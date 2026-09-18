const cron = require('node-cron');
const Flock = require('../models/Flock');
const Settings = require('../models/Settings');
const FeedStock = require('../models/FeedStock');
const AuditLog = require('../models/AuditLog');

const todayStr = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

/**
 * Computes and deducts today's automatic feed consumption, exactly once
 * per calendar day. Guarded by FeedStock.lastAutoDeductionDate so a
 * server restart mid-day can't double-deduct — mirrors the dairy
 * project's idempotent startup check.
 */
const runAutoFeedDeduction = async () => {
  const today = todayStr();
  const feedStock = await FeedStock.getSingleton();

  if (feedStock.lastAutoDeductionDate === today) {
    return; // already ran today
  }

  const [flock, settings] = await Promise.all([Flock.getSingleton(), Settings.getSingleton()]);

  const requiredKg =
    flock.liveLayerCount * settings.feedPerLayerKgPerDay +
    flock.liveRoosterCount * settings.feedPerRoosterKgPerDay;

  if (requiredKg <= 0) {
    feedStock.lastAutoDeductionDate = today;
    await feedStock.save();
    return;
  }

  if (feedStock.stockKg < requiredKg) {
    // Block the deduction, but still mark today as attempted and log it
    // loudly so it surfaces as an alert rather than silently going negative.
    feedStock.lastAutoDeductionDate = today;
    await feedStock.save();
    await AuditLog.create({
      userName: 'System (cron)',
      action: 'stock_adjust',
      entityType: 'FeedIngredient',
      entityLabel: 'FeedStock',
      details: `BLOCKED — insufficient finished feed stock for automatic daily deduction. Required ${requiredKg.toFixed(2)}kg, available ${feedStock.stockKg.toFixed(2)}kg. Layers=${flock.liveLayerCount}, Roosters=${flock.liveRoosterCount}.`,
      timestamp: new Date(),
    });
    return;
  }

  feedStock.stockKg -= requiredKg;
  feedStock.lastAutoDeductionDate = today;
  await feedStock.save();

  await AuditLog.create({
    userName: 'System (cron)',
    action: 'stock_adjust',
    entityType: 'FeedIngredient',
    entityLabel: 'FeedStock',
    details: `Automatic daily deduction: ${requiredKg.toFixed(2)}kg (Layers=${flock.liveLayerCount} x ${settings.feedPerLayerKgPerDay}kg, Roosters=${flock.liveRoosterCount} x ${settings.feedPerRoosterKgPerDay}kg). Remaining stock: ${feedStock.stockKg.toFixed(2)}kg.`,
    timestamp: new Date(),
  });
};

const scheduleAutoFeedDeduction = () => {
  // 00:05 daily, server time.
  cron.schedule('5 0 * * *', () => {
    runAutoFeedDeduction().catch((err) => console.error('Auto feed deduction failed:', err.message));
  });

  // Also run once at boot (covers the case the server was down at 00:05),
  // guarded by the same lastAutoDeductionDate check so it's a no-op if
  // today already ran.
  runAutoFeedDeduction().catch((err) => console.error('Startup feed deduction check failed:', err.message));
};

module.exports = { scheduleAutoFeedDeduction, runAutoFeedDeduction };
