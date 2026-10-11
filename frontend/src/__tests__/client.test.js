import { describe, it, expect } from 'vitest';
import { friendlyMessage, extractErrorMessage } from '../api/client';

describe('friendlyMessage', () => {
  it('never surfaces the raw axios 500 text', () => {
    const msg = friendlyMessage(500, 'Request failed with status code 500');
    expect(msg).not.toMatch(/Request failed with status code/);
    expect(msg).toBe('Something went wrong on the server. Please try again.');
  });

  it('maps a bodyless 500 (dev proxy) to a friendly message', () => {
    expect(friendlyMessage(500, undefined)).toBe('Something went wrong on the server. Please try again.');
  });

  it('reports an unreachable server when there is no response', () => {
    expect(friendlyMessage(undefined, undefined)).toBe(
      'Cannot reach the server. Please check your connection and try again.'
    );
  });

  it('keeps meaningful backend messages for 4xx errors', () => {
    expect(friendlyMessage(401, 'Invalid email or password')).toBe('Invalid email or password');
    expect(friendlyMessage(400, 'Validation failed')).toBe('Validation failed');
  });

  it('maps 503 to a service-unavailable message', () => {
    expect(friendlyMessage(503, undefined)).toBe('The service is temporarily unavailable. Please try again in a moment.');
  });

  it('falls back for other client errors without a backend message', () => {
    expect(friendlyMessage(418, undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('extractErrorMessage', () => {
  it('joins validation details', () => {
    expect(extractErrorMessage({ details: [{ field: 'email', message: 'is required' }] })).toBe('email: is required');
  });

  it('falls back to the error message', () => {
    expect(extractErrorMessage({ message: 'Boom' })).toBe('Boom');
  });
});
