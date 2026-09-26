const express = require('express');
const asyncHandler = require('express-async-handler');
const ManureLog = require('../models/ManureLog');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// CAN_LOG mirrors EggLog's permission set — the same roles handling
// birds day-to-day are the ones logging what comes out of the coop.
const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await ManureLog.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(200);
    res.json(logs);
  })
);

router.post(
  '/',
  authorize(...CAN_LOG),
  asyncHandler(async (req, res) => {
    const { date, quantityKg, note } = req.body;
    if (!date || quantityKg === undefined || Number(quantityKg) < 0) {
      res.status(400);
      throw new Error('A valid date and quantity are required');
    }
    const log = await ManureLog.create({
      date: new Date(date),
      quantityKg: Number(quantityKg),
      note: note || '',
      recordedBy: req.user._id,
    });
    await logAction(req, {
      action: 'create',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Manure log ${new Date(date).toISOString().slice(0, 10)}`,
      details: `${quantityKg}kg manure recorded`,
    });
    res.status(201).json(log);
  })
);

router.put(
  '/:id',
  authorize(...CAN_LOG),
  asyncHandler(async (req, res) => {
    const log = await ManureLog.findById(req.params.id);
    if (!log || log.isDeleted) {
      res.status(404);
      throw new Error('Manure log not found');
    }
    if (req.body.quantityKg !== undefined) log.quantityKg = Number(req.body.quantityKg);
    if (req.body.date) log.date = new Date(req.body.date);
    if (req.body.note !== undefined) log.note = req.body.note;
    await log.save();
    await logAction(req, {
      action: 'update',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Manure log ${log.date.toISOString().slice(0, 10)}`,
    });
    res.json(log);
  })
);

router.delete(
  '/:id',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const log = await ManureLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Manure log not found');
    }
    log.isDeleted = true;
    log.deletedAt = new Date();
    log.deletedBy = req.user._id;
    await log.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'FeedIngredient',
      entityId: log._id,
      entityLabel: `Manure log ${log.date.toISOString().slice(0, 10)}`,
    });
    res.json({ message: 'Moved to Trash' });
  })
);

router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const log = await ManureLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Manure log not found');
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
    const logs = await ManureLog.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(logs);
  })
);

module.exports = router;