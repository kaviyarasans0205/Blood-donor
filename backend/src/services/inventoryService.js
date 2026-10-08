import BloodInventory from '../models/BloodInventory.js';
import SystemSettings from '../models/SystemSettings.js';
import Alert from '../models/Alert.js';
import { BLOOD_GROUPS } from '../models/Donor.js';
import ApiError from '../utils/ApiError.js';

export const DEFAULT_THRESHOLDS = {
  'A+': 20, 'A-': 10, 'B+': 20, 'B-': 10,
  'O+': 25, 'O-': 15, 'AB+': 8, 'AB-': 5,
};

export const EXPIRY_WARNING_DAYS = 7;

export async function getThresholds() {
  return SystemSettings.get('low_stock_thresholds', DEFAULT_THRESHOLDS);
}

export async function setThresholds(thresholds) {
  return SystemSettings.set('low_stock_thresholds', thresholds, null, 'Minimum stock per blood group');
}

/** Total available (non-expired, available-status) units per blood group. */
export async function getAvailableStock() {
  const rows = await BloodInventory.aggregate([
    { $match: { status: 'available', expiryDate: { $gt: new Date() } } },
    { $group: { _id: '$bloodGroup', units: { $sum: '$units' } } },
  ]);
  const stock = Object.fromEntries(BLOOD_GROUPS.map((g) => [g, 0]));
  for (const r of rows) stock[r._id] = r.units;
  return stock;
}

export async function getTotalAvailableUnits() {
  const stock = await getAvailableStock();
  return Object.values(stock).reduce((a, b) => a + b, 0);
}

/** Add stock atomically. Creates a new batch document. */
export async function addStock({ bloodGroup, units, batchNumber, collectionDate, expiryDate, location, notes, createdBy }) {
  const existing = await BloodInventory.findOne({ batchNumber: String(batchNumber).toUpperCase() });
  if (existing) throw ApiError.conflict(`Batch ${batchNumber} already exists`, 'DUPLICATE_BATCH');
  return BloodInventory.create({
    bloodGroup, units, batchNumber, collectionDate, expiryDate, location, notes, createdBy,
  });
}

/**
 * Consume units from available stock across batches (earliest expiry first - FEFO).
 * Rolls back cleanly if insufficient stock.
 */
export async function consumeStock(bloodGroup, units, location = null) {
  const qty = Number(units);
  if (!Number.isInteger(qty) || qty <= 0) throw ApiError.badRequest('Units to consume must be a positive integer');

  const query = { bloodGroup, status: 'available', expiryDate: { $gt: new Date() } };
  if (location) query.location = location;

  const batches = await BloodInventory.find(query).sort({ expiryDate: 1 });
  const total = batches.reduce((s, b) => s + b.units, 0);
  if (total < qty) {
    throw ApiError.badRequest(`Insufficient ${bloodGroup} stock: requested ${qty}, available ${total}`, 'INSUFFICIENT_STOCK');
  }

  let remaining = qty;
  const ops = [];
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.units, remaining);
    batch.units -= take;
    remaining -= take;
    if (batch.units === 0) batch.status = 'consumed';
    ops.push(batch.save());
  }
  await Promise.all(ops);
  return { consumed: qty, remainingRequested: remaining };
}

/** Mark expired batches; returns docs updated. */
export async function expireOverdueBatches() {
  const res = await BloodInventory.updateMany(
    { status: 'available', expiryDate: { $lte: new Date() } },
    { $set: { status: 'expired' } }
  );
  return res.modifiedCount;
}

/** Batches expiring within `days` days. */
export async function getExpiringBatches(days = EXPIRY_WARNING_DAYS) {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 24 * 3600 * 1000);
  const rows = await BloodInventory.find({
    status: 'available',
    expiryDate: { $gt: now, $lte: limit },
  }).sort({ expiryDate: 1 });
  return rows.map((b) => ({
    ...b.toObject(),
    daysRemaining: Math.max(0, Math.ceil((b.expiryDate - now) / (24 * 3600 * 1000))),
  }));
}

/** Blood groups below configured threshold. */
export async function getLowStockGroups() {
  const [stock, thresholds] = await Promise.all([getAvailableStock(), getThresholds()]);
  return BLOOD_GROUPS.filter((g) => (stock[g] ?? 0) < (thresholds[g] ?? 0)).map((g) => ({
    bloodGroup: g,
    units: stock[g] ?? 0,
    threshold: thresholds[g] ?? 0,
  }));
}

/** Create/refresh low stock + expiry alerts (deduped by dedupeKey). */
export async function refreshStockAlerts() {
  const created = [];
  const lowStock = await getLowStockGroups();
  for (const item of lowStock) {
    const dedupeKey = `low_stock:${item.bloodGroup}`;
    const alert = await Alert.findOneAndUpdate(
      { dedupeKey, isResolved: false },
      {
        $set: {
          type: 'low_stock',
          severity: item.units < item.threshold / 2 ? 'critical' : 'warning',
          title: `Critical: ${item.bloodGroup} blood stock is low.`,
          message: `${item.bloodGroup} available ${item.units} unit(s), minimum threshold ${item.threshold}.`,
          bloodGroup: item.bloodGroup,
        },
      },
      { upsert: true, new: true }
    );
    created.push(alert);
    // auto-resolve alerts for groups that recovered
  }
  const lowSet = new Set(lowStock.map((i) => i.bloodGroup));
  await Alert.updateMany(
    { type: 'low_stock', isResolved: false, bloodGroup: { $nin: [...lowSet] } },
    { $set: { isResolved: true, resolvedAt: new Date() } }
  );

  const expiring = await getExpiringBatches(EXPIRY_WARNING_DAYS);
  for (const b of expiring) {
    const dedupeKey = `expiry:${b.batchNumber}`;
    const alert = await Alert.findOneAndUpdate(
      { dedupeKey, isResolved: false },
      {
        $set: {
          type: b.daysRemaining <= 2 ? 'expired' : 'expiry_warning',
          severity: b.daysRemaining <= 2 ? 'critical' : 'warning',
          title: `${b.bloodGroup} blood expires soon`,
          message: `Batch ${b.batchNumber}: ${b.units} unit(s) of ${b.bloodGroup} expire in ${b.daysRemaining} day(s) on ${b.expiryDate.toISOString().slice(0, 10)}.`,
          bloodGroup: b.bloodGroup,
          relatedEntity: { entityType: 'BloodInventory', entityId: b._id },
        },
      },
      { upsert: true, new: true }
    );
    created.push(alert);
  }
  return created;
}

export default {
  getAvailableStock, getTotalAvailableUnits, addStock, consumeStock,
  expireOverdueBatches, getExpiringBatches, getLowStockGroups,
  refreshStockAlerts, getThresholds, setThresholds, DEFAULT_THRESHOLDS, EXPIRY_WARNING_DAYS,
};
