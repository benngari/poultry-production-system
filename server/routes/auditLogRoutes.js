const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { summarizeLogs } = require('../utils/activitySummary');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('Administrator'));

const MAX_DAYS = 30;
const LOG_FETCH_LIMIT = 5000;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500);
    res.json(logs);
  })
);

// GET /api/audit-logs/user-summary?userId=<id>&days=7
// "What has this person done lately" — condensed from the audit log so the
// Administrator doesn't have to scroll the raw list and filter by eye.
router.get(
  '/user-summary',
  asyncHandler(async (req, res) => {
    const { userId } = req.query;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(400);
      throw new Error('A valid userId is required');
    }
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), MAX_DAYS);

    const user = await User.findById(userId).select('name email role isActive lastLoginAt lastActiveAt');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Window starts at 00:00 UTC of the first day shown, so it lines up
    // exactly with the per-day buckets in summarizeLogs.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - (days - 1));
    since.setUTCHours(0, 0, 0, 0);

    const logs = await AuditLog.find({ user: userId, timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(LOG_FETCH_LIMIT)
      .select('action entityType entityLabel details timestamp')
      .lean();

    const summary = summarizeLogs(logs, days);

    res.json({
      user,
      days,
      ...summary,
      // Counts above are exact up to the fetch limit; flag it if we hit it
      // so the UI can say so rather than quietly under-reporting.
      truncated: logs.length >= LOG_FETCH_LIMIT,
      recent: logs.slice(0, 50),
    });
  })
);

module.exports = router;
