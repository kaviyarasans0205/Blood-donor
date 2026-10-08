import EligibilityCheck from '../models/EligibilityCheck.js';
import Donor from '../models/Donor.js';
import SystemSettings from '../models/SystemSettings.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler, success, created } from '../utils/response.js';
import { checkEligibility, DEFAULT_RULES, DISCLAIMER } from '../services/eligibilityService.js';

const ageFromDob = (dob) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));

export const getRules = asyncHandler(async (_req, res) => {
  const rules = await SystemSettings.get('eligibility_rules', DEFAULT_RULES);
  return success(res, { rules, disclaimer: DISCLAIMER });
});

export const check = asyncHandler(async (req, res) => {
  const { weightKg, answers = {}, saveToProfile = false } = req.body;

  let donor;
  if (req.user.role === 'donor') {
    donor = await Donor.findOne({ userId: req.user.id });
    if (!donor) throw ApiError.notFound('Donor profile not found', 'DONOR_NOT_FOUND');
  } else {
    const donorId = req.body.donorId || req.params.donorId;
    if (!donorId) throw ApiError.badRequest('donorId is required for admin checks');
    donor = await Donor.findById(donorId);
    if (!donor) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');
  }

  const rules = await SystemSettings.get('eligibility_rules', DEFAULT_RULES);
  const age = req.body.age != null ? Number(req.body.age) : ageFromDob(donor.dateOfBirth);
  const weight = weightKg != null ? Number(weightKg) : donor.weight;

  const outcome = checkEligibility(
    { age, weightKg: weight, lastDonationDate: donor.lastDonationDate, gender: donor.gender, answers },
    rules
  );

  const record = await EligibilityCheck.create({
    donorId: donor._id,
    answers,
    result: outcome.result,
    reasons: outcome.reasons,
    rulesVersion: outcome.rulesVersion,
    checkedBy: req.user.id,
    isManual: req.user.role === 'admin',
  });

  if (saveToProfile || req.user.role === 'donor') {
    donor.eligibilityStatus = outcome.result === 'ELIGIBLE' ? 'eligible' : 'ineligible';
    if (outcome.result === 'ELIGIBLE') {
      donor.nextEligibleDate = donor.lastDonationDate
        ? new Date(new Date(donor.lastDonationDate).getTime() + (rules.deferralDaysAfterDonation ?? 56) * 24 * 3600 * 1000)
        : new Date();
    }
    await donor.save();
  }

  return created(res, { ...outcome, checkId: record._id, donorId: donor._id }, 'Eligibility check recorded');
});

export const history = asyncHandler(async (req, res) => {
  const donorId = req.user.role === 'donor' ? (await Donor.findOne({ userId: req.user.id }))?._id : req.params.donorId;
  if (!donorId) throw ApiError.notFound('Donor not found', 'DONOR_NOT_FOUND');
  const items = await EligibilityCheck.find({ donorId }).sort({ createdAt: -1 }).limit(20).lean();
  return success(res, items);
});

export const updateRules = asyncHandler(async (req, res) => {
  const rules = { ...DEFAULT_RULES, ...req.body };
  await SystemSettings.set('eligibility_rules', rules, req.user.id, 'Donor eligibility screening rules');
  return success(res, rules, 'Eligibility rules updated');
});

export default { getRules, check, history, updateRules };
