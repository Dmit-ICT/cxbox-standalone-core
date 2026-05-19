require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');

const setupRouter = require('./routes/setup');
const webhookRouter = require('./routes/webhook');
const chatwootCallbackRouter = require('./routes/chatwootCallback');

// Start BullMQ workers
require('./workers/inboundWorker');
require('./workers/outboundWorker');

const app = express();
app.use(express.json());

// Bull Board — queue monitor UI at /queues (dev/staging only)
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/queues');
const connection = { url: process.env.REDIS_URL };
createBullBoard({
  queues: [
    new BullMQAdapter(new Queue('lazada-inbound', { connection })),
    new BullMQAdapter(new Queue('lazada-outbound', { connection })),
  ],
  serverAdapter,
});
app.use('/queues', serverAdapter.getRouter());

// Internal: called by Chatwoot UI setup form
app.use('/internal/setup', setupRouter);

// Internal: called by Chatwoot Channel::Api on agent reply
app.use('/internal/chatwoot-callback', chatwootCallbackRouter);

// External: called by Lazada Open Platform on buyer message
app.use('/webhooks/lazada', webhookRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`adapter-lazada listening on :${port}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
