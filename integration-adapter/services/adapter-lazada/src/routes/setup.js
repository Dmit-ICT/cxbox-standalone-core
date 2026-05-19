const { Router } = require('express');
const { ShopInbox, chatwootClient } = require('@cxbox/adapter-core');

const router = Router();

// Called by Lazada.vue after admin enters credentials.
// Creates the Chatwoot API Channel inbox and stores credentials in MongoDB.
router.post('/', async (req, res) => {
  const { inbox_name, app_key, app_secret, seller_id, region } = req.body;

  if (!inbox_name || !app_key || !app_secret || !seller_id || !region) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const selfUrl = process.env.ADAPTER_LAZADA_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
  const webhookUrl = `${selfUrl}/internal/chatwoot-callback`;

  // Create Channel::Api inbox in Chatwoot with this adapter as the callback endpoint
  let inbox;
  try {
    inbox = await chatwootClient.createApiInbox(accountId, {
      name: inbox_name,
      webhookUrl,
    });
  } catch (err) {
    console.error('Failed to create Chatwoot inbox:', err.message);
    return res.status(502).json({ error: 'Failed to create inbox in Chatwoot' });
  }

  // Persist shop → inbox mapping
  await ShopInbox.findOneAndUpdate(
    { platform: 'lazada', seller_id },
    {
      platform: 'lazada',
      chatwoot_account_id: Number(accountId),
      chatwoot_inbox_id: inbox.id,
      seller_id,
      region,
      app_key,
      app_secret,
    },
    { upsert: true, new: true }
  );

  // Return the Lazada webhook URL the admin must register in the Lazada partner portal
  const lazadaWebhookUrl = `${selfUrl}/webhooks/lazada`;
  return res.json({
    inbox_id: inbox.id,
    lazada_webhook_url: lazadaWebhookUrl,
    message: `Inbox created. Register this webhook URL in the Lazada partner portal: ${lazadaWebhookUrl}`,
  });
});

module.exports = router;
