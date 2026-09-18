const express = require('express');
const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const logAction = require('../utils/logAction');
const { protect } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
});

// @route POST /api/auth/register
router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400);
      throw new Error('All fields are required');
    }
    if (role === 'Administrator') {
      res.status(400);
      throw new Error('Administrator role cannot be self-selected');
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      res.status(400);
      throw new Error('An account with that email already exists');
    }

    const userCount = await User.countDocuments();
    const isBootstrap = userCount === 0;

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: isBootstrap ? 'Administrator' : role,
      isActive: isBootstrap, // first-ever user is auto-approved
    });

    req.user = user; // for logAction attribution
    await logAction(req, {
      action: 'register',
      entityType: 'User',
      entityId: user._id,
      entityLabel: user.email,
      details: isBootstrap
        ? 'Bootstrap Administrator account created and auto-approved'
        : 'New registration, pending Administrator approval',
    });

    if (isBootstrap) {
      return res.status(201).json({
        message: 'Bootstrap Administrator account created — you can log in now.',
        user: sanitize(user),
      });
    }

    res.status(201).json({
      message: 'Registered. Your account needs Administrator approval before you can log in.',
      user: sanitize(user),
    });
  })
);

// @route POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      res.status(403);
      throw new Error('Your account is not active yet — an Administrator needs to approve it first.');
    }

    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    await user.save();

    req.user = user;
    await logAction(req, {
      action: 'login',
      entityType: 'User',
      entityId: user._id,
      entityLabel: user.email,
    });

    res.json({ token: signToken(user), user: sanitize(user) });
  })
);

// @route POST /api/auth/logout
router.post(
  '/logout',
  protect,
  asyncHandler(async (req, res) => {
    await logAction(req, {
      action: 'logout',
      entityType: 'User',
      entityId: req.user._id,
      entityLabel: req.user.email,
    });
    res.json({ message: 'Logged out' });
  })
);

// @route GET /api/auth/me
router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    res.json(sanitize(req.user));
  })
);

module.exports = router;
