const express = require('express');
const asyncHandler = require('express-async-handler');
const Settings = require('../models/Settings');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    res.json(settings);
  })
);

router.put(
  '/',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSingleton();
    Object.assign(settings, req.body);
    await settings.save();
    await logAction(req, {
      action: 'update',
      entityType: 'Settings',
      entityId: settings._id,
      entityLabel: 'Settings',
    });
    res.json(settings);
  })
);

module.exports = router;
