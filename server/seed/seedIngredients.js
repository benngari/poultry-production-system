// One-off seed script: node seed/seedIngredients.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const FeedIngredient = require('../models/FeedIngredient');

const REFERENCE_INGREDIENTS = [
  { name: 'Maize germ', unit: 'kg', unitCost: 55, stock: 0, minStock: 20 },
  { name: 'Soya', unit: 'kg', unitCost: 85, stock: 0, minStock: 10 },
  { name: 'Wheat bran', unit: 'kg', unitCost: 35.71, stock: 0, minStock: 10 },
  { name: 'BSF (Black Soldier Fly larvae meal)', unit: 'kg', unitCost: 7, stock: 0, minStock: 10 },
  { name: 'Premix', unit: 'kg', unitCost: 450, stock: 0, minStock: 2 },
  { name: 'Lysine', unit: 'kg', unitCost: 450, stock: 0, minStock: 2 },
  { name: 'Lime', unit: 'kg', unitCost: 40, stock: 0, minStock: 5 },
  { name: 'Phytase', unit: 'kg', unitCost: 100, stock: 0, minStock: 2 },
  { name: 'Methionine', unit: 'kg', unitCost: 333.33, stock: 0, minStock: 2 },
  { name: 'Toxin Binder', unit: 'kg', unitCost: 100, stock: 0, minStock: 2 },
];

const run = async () => {
  await connectDB();
  for (const ing of REFERENCE_INGREDIENTS) {
    const exists = await FeedIngredient.findOne({ name: ing.name });
    if (!exists) {
      await FeedIngredient.create(ing);
      console.log(`Seeded: ${ing.name}`);
    } else {
      console.log(`Skipped (exists): ${ing.name}`);
    }
  }
  console.log('Done seeding feed ingredients.');
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
