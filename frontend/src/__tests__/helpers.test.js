/**
 * Frontend unit tests: blood group catalogue, formatting helpers and tone mappers.
 */
import { describe, test, expect } from 'vitest';
import { BLOOD_GROUPS } from '../services/bloodGroups';
import {
  daysBetween, priorityTone, riskTone, formatDate, formatDateTime, bloodGroupOptions,
} from '../utils/helpers';

describe('bloodGroups service', () => {
  test('contains all 8 ABO/Rh groups', () => {
    expect(BLOOD_GROUPS).toEqual(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']);
  });

  test('no duplicates', () => {
    expect(new Set(BLOOD_GROUPS).size).toBe(BLOOD_GROUPS.length);
  });

  test('select options mirror the catalogue', () => {
    expect(bloodGroupOptions).toHaveLength(8);
    expect(bloodGroupOptions[0]).toEqual({ value: 'A+', label: 'A+' });
    expect(bloodGroupOptions.map((o) => o.value)).toEqual([...BLOOD_GROUPS]);
  });
});

describe('helpers', () => {
  test('daysBetween floors whole days', () => {
    const base = new Date('2026-01-01T00:00:00Z');
    expect(daysBetween(base, new Date('2026-01-10T23:59:00Z'))).toBe(9);
    expect(daysBetween(base, base)).toBe(0);
  });

  test('priorityTone maps urgency', () => {
    expect(priorityTone('CRITICAL')).toBe('danger');
    expect(priorityTone('URGENT')).toBe('warning');
    expect(priorityTone('NORMAL')).toBe('medical');
    expect(priorityTone(undefined)).toBe('medical');
  });

  test('riskTone maps forecast risk levels', () => {
    expect(riskTone('CRITICAL')).toBe('danger');
    expect(riskTone('HIGH')).toBe('danger');
    expect(riskTone('MEDIUM')).toBe('warning');
    expect(riskTone('LOW')).toBe('success');
  });

  test('formatDate handles null and Date inputs', () => {
    expect(formatDate(null)).toBe('—');
    const d = new Date('2026-03-15T10:30:00');
    expect(formatDate(d)).toBe(new Date(d).toLocaleDateString());
  });

  test('formatDateTime handles null and Date inputs', () => {
    expect(formatDateTime(undefined)).toBe('—');
    const d = new Date('2026-03-15T10:30:00');
    expect(formatDateTime(d)).toBe(new Date(d).toLocaleString());
  });
});
