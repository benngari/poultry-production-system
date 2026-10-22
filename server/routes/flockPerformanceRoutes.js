const express = require('express');
const asyncHandler = require('express-async-handler');
const EggLog = require('../models/EggLog');
const FeedingLog = require('../models/FeedingLog');
const Flock = require('../models/Flock');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { buildFlockPerformance, dayKey, addDays } = require('../utils/flockPerformance');

const router = express.Router();
router.use(protect);

// GET /api/flock-performance?days=14   (days: whole number, 7 to 60)
// Laying rate (eggs / layers alive that day), an early-warning status, and
// feed per egg. Read-only, so every logged-in role can see it.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const raw = req.query.days;
    const days = raw === undefined ? 14 : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(days) || days < 7 || days > 60) {
      res.status(400);
      throw new Error('days must be a whole number from 7 to 60');
    }

    const endDay = dayKey(new Date());
    const from = new Date(`${addDays(endDay, -(Math.max(days, 30) - 1))}T00:00:00.000Z`);
    const range = { isDeleted: { $ne: true }, date: { $gte: from } };

    const [eggLogs, feedingLogs, flock, settings] = await Promise.all([
      EggLog.find(range).select('date quantityCollected').lean(),
      FeedingLog.find(range).select('date quantityKg').lean(),
      Flock.getSingleton(),
      Settings.getSingleton(),
    ]);

    res.json(
      buildFlockPerformance({
        endDay,
        days,
        eggLogs,
        feedingLogs,
        currentLayers: flock.liveLayerCount,
        transactions: (flock.transactions || []).map((t) => ({ type: t.type, birdType: t.birdType, quantity: t.quantity, date: t.date })),
        costPerKg: settings.compoundedFeedCostPerKg,
        eggPrice: settings.eggSellingPrice,
        currency: settings.currency || 'KSh',
      })
    );
  })
);

module.exports = router;
