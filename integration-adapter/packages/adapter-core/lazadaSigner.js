const crypto = require('crypto');

const REGION_BASE_URLS = {
  vn: 'https://api.lazada.vn/rest',
  sg: 'https://api.lazada.sg/rest',
  ph: 'https://api.lazada.com.ph/rest',
  my: 'https://api.lazada.com.my/rest',
  th: 'https://api.lazada.co.th/rest',
  id: 'https://api.lazada.co.id/rest',
};

function getBaseUrl(region) {
  const url = REGION_BASE_URLS[region?.toLowerCase()];
  if (!url) throw new Error(`Unsupported Lazada region: "${region}"`);
  return url;
}

// Algorithm (Lazada Open Platform spec):
//   1. Sort all params by key (ascending).
//   2. Concatenate as `${apiPath}${k1}${v1}${k2}${v2}...`
//   3. HMAC-SHA256 over that string, keyed by appSecret, hex-encoded, UPPERCASE.
function generateSign(apiPath, params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let paramStr = '';
  for (const key of sortedKeys) paramStr += key + params[key];
  return crypto
    .createHmac('sha256', appSecret)
    .update(Buffer.from(apiPath + paramStr, 'utf-8'))
    .digest('hex')
    .toUpperCase();
}

module.exports = { getBaseUrl, generateSign };
