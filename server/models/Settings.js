const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Poultry Farm' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    currency: { type: String, default: 'KSh' },
    dailyLabourCost: { type: Number, default: 335.5 },
    hoursPerShift: { type: Number, default: 8 },
    feedPerLayerKgPerDay: { type: Number, default: 0.14 },
    feedPerRoosterKgPerDay: { type: Number, default: 0.14 },
    eggSellingPrice: { type: Number, default: 15 },
    feedLowStockThresholdKg: { type: Number, default: 20 },
  },
  { timestamps: true }
);

settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
