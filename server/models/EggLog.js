const mongoose = require('mongoose');

const eggLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    quantityCollected: { type: Number, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EggLog', eggLogSchema);
