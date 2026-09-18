const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['purchase', 'usage', 'adjustment'], required: true },
    quantity: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const feedIngredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, default: 'kg' },
    stock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 0 },
    supplier: { type: String, default: '' },
    unitCost: { type: Number, required: true, default: 0 },
    transactions: [transactionSchema],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeedIngredient', feedIngredientSchema);
