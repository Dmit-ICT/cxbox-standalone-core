# Sending Messages to a Lazada Buyer via Lazada Open Platform API

This guide explains how to send a text or image message to a Lazada buyer
inside an existing chat session. It is extracted from `LazadaReplyService`
in this project and is intended as a standalone reference for any project
that needs to call the Lazada Chat API.

---

## Prerequisites

| Item | Where to get it |
|------|----------------|
| `app_key` | Lazada Open Platform developer console |
| `app_secret` | Lazada Open Platform developer console |
| `access_token` | OAuth token with **chat scope** (see [Token section](#token)) |
| `refresh_token` | Returned alongside `access_token` during OAuth |
| `session_id` | Lazada chat session/thread ID (from an incoming chat event) |
| `region` | Country code of the shop (`th`, `sg`, `ph`, `my`, `vn`, `id`) |

---

## Base URLs by Region

```
th  →  https://api.lazada.co.th/rest
sg  →  https://api.lazada.sg/rest
ph  →  https://api.lazada.com.ph/rest
my  →  https://api.lazada.com.my/rest
vn  →  https://api.lazada.vn/rest
id  →  https://api.lazada.co.id/rest
```

---

## Step 1 — Build the Signature

Every Lazada API call requires an HMAC-SHA256 signature appended as the
`sign` query parameter.

**Algorithm:**

1. Collect all query parameters (excluding `sign` itself).
2. Sort the keys alphabetically (ascending, byte order).
3. Concatenate as: `<apiPath><key1><value1><key2><value2>...`
4. HMAC-SHA256 the result using `app_secret` as the key.
5. Hex-encode and uppercase the digest.

**TypeScript example:**

```typescript
import * as crypto from 'crypto';

function generateLazadaSign(
  apiPath: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const sortedKeys = Object.keys(params).sort();
  let paramString = '';
  for (const key of sortedKeys) {
    paramString += key + params[key];
  }
  const concatString = apiPath + paramString;
  return crypto
    .createHmac('sha256', appSecret)
    .update(Buffer.from(concatString, 'utf-8'))
    .digest('hex')
    .toUpperCase();
}
```

**Python example:**

```python
import hmac, hashlib

def generate_lazada_sign(api_path: str, params: dict, app_secret: str) -> str:
    sorted_keys = sorted(params.keys())
    param_string = ''.join(k + params[k] for k in sorted_keys)
    concat_string = api_path + param_string
    return hmac.new(
        app_secret.encode('utf-8'),
        concat_string.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest().upper()
```

---

## Step 2 — Send a Text Message

**Endpoint:** `POST {baseUrl}/im/message/send`

All parameters are sent as **query string** (not as a request body).

**Required parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `app_key` | string | Your Lazada app key |
| `timestamp` | string | Current Unix time in **milliseconds** |
| `access_token` | string | Chat OAuth access token |
| `sign_method` | string | Always `"sha256"` |
| `sign` | string | Signature from Step 1 |
| `session_id` | string | Lazada chat session ID |
| `template_id` | string | `"1"` for text messages |
| `txt` | string | The message text to deliver |

**Example (TypeScript / axios):**

```typescript
const baseUrl = 'https://api.lazada.co.th/rest'; // adjust region
const apiPath = '/im/message/send';

const params: Record<string, string> = {
  app_key:      APP_KEY,
  timestamp:    Date.now().toString(),
  access_token: ACCESS_TOKEN,
  sign_method:  'sha256',
  session_id:   SESSION_ID,
  template_id:  '1',
  txt:          'Hello! How can I help you today?',
};

const sign = generateLazadaSign(apiPath, params, APP_SECRET);

const response = await axios.post(`${baseUrl}${apiPath}`, null, {
  params: { ...params, sign },
  timeout: 15_000,
});

// Success: response.data.code === "0"
```

**Example (Python / requests):**

```python
import time, requests

base_url = 'https://api.lazada.co.th/rest'
api_path = '/im/message/send'

params = {
    'app_key':      APP_KEY,
    'timestamp':    str(int(time.time() * 1000)),
    'access_token': ACCESS_TOKEN,
    'sign_method':  'sha256',
    'session_id':   SESSION_ID,
    'template_id':  '1',
    'txt':          'Hello! How can I help you today?',
}
params['sign'] = generate_lazada_sign(api_path, params, APP_SECRET)

response = requests.post(f'{base_url}{api_path}', params=params, timeout=15)
data = response.json()
# Success: data['code'] == '0'
```

**Success response:**

```json
{ "code": "0", "request_id": "...", "result": {} }
```

---

## Step 3 — Send an Image Message (two-step)

Sending an image requires uploading the file to Lazada's CDN first, then
sending the CDN URL as a message.

### 3a — Upload the image

**Endpoint:** `POST {baseUrl}/image/upload`  
**Content-Type:** `multipart/form-data`

Include the signature params in the form fields (not as query string):

| Field | Value |
|-------|-------|
| `image` | Binary image file |
| `app_key` | Your app key |
| `timestamp` | Unix ms |
| `access_token` | Chat access token |
| `sign_method` | `"sha256"` |
| `sign` | Signature (sign the non-image params only) |

**Example (TypeScript / axios + form-data):**

```typescript
import * as FormData from 'form-data';

const apiPath = '/image/upload';
const timestamp = Date.now().toString();

const uploadParams: Record<string, string> = {
  app_key:      APP_KEY,
  timestamp,
  access_token: ACCESS_TOKEN,
  sign_method:  'sha256',
};
const sign = generateLazadaSign(apiPath, uploadParams, APP_SECRET);

const form = new FormData();
form.append('image', imageBuffer, { filename: 'image.jpg' });
form.append('app_key', APP_KEY);
form.append('timestamp', timestamp);
form.append('access_token', ACCESS_TOKEN);
form.append('sign_method', 'sha256');
form.append('sign', sign);

const uploadResp = await axios.post(`${baseUrl}${apiPath}`, form, {
  headers: { ...form.getHeaders() },
  timeout: 30_000,
});

const imgUrl: string = uploadResp.data.data.image.url;
```

### 3b — Send the image message

Same endpoint as text (`/im/message/send`) but with `template_id: "3"`:

| Parameter | Value |
|-----------|-------|
| `template_id` | `"3"` for image |
| `img_url` | CDN URL from step 3a |
| `width` | Image width in pixels (e.g. `400`) |
| `height` | Image height in pixels (e.g. `400`) |

```typescript
const sendParams: Record<string, string> = {
  app_key:      APP_KEY,
  timestamp:    Date.now().toString(),
  access_token: ACCESS_TOKEN,
  sign_method:  'sha256',
  session_id:   SESSION_ID,
  template_id:  '3',
  img_url:      imgUrl,
  width:        '400',
  height:       '400',
};
const sign = generateLazadaSign('/im/message/send', sendParams, APP_SECRET);

await axios.post(`${baseUrl}/im/message/send`, null, {
  params: { ...sendParams, sign },
  timeout: 15_000,
});
```

---

## Token

Use the **chat-scoped token** (not the general seller profile token). These
are separate token sets in Lazada:

| Token type | Scope |
|------------|-------|
| `lazada_profile_token` | General seller API (orders, products, etc.) |
| `lazada_chat_token` | Chat API only — required for `/im/message/send` |

Obtain a chat token by authorizing your app via the Lazada OAuth flow with
the `im` (Instant Messaging) permission scope selected.

---

## Token Refresh

When the API returns `code: "IllegalAccessToken"`, the token has expired.
Refresh it before retrying:

**Endpoint:** `GET https://auth.lazada.com/rest/auth/token/refresh`

| Parameter | Value |
|-----------|-------|
| `app_key` | Your app key |
| `timestamp` | Unix ms |
| `sign_method` | `"sha256"` |
| `access_token` | The expired access token |
| `refresh_token` | The refresh token |
| `sign` | Signature (sign path `/auth/token/refresh` + params) |

```typescript
const authParams: Record<string, string> = {
  app_key:       APP_KEY,
  sign_method:   'sha256',
  timestamp:     Date.now().toString(),
  access_token:  expiredAccessToken,
  refresh_token: refreshToken,
};
const sign = generateLazadaSign('/auth/token/refresh', authParams, APP_SECRET);

const resp = await axios.get('https://auth.lazada.com/rest/auth/token/refresh', {
  params: { ...authParams, sign },
  timeout: 15_000,
});

const newAccessToken: string = resp.data.access_token;
const newRefreshToken: string = resp.data.refresh_token;
// Persist both tokens immediately for future use.
```

Retry the original send after obtaining the new `access_token`.
Recommended retry limit: **3 attempts**.

---

## Error Codes

| `code` | Meaning |
|--------|---------|
| `"0"` | Success |
| `"IllegalAccessToken"` | Token expired — refresh and retry |
| `"NoImageUrl"` | Image upload did not return a CDN URL |
| HTTP 4xx / 5xx | Network or upstream error — log and surface |

---

## Complete Flow Diagram

```
Your app
  │
  ├─ 1. Build params (app_key, timestamp, access_token, session_id, txt, ...)
  ├─ 2. Sign:  HMAC-SHA256( "/im/message/send" + sorted_params, app_secret )
  ├─ 3. POST {baseUrl}/im/message/send?{params}&sign={sign}
  │
  │         Lazada API
  │           ├─ code "0"                 → success ✓
  │           └─ code "IllegalAccessToken"
  │                 │
  │                 ├─ GET auth.lazada.com/rest/auth/token/refresh
  │                 ├─ Store new access_token + refresh_token
  │                 └─ Retry POST /im/message/send  (max 3 attempts)
  │
  └─ For images:
       ├─ 3a. POST {baseUrl}/image/upload  (multipart) → imgUrl
       └─ 3b. POST /im/message/send  with template_id=3 + img_url
```

---

## Reference

- Source implementation: `worker/src/zd-bot/lazada-reply.service.ts`
- Signature helper: `worker/src/lazada-proxy/lazada-signer.ts`
- Lazada Open Platform docs: https://open.lazada.com/apps/doc/doc.htm
