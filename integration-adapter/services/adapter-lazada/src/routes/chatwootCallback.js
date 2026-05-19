const { Router } = require('express');
const { Queue } = require('bullmq');

const router = Router();

const outboundQueue = new Queue('lazada-outbound', {
  connection: { url: process.env.REDIS_URL },
});

// Called by Chatwoot's Channel::Api when an agent sends a reply.
// Enqueue to BullMQ for async send to Lazada with retry support.
router.post('/', async (req, res) => {
  res.sendStatus(200);

  const event = req.body;
  if (event.message_type !== 'outgoing') return;

  const attrs = event.conversation?.additional_attributes || {};
  if (!attrs.lazada_session_id) return;

  await outboundQueue.add(
    'send',
    {
      session_id: attrs.lazada_session_id,
      seller_id: attrs.lazada_seller_id,
      content: event.content,
    },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    }
  );
});

module.exports = router;
