const mongoose = require('mongoose');

const dailyEggStockSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    openingStock: { type: Number, required: true, default: 0 },
    addedStock: { type: Number, required: true, default: 0 },
    closingStock: { type: Number, required: true, default: 0 },
    soldQuantity: { type: Number, required: true, default: 0 },
    unitPrice: { type: Number, required: true },
    revenue: { type: Number, required: true, default: 0 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

dailyEggStockSchema.index(
  { date: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);

module.exports = mongoose.model('DailyEggStock', dailyEggStockSchema);
