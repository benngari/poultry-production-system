const express = require('express');
const asyncHandler = require('express-async-handler');
const EggLog = require('../models/EggLog');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await EggLog.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(200);
    res.json(logs);
  })
);

router.post(
  '/',
  authorize('Administrator', 'Manager', 'Flock Operator'),
  asyncHandler(async (req, res) => {
    const { date, quantityCollected } = req.body;
    if (!date || quantityCollected === undefined || Number(quantityCollected) < 0) {
      res.status(400);
      throw new Error('A valid date and quantity are required');
    }
    const log = await EggLog.create({
      date: new Date(date),
      quantityCollected: Number(quantityCollected),
      recordedBy: req.user._id,
    });
    await logAction(req, {
      action: 'create',
      entityType: 'EggLog',
      entityId: log._id,
      entityLabel: new Date(date).toISOString().slice(0, 10),
      details: `${quantityCollected} eggs collected`,
    });
    res.status(201).json(log);
  })
);

router.put(
  '/:id',
  authorize('Administrator', 'Manager', 'Flock Operator'),
  asyncHandler(async (req, res) => {
    const log = await EggLog.findById(req.params.id);
    if (!log || log.isDeleted) {
      res.status(404);
      throw new Error('Egg log not found');
    }
    if (req.body.quantityCollected !== undefined) log.quantityCollected = Number(req.body.quantityCollected);
    if (req.body.date) log.date = new Date(req.body.date);
    await log.save();
    await logAction(req, {
      action: 'update',
      entityType: 'EggLog',
      entityId: log._id,
      entityLabel: log.date.toISOString().slice(0, 10),
    });
    res.json(log);
  })
);

router.delete(
  '/:id',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const log = await EggLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Egg log not found');
    }
    log.isDeleted = true;
    log.deletedAt = new Date();
    log.deletedBy = req.user._id;
    await log.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'EggLog',
      entityId: log._id,
      entityLabel: log.date.toISOString().slice(0, 10),
    });
    res.json({ message: 'Moved to Trash' });
  })
);

router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const log = await EggLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Egg log not found');
    }
    log.isDeleted = false;
    log.deletedAt = undefined;
    log.deletedBy = undefined;
    await log.save();
    await logAction(req, { action: 'restore', entityType: 'EggLog', entityId: log._id });
    res.json(log);
  })
);

router.get(
  '/trash/list',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const logs = await EggLog.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(logs);
  })
);

module.exports = router;
