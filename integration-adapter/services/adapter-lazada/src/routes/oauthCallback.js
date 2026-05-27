const { Router } = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { ShopInbox } = require('@cxbox/adapter-core');

const router = Router();

const LAZADA_AUTH_URL = 'https://auth.lazada.com/rest/auth/token/create';

function generateSign(apiPath, params, appSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map(key => `${key}${params[key]}`)
    .join('');
  const message = apiPath + sorted;
  return crypto.createHmac('sha256', appSecret).update(message).digest('hex').toUpperCase();
}

// Called server-to-server by the Rails lazada_chat/callbacks_controller after
// Lazada redirects the browser back with ?code=XXX&state=YYY.
// Exchanges the auth code for tokens and persists them on the ShopInbox.
router.post('/', async (req, res) => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (req.headers['x-internal-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { code, inbox_id } = req.body;
  if (!code || !inbox_id) {
    return res.status(400).json({ error: 'Missing code or inbox_id' });
  }

  const shopInbox = await ShopInbox.findOne({ platform: 'lazada', chatwoot_inbox_id: Number(inbox_id) });
  if (!shopInbox) {
    return res.status(404).json({ error: 'Inbox not found' });
  }

  const { app_key, app_secret } = shopInbox;
  const timestamp = Date.now().toString();

  const signParams = { app_key, code, sign_method: 'sha256', timestamp };
  const sign = generateSign('/auth/token/create', signParams, app_secret);

  let tokenData;
  try {
    const response = await axios.get(LAZADA_AUTH_URL, {
      params: { ...signParams, sign },
    });
    tokenData = response.data;
  } catch (err) {
    console.error('Lazada token exchange failed:', err.response?.data || err.message);
    return res.status(502).json({ error: 'Failed to exchange code for token' });
  }

  if (tokenData.code && tokenData.code !== '0') {
    console.error('Lazada token error:', tokenData);
    return res.status(400).json({ error: tokenData.message || 'Lazada token exchange error' });
  }

  const { access_token, refresh_token, expires_in, account_id, country } = tokenData;
  // Lazada returns `account_id` (not `shop_id`) as the numeric seller identifier.
  // country_user_info[0].seller_id is the same value as a string.
  const sellerId =
    (tokenData.country_user_info && tokenData.country_user_info[0]?.seller_id) ||
    String(account_id);

  await ShopInbox.findOneAndUpdate(
    { platform: 'lazada', chatwoot_inbox_id: Number(inbox_id) },
    {
      seller_id: sellerId,
      region: country || shopInbox.region,
      access_token,
      refresh_token,
      token_expires_at: new Date(Date.now() + Number(expires_in) * 1000),
    },
    { new: true }
  );

  return res.json({ ok: true, inbox_id: shopInbox.chatwoot_inbox_id });
});

module.exports = router;
