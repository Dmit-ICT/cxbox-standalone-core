const { Router } = require('express');
const { ShopInbox, chatwootClient } = require('@cxbox/adapter-core');

const router = Router();

const LAZADA_AUTH_HOST = 'https://auth.lazada.com';
const LAZADA_OAUTH_PATH = '/oauth/authorize';

// Called by Lazada.vue after admin enters App Chat Key, App Chat Secret, and Region.
// Creates the Chatwoot API Channel inbox, stores partial credentials, and returns
// the Lazada OAuth URL for the admin to authorize the shop.
router.post('/', async (req, res) => {
  const { inbox_name, app_key, app_secret, region } = req.body;

  if (!inbox_name || !app_key || !app_secret || !region) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const selfUrl = process.env.ADAPTER_LAZADA_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
  const redirectUri = process.env.LAZADA_OAUTH_REDIRECT_URI;

  if (!redirectUri) {
    return res.status(500).json({ error: 'LAZADA_OAUTH_REDIRECT_URI is not configured' });
  }

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

  // Persist partial shop → inbox mapping (seller_id and tokens populated after OAuth)
  await ShopInbox.findOneAndUpdate(
    { platform: 'lazada', chatwoot_inbox_id: inbox.id },
    {
      platform: 'lazada',
      chatwoot_account_id: Number(accountId),
      chatwoot_inbox_id: inbox.id,
      region,
      app_key,
      app_secret,
    },
    { upsert: true, new: true }
  );

  // Encode account_id and inbox_id in the OAuth state so the callback controller
  // can look up the correct ShopInbox without needing cookies or sessions.
  const state = Buffer.from(JSON.stringify({ account_id: Number(accountId), inbox_id: inbox.id })).toString('base64');

  const oauthUrl =
    `${LAZADA_AUTH_HOST}${LAZADA_OAUTH_PATH}` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(app_key)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  return res.json({ inbox_id: inbox.id, oauth_url: oauthUrl });
});

module.exports = router;
