const mongoose = require('mongoose');

const ingredientUsedSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedIngredient', required: true },
    name: { type: String, required: true },
    quantityKg: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    cost: { type: Number, required: true },
  },
  { _id: false }
);

const feedBatchSchema = new mongoose.Schema(
  {
    ingredientsUsed: [ingredientUsedSchema],
    totalKg: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    costPerKg: { type: Number, required: true },
    producedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeedBatch', feedBatchSchema);
