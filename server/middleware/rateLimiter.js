const rateLimit = require('express-rate-limit');
const AuditLog = require('../models/AuditLog');

// Applied to /auth/login and /auth/register from day one — this is the
// exact gap the sibling dairy project left open (limiter written, never
// wired into the route file). Don't repeat that here.

const makeLimiter = ({ windowMs, max, action, label }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res) => {
      try {
        await AuditLog.create({
          userName: 'System',
          action,
          entityType: 'User',
          entityLabel: req.body?.email || req.ip,
          details: `Rate limit exceeded on ${label} from IP ${req.ip}`,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error('AuditLog write failed on rate-limit block:', err.message);
      }
      res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    },
  });

const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 6,
  action: 'login',
  label: '/auth/login',
});

const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  action: 'register',
  label: '/auth/register',
});

module.exports = { loginLimiter, registerLimiter };
