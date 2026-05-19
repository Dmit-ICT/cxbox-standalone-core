const { Router } = require('express');
const { ShopInbox, ConversationMapping, chatwootClient } = require('@cxbox/adapter-core');
const { Queue } = require('bullmq');

const router = Router();

const inboundQueue = new Queue('lazada-inbound', {
  connection: { url: process.env.REDIS_URL },
});

// Lazada pushes a notification here when a buyer sends a message.
// We validate, enqueue, and return 200 immediately (Lazada has a tight timeout).
router.post('/', async (req, res) => {
  // Acknowledge immediately so Lazada doesn't retry
  res.sendStatus(200);

  const payload = req.body;
  const sellerId = String(payload.seller_id);
  const data = payload.data;

  if (!data || data.from_account_type !== 1) return; // Ignore seller/system messages

  await inboundQueue.add('process', { sellerId, data });
});

module.exports = router;
