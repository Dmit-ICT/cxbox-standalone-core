# Lazada Integration — Customization Steps

**Date:** 2026-05-17  
**Branch:** staging  
**Reference:** [architecture-solution-design.md](./architecture-solution-design.md)

---

## Overview

This document records every file created or modified to integrate Lazada Live Chat into cxbox-standalone-core as an Omni-channel inbox. The integration follows the per-platform isolated container pattern defined in the architecture design.

---

## Files Created

### 1. Integration Adapter Workspace Root

**`integration-adapter/package.json`**  
pnpm/npm workspaces root that links `packages/*` and `services/*` together so `adapter-lazada` can resolve `@cxbox/adapter-core` as a local package without publishing to npm.

---

### 2. Shared Package — `adapter-core`

All files under `integration-adapter/packages/adapter-core/`.

| File | Purpose |
|---|---|
| `package.json` | Declares `@cxbox/adapter-core` with `axios` and `mongoose` dependencies |
| `index.js` | Barrel export for all modules |
| `lazadaSigner.js` | HMAC-SHA256 request signing (ported from `cxbox-laz-to-zd`). Exports `generateSign(apiPath, params, appSecret)` and `getBaseUrl(region)`. Regional base URLs for TH, SG, MY, PH, VN, ID |
| `chatwootClient.js` | Chatwoot REST API wrapper. Functions: `findOrCreateContact`, `findOrCreateConversation`, `createMessage`, `createApiInbox`. Uses `CHATWOOT_BASE_URL` + `CHATWOOT_API_TOKEN` env vars |
| `tokenManager.js` | Refreshes a Lazada OAuth access token using the refresh token. Calls `https://auth.lazada.com/rest/auth/token/refresh`, persists new tokens to MongoDB `ShopInbox` document |
| `models/ShopInbox.js` | Mongoose model — maps a Lazada seller shop to a Chatwoot inbox. Fields: `platform`, `chatwoot_account_id`, `chatwoot_inbox_id`, `seller_id`, `region`, `app_key`, `app_secret`, `access_token`, `refresh_token`, `token_expires_at` |
| `models/ConversationMapping.js` | Mongoose model — correlates a Lazada `session_id` to a Chatwoot conversation. Fields: `platform`, `platform_session_id`, `platform_buyer_id`, `seller_id`, `chatwoot_contact_id`, `chatwoot_conversation_id`, `chatwoot_inbox_id` |

---

### 3. Lazada Adapter Service

All files under `integration-adapter/services/adapter-lazada/`.

| File | Purpose |
|---|---|
| `package.json` | Node.js service dependencies: `express`, `bullmq`, `mongoose`, `axios`, `dotenv`, `@cxbox/adapter-core` |
| `Dockerfile` | Multi-stage build — copies workspace root + `adapter-core` + `adapter-lazada`, installs production deps, runs `node src/app.js` on port 3001 |
| `.env.example` | Documents all required environment variables (copy to `.env` for local dev) |
| `src/app.js` | Express entry point. Mounts all routes, starts BullMQ workers, connects to MongoDB. Exits on DB connection failure |
| `src/adapter.js` | Lazada Chat API client. `sendText(shopInbox, sessionId, text)` and `sendImage(shopInbox, sessionId, imgUrl)`. Both auto-refresh the access token on `IllegalAccessToken` response (up to 3 retries) |
| `src/routes/setup.js` | `POST /internal/setup` — called by `Lazada.vue` when admin creates a new inbox. Creates a `Channel::Api` inbox in Chatwoot (webhook URL = this adapter's callback endpoint), stores credentials in MongoDB `ShopInbox`, returns the Lazada webhook URL the admin must register in the Lazada partner portal |
| `src/routes/webhook.js` | `POST /webhooks/lazada` — receives Lazada push notification when a buyer sends a message. Acknowledges immediately (200 OK), filters out seller/system messages (`from_account_type !== 1`), enqueues to `lazada-inbound` BullMQ queue |
| `src/routes/chatwootCallback.js` | `POST /internal/chatwoot-callback` — called by Chatwoot `Channel::Api` when an agent sends a reply. Reads `conversation.additional_attributes.lazada_session_id` and enqueues to `lazada-outbound` BullMQ queue with exponential backoff retry (5 attempts) |
| `src/workers/inboundWorker.js` | BullMQ worker on `lazada-inbound` queue. Looks up `ShopInbox` by `seller_id`, finds or creates Chatwoot contact + conversation (with Lazada metadata in `additional_attributes`), creates the incoming message in Chatwoot |
| `src/workers/outboundWorker.js` | BullMQ worker on `lazada-outbound` queue. Looks up `ShopInbox` by `seller_id`, calls `adapter.sendText()` to deliver the agent reply to the buyer on Lazada |

---

## Files Modified

### 4. Chatwoot Frontend

| File | Change |
|---|---|
| `app/javascript/dashboard/routes/dashboard/settings/inbox/channels/Lazada.vue` | **New** — setup form with fields: Inbox Name, App Key, App Secret, Seller ID, Region (dropdown: TH/SG/MY/PH/VN/ID). On submit, calls `adapter-lazada /internal/setup`. On success, routes to Add Agents step |
| `app/javascript/dashboard/routes/dashboard/settings/inbox/ChannelFactory.vue` | Added `import Lazada` and registered `lazada: Lazada` in `channelViewList` |
| `app/javascript/dashboard/routes/dashboard/settings/inbox/ChannelList.vue` | Added Lazada tile entry (key: `lazada`, icon: `i-woot-api`) after the Line tile |
| `app/javascript/dashboard/i18n/locale/en/inboxMgmt.json` | Added `INBOX_MGMT.ADD.LAZADA.*` keys for the setup form, and `INBOX_MGMT.ADD.AUTH.CHANNEL.LAZADA.*` keys for the channel picker tile |

### 5. Docker Compose

| File | Change |
|---|---|
| `docker-compose.yaml` | Added `mongo` service (mongo:7 image, `mongo_data` volume) and `adapter-lazada` service (port 3002→3001, env vars, depends on mongo + redis). Added `mongo_data` to the top-level `volumes` block |

---

## Environment Variables Required

There are two separate `.env` files depending on how the service is run.

### Root `.env` — `cxbox-standalone-core/.env`

Used by Docker Compose variable substitution (`${VAR}`) to inject values into the `adapter-lazada` container at runtime. Add these alongside the existing Chatwoot variables:

```bash
# SaaS system-level token — one value for the whole platform, NOT per tenant.
# Must be a Super Admin user's token (Profile Settings → Access Token).
# A Super Admin token can access all tenant accounts.
CHATWOOT_API_TOKEN=

# The Chatwoot account ID where Lazada inboxes will be created (usually 1)
CHATWOOT_ACCOUNT_ID=1

# Public URL where adapter-lazada is reachable from outside (Lazada needs to POST here)
# Local dev: use ngrok → https://abc123.ngrok.io
# Production: https://adapter-lazada.yourdomain.com
ADAPTER_LAZADA_PUBLIC_URL=

# Shared secret for internal API calls
ADAPTER_INTERNAL_API_SECRET=
```

### Service `.env` — `integration-adapter/services/adapter-lazada/.env`

Only needed when running `adapter-lazada` locally with `node src/app.js` **outside Docker**. Copy from `.env.example` and fill in the same values:

```bash
cp integration-adapter/services/adapter-lazada/.env.example \
   integration-adapter/services/adapter-lazada/.env
```

> When running via `docker-compose up`, the root `.env` is the only file needed — Docker Compose injects the vars into the container and `dotenv` inside the service reads them from the process environment.

---

## Data Flows

### Flow 1 — Admin Sets Up a Lazada Inbox

```
Admin → Settings → Inboxes → New → Lazada tile
  → Fills: Inbox Name, App Key, App Secret, Seller ID, Region
  → Lazada.vue POSTs to adapter-lazada: POST /internal/setup
    → adapter-lazada creates Channel::Api inbox in Chatwoot
    → adapter-lazada stores ShopInbox in MongoDB
    → Returns: { inbox_id, lazada_webhook_url }
  → Admin registers lazada_webhook_url in Lazada Partner Portal
  → Chatwoot routes to Add Agents step
```

### Flow 2 — Customer Message → Agent (Inbound)

```
Buyer sends message on Lazada
  → Lazada POSTs to: POST /webhooks/lazada  (adapter-lazada)
    → adapter-lazada returns 200 immediately
    → Enqueues to BullMQ lazada-inbound queue
    → inboundWorker processes:
        - Looks up ShopInbox by seller_id
        - Finds or creates Chatwoot contact (identifier: lazada:{buyer_id})
        - Finds or creates Chatwoot conversation (stores lazada_session_id in additional_attributes)
        - Creates incoming message in Chatwoot
  → Message appears in agent dashboard (real-time via ActionCable)
```

### Flow 3 — Agent Reply → Customer (Outbound)

```
Agent types reply in Chatwoot → clicks Send
  → Chatwoot Channel::Api triggers webhook callback:
        POST /internal/chatwoot-callback  (adapter-lazada)
    → adapter-lazada returns 200 immediately
    → Enqueues to BullMQ lazada-outbound queue (5 retries, exponential backoff)
    → outboundWorker processes:
        - Reads session_id + seller_id from job data
        - Looks up ShopInbox by seller_id
        - Calls Lazada Chat API: POST /im/message/send
        - Auto-refreshes token if expired (up to 3 attempts)
  → Buyer receives reply on Lazada app
```

---

## How to Run the Integration

### Step 1 — Set environment variables

**Docker (primary):** add these to `cxbox-standalone-core/.env` (the root `.env`). Docker Compose reads this file and injects the values into the `adapter-lazada` container:

```bash
CHATWOOT_API_TOKEN=         # Super Admin user's API token — one value for all tenants
CHATWOOT_ACCOUNT_ID=1
ADAPTER_LAZADA_PUBLIC_URL=  # e.g. https://abc123.ngrok.io (local) or https://adapter-lazada.yourdomain.com (prod)
ADAPTER_INTERNAL_API_SECRET=changeme
```

**Local dev without Docker:** copy the service `.env.example` instead:

```bash
cp integration-adapter/services/adapter-lazada/.env.example \
   integration-adapter/services/adapter-lazada/.env
# then fill in the values in that file
```

### Step 2 — Install npm workspace packages (local dev only)

```bash
cd integration-adapter
npm install
```

This creates the symlink so `adapter-lazada` resolves `@cxbox/adapter-core` locally.

### Step 3 — Start the new services

```bash
docker-compose up mongo adapter-lazada
```

Verify health:

```bash
curl http://localhost:3002/health
# → {"ok":true}
```

### Step 4 — Restart Rails (picks up new `chatwootConfig` key)

```bash
# overmind:
overmind restart rails
# or docker:
docker-compose restart rails
```

This makes `window.chatwootConfig.adapterLazadaUrl` available in the browser so `Lazada.vue` knows where to call.

### Step 5 — Create a Lazada inbox from the UI

1. Go to **Settings → Inboxes → New**
2. Select the **Lazada** tile
3. Fill in: Inbox Name, App Key, App Secret, Seller ID, Region
4. Click **Create Lazada Inbox**
5. Copy the `lazada_webhook_url` from the response (visible in browser Network tab)

### Step 6 — Register the webhook with Lazada

In the **Lazada Open Platform Partner Portal**:
- Go to your app → Push Notifications / Webhooks
- Register the `lazada_webhook_url` from Step 5
- Enable the IM (instant messaging) push event

> Lazada requires partner program approval before webhook registration is available. This is the primary gating item for production use.

### Step 7 — Test end-to-end

Send a test message from a Lazada buyer account → it should appear as a new conversation in Chatwoot under the Lazada inbox. Reply from Chatwoot → the buyer should receive it on the Lazada app.

---

## Remaining Backlog

- [ ] Add Lazada OAuth authorization flow (currently credentials are entered manually; OAuth requires Lazada partner program approval)
- [ ] Add BullMQ cron job for proactive token refresh before `token_expires_at`
- [ ] Add Lazada webhook signature validation in `src/routes/webhook.js` once Lazada partner portal provides the signing secret
- [ ] Inbox settings page: show token status + reconnect button
- [ ] Structured JSON logging (Winston or Pino) with `seller_id` and `session_id` on every log line
