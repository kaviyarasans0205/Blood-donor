import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'emergency_request',
  'donor_match',
  'appointment_confirmation',
  'appointment_reminder',
  'low_stock',
  'expiry_warning',
  'reengagement_reminder',
  'reward_earned',
  'general',
];
export const NOTIFICATION_CHANNELS = ['email', 'sms', 'inapp'];
export const NOTIFICATION_STATUSES = ['queued', 'sent', 'delivered', 'failed', 'mocked'];

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'queued', index: true },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    relatedEntity: {
      entityType: { type: String, maxlength: 50 },
      entityId: { type: mongoose.Schema.Types.ObjectId },
    },
    error: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
