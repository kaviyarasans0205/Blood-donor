import Appointment from '../models/Appointment.js';
import Donor from '../models/Donor.js';
import Donation from '../models/Donation.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created, noContent } from '../utils/response.js';
import { notify } from '../services/notificationService.js';
import { awardDonationPoints } from '../services/rewardService.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const create = asyncHandler(async (req, res) => {
  const { location, appointmentDate, appointmentTime, notes } = req.body;
  if (!TIME_RE.test(appointmentTime)) throw ApiError.badRequest('appointmentTime must be HH:MM', 'INVALID_TIME');

  const donor = await Donor.findOne({ userId: req.user.id });
  if (!donor) throw ApiError.notFound('Donor profile not found', 'DONOR_NOT_FOUND');

  const date = new Date(appointmentDate);
  date.setHours(0, 0, 0, 0);
  if (date < new Date(new Date().setHours(0, 0, 0, 0))) throw ApiError.badRequest('Appointment date must be in the future', 'PAST_DATE');

  const conflict = await Appointment.findOne({
    donorId: donor._id,
    appointmentDate: date,
    appointmentTime,
    status: { $in: ['Pending', 'Confirmed'] },
  });
  if (conflict) throw ApiError.conflict('You already have an appointment at this date and time', 'DUPLICATE_APPOINTMENT');

  const slotTaken = await Appointment.findOne({
    location,
    appointmentDate: date,
    appointmentTime,
    status: { $in: ['Pending', 'Confirmed'] },
  });
  if (slotTaken) throw ApiError.conflict('This time slot is already booked at the selected location', 'SLOT_TAKEN');

  const doc = await Appointment.create({
    donorId: donor._id, location, appointmentDate: date, appointmentTime, notes,
  });

  try {
    await notify({
      userId: req.user.id,
      type: 'appointment_confirmation',
      channels: ['inapp', 'email'],
      data: { date: date.toISOString().slice(0, 10), time: appointmentTime, location, relatedEntity: { entityType: 'Appointment', entityId: doc._id } },
    });
  } catch (e) { console.warn('[appt notify]', e.message); }

  if (req.audit) await req.audit(doc._id, { action: 'book_appointment', location, appointmentDate: date, appointmentTime });
  return created(res, doc, 'Appointment booked');
});

export const list = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, from, to, all = 'false' } = req.query;
  const filter = {};
  if (status) filter.status = status;

  if (req.user.role === 'donor') {
    const donor = await Donor.findOne({ userId: req.user.id });
    if (!donor) return success(res, [], 'OK', { total: 0, page: 1, pages: 0 });
    filter.donorId = donor._id;
  } else if (all !== 'true' && req.user.role !== 'admin') {
    const donor = await Donor.findOne({ userId: req.user.id });
    if (donor) filter.donorId = donor._id;
  }

  if (from || to) {
    filter.appointmentDate = {};
    if (from) filter.appointmentDate.$gte = new Date(from);
    if (to) filter.appointmentDate.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    Appointment.find(filter).sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip((Number(page) - 1) * Number(limit)).limit(Number(limit))
      .populate({ path: 'donorId', select: 'bloodGroup city userId' }),
    Appointment.countDocuments(filter),
  ]);
  return success(res, items, 'OK', { total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const update = asyncHandler(async (req, res) => {
  const doc = await Appointment.findById(req.params.id).populate({ path: 'donorId', select: 'userId' });
  if (!doc) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');

  const isOwner = req.user.role === 'donor' && String(doc.donorId?.userId) === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) throw ApiError.forbidden('Not permitted');

  const { status, appointmentDate, appointmentTime, location } = req.body;

  if (appointmentDate || appointmentTime) {
    const newDate = appointmentDate ? new Date(appointmentDate) : doc.appointmentDate;
    if (appointmentDate) newDate.setHours(0, 0, 0, 0);
    const newTime = appointmentTime || doc.appointmentTime;
    if (!TIME_RE.test(newTime)) throw ApiError.badRequest('appointmentTime must be HH:MM', 'INVALID_TIME');
    const conflict = await Appointment.findOne({
      _id: { $ne: doc._id },
      donorId: doc.donorId._id,
      appointmentDate: newDate,
      appointmentTime: newTime,
      status: { $in: ['Pending', 'Confirmed'] },
    });
    if (conflict) throw ApiError.conflict('Conflicting appointment exists', 'DUPLICATE_APPOINTMENT');
    doc.appointmentDate = newDate;
    doc.appointmentTime = newTime;
    if (location) doc.location = location;
    if (!status) doc.status = 'Pending';
  }

  if (status) {
    const allowed = ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'No-show'];
    if (!allowed.includes(status)) throw ApiError.badRequest('Invalid status');
    if (['Cancelled'].includes(status)) doc.cancelledBy = req.user.id;
    doc.status = status;
  }
  if (req.body.notes) doc.notes = req.body.notes;

  await doc.save();

  if (doc.status === 'Completed') {
    const donor = await Donor.findById(doc.donorId._id || doc.donorId);
    if (donor) {
      const already = await Donation.findOne({ appointmentId: doc._id });
      if (!already) {
        const donation = await Donation.create({
          donorId: donor._id,
          bloodGroup: donor.bloodGroup,
          units: 1,
          donationDate: new Date(),
          location: doc.location,
          appointmentId: doc._id,
          status: 'completed',
          recordedBy: req.user.id,
        });
        donor.lastDonationDate = new Date();
        donor.totalDonations = (donor.totalDonations || 0) + 1;
        donor.nextEligibleDate = new Date(Date.now() + 56 * 24 * 3600 * 1000);
        await donor.save();
        try {
          await awardDonationPoints(donation);
          await notify({
            userId: String(donor.userId), type: 'reward_earned', channels: ['inapp', 'email'],
            data: { points: 100, balance: donor.rewardPoints },
          });
        } catch (e) { console.warn('[reward]', e.message); }
      }
    }
  }

  if (req.audit) await req.audit(doc._id, { action: 'update_appointment', status: doc.status });
  return success(res, doc, 'Appointment updated');
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await Appointment.findById(req.params.id).populate({ path: 'donorId', select: 'userId' });
  if (!doc) throw ApiError.notFound('Appointment not found', 'APPOINTMENT_NOT_FOUND');
  const isOwner = req.user.role === 'donor' && String(doc.donorId?.userId) === req.user.id;
  if (!isOwner && req.user.role !== 'admin') throw ApiError.forbidden('Not permitted');
  doc.status = 'Cancelled';
  doc.cancelledBy = req.user.id;
  await doc.save();
  if (req.audit) await req.audit(doc._id, { action: 'cancel_appointment' });
  return success(res, doc, 'Appointment cancelled');
});

export default { create, list, update, remove };
