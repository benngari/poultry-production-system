const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit log writer. Always await this BEFORE any `return`
 * in the calling route — a dead-code audit call placed after a return is
 * exactly the bug the sibling dairy project shipped with for FeedBatch
 * creation. Call it, then return.
 */
const logAction = async (req, { action, entityType, entityId, entityLabel = '', details = '' }) => {
  try {
    await AuditLog.create({
      user: req.user ? req.user._id : undefined,
      userName: req.user ? req.user.name : 'System',
      action,
      entityType,
      entityId,
      entityLabel,
      details,
      timestamp: new Date(),
    });
  } catch (err) {
    // Never let a logging failure break the actual request.
    console.error('AuditLog write failed:', err.message);
  }
};

module.exports = logAction;
