const express = require('express');
const asyncHandler = require('express-async-handler');
const Flock = require('../models/Flock');
const FeedStock = require('../models/FeedStock');
const Settings = require('../models/Settings');
const FeedingLog = require('../models/FeedingLog');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/flock
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const flock = await Flock.getSingleton();
    res.json(flock);
  })
);

// POST /api/flock/adjust  { birdType, type, quantity, note }
// Manual, non-sale count changes: hatched/purchased/died/culled.
router.post(
  '/adjust',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const { birdType, type, quantity, note } = req.body;
    if (!['layer', 'rooster', 'chick'].includes(birdType)) {
      res.status(400);
      throw new Error('Invalid bird type');
    }
    if (!['hatched', 'purchased', 'died', 'culled'].includes(type)) {
      res.status(400);
      throw new Error('Invalid adjustment type — use the Bird Sale form for sales');
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      res.status(400);
      throw new Error('Quantity must be greater than zero');
    }

    const flock = await Flock.getSingleton();
    const field = birdType === 'layer' ? 'liveLayerCount' : birdType === 'rooster' ? 'liveRoosterCount' : 'liveChickCount';
    const delta = ['hatched', 'purchased'].includes(type) ? qty : -qty;

    if (flock[field] + delta < 0) {
      res.status(400);
      throw new Error(`Cannot reduce ${birdType} count below zero`);
    }

    flock[field] += delta;
    flock.transactions.push({ type, birdType, quantity: qty, note: note || '', date: new Date() });
    await flock.save();

    await logAction(req, {
      action: 'update',
      entityType: 'Flock',
      entityId: flock._id,
      entityLabel: `${birdType} ${type}`,
      details: `${type} ${qty} ${birdType}(s)${note ? ` — ${note}` : ''}`,
    });

    res.json(flock);
  })
);

// POST /api/flock/manual-feed-deduction  { quantityKg, note, date }
router.post(
  '/manual-feed-deduction',
  authorize('Administrator', 'Manager', 'Flock Operator'),
  asyncHandler(async (req, res) => {
    const { quantityKg, note, date } = req.body;
    const qty = Number(quantityKg);
    if (!qty || qty <= 0) {
      res.status(400);
      throw new Error('Quantity must be greater than zero');
    }

    const feedStock = await FeedStock.getSingleton();
    if (feedStock.stockKg < qty) {
      res.status(400);
      throw new Error(`Insufficient finished-feed stock — has ${feedStock.stockKg.toFixed(2)}kg, tried to deduct ${qty}kg`);
    }
    feedStock.stockKg -= qty;
    await feedStock.save();

    // This is the actual queryable "feed given" record — previously the
    // stock number moved but nothing showed up on a per-day feeding history.
    await FeedingLog.create({
      date: date ? new Date(date) : new Date(),
      quantityKg: qty,
      source: 'manual',
      note: note || '',
      recordedBy: req.user._id,
    });

    await logAction(req, {
      action: 'stock_adjust',
      entityType: 'FeedIngredient',
      entityLabel: 'FeedStock (manual)',
      details: `Manual deduction of ${qty}kg${note ? ` — ${note}` : ''}. Remaining: ${feedStock.stockKg.toFixed(2)}kg.`,
    });

    res.json(feedStock);
  })
);

// GET /api/flock/feed-stock
router.get(
  '/feed-stock',
  asyncHandler(async (req, res) => {
    const feedStock = await FeedStock.getSingleton();
    res.json(feedStock);
  })
);

module.exports = router;