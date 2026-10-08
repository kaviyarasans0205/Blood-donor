import User from '../models/User.js';
import Donor, { BLOOD_GROUPS } from '../models/Donor.js';
import Donation from '../models/Donation.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import Appointment from '../models/Appointment.js';
import BloodInventory from '../models/BloodInventory.js';
import Alert from '../models/Alert.js';
import Notification from '../models/Notification.js';
import Requester from '../models/Requester.js';
import SystemSettings from '../models/SystemSettings.js';
import { asyncHandler, success } from '../utils/response.js';
import { getAvailableStock, getLowStockGroups, getExpiringBatches, getThresholds } from '../services/inventoryService.js';
import { getDemandPredictions } from '../services/predictionService.js';
import { notify } from '../services/notificationService.js';
import { haversineKm } from '../services/haversineService.js';

export const dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalDonors, eligibleDonors, totalRequesters, activeRequests,
    criticalCount, urgentCount, expiredOrExpiring, appointmentsPending,
    donationsThisMonth, alertsUnresolved,
  ] = await Promise.all([
    User.countDocuments({ role: 'donor', isActive: true }),
    Donor.countDocuments({ eligibilityStatus: 'eligible' }),
    User.countDocuments({ role: 'requester', isActive: true }),
    EmergencyRequest.countDocuments({ status: { $in: ['Pending', 'Matching'] } }),
    EmergencyRequest.countDocuments({ priority: 'CRITICAL', status: { $in: ['Pending', 'Matching'] } }),
    EmergencyRequest.countDocuments({ priority: 'URGENT', status: { $in: ['Pending', 'Matching'] } }),
    BloodInventory.countDocuments({ $or: [{ status: 'expired' }, { status: 'available', expiryDate: { $lte: new Date(now.getTime() + 7 * 86400000) } }] }),
    Appointment.countDocuments({ status: { $in: ['Pending', 'Confirmed'] }, appointmentDate: { $gte: now } }),
    Donation.countDocuments({ status: 'completed', donationDate: { $gte: monthStart } }),
    Alert.countDocuments({ isResolved: false }),
  ]);

  const [stock, lowStock, expiring] = await Promise.all([
    getAvailableStock(),
    getLowStockGroups(),
    getExpiringBatches(),
  ]);

  let predictions = [];
  try {
    const p = await getDemandPredictions({ forecastDays: 14 });
    predictions = p.predictions;
  } catch (e) {
    console.warn('[dashboard] prediction fetch failed:', e.message);
  }

  const [emergencyByPriority, monthlyDonations, stockByGroup, expiringTrend, appointmentStats, donorActivity] = await Promise.all([
    EmergencyRequest.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    Donation.aggregate([
      { $match: { status: 'completed', donationDate: { $gte: new Date(Date.now() - 365 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$donationDate' } }, units: { $sum: '$units' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Object.entries(stock).map(([bloodGroup, units]) => ({ bloodGroup, units })),
    BloodInventory.aggregate([
      { $match: { status: 'available' } },
      { $group: { _id: { $cond: [{ $lte: ['$expiryDate', new Date(now.getTime() + 7 * 86400000)] }, 'expiring_soon', 'safe'] }, units: { $sum: '$units' } } },
    ]),
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { role: 'donor', createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return success(res, {
    cards: {
      totalDonors,
      eligibleDonors,
      availableUnits: Object.values(stock).reduce((a, b) => a + b, 0),
      activeRequests,
      criticalRequests: criticalCount,
      urgentRequests: urgentCount,
      expiringUnits: expiredOrExpiring,
      lowStockGroups: lowStock.length,
      appointments: appointmentsPending,
      donationsThisMonth,
      totalRequesters: totalRequesters,
      unresolvedAlerts: alertsUnresolved,
      predictedDemand: predictions.map((p) => ({ bloodGroup: p.bloodGroup, predictedDemand: p.predictedDemand, riskLevel: p.riskLevel })),
    },
    stock,
    lowStock,
    expiring,
    charts: { emergencyByPriority, monthlyDonations, stockByGroup, expiringTrend, appointmentStats, donorActivity },
  }, 'OK');
});

export const analytics = asyncHandler(async (_req, res) => {
  const since = new Date(Date.now() - 365 * 86400000);
  const [donationsByGroup, requestsByGroup, requestsByCity, topDonors, donorTrend, responseStats] = await Promise.all([
    Donation.aggregate([{ $match: { status: 'completed', donationDate: { $gte: since } } }, { $group: { _id: '$bloodGroup', units: { $sum: '$units' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    EmergencyRequest.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$bloodGroup', units: { $sum: '$requiredUnits' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    EmergencyRequest.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$hospital', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Donation.aggregate([
      { $match: { status: 'completed', donationDate: { $gte: since } } },
      { $group: { _id: '$donorId', donations: { $sum: 1 }, units: { $sum: '$units' } } },
      { $sort: { donations: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'donors', localField: '_id', foreignField: '_id', as: 'donor' } },
      { $unwind: { path: '$donor', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'donor.userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $project: { donations: 1, units: 1, name: '$user.name', bloodGroup: '$donor.bloodGroup' } },
    ]),
    Donor.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, newDonors: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    EmergencyRequest.aggregate([
      { $match: { resolvedAt: { $ne: null } } },
      { $group: { _id: null, avgHours: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000] } }, count: { $sum: 1 } } },
    ]),
  ]);
  return success(res, { donationsByGroup, requestsByGroup, requestsByCity, topDonors, donorTrend, responseStats: responseStats[0] || null });
});

export const donorMap = asyncHandler(async (req, res) => {
  const { bloodGroup, eligibleOnly = 'true', radiusKm, latitude, longitude } = req.query;
  const filter = {};
  if (bloodGroup && BLOOD_GROUPS.includes(bloodGroup)) filter.bloodGroup = bloodGroup;
  if (eligibleOnly === 'true') filter.eligibilityStatus = { $ne: 'ineligible' };

  const donors = await Donor.find(filter).limit(1000).lean();
  const users = await User.find({ _id: { $in: donors.map((d) => d.userId) }, isActive: true }).select('name phone').lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  let points = donors
    .filter((d) => d.latitude != null && d.longitude != null)
    .map((d) => ({
      donorId: d._id,
      // privacy: masked name + no exact address for map view
      label: `${(userMap.get(String(d.userId))?.name || 'Donor').charAt(0)}***`,
      bloodGroup: d.bloodGroup,
      city: d.city,
      latitude: d.latitude,
      longitude: d.longitude,
      eligibilityStatus: d.eligibilityStatus,
      availability: d.availability,
      lastDonationDate: d.lastDonationDate,
      hasPhone: Boolean(userMap.get(String(d.userId))?.phone),
      distanceKm:
        latitude != null && longitude != null
          ? Math.round(haversineKm(Number(latitude), Number(longitude), d.latitude, d.longitude) * 100) / 100
          : null,
    }));

  if (radiusKm && latitude != null && longitude != null) {
    points = points.filter((p) => p.distanceKm <= Number(radiusKm));
  }
  return success(res, points, 'OK', { total: points.length });
});

export const reengagement = asyncHandler(async (req, res) => {
  const inactiveMonths = Number(req.query.inactiveMonths || (await SystemSettings.get('reengagement_inactive_months', 6)));
  const cutoff = new Date(Date.now() - inactiveMonths * 30 * 24 * 3600 * 1000);

  const inactive = await Donor.find({
    $or: [{ lastDonationDate: { $lt: cutoff } }, { lastDonationDate: null }],
    reEngagementDisabled: { $ne: true },
  })
    .populate({ path: 'userId', select: 'name email phone' })
    .limit(Number(req.query.limit || 100))
    .lean();

  const stats = await Donor.aggregate([
    { $group: { _id: { $cond: [{ $gte: ['$lastDonationDate', cutoff] }, 'active', 'inactive'] }, count: { $sum: 1 } } },
  ]);

  return success(res, {
    inactive: inactive.map((d) => ({
      donorId: d._id,
      name: d.userId?.name,
      email: d.userId?.email,
      bloodGroup: d.bloodGroup,
      city: d.city,
      lastDonationDate: d.lastDonationDate,
      rewardPoints: d.rewardPoints,
      daysSinceDonation: d.lastDonationDate ? Math.floor((Date.now() - new Date(d.lastDonationDate)) / 86400000) : null,
    })),
    stats: { inactiveMonths, breakdown: stats },
  });
});

export const sendReengagement = asyncHandler(async (req, res) => {
  const { donorIds, all = false } = req.body;
  let targets = [];
  if (all) {
    const cutoff = new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000);
    targets = await Donor.find({ $or: [{ lastDonationDate: { $lt: cutoff } }, { lastDonationDate: null }], reEngagementDisabled: { $ne: true } }).select('userId');
  } else if (Array.isArray(donorIds)) {
    targets = await Donor.find({ _id: { $in: donorIds } }).select('userId');
  }
  let sent = 0;
  for (const t of targets) {
    try {
      await notify({ userId: t.userId, type: 'reengagement_reminder', channels: ['inapp', 'email'] });
      sent++;
    } catch (e) { console.warn('[reengage]', e.message); }
  }
  if (req.audit) await req.audit(null, { action: 'send_reengagement', count: sent });
  return success(res, { sent, total: targets.length }, `Reminders queued for ${sent} donor(s)`);
});

export const settings = asyncHandler(async (req, res) => {
  if (req.method === 'PUT') {
    const updates = req.body;
    const results = {};
    for (const [key, value] of Object.entries(updates)) {
      results[key] = await SystemSettings.set(key, value, req.user.id, 'Admin updated');
    }
    if (req.audit) await req.audit(null, { action: 'update_settings', keys: Object.keys(updates) });
    return success(res, results, 'Settings updated');
  }
  const keys = ['low_stock_thresholds', 'reward_config', 'eligibility_rules', 'reengagement_inactive_months', 'expiry_warning_days', 'appointment_reminder_hours'];
  const out = {};
  for (const k of keys) out[k] = await SystemSettings.findOne({ key: k }).lean();
  return success(res, out);
});

export const alerts = asyncHandler(async (req, res) => {
  const { type, unresolvedOnly = 'true', page = 1, limit = 25 } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (unresolvedOnly === 'true') filter.isResolved = false;
  const [items, total] = await Promise.all([
    Alert.find(filter).sort({ severity: 1, createdAt: -1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
    Alert.countDocuments(filter),
  ]);
  return success(res, items, 'OK', { total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const resolveAlert = asyncHandler(async (req, res) => {
  const doc = await Alert.findByIdAndUpdate(req.params.id, { isResolved: true, resolvedAt: new Date(), resolvedBy: req.user.id }, { new: true });
  if (!doc) return res.status(404).json({ success: false, message: 'Alert not found', errorCode: 'ALERT_NOT_FOUND' });
  return success(res, doc, 'Alert resolved');
});

export default { dashboard, analytics, donorMap, reengagement, sendReengagement, settings, alerts, resolveAlert };
