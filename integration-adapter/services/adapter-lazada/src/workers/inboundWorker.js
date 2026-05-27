const { Worker } = require('bullmq');
const { ShopInbox, ConversationMapping, chatwootClient } = require('@cxbox/adapter-core');

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseContent(data) {
  if (data.template_id === 1) {
    try {
      const parsed = JSON.parse(data.content);
      const txt = parsed.txt || '';
      // If txt contains HTML, prefer the plain-text summary from ext.summary
      if (/<[a-z][\s\S]*>/i.test(txt)) {
        return parsed.ext?.summary ? stripHtml(parsed.ext.summary) : stripHtml(txt);
      }
      return txt || parsed.ext?.summary || '';
    } catch { return data.content; }
  }
  if (data.template_id === 3) {
    try { return JSON.parse(data.content).imgUrl || '[image]'; } catch { return '[image]'; }
  }
  return data.content || '';
}

const worker = new Worker(
  'lazada-inbound',
  async job => {
    const { sellerId, data } = job.data;

    const shopInbox = await ShopInbox.findOne({ platform: 'lazada', seller_id: sellerId });
    if (!shopInbox) {
      console.warn(`No ShopInbox found for Lazada seller_id=${sellerId}`);
      return;
    }

    const accountId = shopInbox.chatwoot_account_id;
    const inboxId = shopInbox.chatwoot_inbox_id;
    const buyerId = String(data.from_user_id);
    const sessionId = data.session_id;
    const text = parseContent(data);

    // Find or create Chatwoot contact
    const contact = await chatwootClient.findOrCreateContact(accountId, {
      name: `Lazada Buyer ${buyerId}`,
      identifier: `lazada:${buyerId}`,
    });

    // Find or create conversation with Lazada metadata stored in additional_attributes
    let mapping = await ConversationMapping.findOne({
      platform: 'lazada',
      platform_session_id: sessionId,
    });

    if (!mapping) {
      const conversation = await chatwootClient.findOrCreateConversation(
        accountId,
        inboxId,
        contact.id,
        {
          lazada_session_id: sessionId,
          lazada_seller_id: sellerId,
          lazada_region: shopInbox.region,
        }
      );

      mapping = await ConversationMapping.create({
        platform: 'lazada',
        platform_session_id: sessionId,
        platform_buyer_id: buyerId,
        seller_id: sellerId,
        chatwoot_contact_id: contact.id,
        chatwoot_conversation_id: conversation.id,
        chatwoot_inbox_id: inboxId,
      });
    }

    await chatwootClient.createMessage(accountId, mapping.chatwoot_conversation_id, text);
  },
  // High concurrency is safe here — work is I/O bound (Chatwoot API calls),
  // not CPU bound. Scale further by running multiple adapter-lazada replicas.
  { connection: { url: process.env.REDIS_URL }, concurrency: 50 }
);

worker.on('failed', (job, err) => {
  console.error(`lazada-inbound job ${job.id} failed:`, err.message);
});

module.exports = worker;
