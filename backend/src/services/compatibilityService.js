/**
 * Centralized red-cell compatibility configuration.
 *
 * Rules are intentionally data-driven so authorized blood-bank staff can review
 * and adjust them. Default values follow common red-cell transfusion practice:
 * recipient receives donor RBCs; compatibility = donor red cell antigens safe
 * for recipient plasma.
 *
 * ALWAYS subject to validation by authorized medical/blood-bank personnel.
 */
export const DEFAULT_COMPATIBILITY = {
  // donorGroup -> groups whose recipients may receive from this donor
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'B+', 'A+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

let rules = { ...DEFAULT_COMPATIBILITY };

export function getCompatibilityRules() {
  return { ...rules };
}

export function setCompatibilityRules(custom) {
  if (!custom || typeof custom !== 'object') throw new TypeError('Compatibility rules must be an object');
  for (const [donor, recipients] of Object.entries(custom)) {
    if (!Array.isArray(recipients)) throw new TypeError(`Rules for ${donor} must be an array`);
  }
  rules = { ...custom };
  return getCompatibilityRules();
}

export function resetCompatibilityRules() {
  rules = { ...DEFAULT_COMPATIBILITY };
  return getCompatibilityRules();
}

/** Can `donorGroup` donate red cells to `recipientGroup`? */
export function isCompatible(donorGroup, recipientGroup) {
  const allowed = rules[donorGroup];
  if (!allowed) return false;
  return allowed.includes(recipientGroup);
}

/** All blood groups this donor group can donate to. */
export function compatibleRecipients(donorGroup) {
  return rules[donorGroup] ? [...rules[donorGroup]] : [];
}

/** All donor groups that can donate to the given recipient group. */
export function compatibleDonors(recipientGroup) {
  return Object.entries(rules)
    .filter(([, recipients]) => recipients.includes(recipientGroup))
    .map(([donor]) => donor);
}

export default { isCompatible, compatibleRecipients, compatibleDonors, getCompatibilityRules, setCompatibilityRules, resetCompatibilityRules, DEFAULT_COMPATIBILITY };
