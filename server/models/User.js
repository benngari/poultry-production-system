const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['Administrator', 'Manager', 'Flock Operator', 'Store Keeper'],
      required: true,
    },
    isActive: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastActiveAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
