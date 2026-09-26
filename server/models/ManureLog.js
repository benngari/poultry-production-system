const mongoose = require('mongoose');

const manureLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    quantityKg: { type: Number, required: true },
    note: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ManureLog', manureLogSchema);