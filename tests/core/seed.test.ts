import { describe, expect, it } from 'vitest';
import { addDays } from '../../core/dates';
import { findDueReminders } from '../../core/reminders';
import { isTestAddress } from '../../core/recipients';
import { SEED_IDS, buildSeed } from '../../core/seed';

const iso = '2027-01-01T00:00:00.000Z';

describe('buildSeed', () => {
  it('exactly one reminder is due on every day of a year', () => {
    let day = '2027-01-01';
    for (let i = 0; i < 366; i++) {
      const due = findDueReminders(buildSeed(day, iso), new Set(), day);
      expect(due.length, day).toBe(1);
      day = addDays(day, 1);
    }
  });

  it('uses only test addresses', () => {
    for (const car of buildSeed('2027-01-01', iso)) {
      expect(isTestAddress(car.email)).toBe(true);
    }
  });

  it('has stable ids and flags', () => {
    const cars = buildSeed('2027-01-01', iso);
    expect(cars.map((c) => c.id)).toEqual([...SEED_IDS]);
    expect(cars.every((c) => c.seed && c.remindersAccepted && c.createdAt === iso)).toBe(true);
  });
});
