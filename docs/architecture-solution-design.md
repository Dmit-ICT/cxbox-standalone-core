# Architecture Solution Design: Shopee & Lazada Chat Integration

## Project: cxbox-standalone-core

**Date:** 2026-05-17  
**Author:** Pakpoom DMIT  
**Purpose:** Design reference for integrating Shopee and Lazada chat platforms into cxbox-standalone-core (customized Chatwoot) as additional Omni-channel inbox providers.

---

## Background & Goals

1. cxbox-standalone-core is a customized Chatwoot instance for integrating e-commerce chat platforms (Shopee, Lazada, TikTok) alongside traditional social channels (LINE, Facebook, WhatsApp).
2. Agents can respond to all customer chats from a single Omni-channel dashboard.
3. E-commerce platforms (Shopee, Lazada) deliver customer messages via webhooks to a configurable endpoint.
4. Chatwoot customization should be kept as minimal as possible.
5. Additional services should be built as separate containers using the preferred tech stack: **Node.js, Express, MongoDB/MySQL** (not Ruby on Rails).

---

## Core Strategy

Chatwoot already provides `Channel::Api` — a webhook-based channel type that supports bidirectional messaging. This is used as the transport layer, keeping Chatwoot changes surgical. All platform-specific complexity (OAuth, token management, API translation) lives in a separate **Integration Adapter** microservice.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          cxbox-standalone-core (Docker Compose)                  │
│                                                                                  │
│  ┌──────────────────────────────┐   ┌─────────────────┐  ┌─────────────────┐   │
│  │  Chatwoot (Ruby on Rails)     │   │  adapter-shopee  │  │  adapter-lazada  │   │
│  │  MINIMAL CHANGES ONLY         │   │  (Node.js)      │  │  (Node.js)      │   │
│  │                               │   │                 │  │                 │   │
│  │  Frontend:                    │   │  • Shopee OAuth  │  │  • Lazada OAuth  │   │
│  │  + Shopee/Lazada tiles in UI  │◄──► • Webhook ingest │  │ • Webhook ingest │   │
│  │  + Setup wizard Vue components│   │  • Chat API send │  │ • Chat API send  │   │
│  │                               │   │  • BullMQ queue  │  │ • BullMQ queue   │   │
│  │  Backend (thin):              │   │                 │  │                 │   │
│  │  + 2 webhook routes           │   │  POST /internal/setup              │   │
│  │  + 2 thin controllers         │   │  POST /webhooks/shopee             │   │
│  │  Uses: Channel::Api (existing)│   │                 │  POST /webhooks/lazada  │   │
│  └──────────────────────────────┘   └─────────────────┘  └─────────────────┘   │
│                                                                                  │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │   PostgreSQL         │  │   Redis           │  │   MongoDB                │   │
│  │  (Chatwoot data)     │  │  (Sidekiq/BullMQ) │  │  (Adapter state, shared)  │   │
│  └─────────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
         ▲                          ▲                         ▲
         │ Chatwoot Public API      │ Shopee Webhooks         │ Lazada Webhooks
         ▼                          ▼                         ▼
    Agent Browser          Shopee Open Platform       Lazada Open Platform
```

### Why separate containers per platform

Each platform adapter runs as an **isolated container**. A crash, memory leak, or hung API call in `adapter-shopee` has zero impact on `adapter-lazada` or any other platform. This is essential for a commercial SaaS where tenants' shops span multiple platforms.

---

## Data Flow

### Flow 1: Admin Sets Up a Shopee Inbox

```
Admin → Chatwoot UI (Shopee tile in Inboxes → New)
  → Enters: App ID, App Secret, Shop ID
  → Chatwoot frontend calls Integration Adapter: POST /internal/setup/shopee
    → Adapter registers webhook with Shopee Open Platform API
    → Adapter creates API Channel Inbox via Chatwoot API
    → Adapter stores mapping in MongoDB:
        { chatwoot_inbox_id, platform: 'shopee', shop_id, app_id, encrypted_tokens }
  → Returns: inbox created ✓, webhook URL confirmed
```

### Flow 2: Customer Message → Agent (Inbound)

```
Customer sends message on Shopee
  → Shopee POSTs webhook to: /webhooks/shopee/:shop_id  (Integration Adapter)
    → Adapter validates Shopee HMAC-SHA256 signature
    → Adapter looks up MongoDB: shop_id → chatwoot_inbox_id
    → Adapter calls Chatwoot API:
        POST /api/v1/accounts/{id}/conversations   (find or create conversation)
        POST /api/v1/accounts/{id}/conversations/{id}/messages  (create message)
  → Chatwoot shows message in agent dashboard (real-time via ActionCable)
```

### Flow 3: Agent Reply → Customer (Outbound)

```
Agent types reply in Chatwoot → clicks Send
  → Chatwoot triggers API Channel webhook callback:
        POST {webhook_url} with message payload
        (webhook_url is set to Integration Adapter outbound endpoint)
  → Adapter receives: POST /internal/chatwoot-callback
    → Reads conversation.additional_attributes.platform = 'shopee'
    → Reads conversation.additional_attributes.buyer_user_id
    → Calls Shopee Chat API: POST /v2/sellerchat/send_message
  → Customer receives reply on Shopee app
```

---

## Chatwoot Changes (Minimal)

| Layer | Change | Notes |
|---|---|---|
| Rails models | **None** | Reuse existing `Channel::Api` |
| DB migrations | **None** | No new tables |
| Rails routes | +2 lines | Shopee + Lazada webhook routes |
| Rails controllers | +2 thin files | Validate signature → enqueue job → Adapter |
| Vue channel forms | +2 new components | Copy Line.vue pattern |
| Vue channel picker | Edit 1 file (`ChannelFactory.vue`) | Add Shopee/Lazada to channelViewList |
| i18n | +entries in `en.json` | Channel names and labels only |

### Backend (Rails) — Files to Add

```ruby
# app/controllers/webhooks/shopee_controller.rb
class Webhooks::ShopeeController < ActionController::API
  def process_payload
    ShopeeWebhookJob.perform_later(
      params: params.to_unsafe_hash,
      headers: request.headers.to_h
    )
    head :ok
  end
end

# app/controllers/webhooks/lazada_controller.rb  (same pattern)
```

```ruby
# config/routes.rb — add 2 lines under existing webhook routes:
post 'webhooks/shopee/:shop_id', to: 'webhooks/shopee#process_payload'
post 'webhooks/lazada/:seller_id', to: 'webhooks/lazada#process_payload'
```

### Frontend (Vue.js) — Files to Add/Edit

| File | Action |
|---|---|
| `channels/Shopee.vue` | New — setup form (App ID, App Secret, Shop ID) |
| `channels/Lazada.vue` | New — setup form (App Key, App Secret) |
| `ChannelFactory.vue` | Edit — add `shopee` and `lazada` to `channelViewList` |
| Channel picker page | Edit — add Shopee/Lazada tiles (same pattern as Line/Telegram) |

---

## Integration Adapter (Per-Platform Services)

### Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express
- **Database:** MongoDB (via Mongoose, shared instance, isolated by platform)
- **Queue:** BullMQ (backed by Redis, separate queue name per platform)
- **HTTP client:** axios
- **Container:** Docker — **one container per platform**

### Project Structure

Each platform is a standalone service. Shared logic lives in `packages/adapter-core` — an internal package consumed by each service.

```
integration-adapter/
├── packages/
│   └── adapter-core/               # shared internal npm package
│       ├── chatwootClient.js      # Chatwoot API wrapper
│       ├── tokenManager.js        # OAuth token refresh logic (generic)
│       ├── messageMapper.js       # Base message format helpers
│       ├── models/
│       │   ├── ShopInbox.js       # MongoDB: shop → inbox mapping
│       │   └── Conversation.js    # MongoDB: platform conv ID ↔ Chatwoot conv ID
│       └── package.json
│
├── services/
│   ├── adapter-shopee/             # Shopee container (independent)
│   │   ├── src/
│   │   │   ├── adapter.js         # Shopee Open Platform API client
│   │   │   ├── routes/
│   │   │   │   ├── setup.js       # POST /internal/setup
│   │   │   │   └── webhook.js     # POST /webhooks/shopee
│   │   │   └── workers/
│   │   │       └── outboundQueue.js  # BullMQ: shopee-outbound queue
│   │   ├── Dockerfile
│   │   └── package.json           # depends on adapter-core
│   │
│   └── adapter-lazada/             # Lazada container (independent)
│       ├── src/
│       │   ├── adapter.js         # Lazada Open Platform API client
│       │   ├── routes/
│       │   │   ├── setup.js       # POST /internal/setup
│       │   │   └── webhook.js     # POST /webhooks/lazada
│       │   └── workers/
│       │       └── outboundQueue.js  # BullMQ: lazada-outbound queue
│       ├── Dockerfile
│       └── package.json           # depends on adapter-core
│
└── package.json                   # workspace root (pnpm/npm workspaces)
```

### Adding a new platform

1. Create `services/adapter-{platform}/` following the same structure above
2. Add the new service to `docker-compose.yml`
3. Add the setup form Vue component in Chatwoot frontend

No changes to existing platform services are required.

### MongoDB Schemas

```js
// ShopInbox — maps a platform shop to a Chatwoot inbox
{
  platform: 'shopee' | 'lazada',
  chatwoot_account_id: Number,
  chatwoot_inbox_id: Number,
  shop_id: String,          // Shopee shop ID / Lazada seller ID
  app_id: String,
  app_secret: String,       // encrypted at rest
  access_token: String,     // encrypted
  refresh_token: String,    // encrypted
  token_expires_at: Date,
}

// ConversationMapping — correlates platform conversation to Chatwoot
{
  platform: 'shopee' | 'lazada',
  platform_conversation_id: String,  // Shopee: conversation_id
  platform_buyer_id: String,
  chatwoot_contact_id: Number,
  chatwoot_conversation_id: Number,
  chatwoot_inbox_id: Number,
}
```

---

## Infrastructure: Docker Compose

Each platform runs as an isolated container. A failure in `adapter-shopee` does not affect `adapter-lazada` or any other service.

```yaml
# Additions to docker-compose.yml

services:
  # ... existing Chatwoot services unchanged ...

  adapter-shopee:
    build: ./integration-adapter/services/adapter-shopee
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/cxbox_adapter
      - CHATWOOT_BASE_URL=http://chatwoot:3000
      - CHATWOOT_API_TOKEN=${CHATWOOT_API_TOKEN}
      - ENCRYPTION_KEY=${ADAPTER_ENCRYPTION_KEY}
      - REDIS_URL=redis://redis:6379/2
      - PLATFORM=shopee
    restart: unless-stopped
    depends_on:
      - mongo
      - redis

  adapter-lazada:
    build: ./integration-adapter/services/adapter-lazada
    ports:
      - "3002:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/cxbox_adapter
      - CHATWOOT_BASE_URL=http://chatwoot:3000
      - CHATWOOT_API_TOKEN=${CHATWOOT_API_TOKEN}
      - ENCRYPTION_KEY=${ADAPTER_ENCRYPTION_KEY}
      - REDIS_URL=redis://redis:6379/3
      - PLATFORM=lazada
    restart: unless-stopped
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:7
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

> Each platform uses a dedicated Redis DB index (`/2`, `/3`, ...) to keep BullMQ queues fully isolated.

---

## Platform API Notes

### Shopee Open Platform

- Webhook push for new chat messages
- Chat API: `GET /v2/sellerchat/get_message`, `POST /v2/sellerchat/send_message`
- Auth: OAuth2 with 30-day access tokens + refresh tokens
- Webhook signature: HMAC-SHA256 with app secret
- API access requires partner program approval from Shopee

### Lazada Open Platform

- IM API available; webhook support for chat events
- Auth: OAuth2 (same pattern as Shopee)
- Webhook registration via Lazada partner portal
- API access requires seller/partner account approval

---

## Implementation Phases

### Phase 1 — Foundation (1–2 weeks)

- Scaffold `integration-adapter/` workspace with `packages/adapter-core` and `services/adapter-shopee`, `services/adapter-lazada`
- Add both adapter containers to Docker Compose
- Implement MongoDB models + Chatwoot API client in `adapter-core`
- Add Shopee/Lazada tiles to Chatwoot Inboxes UI (frontend only, non-functional)

### Phase 2 — Shopee Integration (2–3 weeks)

- Implement Shopee adapter (OAuth, webhook validation, Chat API)
- Implement inbound flow: Shopee → Adapter → Chatwoot
- Implement outbound flow: Chatwoot webhook callback → Adapter → Shopee
- Shopee setup wizard in Chatwoot UI (functional end-to-end)

### Phase 3 — Lazada Integration (1–2 weeks)

- Reuse Adapter infrastructure, add Lazada adapter
- Lazada setup wizard in Chatwoot UI

### Phase 4 — Polish & Reliability

- Token refresh scheduling via BullMQ cron jobs
- Failed message retry queue with exponential backoff
- Inbox settings page: show token status, reconnect button
- Logging and observability (structured JSON logs)

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Chatwoot channel backend | Reuse `Channel::Api` | Zero new Rails models or DB migrations |
| Credential storage | MongoDB in Adapter only | Shopee/Lazada tokens never touch Chatwoot DB |
| Webhook reception | Thin Rails controller → Sidekiq job | Responds to platform in <1s (platform timeout requirement) |
| Message queue | BullMQ on Redis | Retry failed outbound sends without losing messages |
| Token security | Encrypted at rest in MongoDB | Using `ENCRYPTION_KEY` env var |
| Container isolation | One container per platform | Fault isolation: Shopee crash/OOM/memory leak does not affect Lazada or other platforms — critical for commercial SaaS |
| Shared code | `packages/adapter-core` internal npm package | Avoids duplication of Chatwoot client, token manager, and MongoDB models across platform services |
| Redis isolation | Separate Redis DB index per platform | BullMQ queues are fully isolated; one platform's queue backlog cannot starve another |
| Future platforms | New `services/adapter-{platform}/` service | Add a new container following the same pattern; zero changes to existing platforms |
