const axios = require('axios');
const { generateSign, getBaseUrl } = require('@cxbox/adapter-core');
const { refreshLazadaToken } = require('@cxbox/adapter-core').tokenManager;

function buildParams(shopInbox, apiSpecificParams) {
  return {
    app_key: shopInbox.app_key,
    timestamp: Date.now().toString(),
    sign_method: 'sha256',
    access_token: shopInbox.access_token,
    ...apiSpecificParams,
  };
}

async function sendText(shopInbox, sessionId, text, attempt = 0) {
  const apiPath = '/im/message/send';
  const params = buildParams(shopInbox, {
    session_id: sessionId,
    template_id: '1',
    txt: text,
  });
  params.sign = generateSign(apiPath, params, shopInbox.app_secret);

  const baseUrl = getBaseUrl(shopInbox.region);
  const res = await axios.post(`${baseUrl}${apiPath}`, null, { params });

  if (res.data.code === 'IllegalAccessToken' && attempt < 3) {
    const refreshed = await refreshLazadaToken(shopInbox);
    return sendText(refreshed, sessionId, text, attempt + 1);
  }

  if (res.data.code !== '0') {
    throw new Error(`Lazada sendText failed: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

async function sendImage(shopInbox, sessionId, imageUrl, attempt = 0) {
  const apiPath = '/im/message/send';
  const params = buildParams(shopInbox, {
    session_id: sessionId,
    template_id: '3',
    img_url: imageUrl,
    width: '400',
    height: '400',
  });
  params.sign = generateSign(apiPath, params, shopInbox.app_secret);

  const baseUrl = getBaseUrl(shopInbox.region);
  const res = await axios.post(`${baseUrl}${apiPath}`, null, { params });

  if (res.data.code === 'IllegalAccessToken' && attempt < 3) {
    const refreshed = await refreshLazadaToken(shopInbox);
    return sendImage(refreshed, sessionId, imageUrl, attempt + 1);
  }

  if (res.data.code !== '0') {
    throw new Error(`Lazada sendImage failed: ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

module.exports = { sendText, sendImage };
