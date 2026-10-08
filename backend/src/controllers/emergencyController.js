import EmergencyRequest, { PRIORITIES, REQUEST_STATUSES } from '../models/EmergencyRequest.js';
import Requester from '../models/Requester.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created } from '../utils/response.js';
import { classifyPriority, buildPriorityQueue, PRIORITY_ORDER } from '../services/priorityService.js';
import { findMatchingDonors } from '../services/matchingService.js';
import { notify } from '../services/notificationService.js';
import { getAvailableStock, consumeStock } from '../services/inventoryService.js';
import { haversineKm } from '../services/haversineService.js';

export const create = asyncHandler(async (req, res) => {
  const {
    patientName, hospital, contactNumber, bloodGroup, requiredUnits,
    latitude, longitude, address, requiredAt, emergencyLevel, notes,
  } = req.body;

  const createdAt = new Date();
  const { priority, priorityScore, reasons } = classifyPriority({ emergencyLevel, requiredAt, createdAt, notes });

  const doc = await EmergencyRequest.create({
    requesterId: req.user.id,
    patientName, hospital, contactNumber, bloodGroup,
    requiredUnits: Number(requiredUnits),
    latitude: Number(latitude), longitude: Number(longitude), address,
    requiredAt: new Date(requiredAt),
    priority, priorityScore, notes,
    status: 'Pending',
  });
  doc.notes = `${notes ? notes + '\n' : ''}[auto-classified: ${reasons.join(' ')}]`;
  await doc.save();

  if (req.audit) await req.audit(doc._id, { action: 'create_emergency_request', priority, priorityScore, bloodGroup });

  // async side-effects: inventory check + donor matching + notifications
  setImmediate(async () => {
    try {
      const stock = await getAvailableStock();
      const matches = await findMatchingDonors({
        bloodGroup, latitude: Number(latitude), longitude: Number(longitude),
        radiusKm: priority === 'CRITICAL' ? 100 : 50, limit: 20,
      });

      doc.status = stock[bloodGroup] >= Number(requiredUnits) ? 'Matching' : 'Matching';
      doc.matchedDonors = matches.slice(0, 10).map((m) => ({ donorId: m.donorId, distanceKm: m.distanceKm, response: 'pending' }));
      await doc.save();

      const eligibleNotified = matches.filter((m) => m.eligible && m.notificationConsent).slice(0, 10);
      for (const m of eligibleNotified) {
        await notify({
          userId: m.userId,
          type: 'emergency_request',
          channels: ['inapp', 'email', 'sms'],
          data: {
            bloodGroup, requiredUnits, hospital, priority,
            distanceKm: m.distanceKm,
            relatedEntity: { entityType: 'EmergencyRequest', entityId: doc._id },
          },
        });
      }

      // notify admins
      const admins = await (await import('../models/User.js')).default.find({ role: 'admin', isActive: true }).select('_id');
      for (const a of admins) {
        await notify({
          userId: a._id, type: 'emergency_request', channels: ['inapp'],
          title: `New ${priority} request: ${bloodGroup}`,
          message: `${hospital} needs ${requiredUnits} unit(s) of ${bloodGroup}. ${matches.length} compatible donors found.`,
          data: { relatedEntity: { entityType: 'EmergencyRequest', entityId: doc._id } },
        });
      }
    } catch (err) {
      console.warn('[emergency] match/notify failed:', err.message);
    }
  });

  return created(res, { ...doc.toObject(), classificationReasons: reasons }, 'Emergency request created');
});

export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, priority, bloodGroup, search, sort = '-createdAt' } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (bloodGroup) filter.bloodGroup = bloodGroup;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ patientName: rx }, { hospital: rx }];
  }
  if (req.user.role === 'requester') {
    filter.requesterId = req.user.id;
    const requester = await Requester.findOne({ userId: req.user.id });
    if (!requester) return success(res, [], 'OK', { total: 0, page: 1, pages: 0 });
  }

  const [items, total] = await Promise.all([
    EmergencyRequest.find(filter).sort(sort).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)).populate('requesterId', 'name email'),
    EmergencyRequest.countDocuments(filter),
  ]);
  return success(res, items, 'OK', { total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const getOne = asyncHandler(async (req, res) => {
  const doc = await EmergencyRequest.findById(req.params.id).populate('requesterId', 'name email phone');
  if (!doc) throw ApiError.notFound('Emergency request not found', 'REQUEST_NOT_FOUND');
  if (req.user.role === 'requester' && String(doc.requesterId._id) !== req.user.id) {
    throw ApiError.forbidden('You may only view your own requests');
  }
  const stock = await getAvailableStock();
  return success(res, { ...doc.toObject(), availableStock: stock[doc.bloodGroup] ?? 0 });
});

export const update = asyncHandler(async (req, res) => {
  const doc = await EmergencyRequest.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Emergency request not found', 'REQUEST_NOT_FOUND');

  const isOwner = req.user.role === 'requester' && String(doc.requesterId) === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) throw ApiError.forbidden('Not permitted');

  const { status, priority, priorityOverrideReason, fulfilledUnits, notes } = req.body;

  if (priority && isAdmin && priority !== doc.priority) {
    if (!PRIORITIES.includes(priority)) throw ApiError.badRequest('Invalid priority');
    doc.priorityOverrideBy = req.user.id;
    doc.priorityOverrideReason = priorityOverrideReason || 'Manual override';
    doc.priority = priority;
    doc.priorityScore = 100;
  } else if (priority && !isAdmin) {
    throw ApiError.forbidden('Only admins may override priority');
  }

  if (status) {
    if (!REQUEST_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status');
    doc.status = status;
    if (['Fulfilled', 'Cancelled', 'Expired'].includes(status)) doc.resolvedAt = new Date();
  }
  if (fulfilledUnits !== undefined) doc.fulfilledUnits = Number(fulfilledUnits);
  if (notes !== undefined) doc.notes = notes;

  await doc.save();
  if (req.audit) await req.audit(doc._id, { action: 'update_request', changes: req.body });
  return success(res, doc, 'Request updated');
});

export const priorityQueue = asyncHandler(async (req, res) => {
  const { includeResolved = 'false', limit = 50 } = req.query;
  const filter = includeResolved === 'true'
    ? {}
    : { status: { $in: ['Pending', 'Matching', 'Partially Fulfilled'] } };
  const items = await EmergencyRequest.find(filter).sort({ createdAt: 1 }).limit(Number(limit)).lean();
  const queue = buildPriorityQueue(items).map((item, index) => ({
    ...item,
    queuePosition: index + 1,
    distanceKm: req.query.latitude
      ? Math.round(haversineKm(Number(req.query.latitude), Number(req.query.longitude), item.latitude, item.longitude) * 100) / 100
      : null,
  }));
  return success(res, queue, 'OK', {
    total: queue.length,
    counts: queue.reduce((acc, q) => ({ ...acc, [q.priority]: (acc[q.priority] || 0) + 1 }), {}),
  });
});

export const runMatching = asyncHandler(async (req, res) => {
  const doc = await EmergencyRequest.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Emergency request not found', 'REQUEST_NOT_FOUND');
  const radiusKm = Number(req.query.radiusKm || (doc.priority === 'CRITICAL' ? 100 : 50));
  const matches = await findMatchingDonors({
    bloodGroup: doc.bloodGroup, latitude: doc.latitude, longitude: doc.longitude, radiusKm, limit: 30,
  });
  doc.matchedDonors = matches.slice(0, 15).map((m) => ({ donorId: m.donorId, distanceKm: m.distanceKm, response: 'pending' }));
  if (doc.status === 'Pending') doc.status = 'Matching';
  await doc.save();

  let notified = 0;
  if (req.query.notify === 'true') {
    for (const m of matches.filter((x) => x.eligible && x.notificationConsent).slice(0, 15)) {
      try {
        await notify({
          userId: m.userId, type: 'donor_match', channels: ['inapp', 'email'],
          data: { bloodGroup: doc.bloodGroup, distanceKm: m.distanceKm, relatedEntity: { entityType: 'EmergencyRequest', entityId: doc._id } },
        });
        notified++;
      } catch (e) { console.warn('[match notify]', e.message); }
    }
  }
  return success(res, { matches, notified }, 'Matching complete', { total: matches.length, radiusKm });
});

export const fulfillFromInventory = asyncHandler(async (req, res) => {
  const doc = await EmergencyRequest.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Emergency request not found', 'REQUEST_NOT_FOUND');
  if (req.user.role !== 'admin') throw ApiError.forbidden('Only admins may allocate inventory');

  const units = Number(req.body.units || doc.requiredUnits - doc.fulfilledUnits);
  const result = await consumeStock(doc.bloodGroup, units);
  doc.fulfilledUnits += result.consumed;
  if (doc.fulfilledUnits >= doc.requiredUnits) {
    doc.status = 'Fulfilled';
    doc.resolvedAt = new Date();
  } else {
    doc.status = 'Partially Fulfilled';
  }
  await doc.save();
  if (req.audit) await req.audit(doc._id, { action: 'fulfill_from_inventory', units: result.consumed });
  return success(res, doc, `Allocated ${result.consumed} unit(s)`, { remainingStockRequest: result.remainingRequested });
});

export default { create, list, getOne, update, priorityQueue, runMatching, fulfillFromInventory };
