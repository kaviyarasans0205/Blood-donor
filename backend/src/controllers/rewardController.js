import Donor from '../models/Donor.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success } from '../utils/response.js';
import { getRewardHistory, getRewardConfig, setRewardConfig, awardPoints } from '../services/rewardService.js';

export const summary = asyncHandler(async (req, res) => {
  let donorId = req.query.donorId;
  if (req.user.role === 'donor') {
    const donor = await Donor.findOne({ userId: req.user.id });
    if (!donor) throw ApiError.notFound('Donor profile not found', 'DONOR_NOT_FOUND');
    donorId = donor._id;
  }
  if (!donorId) throw ApiError.badRequest('donorId is required');

  const donor = await Donor.findById(donorId).select('rewardPoints totalDonations bloodGroup');
  if (!donor) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');
  const history = await getRewardHistory(donorId, { page: Number(req.query.page || 1), limit: Number(req.query.limit || 10) });
  const config = await getRewardConfig();
  return success(res, {
    points: donor.rewardPoints || 0,
    totalDonations: donor.totalDonations || 0,
    bloodGroup: donor.bloodGroup,
    config,
    history,
  });
});

export const history = asyncHandler(async (req, res) => {
  let donorId = req.query.donorId;
  if (req.user.role === 'donor') {
    const donor = await Donor.findOne({ userId: req.user.id });
    if (!donor) throw ApiError.notFound('Donor profile not found', 'DONOR_NOT_FOUND');
    donorId = donor._id;
  }
  if (!donorId) throw ApiError.badRequest('donorId is required');
  const result = await getRewardHistory(donorId, { page: Number(req.query.page || 1), limit: Number(req.query.limit || 20) });
  return success(res, result.items, 'OK', { total: result.total, page: result.page, pages: result.pages });
});

export const config = asyncHandler(async (req, res) => {
  if (req.method === 'PUT') {
    const updated = await setRewardConfig(req.body);
    return success(res, updated, 'Reward config updated');
  }
  return success(res, await getRewardConfig());
});

export const adjust = asyncHandler(async (req, res) => {
  const { donorId, points, description } = req.body;
  const tx = await awardPoints({ donorId, points: Number(points), transactionType: 'adjustment', description });
  return success(res, tx, 'Points adjusted');
});

export default { summary, history, config, adjust };
