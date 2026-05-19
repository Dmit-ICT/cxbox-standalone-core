const { Worker } = require('bullmq');
const { ShopInbox } = require('@cxbox/adapter-core');
const { sendText } = require('../adapter');

const worker = new Worker(
  'lazada-outbound',
  async job => {
    const { session_id, seller_id, content } = job.data;

    const shopInbox = await ShopInbox.findOne({ platform: 'lazada', seller_id });
    if (!shopInbox) throw new Error(`No ShopInbox for seller_id=${seller_id}`);

    await sendText(shopInbox, session_id, content);
  },
  {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  console.error(`lazada-outbound job ${job.id} failed:`, err.message);
});

module.exports = worker;
