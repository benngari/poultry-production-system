const express = require('express');
const asyncHandler = require('express-async-handler');
const DailyEggStock = require('../models/DailyEggStock');
const EggLog = require('../models/EggLog');
const Settings = require('../models/Settings');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const dateStr = (d) => new Date(d).toISOString().slice(0, 10);
const todayStr = () => dateStr(new Date());

// GET /api/daily-egg-stock/:date  ('YYYY-MM-DD') — auto-creates the row if missing
router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const date = req.params.date;
    let row = await DailyEggStock.findOne({ date, isDeleted: { $ne: true } });

    if (!row) {
      // Carry forward opening stock from yesterday's closing stock.
      const yesterday = dateStr(new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000));
      const prevRow = await DailyEggStock.findOne({ date: yesterday, isDeleted: { $ne: true } });
      const opening = prevRow ? prevRow.closingStock : 0;

      const eggLogsForDay = await EggLog.find({
        isDeleted: { $ne: true },
        date: { $gte: new Date(`${date}T00:00:00.000Z`), $lt: new Date(`${date}T23:59:59.999Z`) },
      });
      const added = eggLogsForDay.reduce((sum, l) => sum + l.quantityCollected, 0);

      const settings = await Settings.getSingleton();
      row = await DailyEggStock.create({
        date,
        openingStock: opening,
        addedStock: added,
        closingStock: opening + added,
        soldQuantity: 0,
        unitPrice: settings.eggSellingPrice,
        revenue: 0,
        recordedBy: req.user._id,
      });
    } else if (date === todayStr()) {
      // Today's row re-syncs to the current Settings price on every load.
      const settings = await Settings.getSingleton();
      if (row.unitPrice !== settings.eggSellingPrice) {
        row.unitPrice = settings.eggSellingPrice;
        row.revenue = row.soldQuantity * row.unitPrice;
        await row.save();
      }
    }

    res.json(row);
  })
);

// PUT /api/daily-egg-stock/:date  { closingStock }
router.put(
  '/:date',
  authorize('Administrator', 'Manager', 'Store Keeper'),
  asyncHandler(async (req, res) => {
    const { closingStock } = req.body;
    const row = await DailyEggStock.findOne({ date: req.params.date, isDeleted: { $ne: true } });
    if (!row) {
      res.status(404);
      throw new Error('Row for this date does not exist yet — load it first via GET');
    }
    const closing = Number(closingStock);
    if (closing < 0) {
      res.status(400);
      throw new Error('Closing stock cannot be negative');
    }
    const sold = row.openingStock + row.addedStock - closing;
    if (sold < 0) {
      res.status(400);
      throw new Error('Closing stock cannot exceed opening + added stock');
    }
    row.closingStock = closing;
    row.soldQuantity = sold;
    row.revenue = sold * row.unitPrice;
    await row.save();

    await logAction(req, {
      action: 'update',
      entityType: 'DailyEggStock',
      entityId: row._id,
      entityLabel: row.date,
      details: `Closing stock set to ${closing}, sold ${sold}, revenue ${row.revenue}`,
    });

    res.json(row);
  })
);

module.exports = router;
