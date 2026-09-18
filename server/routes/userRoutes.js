const express = require('express');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logAction = require('../utils/logAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('Administrator'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    const withOnline = users.map((u) => ({
      ...u.toObject(),
      online: u.lastActiveAt && Date.now() - new Date(u.lastActiveAt).getTime() < 5 * 60 * 1000,
    }));
    res.json(withOnline);
  })
);

router.put(
  '/:id/activate',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    user.isActive = true;
    await user.save();
    await logAction(req, { action: 'activate', entityType: 'User', entityId: user._id, entityLabel: user.email });
    res.json({ message: 'User activated' });
  })
);

router.put(
  '/:id/deactivate',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    if (String(user._id) === String(req.user._id)) {
      res.status(400);
      throw new Error('You cannot deactivate your own account');
    }
    user.isActive = false;
    await user.save();
    await logAction(req, { action: 'deactivate', entityType: 'User', entityId: user._id, entityLabel: user.email });
    res.json({ message: 'User deactivated' });
  })
);

router.put(
  '/:id/role',
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!['Administrator', 'Manager', 'Flock Operator', 'Store Keeper'].includes(role)) {
      res.status(400);
      throw new Error('Invalid role');
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    const oldRole = user.role;
    user.role = role;
    await user.save();
    await logAction(req, {
      action: 'role_change',
      entityType: 'User',
      entityId: user._id,
      entityLabel: user.email,
      details: `${oldRole} -> ${role}`,
    });
    res.json({ message: 'Role updated' });
  })
);

router.put(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await logAction(req, { action: 'password_reset', entityType: 'User', entityId: user._id, entityLabel: user.email });
    res.json({ message: 'Password reset' });
  })
);

module.exports = router;
