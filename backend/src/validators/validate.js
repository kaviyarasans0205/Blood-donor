import validator from 'validator';
import ApiError from '../utils/ApiError.js';

/**
 * Tiny declarative validation middleware.
 * Schema shape: { field: [ruleFn, ruleFn...], 'nested.field': [...] }
 * Each rule: (value, field) => errorString | null
 */
const rules = {
  required:
    (msg = 'is required') =>
    (v) =>
      v === undefined || v === null || v === ''
        ? msg
        : Array.isArray(v) && v.length === 0
          ? msg
          : null,
  string: (msg = 'must be a string') => (v) => (v === undefined || v === null ? null : typeof v === 'string' ? null : msg),
  email: (msg = 'must be a valid email') => (v) => (!v || validator.isEmail(String(v)) ? null : msg),
  minLength: (n, msg) => (v) => (!v || String(v).length >= n ? null : msg || `must be at least ${n} characters`),
  maxLength: (n, msg) => (v) => (!v || String(v).length <= n ? null : msg || `must be at most ${n} characters`),
  number: (msg = 'must be a number') => (v) => (v === undefined || v === null || v === '' ? null : !Number.isNaN(Number(v)) ? null : msg),
  min: (n, msg) => (v) => (v === undefined || v === null || v === '' || Number(v) >= n ? null : msg || `must be >= ${n}`),
  max: (n, msg) => (v) => (v === undefined || v === null || v === '' || Number(v) <= n ? null : msg || `must be <= ${n}`),
  int: (msg = 'must be an integer') => (v) => (v === undefined || v === null || v === '' || Number.isInteger(Number(v)) ? null : msg),
  oneOf: (list, msg) => (v) => (!v || list.includes(v) ? null : msg || `must be one of: ${list.join(', ')}`),
  regex: (re, msg = 'is invalid format') => (v) => (!v || re.test(String(v)) ? null : msg),
  date: (msg = 'must be a valid date') => (v) => (!v || !Number.isNaN(Date.parse(v)) ? null : msg),
  bool: (msg = 'must be a boolean') => (v) => (v === undefined || v === null ? null : typeof v === 'boolean' ? null : msg),
  lat: () => (v) => (v === undefined || v === null || v === '' ? null : Number(v) >= -90 && Number(v) <= 90 ? null : 'must be a valid latitude'),
  lng: () => (v) => (v === undefined || v === null || v === '' ? null : Number(v) >= -180 && Number(v) <= 180 ? null : 'must be a valid longitude'),
};

export const R = rules;

const getVal = (obj, path) => path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
const setVal = (obj, path, val) => {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
};

/**
 * validate(schema, source='body'|'query'|'params')
 * schema: { field: [rules] } or { field: { rules: [...], coerce: fn } }
 */
export const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    const data = req[source] || {};
    const errors = [];
    const coerced = { ...data };

    for (const [field, spec] of Object.entries(schema)) {
      const { fieldRules, coerce } = Array.isArray(spec) ? { fieldRules: spec } : { fieldRules: spec.rules, coerce: spec.coerce };
      let value = getVal(data, field);
      if (coerce && value !== undefined && value !== null && value !== '') {
        try {
          value = coerce(value);
          setVal(coerced, field, value);
        } catch {
          errors.push({ field, message: 'has an invalid value' });
          continue;
        }
      }
      for (const rule of fieldRules) {
        const msg = rule(value, field);
        if (msg) {
          errors.push({ field, message: msg });
          break;
        }
      }
    }

    if (errors.length > 0) {
      return next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', errors));
    }
    req[source] = coerced;
    return next();
  };
};
