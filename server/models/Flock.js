const mongoose = require('mongoose');

const flockTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['hatched', 'purchased', 'sold', 'died', 'culled'], required: true },
    birdType: { type: String, enum: ['layer', 'rooster', 'chick'], required: true },
    quantity: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const flockSchema = new mongoose.Schema(
  {
    liveLayerCount: { type: Number, required: true, default: 0 },
    liveRoosterCount: { type: Number, required: true, default: 0 },
    liveChickCount: { type: Number, required: true, default: 0 },
    transactions: [flockTransactionSchema],
  },
  { timestamps: true }
);

flockSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({ liveLayerCount: 0, liveRoosterCount: 0, liveChickCount: 0 });
  return doc;
};

module.exports = mongoose.model('Flock', flockSchema);
