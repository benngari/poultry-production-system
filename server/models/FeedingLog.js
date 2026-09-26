const mongoose = require('mongoose');

// A reviewable record of feed actually given to the flock each day —
// distinct from FeedStock (a running balance) and FeedBatch (mixing raw
// ingredients into finished feed). This is the "what went out" ledger,
// the same role EggLog plays for eggs.
const feedingLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    quantityKg: { type: Number, required: true },
    source: { type: String, enum: ['auto', 'manual'], required: true, default: 'manual' },
    note: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeedingLog', feedingLogSchema);