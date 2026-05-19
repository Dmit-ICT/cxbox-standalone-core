const axios = require('axios');
const { generateSign } = require('./lazadaSigner');
const ShopInbox = require('./models/ShopInbox');

const AUTH_URL = 'https://auth.lazada.com/rest';

// Refreshes the Lazada access token and persists the new tokens to MongoDB.
// Returns the updated ShopInbox document.
async function refreshLazadaToken(shopInbox) {
  const params = {
    app_key: shopInbox.app_key,
    timestamp: Date.now().toString(),
    sign_method: 'sha256',
    access_token: shopInbox.access_token,
    refresh_token: shopInbox.refresh_token,
  };
  params.sign = generateSign('/auth/token/refresh', params, shopInbox.app_secret);

  const res = await axios.get(`${AUTH_URL}/auth/token/refresh`, { params });
  const { access_token, refresh_token, expires_in } = res.data;

  if (!access_token) throw new Error(`Token refresh failed: ${JSON.stringify(res.data)}`);

  const updatedInbox = await ShopInbox.findByIdAndUpdate(
    shopInbox._id,
    {
      access_token,
      refresh_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000),
    },
    { new: true }
  );

  return updatedInbox;
}

module.exports = { refreshLazadaToken };
