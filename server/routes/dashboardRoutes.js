const express = require('express');
const asyncHandler = require('express-async-handler');
const EggLog = require('../models/EggLog');
const DailyEggStock = require('../models/DailyEggStock');
const BirdSale = require('../models/BirdSale');
const FeedBatch = require('../models/FeedBatch');
const FeedingLog = require('../models/FeedingLog');
const FeedIngredient = require('../models/FeedIngredient');
const FeedStock = require('../models/FeedStock');
const Flock = require('../models/Flock');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

const dateStr = (d) => new Date(d).toISOString().slice(0, 10);
const startOfDay = (d) => new Date(`${dateStr(d)}T00:00:00.000Z`);
const endOfDay = (d) => new Date(`${dateStr(d)}T23:59:59.999Z`);

// GET /api/dashboard/summary
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const today = new Date();
    const todayKey = dateStr(today);

    const [
      eggsToday,
      todaysFeedingLogs,
      todaysStockRow,
      todaysBirdSales,
      allEggLogs,
      allBatches,
      allFeedingLogs,
      allBirdSales,
      flock,
      feedStock,
      lowIngredients,
      settings,
    ] = await Promise.all([
      EggLog.aggregate([
        { $match: { isDeleted: { $ne: true }, date: { $gte: startOfDay(today), $lte: endOfDay(today) } } },
        { $group: { _id: null, total: { $sum: '$quantityCollected' } } },
      ]),
      // Feed actually given to the flock today — FeedingLog, not FeedBatch.
      // FeedBatch is "feed added to the store" (production); FeedingLog is
      // "feed scooped out of the store and fed" (consumption).
      FeedingLog.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(today), $lte: endOfDay(today) } }),
      DailyEggStock.findOne({ date: todayKey, isDeleted: { $ne: true } }),
      BirdSale.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(today), $lte: endOfDay(today) } }),
      EggLog.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$quantityCollected' } } },
      ]),
      FeedBatch.aggregate([{ $group: { _id: null, totalCost: { $sum: '$totalCost' } } }]),
      // All-time feed consumed, for the "by consumption" cost basis.
      FeedingLog.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, totalKg: { $sum: '$quantityKg' } } },
      ]),
      BirdSale.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, totalCount: { $sum: '$quantity' } } },
      ]),
      Flock.getSingleton(),
      FeedStock.getSingleton(),
      FeedIngredient.find({ isDeleted: { $ne: true }, $expr: { $lte: ['$stock', '$minStock'] } }),
      Settings.getSingleton(),
    ]);

    // All-time egg revenue = sum of DailyEggStock.revenue across all rows.
    const allEggStockRows = await DailyEggStock.find({ isDeleted: { $ne: true } });
    const totalEggRevenue = allEggStockRows.reduce((s, r) => s + (r.revenue || 0), 0);

    const feedConsumedToday = todaysFeedingLogs.reduce((s, l) => s + l.quantityKg, 0);
    const eggRevenueToday = todaysStockRow ? todaysStockRow.revenue : 0;
    const birdRevenueToday = todaysBirdSales.reduce((s, b) => s + b.totalPrice, 0);
    const revenueToday = eggRevenueToday + birdRevenueToday;

    // Today's feed cost always uses consumption (what was actually eaten
    // today), priced at the flat compounded-feed rate — a same-day P&L
    // view only makes sense against same-day consumption.
    const todaysFeedCost = feedConsumedToday * settings.compoundedFeedCostPerKg;
    const profitToday = revenueToday - todaysFeedCost;

    // All-time: TWO bases, since "how much have I spent stocking feed"
    // and "what did the feed I actually fed out cost" are both legitimate
    // questions with different answers. The frontend toggles between them.
    const totalFeedCostProduced = allBatches[0] ? allBatches[0].totalCost : 0;
    const totalFeedConsumedKgAllTime = allFeedingLogs[0] ? allFeedingLogs[0].totalKg : 0;
    const totalFeedCostConsumed = totalFeedConsumedKgAllTime * settings.compoundedFeedCostPerKg;

    const totalBirdRevenue = allBirdSales[0] ? allBirdSales[0].totalRevenue : 0;
    const totalBirdsSold = allBirdSales[0] ? allBirdSales[0].totalCount : 0;
    const totalRevenue = totalEggRevenue + totalBirdRevenue;
    const expectedProfitProduced = totalRevenue - totalFeedCostProduced;
    const expectedProfitConsumed = totalRevenue - totalFeedCostConsumed;

    res.json({
      today: {
        eggsCollected: eggsToday[0]?.total || 0,
        feedConsumedKg: feedConsumedToday,
        revenue: revenueToday,
        profit: profitToday,
        birdsSold: todaysBirdSales.reduce((s, b) => s + b.quantity, 0),
      },
      allTime: {
        totalEggsCollected: allEggLogs[0]?.total || 0,
        totalFeedCostProduced,
        totalFeedCostConsumed,
        totalFeedConsumedKg: totalFeedConsumedKgAllTime,
        totalRevenue,
        expectedProfitProduced,
        expectedProfitConsumed,
        totalBirdsSold,
        currentFlockSize: flock.liveLayerCount + flock.liveRoosterCount + flock.liveChickCount,
      },
      flock,
      feedStock,
      lowStockIngredients: lowIngredients,
      settings,
    });
  })
);

// GET /api/dashboard/weekly?range=week|2weeks|30days
router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const range = req.query.range || 'week';
    const days = range === '30days' ? 30 : range === '2weeks' ? 14 : 7;

    const points = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateStr(d);

      const [eggAgg, feedingLogs] = await Promise.all([
        EggLog.aggregate([
          { $match: { isDeleted: { $ne: true }, date: { $gte: startOfDay(d), $lte: endOfDay(d) } } },
          { $group: { _id: null, total: { $sum: '$quantityCollected' } } },
        ]),
        FeedingLog.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(d), $lte: endOfDay(d) } }),
      ]);

      points.push({
        date: key,
        eggsCollected: eggAgg[0]?.total || 0,
        feedConsumedKg: feedingLogs.reduce((s, l) => s + l.quantityKg, 0),
      });
    }

    res.json(points);
  })
);

module.exports = router;