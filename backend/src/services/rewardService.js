import RewardTransaction from '../models/RewardTransaction.js';
import Donor from '../models/Donor.js';
import SystemSettings from '../models/SystemSettings.js';
import ApiError from '../utils/ApiError.js';

export const DEFAULT_REWARD_CONFIG = {
  pointsPerDonation: 100,
  pointsPerAppointmentKept: 25,
  streakBonusThreshold: 4,
  streakBonusPoints: 50,
  enabled: true,
};

export async function getRewardConfig() {
  return SystemSettings.get('reward_config', DEFAULT_REWARD_CONFIG);
}

export async function setRewardConfig(cfg) {
  return SystemSettings.set('reward_config', { ...DEFAULT_REWARD_CONFIG, ...cfg }, null, 'Reward points configuration');
}

/**
 * Award points to a donor and record the transaction atomically-ish.
 */
export async function awardPoints({ donorId, points, transactionType, donationRef = null, description = '' }) {
  const cfg = await getRewardConfig();
  if (!cfg.enabled && transactionType !== 'adjustment') return null;
  const qty = Number(points);
  if (!Number.isFinite(qty) || qty === 0) throw ApiError.badRequest('Points must be a non-zero number');

  const donor = await Donor.findById(donorId);
  if (!donor) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');

  donor.rewardPoints = Math.max(0, (donor.rewardPoints || 0) + qty);
  await donor.save();

  return RewardTransaction.create({
    donorId,
    points: qty,
    balanceAfter: donor.rewardPoints,
    transactionType,
    donationRef,
    description: description || `${transactionType}: ${qty > 0 ? '+' : ''}${qty} points`,
  });
}

export async function awardDonationPoints(donation) {
  const cfg = await getRewardConfig();
  const txs = [];
  const base = await awardPoints({
    donorId: donation.donorId,
    points: cfg.pointsPerDonation,
    transactionType: 'donation',
    donationRef: donation._id,
    description: `Donation completed at ${donation.location}`,
  });
  if (base) txs.push(base);

  const donor = await Donor.findById(donation.donorId).select('totalDonations');
  if (donor && donor.totalDonations > 0 && donor.totalDonations % cfg.streakBonusThreshold === 0) {
    const bonus = await awardPoints({
      donorId: donation.donorId,
      points: cfg.streakBonusPoints,
      transactionType: 'streak_bonus',
      donationRef: donation._id,
      description: `Milestone bonus: ${donor.totalDonations} donations`,
    });
    if (bonus) txs.push(bonus);
  }
  return txs.filter(Boolean);
}

export async function getRewardHistory(donorId, { page = 1, limit = 20 } = {}) {
  const [items, total] = await Promise.all([
    RewardTransaction.find({ donorId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RewardTransaction.countDocuments({ donorId }),
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
}

export default { awardPoints, awardDonationPoints, getRewardHistory, getRewardConfig, setRewardConfig, DEFAULT_REWARD_CONFIG };
