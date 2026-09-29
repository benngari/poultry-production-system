const express = require('express');
const asyncHandler = require('express-async-handler');
const FeedBatch = require('../models/FeedBatch');
const FeedStock = require('../models/FeedStock');
const Settings = require('../models/Settings');
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
// body: { totalKg, notes }
// Logs compounded/finished feed as a single total — the flock is fed the
// whole mix at once, not one raw ingredient at a time, so this no longer
// asks for a per-ingredient breakdown. Cost is the flat rate from
// Settings.compoundedFeedCostPerKg, not derived from itemized ingredients.
// Raw FeedIngredient stock (FeedIngredients page) is tracked separately
// for purchasing/reordering and is no longer auto-deducted here.
router.post(
  '/',
  authorize('Administrator', 'Manager', 'Flock Operator'),
  asyncHandler(async (req, res) => {
    const { totalKg, notes } = req.body;
    const qty = Number(totalKg);
    if (!qty || qty <= 0) {
      res.status(400);
      throw new Error('Total kg must be greater than zero');
    }

    const settings = await Settings.getSingleton();
    const costPerKg = settings.compoundedFeedCostPerKg;
    const totalCost = qty * costPerKg;

    const batch = await FeedBatch.create({
      ingredientsUsed: [],
      totalKg: qty,
      totalCost,
      costPerKg,
      producedBy: req.user._id,
      date: new Date(),
      notes: notes || '',
    });

    const feedStock = await FeedStock.getSingleton();
    feedStock.stockKg += qty;
    await feedStock.save();

    // Audit call happens BEFORE the response is sent — not after a return.
    await logAction(req, {
      action: 'create',
      entityType: 'FeedBatch',
      entityId: batch._id,
      entityLabel: `Compounded feed ${qty}kg`,
      details: `Cost/kg: ${costPerKg.toFixed(2)}, total cost: ${totalCost.toFixed(2)}`,
    });

    res.status(201).json(batch);
  })
);

// DELETE /api/feed-batches/:id  (Administrator only, hard delete)
router.delete(
  '/:id',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const batch = await FeedBatch.findById(req.params.id);
    if (!batch) {
      res.status(404);
      throw new Error('Feed batch not found');
    }

    const feedStock = await FeedStock.getSingleton();
    feedStock.stockKg = Math.max(0, feedStock.stockKg - batch.totalKg);
    await feedStock.save();

    await batch.deleteOne();

    await logAction(req, {
      action: 'delete',
      entityType: 'FeedBatch',
      entityId: req.params.id,
      entityLabel: `Compounded feed ${batch.totalKg}kg`,
      details: 'FeedStock reduced back',
    });

    res.json({ message: 'Feed batch deleted and finished-feed stock reduced back' });
  })
);

module.exports = router;