/**
 * Rule-based donation eligibility checking.
 * Rules are configuration-driven (SystemSettings: eligibility_rules).
 * This is a screening aid ONLY — never a medical diagnosis.
 */

export const DISCLAIMER =
  'This is an automated pre-screening aid only and does not constitute medical advice. Final eligibility must be confirmed by authorized medical/blood-bank personnel.';

export const DEFAULT_RULES = {
  rulesVersion: '1',
  minAge: 18,
  maxAge: 65,
  minWeightKg: 50,
  deferralDaysAfterDonation: 56, // whole blood interval
  deferralDaysAfterIllness: 14,
  deferralDaysAfterTattoo: 90,
  deferralDaysAfterSurgery: 90,
  maxHemoglobinGapNote: true,
  questions: [
    { key: 'recentIllness', label: 'Have you had fever, cough or flu in the last 14 days?', type: 'boolean', deflectDaysKey: 'deferralDaysAfterIllness' },
    { key: 'recentTattoo', label: 'Have you had a tattoo/piercing in the last 90 days?', type: 'boolean', deflectDaysKey: 'deferralDaysAfterTattoo' },
    { key: 'recentSurgery', label: 'Have you had surgery in the last 90 days?', type: 'boolean', deflectDaysKey: 'deferralDaysAfterSurgery' },
    { key: 'onMedication', label: 'Are you currently taking prescription medication?', type: 'boolean' },
    { key: 'isPregnant', label: 'Are you currently pregnant or gave birth in the last 6 months?', type: 'boolean', appliesToGender: 'female' },
    { key: 'chronicCondition', label: 'Do you have a diagnosed chronic condition (heart, kidney, liver, bleeding disorder)?', type: 'boolean' },
    { key: 'recentTravel', label: 'Have you travelled outside the country in the last 4 weeks?', type: 'boolean' },
  ],
};

const dayMs = 24 * 3600 * 1000;

export function resolveRules(custom) {
  return { ...DEFAULT_RULES, ...(custom || {}) };
}

/**
 * @param {object} input
 * @param {number} input.age
 * @param {number} input.weightKg
 * @param {string|null} input.lastDonationDate
 * @param {string} [input.gender]
 * @param {object} input.answers - question key -> boolean
 * @returns {{result:'ELIGIBLE'|'NOT_ELIGIBLE', reasons:string[], checkedAt:Date, rulesVersion:string}}
 */
export function checkEligibility(input, customRules = null) {
  const rules = resolveRules(customRules);
  const reasons = [];
  const answers = input.answers || {};

  const age = Number(input.age);
  if (!Number.isFinite(age)) reasons.push('Age is required for eligibility screening.');
  else if (age < rules.minAge) reasons.push(`Age ${age} is below the configured minimum of ${rules.minAge}.`);
  else if (age > rules.maxAge) reasons.push(`Age ${age} exceeds the configured maximum of ${rules.maxAge}.`);

  const weight = Number(input.weightKg);
  if (!Number.isFinite(weight)) reasons.push('Weight is required for eligibility screening.');
  else if (weight < rules.minWeightKg) reasons.push(`Weight ${weight} kg is below the configured minimum of ${rules.minWeightKg} kg.`);

  if (input.lastDonationDate) {
    const last = new Date(input.lastDonationDate);
    if (!Number.isNaN(last.getTime())) {
      const daysSince = Math.floor((Date.now() - last.getTime()) / dayMs);
      if (daysSince < rules.deferralDaysAfterDonation) {
        const nextDate = new Date(last.getTime() + rules.deferralDaysAfterDonation * dayMs);
        reasons.push(
          `Recent donation date does not satisfy configured interval: last donation was ${daysSince} day(s) ago, minimum interval is ${rules.deferralDaysAfterDonation} days (next eligible ~${nextDate.toISOString().slice(0, 10)}).`
        );
      }
    }
  }

  for (const q of rules.questions) {
    if (q.appliesToGender && input.gender && q.appliesToGender !== input.gender) continue;
    if (answers[q.key] === true || answers[q.key] === 'true') {
      const customLabel = typeof q.deflectDaysKey === 'number' ? q.deflectDaysKey : rules[q.deflectDaysKey];
      if (q.deflectDaysKey && Number.isFinite(Number(customLabel))) {
        reasons.push(`${q.label} Deferral period: ${Number(customLabel)} days.`);
      } else {
        reasons.push(q.label);
      }
    }
  }

  const result = reasons.length === 0 ? 'ELIGIBLE' : 'NOT_ELIGIBLE';
  return {
    result,
    reasons,
    checkedAt: new Date(),
    rulesVersion: String(rules.rulesVersion || '1'),
    disclaimer: DISCLAIMER,
  };
}

export default { checkEligibility, DEFAULT_RULES, resolveRules, DISCLAIMER };
