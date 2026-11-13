import { describe, expect, it } from 'vitest';
import {
  LOCKOUT_MAX,
  LOCKOUT_WINDOW_MS,
  SESSION_TTL_MS,
  isLockedOut,
  passwordMatches,
  signSession,
  verifySession,
} from '../../core/session';

const NOW = 1_800_000_000_000;
const SECRET = 'test-secret';

describe('constants', () => {
  it('match the spec', () => {
    expect(SESSION_TTL_MS).toBe(8 * 3600_000);
    expect(LOCKOUT_WINDOW_MS).toBe(15 * 60_000);
    expect(LOCKOUT_MAX).toBe(5);
  });
});

describe('session token', () => {
  it('verifies before expiry and fails after', async () => {
    const token = await signSession(NOW + 1000, SECRET);
    expect(token.startsWith(`${NOW + 1000}.`)).toBe(true);
    expect(await verifySession(token, SECRET, NOW)).toBe(true);
    expect(await verifySession(token, SECRET, NOW + 1000)).toBe(true);
    expect(await verifySession(token, SECRET, NOW + 1001)).toBe(false);
  });
  it('fails when the expiry is tampered with', async () => {
    const token = await signSession(NOW + 1000, SECRET);
    const sig = token.split('.')[1];
    expect(await verifySession(`${NOW + 999_999}.${sig}`, SECRET, NOW)).toBe(false);
  });
  it('fails with another secret', async () => {
    const token = await signSession(NOW + 1000, 'other');
    expect(await verifySession(token, SECRET, NOW)).toBe(false);
  });
  it('fails for missing or garbage tokens', async () => {
    expect(await verifySession(undefined, SECRET, NOW)).toBe(false);
    expect(await verifySession('garbage', SECRET, NOW)).toBe(false);
    expect(await verifySession('123.!!!', SECRET, NOW)).toBe(false);
    expect(await verifySession('.', SECRET, NOW)).toBe(false);
  });
});

describe('passwordMatches', () => {
  it('compares passwords', async () => {
    expect(await passwordMatches('a', 'a')).toBe(true);
    expect(await passwordMatches('a', 'b')).toBe(false);
    expect(await passwordMatches('', 'a')).toBe(false);
  });
});

describe('isLockedOut', () => {
  it('is false with 4 recent failures', () => {
    expect(isLockedOut([NOW, NOW - 1, NOW - 2, NOW - 3], NOW)).toBe(false);
  });
  it('is true with 5 recent failures', () => {
    expect(isLockedOut([NOW, NOW - 1, NOW - 2, NOW - 3, NOW - 4], NOW)).toBe(true);
  });
  it('ignores failures older than the window', () => {
    const old = NOW - LOCKOUT_WINDOW_MS - 1000;
    expect(isLockedOut([old, NOW, NOW - 1, NOW - 2, NOW - 3], NOW)).toBe(false);
  });
});
