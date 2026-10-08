import BloodInventory from '../models/BloodInventory.js';
import { BLOOD_GROUPS } from '../models/Donor.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created, noContent } from '../utils/response.js';
import * as inventoryService from '../services/inventoryService.js';

export const list = asyncHandler(async (req, res) => {
  const { bloodGroup, status, location, search, sort = '-expiryDate', page = 1, limit = 50, expiringWithinDays } = req.query;
  const filter = {};
  if (bloodGroup && BLOOD_GROUPS.includes(bloodGroup)) filter.bloodGroup = bloodGroup;
  if (status) filter.status = status;
  if (location) filter.location = new RegExp(String(location).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (search) filter.batchNumber = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (expiringWithinDays) {
    filter.expiryDate = { $lte: new Date(Date.now() + Number(expiringWithinDays) * 24 * 3600 * 1000), $gt: new Date() };
  }

  const [items, total, stock] = await Promise.all([
    BloodInventory.find(filter).sort(sort).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
    BloodInventory.countDocuments(filter),
    inventoryService.getAvailableStock(),
  ]);

  return success(res, items, 'OK', {
    total, page: Number(page), pages: Math.ceil(total / Number(limit)),
    stockSummary: stock,
    totalUnits: Object.values(stock).reduce((a, b) => a + b, 0),
  });
});

export const create = asyncHandler(async (req, res) => {
  const { bloodGroup, units, batchNumber, collectionDate, expiryDate, location, notes } = req.body;
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw ApiError.badRequest('Invalid blood group', 'INVALID_BLOOD_GROUP');
  const doc = await inventoryService.addStock({
    bloodGroup, units: Number(units), batchNumber, collectionDate, expiryDate, location, notes, createdBy: req.user.id,
  });
  if (req.audit) await req.audit(doc._id, { action: 'add_stock', bloodGroup, units });
  return created(res, doc, 'Stock added');
});

export const update = asyncHandler(async (req, res) => {
  const doc = await BloodInventory.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Inventory record not found', 'INVENTORY_NOT_FOUND');
  const before = { units: doc.units, status: doc.status };
  const allowed = ['units', 'expiryDate', 'location', 'status', 'notes'];
  for (const k of allowed) if (req.body[k] !== undefined) doc[k] = req.body[k];
  await doc.save();
  if (req.audit) await req.audit(doc._id, { action: 'update_stock', before, after: { units: doc.units, status: doc.status } });
  return success(res, doc, 'Inventory updated');
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await BloodInventory.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Inventory record not found', 'INVENTORY_NOT_FOUND');
  const mode = req.query.mode || 'discard';
  if (mode === 'hard') {
    await doc.deleteOne();
    if (req.audit) await req.audit(req.params.id, { action: 'delete_stock', bloodGroup: doc.bloodGroup, units: doc.units });
    return noContent(res);
  }
  doc.status = mode === 'consume' ? 'consumed' : 'discarded';
  await doc.save();
  if (req.audit) await req.audit(doc._id, { action: mode, bloodGroup: doc.bloodGroup, units: doc.units });
  return success(res, doc, `Stock ${mode}d`);
});

export const alerts = asyncHandler(async (_req, res) => {
  await inventoryService.expireOverdueBatches();
  const [lowStock, expiring, stock, thresholds] = await Promise.all([
    inventoryService.getLowStockGroups(),
    inventoryService.getExpiringBatches(),
    inventoryService.getAvailableStock(),
    inventoryService.getThresholds(),
  ]);
  return success(res, { lowStock, expiring, stock, thresholds });
});

export const expiring = asyncHandler(async (req, res) => {
  const days = Number(req.query.days || inventoryService.EXPIRY_WARNING_DAYS);
  const items = await inventoryService.getExpiringBatches(days);
  return success(res, items, 'OK', { days, totalUnits: items.reduce((s, i) => s + i.units, 0) });
});

export const thresholds = asyncHandler(async (req, res) => {
  if (req.method === 'PUT') {
    const t = await inventoryService.setThresholds(req.body);
    if (req.audit) await req.audit(null, { action: 'update_thresholds', value: t });
    return success(res, t, 'Thresholds updated');
  }
  return success(res, await inventoryService.getThresholds());
});

export default { list, create, update, remove, alerts, expiring, thresholds };
