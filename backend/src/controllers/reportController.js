import User from '../models/User.js';
import Donor from '../models/Donor.js';
import Donation from '../models/Donation.js';
import BloodInventory from '../models/BloodInventory.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import Appointment from '../models/Appointment.js';
import RewardTransaction from '../models/RewardTransaction.js';
import DemandPrediction from '../models/DemandPrediction.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success } from '../utils/response.js';

const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows, columns) => {
  const header = columns.map((c) => csvEscape(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(typeof c.key === 'function' ? c.key(r) : r[c.key])).join(','));
  return [header, ...body].join('\r\n');
};

const dateRange = (query) => {
  const filter = {};
  if (query.from) filter.$gte = new Date(query.from);
  if (query.to) filter.$lte = new Date(query.to);
  return Object.keys(filter).length ? filter : null;
};

const REPORTS = {
  donors: async (q) => {
    const filter = {};
    if (q.bloodGroup) filter.bloodGroup = q.bloodGroup;
    if (q.city) filter.city = new RegExp(q.city, 'i');
    const donors = await Donor.find(filter).populate('userId', 'name email phone isActive').lean();
    return {
      columns: [
        { key: (r) => r.userId?.name, label: 'Name' },
        { key: (r) => r.userId?.email, label: 'Email' },
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'city', label: 'City' },
        { key: 'state', label: 'State' },
        { key: 'eligibilityStatus', label: 'Eligibility' },
        { key: 'totalDonations', label: 'Total Donations' },
        { key: 'rewardPoints', label: 'Reward Points' },
        { key: (r) => (r.lastDonationDate ? String(r.lastDonationDate).slice(0, 10) : ''), label: 'Last Donation' },
        { key: (r) => r.userId?.isActive, label: 'Active' },
      ],
      rows: donors,
    };
  },
  blood_stock: async () => {
    const rows = await BloodInventory.find({}).sort({ expiryDate: 1 }).lean();
    return {
      columns: [
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'units', label: 'Units' },
        { key: 'batchNumber', label: 'Batch' },
        { key: 'location', label: 'Location' },
        { key: (r) => String(r.collectionDate).slice(0, 10), label: 'Collected' },
        { key: (r) => String(r.expiryDate).slice(0, 10), label: 'Expiry' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  },
  emergency_requests: async (q) => {
    const filter = {};
    if (q.priority) filter.priority = q.priority;
    if (q.bloodGroup) filter.bloodGroup = q.bloodGroup;
    if (q.status) filter.status = q.status;
    const range = dateRange(q);
    if (range) filter.createdAt = range;
    const rows = await EmergencyRequest.find(filter).populate('requesterId', 'name').sort({ createdAt: -1 }).lean();
    return {
      columns: [
        { key: (r) => String(r.createdAt).slice(0, 10), label: 'Created' },
        { key: 'patientName', label: 'Patient' },
        { key: 'hospital', label: 'Hospital' },
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'requiredUnits', label: 'Units' },
        { key: 'priority', label: 'Priority' },
        { key: 'status', label: 'Status' },
        { key: (r) => r.requesterId?.name, label: 'Requester' },
      ],
      rows,
    };
  },
  donations: async (q) => {
    const filter = {};
    const range = dateRange(q);
    if (range) filter.donationDate = range;
    if (q.bloodGroup) filter.bloodGroup = q.bloodGroup;
    const rows = await Donation.find(filter).populate({ path: 'donorId', select: 'bloodGroup userId' }).sort({ donationDate: -1 }).lean();
    return {
      columns: [
        { key: (r) => String(r.donationDate).slice(0, 10), label: 'Date' },
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'units', label: 'Units' },
        { key: 'location', label: 'Location' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  },
  expiry: async () => {
    const rows = await BloodInventory.find({ expiryDate: { $gte: new Date(Date.now() - 30 * 86400000) } }).sort({ expiryDate: 1 }).lean();
    return {
      columns: [
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'batchNumber', label: 'Batch' },
        { key: 'units', label: 'Units' },
        { key: (r) => String(r.expiryDate).slice(0, 10), label: 'Expiry' },
        { key: (r) => Math.ceil((new Date(r.expiryDate) - Date.now()) / 86400000), label: 'Days Remaining' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  },
  appointments: async (q) => {
    const filter = {};
    if (q.status) filter.status = q.status;
    const range = dateRange(q);
    if (range) filter.appointmentDate = range;
    const rows = await Appointment.find(filter).populate({ path: 'donorId', select: 'bloodGroup city userId' }).sort({ appointmentDate: -1 }).lean();
    return {
      columns: [
        { key: (r) => String(r.appointmentDate).slice(0, 10), label: 'Date' },
        { key: 'appointmentTime', label: 'Time' },
        { key: 'location', label: 'Location' },
        { key: (r) => r.donorId?.bloodGroup, label: 'Blood Group' },
        { key: 'status', label: 'Status' },
      ],
      rows,
    };
  },
  demand_prediction: async () => {
    const rows = await DemandPrediction.find({}).sort({ periodEnd: -1 }).limit(100).lean();
    return {
      columns: [
        { key: 'bloodGroup', label: 'Blood Group' },
        { key: 'predictedDemand', label: 'Predicted Demand' },
        { key: 'currentStock', label: 'Current Stock' },
        { key: 'riskLevel', label: 'Risk' },
        { key: 'forecastPeriodDays', label: 'Forecast Days' },
        { key: (r) => String(r.periodEnd).slice(0, 10), label: 'Period End' },
        { key: (r) => r.modelMeta?.model, label: 'Model' },
      ],
      rows,
    };
  },
  rewards: async (q) => {
    const filter = {};
    if (q.donorId) filter.donorId = q.donorId;
    const range = dateRange(q);
    if (range) filter.createdAt = range;
    const rows = await RewardTransaction.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    return {
      columns: [
        { key: (r) => String(r.createdAt).slice(0, 10), label: 'Date' },
        { key: 'transactionType', label: 'Type' },
        { key: 'points', label: 'Points' },
        { key: 'balanceAfter', label: 'Balance' },
        { key: 'description', label: 'Description' },
      ],
      rows,
    };
  },
};

export const generate = asyncHandler(async (req, res) => {
  const { type, format = 'json' } = req.query;
  if (!type || !REPORTS[type]) {
    throw ApiError.badRequest(`Unknown report type. Available: ${Object.keys(REPORTS).join(', ')}`, 'UNKNOWN_REPORT');
  }
  const { columns, rows } = await REPORTS[type](req.query);

  if (format === 'csv') {
    const csv = toCsv(rows, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(csv);
  }
  return success(res, rows, 'OK', { total: rows.length, type, columns: columns.map((c) => c.label) });
});

export const listTypes = asyncHandler(async (_req, res) => success(res, Object.keys(REPORTS)));

export default { generate, listTypes };
