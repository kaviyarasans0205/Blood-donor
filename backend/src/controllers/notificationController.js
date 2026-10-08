import Notification from '../models/Notification.js';
import { asyncHandler, success } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';
import { notify } from '../services/notificationService.js';

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, channel, unreadOnly = 'false' } = req.query;
  const filter = { userId: req.user.id };
  if (type) filter.type = type;
  if (channel) filter.channel = channel;
  if (unreadOnly === 'true') filter.readAt = null;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user.id, readAt: null }),
  ]);
  return success(res, items, 'OK', { total, unread, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const markRead = asyncHandler(async (req, res) => {
  const doc = await Notification.findOne({ _id: req.params.id, userId: req.user.id });
  if (!doc) throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  if (!doc.readAt) {
    doc.readAt = new Date();
    doc.status = doc.status === 'queued' ? 'delivered' : doc.status;
    await doc.save();
  }
  return success(res, doc, 'Marked as read');
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ userId: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  return success(res, { modified: result.modifiedCount }, 'All notifications marked as read');
});

export const send = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') throw ApiError.forbidden('Only admins may send notifications');
  const { userId, type, channels, data, title, message } = req.body;
  if (!userId || !title || !message) {
    throw ApiError.badRequest('userId, title and message are required', 'VALIDATION_ERROR');
  }
  const result = await notify({ userId, type, channels: channels || ['inapp'], data: data || {}, title, message });
  return success(res, result, 'Notification sent');
});

export default { list, markRead, markAllRead, send };
