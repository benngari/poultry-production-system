const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: 'System' },
    action: {
      type: String,
      enum: [
        'create', 'update', 'delete', 'restore', 'permanent_delete',
        'role_change', 'password_reset', 'activate', 'deactivate',
        'stock_adjust', 'login', 'logout', 'register',
      ],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['FeedBatch', 'FeedIngredient', 'Flock', 'EggLog', 'DailyEggStock', 'BirdSale', 'Settings', 'User'],
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityLabel: { type: String, default: '' },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
