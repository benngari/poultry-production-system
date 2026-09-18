const mongoose = require('mongoose');

const birdSaleSchema = new mongoose.Schema(
  {
    birdType: { type: String, enum: ['layer', 'rooster', 'chick'], required: true },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BirdSale', birdSaleSchema);
