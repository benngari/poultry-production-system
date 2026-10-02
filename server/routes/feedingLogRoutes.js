const express = require('express');
const asyncHandler = require('express-async-handler');
const FeedingLog = require('../models/FeedingLog');
const FeedStock = require('../models/FeedStock');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/feeding-logs — history of feed actually given to the flock,
// both auto (cron) and manual entries. Entries are created from
// flockRoutes.js (manual) and utils/cron.js (auto), not from a POST here.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await FeedingLog.find({ isDeleted: { $ne: true } })
      .sort({ date: -1 })
      .limit(200)
      .populate('recordedBy', 'name');
    res.json(logs);
  })
);

// DELETE /api/feeding-logs/:id — soft delete AND give the kg back to
// FeedStock, since creating this entry originally deducted it. Without
// this, deleting a mistaken/duplicate entry silently loses that feed
// forever from the store balance.
router.delete(
  '/:id',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const log = await FeedingLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Feeding log not found');
    }
    if (log.isDeleted) {
      res.status(400);
      throw new Error('Already in Trash');
    }

    log.isDeleted = true;
    log.deletedAt = new Date();
    log.deletedBy = req.user._id;
    await log.save();

    const feedStock = await FeedStock.getSingleton();
    feedStock.stockKg += log.quantityKg;
    await feedStock.save();

    await logAction(req, {
      action: 'delete',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Feeding log ${new Date(log.date).toISOString().slice(0, 10)}`,
      details: `${log.quantityKg}kg restored to FeedStock on delete`,
    });

    res.json({ message: 'Moved to Trash, feed stock restored' });
  })
);

// POST /api/feeding-logs/:id/restore — reverses the delete: deducts the
// kg from FeedStock again, blocked if there isn't enough stock to cover
// it (e.g. it's since been used up by other feedings).
router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const log = await FeedingLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Feeding log not found');
    }
    if (!log.isDeleted) {
      res.status(400);
      throw new Error('Not in Trash');
    }

    const feedStock = await FeedStock.getSingleton();
    if (feedStock.stockKg < log.quantityKg) {
      res.status(400);
      throw new Error(
        `Cannot restore — would deduct ${log.quantityKg}kg but only ${feedStock.stockKg.toFixed(2)}kg is currently in store`
      );
    }
    feedStock.stockKg -= log.quantityKg;
    await feedStock.save();

    log.isDeleted = false;
    log.deletedAt = undefined;
    log.deletedBy = undefined;
    await log.save();

    await logAction(req, {
      action: 'restore',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Feeding log ${new Date(log.date).toISOString().slice(0, 10)}`,
      details: `${log.quantityKg}kg deducted from FeedStock on restore`,
    });

    res.json(log);
  })
);

router.get(
  '/trash/list',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const logs = await FeedingLog.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(logs);
  })
);

module.exports = router;