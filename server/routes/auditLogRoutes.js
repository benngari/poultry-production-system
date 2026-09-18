const express = require('express');
const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('Administrator'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500);
    res.json(logs);
  })
);

module.exports = router;
