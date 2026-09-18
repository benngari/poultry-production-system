const express = require('express');
const asyncHandler = require('express-async-handler');
const BirdSale = require('../models/BirdSale');
const Flock = require('../models/Flock');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sales = await BirdSale.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(200);
    res.json(sales);
  })
);

// POST /api/bird-sales  { birdType, quantity, pricePerUnit, notes }
router.post(
  '/',
  authorize('Administrator', 'Manager', 'Store Keeper'),
  asyncHandler(async (req, res) => {
    const { birdType, quantity, pricePerUnit, notes } = req.body;
    if (!['layer', 'rooster', 'chick'].includes(birdType)) {
      res.status(400);
      throw new Error('Invalid bird type');
    }
    const qty = Number(quantity);
    const price = Number(pricePerUnit);
    if (!qty || qty <= 0 || price < 0) {
      res.status(400);
      throw new Error('Quantity must be positive and price cannot be negative');
    }

    const flock = await Flock.getSingleton();
    const field = birdType === 'layer' ? 'liveLayerCount' : birdType === 'rooster' ? 'liveRoosterCount' : 'liveChickCount';
    if (flock[field] < qty) {
      res.status(400);
      throw new Error(`Cannot sell ${qty} ${birdType}(s) — only ${flock[field]} currently in the flock`);
    }

    flock[field] -= qty;
    flock.transactions.push({ type: 'sold', birdType, quantity: qty, date: new Date(), note: notes || '' });
    await flock.save();

    const sale = await BirdSale.create({
      birdType,
      quantity: qty,
      pricePerUnit: price,
      totalPrice: qty * price,
      date: new Date(),
      recordedBy: req.user._id,
      notes: notes || '',
    });

    await logAction(req, {
      action: 'create',
      entityType: 'BirdSale',
      entityId: sale._id,
      entityLabel: `${qty} ${birdType}(s)`,
      details: `Sold for ${sale.totalPrice}`,
    });

    res.status(201).json(sale);
  })
);

router.delete(
  '/:id',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const sale = await BirdSale.findById(req.params.id);
    if (!sale) {
      res.status(404);
      throw new Error('Bird sale not found');
    }
    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user._id;
    await sale.save();
    await logAction(req, {
      action: 'delete',
      entityType: 'BirdSale',
      entityId: sale._id,
      entityLabel: `${sale.quantity} ${sale.birdType}(s)`,
    });
    res.json({ message: 'Moved to Trash' });
  })
);

router.get(
  '/trash/list',
  authorize('Administrator'),
  asyncHandler(async (req, res) => {
    const sales = await BirdSale.find({ isDeleted: true }).sort({ deletedAt: -1 });
    res.json(sales);
  })
);

module.exports = router;
