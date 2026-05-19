const axios = require('axios');

const client = axios.create({
  baseURL: process.env.CHATWOOT_BASE_URL,
  headers: {
    'api_access_token': process.env.CHATWOOT_API_TOKEN,
    'Content-Type': 'application/json',
  },
});

async function findOrCreateContact(accountId, { name, identifier }) {
  const search = await client.get(`/api/v1/accounts/${accountId}/contacts/search`, {
    params: { q: identifier, include_contacts: true },
  });
  const existing = search.data.payload.find(c => c.identifier === identifier);
  if (existing) return existing;

  const created = await client.post(`/api/v1/accounts/${accountId}/contacts`, {
    name,
    identifier,
  });
  return created.data;
}

async function findOrCreateConversation(accountId, inboxId, contactId, additionalAttributes) {
  const list = await client.get(
    `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`
  );
  const open = list.data.payload.find(
    c => c.inbox_id === inboxId && c.status === 'open'
  );
  if (open) return open;

  const created = await client.post(`/api/v1/accounts/${accountId}/conversations`, {
    inbox_id: inboxId,
    contact_id: contactId,
    additional_attributes: additionalAttributes,
  });
  return created.data;
}

async function createMessage(accountId, conversationId, content) {
  const res = await client.post(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    { content, message_type: 'incoming', private: false }
  );
  return res.data;
}

async function createApiInbox(accountId, { name, webhookUrl }) {
  const res = await client.post(`/api/v1/accounts/${accountId}/inboxes`, {
    name,
    channel: {
      type: 'api',
      webhook_url: webhookUrl,
    },
  });
  return res.data;
}

module.exports = { findOrCreateContact, findOrCreateConversation, createMessage, createApiInbox };
