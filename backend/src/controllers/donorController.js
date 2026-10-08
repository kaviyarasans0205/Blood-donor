import User from '../models/User.js';
import Donor, { BLOOD_GROUPS } from '../models/Donor.js';
import Donation from '../models/Donation.js';
import Appointment from '../models/Appointment.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created } from '../utils/response.js';
import { findMatchingDonors } from '../services/matchingService.js';
import { haversineKm } from '../services/haversineService.js';
import { compatibleDonors } from '../services/compatibilityService.js';
import { isDonorEligibleByDate } from '../services/matchingService.js';

const donorPopulate = { path: 'userId', select: 'name email phone role isActive createdAt' };

export const listDonors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', bloodGroup, city, eligibility, sort = '-createdAt' } = req.query;
  const filter = {};
  if (bloodGroup && BLOOD_GROUPS.includes(bloodGroup)) filter.bloodGroup = bloodGroup;
  if (city) filter.city = new RegExp(String(city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  if (eligibility === 'eligible') filter.eligibilityStatus = 'eligible';

  let query = Donor.find(filter);
  if (search) {
    const users = await User.find({
      $or: [{ name: new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }],
    }).select('_id');
    filter.userId = { $in: users.map((u) => u._id) };
    query = Donor.find(filter);
  }

  const [items, total] = await Promise.all([
    query.populate(donorPopulate).sort(sort).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
    Donor.countDocuments(filter),
  ]);

  // augment eligibility by date for accuracy
  const data = items.map((d) => {
    const obj = d.toObject({ virtuals: true });
    obj.dateEligible = isDonorEligibleByDate(d);
    return obj;
  });

  return success(res, data, 'OK', { total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

export const getDonor = asyncHandler(async (req, res) => {
  const donor = await Donor.findById(req.params.id).populate(donorPopulate);
  if (!donor) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');

  const isSelf = req.user.role === 'donor' && String(donor.userId?._id || donor.userId) === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    // privacy: limited public view
    return success(res, {
      id: donor._id,
      bloodGroup: donor.bloodGroup,
      city: donor.city,
      state: donor.state,
      availability: donor.availability,
      eligibilityStatus: donor.eligibilityStatus,
    }, 'OK');
  }
  return success(res, donor, 'OK');
});

export const updateDonor = asyncHandler(async (req, res) => {
  const donor = await Donor.findById(req.params.id);
  if (!donor) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');

  const isSelf = String(donor.userId) === req.user.id;
  if (!isSelf && req.user.role !== 'admin') throw ApiError.forbidden('You may only edit your own profile');

  const allowed = ['bloodGroup', 'dateOfBirth', 'gender', 'weight', 'address', 'city', 'state', 'pincode', 'latitude', 'longitude', 'notificationConsent', 'availability', 'lastDonationDate', 'eligibilityStatus', 'nextEligibleDate'];
  if (req.user.role !== 'admin') allowed.push('notificationConsent', 'availability');
  for (const key of allowed) {
    if (req.body[key] !== undefined) donor[key] = req.body[key];
  }
  if (req.body.name || req.body.phone || req.body.email) {
    const user = await User.findById(donor.userId);
    if (req.body.name) user.name = req.body.name;
    if (req.body.phone) user.phone = req.body.phone;
    if (req.body.email && (isSelf || req.user.role === 'admin')) user.email = String(req.body.email).toLowerCase();
    await user.save();
  }
  await donor.save();
  return success(res, donor, 'Profile updated');
});

export const listEligibleDonors = asyncHandler(async (req, res) => {
  const { bloodGroup, radiusKm = 50, latitude, longitude, limit = 50 } = req.query;
  const donors = await Donor.find({ eligibilityStatus: { $ne: 'ineligible' } }).lean();
  const filtered = donors.filter((d) => isDonorEligibleByDate(d));
  const withDistance = latitude != null && longitude != null
    ? filtered.map((d) => ({ ...d, distanceKm: Math.round(haversineKm(Number(latitude), Number(longitude), d.latitude, d.longitude) * 100) / 100 }))
        .filter((d) => d.distanceKm <= Number(radiusKm))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    : filtered;
  const bloodFiltered = bloodGroup ? withDistance.filter((d) => compatibleDonors(bloodGroup).includes(d.bloodGroup)) : withDistance;
  return success(res, bloodFiltered.slice(0, Number(limit)), 'OK', { total: bloodFiltered.length });
});

export const compatibleDonorsList = asyncHandler(async (req, res) => {
  const { bloodGroup } = req.params;
  if (!BLOOD_GROUPS.includes(bloodGroup)) throw ApiError.badRequest('Invalid blood group', 'INVALID_BLOOD_GROUP');
  const { radiusKm = 100, latitude, longitude, limit = 50 } = req.query;

  const matches = await findMatchingDonors({
    bloodGroup,
    latitude: latitude != null ? Number(latitude) : null,
    longitude: longitude != null ? Number(longitude) : null,
    radiusKm: Number(radiusKm),
    limit: Number(limit),
    includeUnavailable: req.query.includeUnavailable === 'true',
  });
  return success(res, matches, 'OK', { total: matches.length, requestedGroup: bloodGroup });
});

export const nearbyDonors = asyncHandler(async (req, res) => {
  const { latitude, longitude, radiusKm = 25, bloodGroup, limit = 50 } = req.query;
  if (latitude == null || longitude == null) throw ApiError.badRequest('latitude and longitude are required', 'MISSING_COORDS');
  const matches = await findMatchingDonors({
    bloodGroup: bloodGroup && BLOOD_GROUPS.includes(bloodGroup) ? bloodGroup : 'O-',
    latitude: Number(latitude),
    longitude: Number(longitude),
    radiusKm: Number(radiusKm),
    limit: Number(limit),
    includeUnavailable: true,
  });
  return success(res, matches, 'OK', { total: matches.length });
});

export const donorDashboard = asyncHandler(async (req, res) => {
  const donor = await Donor.findOne({ userId: req.user.id });
  if (!donor) throw ApiError.notFound('Donor profile not found', 'DONOR_NOT_FOUND');

  const [donations, upcoming, recentAlerts, rewardTotal] = await Promise.all([
    Donation.find({ donorId: donor._id }).sort({ donationDate: -1 }).limit(50).lean(),
    Appointment.find({ donorId: donor._id, status: { $in: ['Pending', 'Confirmed'] }, appointmentDate: { $gte: new Date() } }).sort({ appointmentDate: 1 }).limit(1).lean(),
    EmergencyRequest.find({ status: { $in: ['Pending', 'Matching'] }, bloodGroup: donor.bloodGroup, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } })
      .select('patientName hospital bloodGroup requiredUnits priority status latitude longitude createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .then((reqs) =>
        reqs.map((r) => ({
          ...r,
          distanceKm: donor.latitude != null ? Math.round(haversineKm(donor.latitude, donor.longitude, r.latitude, r.longitude) * 100) / 100 : null,
        }))
      ),
    Donation.countDocuments({ donorId: donor._id, status: 'completed' }),
  ]);

  const monthly = Donation.aggregate
    ? await Donation.aggregate([
        { $match: { donorId: donor._id, status: 'completed' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$donationDate' } }, count: { $sum: 1 }, units: { $sum: '$units' } } },
        { $sort: { _id: 1 } },
        { $limit: 24 },
      ])
    : [];

  return success(res, {
    donor,
    stats: {
      totalDonations: donations.filter((d) => d.status === 'completed').length,
      rewardPoints: donor.rewardPoints || 0,
      eligibility: donor.eligibilityStatus || 'unknown',
      nextEligibleDate: donor.nextEligibleDate,
      lastDonationDate: donor.lastDonationDate,
      bloodGroup: donor.bloodGroup,
    },
    upcomingAppointment: upcoming[0] || null,
    donationHistory: donations,
    monthlyActivity: monthly,
    nearbyEmergencyRequests: recentAlerts,
  });
});

export default { listDonors, getDonor, updateDonor, listEligibleDonors, compatibleDonorsList, nearbyDonors, donorDashboard };
