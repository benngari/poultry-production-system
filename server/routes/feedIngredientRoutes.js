const express = require('express');
const asyncHandler = require('express-async-handler');
const FeedIngredient = require('../models/FeedIngredient');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// GET /api/feed-ingredients  (active only)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await FeedIngredient.find({ isDeleted: { $ne: true } }).sort({ name: 1 });
    res.json(items);
  })
);

// POST /api/feed-ingredients
router.post(
  '/',
  authorize('Administrator', 'Manager', 'Store Keeper'),
  asyncHandler(async (req, res) => {
    const item = await FeedIngredient.create(req.body);
    await logAction(req, {
      action: 'create',
      entityType: 'FeedIngredient',
      entityId: item._id,
      entityLabel: item.name,
    });
    res.status(201).json(item);
  })
);

// PUT /api/feed-ingredients/:id
router.put(
  '/:id',
  authorize('Administrator', 'Manager', 'Store Keeper'),
  asyncHandler(async (req, res) => {
    const item = await FeedIngredient.findById(req.params.id);
    if (!item || item.isDeleted) {
      res.status(404);
      throw new Error('Feed ingredient not found');
    }
    Object.assign(item, req.body);
    await item.save();
    await logAction(req, {
      action: 'update',
      entityType: 'FeedIngredient',
      entityId: item._id,
      entityLabel: item.name,
    });
    res.json(item);
  })
);

// POST /api/feed-ingredients/:id/adjust  { type, quantity, note }
router.post(
  '/:id/adjust',
  authorize('Administrator', 'Manager', 'Store Keeper'),
  asyncHandler(async (req, res) => {
    const { type, quantity, note } = req.body;
    if (!['purchase', 'usage', 'adjustment'].includes(type)) {
      res.status(400);
      throw new Error('Invalid transaction type');
    }
    const item = await FeedIngredient.findById(req.params.id);
    if (!item || item.isDeleted) {
      res.status(404);
      throw new Error('Feed ingredient not found');
    }

    const delta = type === 'purchase' ? Number(quantity) : -Number(quantity);
    if (item.stock + delta < 0) {
      res.status(400);
      throw new Error(`Insufficient stock for ${item.name} — has ${item.stock}${item.unit}, tried to remove ${Math.abs(delta)}${item.unit}`);
    }
    item.stock += delta;
    item.transactions.push({ type, quantity: Number(quantity), note, date: new Date() });
    await item.save();

    await logAction(req, {
      action: 'stock_adjust',
      entityType: 'FeedIngredient',
      entityId: item._id,
      entityLabel: item.name,
      details: `${type} of ${quantity}${item.unit}${note ? ` — ${note}` : ''}`,
    });
    res.json(item);
  })
);

// DELETE /api/feed-ingredients/:id  (soft delete)
router.delete(
  '/:id',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const item = await FeedIngredient.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Feed ingredient not found');
    }
    item.isDeleted = true;
    item.deletedAt = new Date();
    item.deletedBy = req.user._id;
    await item.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'FeedIngredient',
      entityId: item._id,
      entityLabel: item.name,
    });
    res.json({ message: 'Moved to Trash' });
  })
);

// POST /api/feed-ingredients/:id/restore
router.post(
  '/:id/restore',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const item = await FeedIngredient.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Feed ingredient not found');
    }
    item.isDeleted = false;
    item.deletedAt = undefined;
    item.deletedBy = undefined;
    await item.save();
    await logAction(req, {
      action: 'restore',
      entityType: 'FeedIngredient',
      entityId: item._id,
      entityLabel: item.name,
    });
    res.json(item);
  })
);

// DELETE /api/feed-ingredients/:id/permanent
router.delete(
  '/:id/permanent',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const item = await FeedIngredient.findById(req.params.id);
    if (!item) {
      res.status(404);
      throw new Error('Feed ingredient not found');
    }
    await item.deleteOne();
    await logAction(req, {
      action: 'permanent_delete',
      entityType: 'FeedIngredient',
      entityId: req.params.id,
      entityLabel: item.name,
    });
    res.json({ message: 'Permanently deleted' });
  })
);

// GET /api/feed-ingredients/trash/list
router.get(
  '/trash/list',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const items = await FeedIngredient.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(items);
  })
);

module.exports = router;
