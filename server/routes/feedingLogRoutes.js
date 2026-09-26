const express = require('express');
const asyncHandler = require('express-async-handler');
const FeedingLog = require('../models/FeedingLog');
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

router.delete(
  '/:id',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const log = await FeedingLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Feeding log not found');
    }
    log.isDeleted = true;
    log.deletedAt = new Date();
    log.deletedBy = req.user._id;
    await log.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Feeding log ${new Date(log.date).toISOString().slice(0, 10)}`,
    });
    res.json({ message: 'Moved to Trash' });
  })
);

router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const log = await FeedingLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Feeding log not found');
    }
    log.isDeleted = false;
    log.deletedAt = undefined;
    log.deletedBy = undefined;
    await log.save();
    await logAction(req, { action: 'restore', entityType: 'FeedIngredient', entityId: log._id });
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