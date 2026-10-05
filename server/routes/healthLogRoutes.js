const express = require('express');
const asyncHandler = require('express-async-handler');
const HealthLog = require('../models/HealthLog');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];
const VALID_TYPES = ['vaccination', 'treatment', 'disease', 'mortality', 'other'];
const VALID_BIRD_TYPES = ['layer', 'rooster', 'chick', 'all'];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await HealthLog.find({ isDeleted: { $ne: true } })
      .sort({ date: -1 })
      .limit(200)
      .populate('recordedBy', 'name');
    res.json(logs);
  })
);

router.post(
  '/',
  authorize(...CAN_LOG),
  asyncHandler(async (req, res) => {
    const { date, recordType, birdType, quantityAffected, title, medication, dosage, note } = req.body;

    if (!date || !title) {
      res.status(400);
      throw new Error('Date and a title/description are required');
    }
    if (!VALID_TYPES.includes(recordType)) {
      res.status(400);
      throw new Error('Invalid record type');
    }
    if (birdType && !VALID_BIRD_TYPES.includes(birdType)) {
      res.status(400);
      throw new Error('Invalid bird type');
    }

    const log = await HealthLog.create({
      date: new Date(date),
      recordType,
      birdType: birdType || 'all',
      quantityAffected: quantityAffected !== undefined && quantityAffected !== '' ? Number(quantityAffected) : undefined,
      title,
      medication: medication || '',
      dosage: dosage || '',
      note: note || '',
      recordedBy: req.user._id,
    });

    await logAction(req, {
      action: 'create',
      entityType: 'HealthLog',
      entityId: log._id,
      entityLabel: `${recordType}: ${title}`,
      details: quantityAffected ? `${quantityAffected} bird(s) affected` : '',
    });

    res.status(201).json(log);
  })
);

router.put(
  '/:id',
  authorize(...CAN_LOG),
  asyncHandler(async (req, res) => {
    const log = await HealthLog.findById(req.params.id);
    if (!log || log.isDeleted) {
      res.status(404);
      throw new Error('Health log not found');
    }

    const { date, recordType, birdType, quantityAffected, title, medication, dosage, note } = req.body;
    if (date) log.date = new Date(date);
    if (recordType) {
      if (!VALID_TYPES.includes(recordType)) {
        res.status(400);
        throw new Error('Invalid record type');
      }
      log.recordType = recordType;
    }
    if (birdType) {
      if (!VALID_BIRD_TYPES.includes(birdType)) {
        res.status(400);
        throw new Error('Invalid bird type');
      }
      log.birdType = birdType;
    }
    if (quantityAffected !== undefined) log.quantityAffected = quantityAffected === '' ? undefined : Number(quantityAffected);
    if (title !== undefined) log.title = title;
    if (medication !== undefined) log.medication = medication;
    if (dosage !== undefined) log.dosage = dosage;
    if (note !== undefined) log.note = note;

    await log.save();
    await logAction(req, {
      action: 'update',
      entityType: 'HealthLog',
      entityId: log._id,
      entityLabel: `${log.recordType}: ${log.title}`,
    });

    res.json(log);
  })
);

router.delete(
  '/:id',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const log = await HealthLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Health log not found');
    }
    log.isDeleted = true;
    log.deletedAt = new Date();
    log.deletedBy = req.user._id;
    await log.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'HealthLog',
      entityId: log._id,
      entityLabel: `${log.recordType}: ${log.title}`,
    });
    res.json({ message: 'Moved to Trash' });
  })
);

router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const log = await HealthLog.findById(req.params.id);
    if (!log) {
      res.status(404);
      throw new Error('Health log not found');
    }
    log.isDeleted = false;
    log.deletedAt = undefined;
    log.deletedBy = undefined;
    await log.save();
    await logAction(req, { action: 'restore', entityType: 'HealthLog', entityId: log._id });
    res.json(log);
  })
);

router.get(
  '/trash/list',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const logs = await HealthLog.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(logs);
  })
);

module.exports = router;
