const mongoose = require('mongoose');

const shopInboxSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, enum: ['shopee', 'lazada', 'tiktok'] },
    chatwoot_account_id: { type: Number, required: true },
    chatwoot_inbox_id: { type: Number, required: true, unique: true },
    seller_id: { type: String, default: null },
    region: { type: String, required: true },
    app_key: { type: String, required: true },
    app_secret: { type: String, required: true },   // encrypted at rest
    access_token: { type: String, default: null },  // encrypted
    refresh_token: { type: String, default: null }, // encrypted
    token_expires_at: { type: Date, default: null },
  },
  { timestamps: true }
);

shopInboxSchema.index({ platform: 1, seller_id: 1 });

module.exports = mongoose.model('ShopInbox', shopInboxSchema);
