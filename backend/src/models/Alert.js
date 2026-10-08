import mongoose from 'mongoose';

export const ALERT_TYPES = ['low_stock', 'expiry_warning', 'expired', 'system'];
export const ALERT_SEVERITY = ['info', 'warning', 'critical'];

const alertSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ALERT_TYPES, required: true, index: true },
    severity: { type: String, enum: ALERT_SEVERITY, required: true, index: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 1000 },
    bloodGroup: { type: String, index: true },
    relatedEntity: {
      entityType: { type: String, maxlength: 50 },
      entityId: { type: mongoose.Schema.Types.ObjectId },
    },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dedupeKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

const Alert = mongoose.model('Alert', alertSchema);
export default Alert;
