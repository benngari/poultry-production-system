const mongoose = require('mongoose');

// Cause-and-treatment diary — separate from Flock.liveXCount changes.
// Recording a death here does NOT itself decrement the flock; use the
// Flock page's Adjust form (died/culled) for that, same as before. This
// log exists so that when a count does drop, there's a record of *why*
// to look back on — vaccine given, disease suspected, treatment applied.
const healthLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    recordType: {
      type: String,
      enum: ['vaccination', 'treatment', 'disease', 'mortality', 'other'],
      required: true,
    },
    birdType: { type: String, enum: ['layer', 'rooster', 'chick', 'all'], default: 'all' },
    quantityAffected: { type: Number },
    title: { type: String, required: true }, // e.g. "Newcastle Disease vaccine", "Coccidiosis outbreak"
    medication: { type: String, default: '' },
    dosage: { type: String, default: '' },
    note: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HealthLog', healthLogSchema);
