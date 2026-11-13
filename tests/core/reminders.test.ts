import { describe, expect, it } from 'vitest';
import { findDueReminders, reminderKey } from '../../core/reminders';
import type { Car } from '../../core/types';

const today = '2026-11-10';
const car = (over: Partial<Car>): Car => ({
  id: 'c1',
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  make: 'Dacia',
  model: 'Logan',
  remindersAccepted: true,
  seed: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});
const due = (c: Car, sent = new Set<string>()) => findDueReminders([c], sent, today);

describe('reminderKey', () => {
  it('joins car, type and threshold', () => {
    expect(reminderKey('c1', 'itp', 30)).toBe('c1:itp:30');
  });
});

describe('ITP reminders', () => {
  it('fires the 30-day reminder at d = 30', () => {
    expect(due(car({ itpExpiry: '2026-12-10' }))).toMatchObject([
      { type: 'itp', threshold: 30, key: 'c1:itp:30' },
    ]);
  });
  it('does nothing at d = 31', () => {
    expect(due(car({ itpExpiry: '2026-12-11' }))).toEqual([]);
  });
  it('fires the 7-day reminder at d = 7 and marks the 30-day one sent', () => {
    expect(due(car({ itpExpiry: '2026-11-17' }))).toMatchObject([
      { type: 'itp', threshold: 7, key: 'c1:itp:7', alsoMarkSent: ['c1:itp:30'] },
    ]);
  });
  it('fires the 7-day reminder on the expiry day', () => {
    expect(due(car({ itpExpiry: '2026-11-10' }))).toMatchObject([{ threshold: 7, daysLeft: 0 }]);
  });
  it('does nothing once expired', () => {
    expect(due(car({ itpExpiry: '2026-11-09' }))).toEqual([]);
  });
});

describe('oil reminders', () => {
  it('fires at d = 14', () => {
    expect(due(car({ lastOilChange: '2025-11-24' }))).toMatchObject([
      { type: 'ulei', threshold: 14, daysLeft: 14 },
    ]);
  });
  it('does nothing at d = 15', () => {
    expect(due(car({ lastOilChange: '2025-11-25' }))).toEqual([]);
  });
  it('fires when overdue', () => {
    const [r] = due(car({ lastOilChange: '2025-01-01' }));
    expect(r).toMatchObject({ type: 'ulei', threshold: 14 });
    expect(r.daysLeft).toBeLessThan(0);
  });
});

describe('filters', () => {
  it('skips cars that did not accept reminders', () => {
    expect(due(car({ itpExpiry: '2026-12-10', remindersAccepted: false }))).toEqual([]);
  });
  it('skips reminders already sent', () => {
    expect(due(car({ itpExpiry: '2026-12-10' }), new Set(['c1:itp:30']))).toEqual([]);
  });
});
