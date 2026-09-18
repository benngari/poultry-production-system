const express = require('express');
const asyncHandler = require('express-async-handler');
const FeedBatch = require('../models/FeedBatch');
const FeedIngredient = require('../models/FeedIngredient');
const FeedStock = require('../models/FeedStock');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/feed-batches
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const batches = await FeedBatch.find().sort({ date: -1 }).limit(200).populate('producedBy', 'name');
    res.json(batches);
  })
);

// POST /api/feed-batches
// body: { items: [{ ingredientId, quantityKg }], notes }
router.post(
  '/',
  authorize('Administrator', 'Manager', 'Flock Operator'),
  asyncHandler(async (req, res) => {
    const { items, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400);
      throw new Error('At least one ingredient line is required');
    }

    // Full pre-check across every deduction before committing any of them —
    // this is the exact stock-sufficiency bug the sibling project shipped
    // without (an ingredient silently went to -297mL). Never repeat that.
    const ingredientDocs = await FeedIngredient.find({
      _id: { $in: items.map((i) => i.ingredientId) },
      isDeleted: { $ne: true },
    });
    const byId = new Map(ingredientDocs.map((d) => [String(d._id), d]));

    for (const line of items) {
      const doc = byId.get(String(line.ingredientId));
      if (!doc) {
        res.status(400);
        throw new Error('One of the selected ingredients no longer exists');
      }
      if (Number(line.quantityKg) <= 0) {
        res.status(400);
        throw new Error(`Quantity for ${doc.name} must be greater than zero`);
      }
      if (doc.stock < Number(line.quantityKg)) {
        res.status(400);
        throw new Error(`Insufficient stock for ${doc.name} — has ${doc.stock}kg, batch needs ${line.quantityKg}kg`);
      }
    }

    // All checks passed — now commit every deduction.
    const ingredientsUsed = [];
    let totalKg = 0;
    let totalCost = 0;

    for (const line of items) {
      const doc = byId.get(String(line.ingredientId));
      const qty = Number(line.quantityKg);
      const cost = qty * doc.unitCost;

      doc.stock -= qty;
      doc.transactions.push({ type: 'usage', quantity: qty, note: 'Used in feed batch', date: new Date() });
      await doc.save();

      ingredientsUsed.push({
        ingredientId: doc._id,
        name: doc.name,
        quantityKg: qty,
        unitCost: doc.unitCost,
        cost,
      });
      totalKg += qty;
      totalCost += cost;
    }

    const costPerKg = totalCost / totalKg;

    const batch = await FeedBatch.create({
      ingredientsUsed,
      totalKg,
      totalCost,
      costPerKg,
      producedBy: req.user._id,
      date: new Date(),
      notes: notes || '',
    });

    const feedStock = await FeedStock.getSingleton();
    feedStock.stockKg += totalKg;
    await feedStock.save();

    // Audit call happens BEFORE the response is sent — not after a return.
    await logAction(req, {
      action: 'create',
      entityType: 'FeedBatch',
      entityId: batch._id,
      entityLabel: `Batch of ${totalKg}kg`,
      details: `Cost/kg: ${costPerKg.toFixed(2)}, total cost: ${totalCost.toFixed(2)}`,
    });

    res.status(201).json(batch);
  })
);

// DELETE /api/feed-batches/:id  (Administrator only, hard delete, restores ingredient stock)
router.delete(
  '/:id',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const batch = await FeedBatch.findById(req.params.id);
    if (!batch) {
      res.status(404);
      throw new Error('Feed batch not found');
    }

    for (const line of batch.ingredientsUsed) {
      const doc = await FeedIngredient.findById(line.ingredientId);
      if (doc) {
        doc.stock += line.quantityKg;
        doc.transactions.push({
          type: 'adjustment',
          quantity: line.quantityKg,
          note: `Restored from deleted batch ${batch._id}`,
          date: new Date(),
        });
        await doc.save();
      }
    }

    const feedStock = await FeedStock.getSingleton();
    feedStock.stockKg = Math.max(0, feedStock.stockKg - batch.totalKg);
    await feedStock.save();

    await batch.deleteOne();

    await logAction(req, {
      action: 'delete',
      entityType: 'FeedBatch',
      entityId: req.params.id,
      entityLabel: `Batch of ${batch.totalKg}kg`,
      details: 'Ingredient stock restored',
    });

    res.json({ message: 'Feed batch deleted and ingredient stock restored' });
  })
);

module.exports = router;
