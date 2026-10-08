/**
 * Emergency request priority classification.
 * CRITICAL > URGENT > NORMAL, ties broken by earliest createdAt.
 */

export const PRIORITY_ORDER = { CRITICAL: 0, URGENT: 1, NORMAL: 2 };

const HOUR = 3600 * 1000;

/**
 * Automatic priority classification.
 * @param {object} p
 * @param {string} p.emergencyLevel - admin/user selected level hint: critical|urgent|normal
 * @param {string|Date} p.requiredAt
 * @param {string|Date} [p.createdAt]
 * @param {string} [p.notes]
 * @returns {{priority:'CRITICAL'|'URGENT'|'NORMAL', priorityScore:number, reasons:string[]}}
 */
export function classifyPriority({ emergencyLevel, requiredAt, createdAt = new Date(), notes = '' }) {
  const reasons = [];
  const required = new Date(requiredAt);
  const created = new Date(createdAt);
  const hoursUntilRequired = (required.getTime() - created.getTime()) / HOUR;

  const level = String(emergencyLevel || '').toLowerCase();
  let score = 0;

  if (Number.isFinite(hoursUntilRequired)) {
    if (hoursUntilRequired <= 2) {
      score += 60;
      reasons.push('Required within 2 hours.');
    } else if (hoursUntilRequired <= 6) {
      score += 40;
      reasons.push('Required within 6 hours.');
    } else if (hoursUntilRequired <= 24) {
      score += 20;
      reasons.push('Required within 24 hours.');
    }
  }

  if (level === 'critical') score += 50;
  else if (level === 'urgent') score += 30;

  const noteText = String(notes).toLowerCase();
  if (/(life[- ]threatening|icu|bleeding|surgery|trauma|accident|haemorrhag|hemorrhag|transfusion reaction|severe)/.test(noteText)) {
    score += 30;
    reasons.push('Life-threatening indicators detected in notes.');
  }

  let priority;
  if (level === 'critical' || score >= 80) priority = 'CRITICAL';
  else if (level === 'urgent' || score >= 40) priority = 'URGENT';
  else priority = 'NORMAL';

  if (level === 'critical' && priority !== 'CRITICAL') priority = 'CRITICAL';
  if (level === 'urgent' && priority === 'NORMAL') priority = 'URGENT';
  if (level === 'normal' && priority === 'CRITICAL' && score >= 110) {
    // keep critical: clinical urgency signals dominate a 'normal' label
    reasons.push('Elevated to CRITICAL despite NORMAL label due to clinical indicators.');
  }

  if (reasons.length === 0) reasons.push('No urgency indicators; default classification applied.');

  return { priority, priorityScore: score, reasons };
}

/** Comparator for priority queue sorting. */
export function comparePriority(a, b) {
  const ra = PRIORITY_ORDER[a.priority] ?? 99;
  const rb = PRIORITY_ORDER[b.priority] ?? 99;
  if (ra !== rb) return ra - rb;
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  return ta - tb;
}

/** Sort array of requests into the emergency priority queue (does not mutate input). */
export function buildPriorityQueue(requests) {
  return [...requests].sort(comparePriority);
}

export default { classifyPriority, comparePriority, buildPriorityQueue, PRIORITY_ORDER };
