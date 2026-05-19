const mongoose = require('mongoose');

const conversationMappingSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, enum: ['shopee', 'lazada', 'tiktok'] },
    platform_session_id: { type: String, required: true },   // Lazada session_id
    platform_buyer_id: { type: String, required: true },
    seller_id: { type: String, required: true },
    chatwoot_contact_id: { type: Number, required: true },
    chatwoot_conversation_id: { type: Number, required: true },
    chatwoot_inbox_id: { type: Number, required: true },
  },
  { timestamps: true }
);

conversationMappingSchema.index({ platform: 1, platform_session_id: 1 }, { unique: true });
conversationMappingSchema.index({ chatwoot_conversation_id: 1 });

module.exports = mongoose.model('ConversationMapping', conversationMappingSchema);
