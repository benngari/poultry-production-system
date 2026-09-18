const mongoose = require('mongoose');

// Singleton document tracking finished-feed stock.
const feedStockSchema = new mongoose.Schema(
  {
    stockKg: { type: Number, required: true, default: 0 },
    minStockKg: { type: Number, required: true, default: 20 },
    lastAutoDeductionDate: { type: String, default: null }, // 'YYYY-MM-DD', guards double-run of the cron job
  },
  { timestamps: true }
);

feedStockSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({ stockKg: 0, minStockKg: 20 });
  return doc;
};

module.exports = mongoose.model('FeedStock', feedStockSchema);
