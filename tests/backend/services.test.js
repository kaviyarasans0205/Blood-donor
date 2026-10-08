/**
 * Pure unit tests for backend domain services (no database required):
 * compatibility, eligibility screening, priority classification, distances
 * and the local demand-forecast fallback.
 */

import {
  isCompatible, compatibleRecipients, compatibleDonors,
  getCompatibilityRules, setCompatibilityRules, resetCompatibilityRules,
} from '../../backend/src/services/compatibilityService.js';
import { checkEligibility, DEFAULT_RULES, DISCLAIMER } from '../../backend/src/services/eligibilityService.js';
import { classifyPriority, comparePriority, buildPriorityQueue } from '../../backend/src/services/priorityService.js';
import { haversineKm, filterByRadius } from '../../backend/src/services/haversineService.js';
import { localForecast, classifyRisk, recommendationFor } from '../../backend/src/services/predictionService.js';

const DAY = 24 * 3600 * 1000;

describe('compatibilityService', () => {
  afterEach(() => resetCompatibilityRules());

  test('O- is a universal donor', () => {
    for (const g of ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']) {
      expect(isCompatible('O-', g)).toBe(true);
    }
  });

  test('AB+ is a universal recipient', () => {
    for (const g of ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']) {
      expect(isCompatible(g, 'AB+')).toBe(true);
    }
  });

  test('A+ cannot receive from B-', () => {
    expect(isCompatible('B-', 'A+')).toBe(false);
  });

  test('A- can receive from A- and O-', () => {
    expect(compatibleDonors('A-').sort()).toEqual(['A-', 'O-']);
  });

  test('O+ blood can be received by all positive groups', () => {
    expect(compatibleRecipients('O+').sort()).toEqual(['A+', 'AB+', 'B+', 'O+']);
    expect(compatibleRecipients('O+')).not.toContain('O-');
  });

  test('rules are configurable and resettable', () => {
    setCompatibilityRules({ 'A+': ['A+', 'O+', 'CUSTOM'] });
    expect(isCompatible('A+', 'CUSTOM')).toBe(true);
    resetCompatibilityRules();
    expect(isCompatible('A+', 'CUSTOM')).toBe(false);
    expect(Object.keys(getCompatibilityRules()).length).toBe(8);
  });
});

describe('eligibilityService', () => {
  const base = { age: 30, weightKg: 70, lastDonationDate: null, answers: {} };

  test('healthy adult with no deferrals is ELIGIBLE', () => {
    const r = checkEligibility(base);
    expect(r.result).toBe('ELIGIBLE');
    expect(r.reasons).toEqual([]);
    expect(r.disclaimer).toBe(DISCLAIMER);
  });

  test('underage donor is rejected', () => {
    const r = checkEligibility({ ...base, age: 15 });
    expect(r.result).toBe('NOT_ELIGIBLE');
    expect(r.reasons.join(' ')).toMatch(/below the configured minimum/);
  });

  test('underweight donor is rejected', () => {
    const r = checkEligibility({ ...base, weightKg: 45 });
    expect(r.result).toBe('NOT_ELIGIBLE');
    expect(r.reasons.join(' ')).toMatch(/below the configured minimum.*50/);
  });

  test('recent donation defers eligibility (56-day rule)', () => {
    const r = checkEligibility({ ...base, lastDonationDate: new Date(Date.now() - 10 * DAY) });
    expect(r.result).toBe('NOT_ELIGIBLE');
    expect(r.reasons.join(' ')).toMatch(/minimum interval is 56 days/);
  });

  test('donation older than deferral window is acceptable', () => {
    const r = checkEligibility({ ...base, lastDonationDate: new Date(Date.now() - 57 * DAY) });
    expect(r.result).toBe('ELIGIBLE');
  });

  test('recent illness answer defers for 14 days', () => {
    const r = checkEligibility({ ...base, answers: { recentIllness: true } });
    expect(r.result).toBe('NOT_ELIGIBLE');
    expect(r.reasons.join(' ')).toMatch(/14/);
  });

  test('custom rules override defaults', () => {
    const r = checkEligibility({ ...base, age: 70 }, { maxAge: 75 });
    expect(r.result).toBe('ELIGIBLE');
    expect(r.rulesVersion).toBe(String(DEFAULT_RULES.rulesVersion));
  });

  test('missing age/weight reported as screening gaps', () => {
    const r = checkEligibility({});
    expect(r.result).toBe('NOT_ELIGIBLE');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });
});

describe('priorityService', () => {
  const now = new Date('2026-01-01T06:00:00Z');

  test('critical + imminent deadline scores highest', () => {
    const r = classifyPriority({ emergencyLevel: 'critical', requiredAt: new Date(now.getTime() + HOUR(1)), createdAt: now });
    expect(r.priority).toBe('CRITICAL');
    expect(r.priorityScore).toBeGreaterThanOrEqual(110); // 60 (<=2h) + 50 (critical)
  });

  test('normal level days out stays NORMAL', () => {
    const r = classifyPriority({ emergencyLevel: 'normal', requiredAt: new Date(now.getTime() + 5 * DAY), createdAt: now });
    expect(r.priority).toBe('NORMAL');
    expect(r.priorityScore).toBeLessThan(60);
  });

  test('life-threatening notes add points and reasons', () => {
    const withNotes = classifyPriority({ emergencyLevel: 'urgent', requiredAt: new Date(now.getTime() + 3 * DAY), createdAt: now, notes: 'severe bleeding, ICU' });
    const without = classifyPriority({ emergencyLevel: 'urgent', requiredAt: new Date(now.getTime() + 3 * DAY), createdAt: now });
    expect(withNotes.priorityScore).toBe(without.priorityScore + 30);
    expect(withNotes.reasons.join(' ')).toMatch(/Life-threatening/);
  });

  test('queue sorts CRITICAL before URGENT before NORMAL', () => {
    const queue = buildPriorityQueue([
      { id: 1, priority: 'NORMAL', priorityScore: 30, createdAt: now },
      { id: 2, priority: 'CRITICAL', priorityScore: 80, createdAt: now },
      { id: 3, priority: 'URGENT', priorityScore: 60, createdAt: now },
    ]);
    expect(queue.map((r) => r.priority)).toEqual(['CRITICAL', 'URGENT', 'NORMAL']);
  });

  test('same priority breaks ties by earliest creation (FIFO)', () => {
    const a = { priority: 'URGENT', priorityScore: 66, createdAt: now };
    const b = { priority: 'URGENT', priorityScore: 66, createdAt: new Date(now.getTime() - HOUR(1)) };
    const c = { priority: 'URGENT', priorityScore: 74, createdAt: now };
    const queue = buildPriorityQueue([a, b, c]);
    expect(queue[0]).toBe(b); // oldest first, score is not a tie-break
    expect(queue[1]).toBe(a); // stable sort keeps input order for equal createdAt
    expect(queue[2]).toBe(c);
  });

  test('comparePriority is consistent (antisymmetric)', () => {
    const crit = { priority: 'CRITICAL', priorityScore: 100, createdAt: now };
    const norm = { priority: 'NORMAL', priorityScore: 10, createdAt: now };
    expect(comparePriority(crit, norm)).toBeLessThan(0);
    expect(comparePriority(norm, crit)).toBeGreaterThan(0);
    expect(comparePriority(crit, crit)).toBe(0);
  });
});

function HOUR(n) { return n * 3600 * 1000; }

describe('haversineService', () => {
  test('identical points are 0 km apart', () => {
    expect(haversineKm(28.61, 77.21, 28.61, 77.21)).toBe(0);
  });

  test('Delhi to Jaipur is roughly 240 km', () => {
    const d = haversineKm(28.6139, 77.209, 26.9124, 75.7873);
    expect(d).toBeGreaterThan(220);
    expect(d).toBeLessThan(260);
  });

  test('filterByRadius keeps only in-radius items', () => {
    const items = [
      { id: 'near', latitude: 28.62, longitude: 77.21 },
      { id: 'far', latitude: 19.08, longitude: 72.88 }, // Mumbai
      { id: 'missing-geo' },
    ];
    const out = filterByRadius(items, 28.6139, 77.209, 50);
    expect(out.map((i) => i.id)).toEqual(['near']);
    expect(out[0].distanceKm).toBeLessThan(50);
  });
});

describe('predictionService (local fallback)', () => {
  test('flat zero series forecasts zero', () => {
    const r = localForecast(new Array(14).fill(0), 7);
    expect(r.predicted).toBe(0);
    expect(r.model).toBe('local_sma');
    expect(r.dataPoints).toBe(14);
  });

  test('rising series forecasts more than the flat mean would', () => {
    const rising = Array.from({ length: 30 }, (_, i) => i + 1);
    const forecast = localForecast(rising, 14);
    const flatMean = (rising.reduce((a, b) => a + b, 0) / rising.length) * 14;
    expect(forecast.predicted).toBeGreaterThan(flatMean);
  });

  test('empty series handled safely', () => {
    expect(localForecast([], 7).predicted).toBe(0);
  });

  test('classifyRisk thresholds', () => {
    expect(classifyRisk(10, 100)).toBe('CRITICAL'); // 0.1 < 0.5
    expect(classifyRisk(70, 100)).toBe('HIGH');     // 0.7 < 0.85
    expect(classifyRisk(100, 100)).toBe('MEDIUM');  // 1.0 < 1.2
    expect(classifyRisk(200, 100)).toBe('LOW');     // 2.0 >= 1.2
    expect(classifyRisk(0, 0)).toBe('LOW');         // no demand
  });

  test('recommendations mention the blood group and risk action', () => {
    expect(recommendationFor('O-', 'CRITICAL')).toMatch(/O-/);
    expect(recommendationFor('O-', 'CRITICAL')).toMatch(/Escalate/i);
    expect(recommendationFor('A+', 'LOW')).toMatch(/adequate/i);
  });
});
