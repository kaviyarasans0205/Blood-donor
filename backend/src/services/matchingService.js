import Donor from '../models/Donor.js';
import User from '../models/User.js';
import { compatibleDonors, isCompatible } from './compatibilityService.js';
import { haversineKm } from './haversineService.js';

const dayMs = 24 * 3600 * 1000;
const DEFAULT_DEFERRAL_DAYS = 56;

/** Is this donor document currently donation-eligible based on dates/status? */
export function isDonorEligibleByDate(donor, deferralDays = DEFAULT_DEFERRAL_DAYS) {
  if (donor.eligibilityStatus === 'ineligible') return false;
  if (donor.availability === 'unavailable') return false;
  if (!donor.lastDonationDate) return true;
  const days = (Date.now() - new Date(donor.lastDonationDate).getTime()) / dayMs;
  return days >= deferralDays;
}

/**
 * Ranked compatible donor match for an emergency request.
 * Ranking: compatibility > eligibility > availability > distance > recency of donation.
 */
export async function findMatchingDonors({
  bloodGroup,
  latitude = null,
  longitude = null,
  radiusKm = 50,
  limit = 50,
  includeUnavailable = false,
}) {
  const eligibleGroups = compatibleDonors(bloodGroup);
  if (eligibleGroups.length === 0) return [];

  const filter = { bloodGroup: { $in: eligibleGroups } };
  if (!includeUnavailable) filter.availability = { $in: ['available', 'busy'] };
  filter.latitude = { $ne: null };
  filter.longitude = { $ne: null };

  const candidates = await Donor.find(filter).limit(500).lean();
  if (candidates.length === 0) return [];

  const users = await User.find({ _id: { $in: candidates.map((c) => c.userId) }, isActive: true })
    .select('name phone')
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const ranked = candidates
    .map((d) => {
      const user = userMap.get(String(d.userId));
      const distanceKm =
        latitude != null && longitude != null
          ? Math.round(haversineKm(latitude, longitude, d.latitude, d.longitude) * 100) / 100
          : null;
      const eligible = isDonorEligibleByDate(d);
      const daysSinceDonation = d.lastDonationDate
        ? Math.floor((Date.now() - new Date(d.lastDonationDate).getTime()) / dayMs)
        : 999;
      const withinRadius = distanceKm == null || distanceKm <= radiusKm;
      const score =
        (eligible ? 50 : 0) +
        (d.availability === 'available' ? 20 : 0) +
        (d.notificationConsent ? 10 : 0) +
        Math.max(0, 30 - Math.min(distanceKm ?? 30, 30)) +
        Math.min(daysSinceDonation / 10, 10);
      return {
        donorId: d._id,
        userId: d.userId,
        name: user?.name || 'Donor',
        phone: user?.phone || null,
        bloodGroup: d.bloodGroup,
        latitude: d.latitude,
        longitude: d.longitude,
        distanceKm,
        eligible,
        availability: d.availability,
        notificationConsent: d.notificationConsent,
        lastDonationDate: d.lastDonationDate,
        daysSinceDonation,
        withinRadius,
        score: Math.round(score * 10) / 10,
        isCompatible: isCompatible(d.bloodGroup, bloodGroup),
      };
    })
    .filter((d) => d.isCompatible && d.withinRadius)
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (a.availability !== b.availability) return a.availability === 'available' ? -1 : 1;
      const da = a.distanceKm ?? Infinity;
      const db = b.distanceKm ?? Infinity;
      if (da !== db) return da - db;
      return b.daysSinceDonation - a.daysSinceDonation;
    });

  return ranked.slice(0, limit);
}

export default { findMatchingDonors, isDonorEligibleByDate };
