import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, todayInBucharest } from '../../core/dates';

describe('todayInBucharest', () => {
  it('rolls over at local midnight in winter (UTC+2)', () => {
    expect(todayInBucharest(new Date('2026-11-10T22:30:00Z'))).toBe('2026-11-11');
  });
  it('rolls over at local midnight in summer (UTC+3)', () => {
    expect(todayInBucharest(new Date('2026-07-01T20:59:00Z'))).toBe('2026-07-01');
  });
});

describe('addMonths', () => {
  it('clamps to the last day of the month', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });
  it('goes backwards across years', () => {
    expect(addMonths('2026-03-15', -12)).toBe('2025-03-15');
    expect(addMonths('2026-01-10', -3)).toBe('2025-10-10');
  });
});

describe('addDays / daysBetween', () => {
  it('counts whole days across the DST change', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
  it('is negative when to is before from', () => {
    expect(daysBetween('2026-11-10', '2026-11-09')).toBe(-1);
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-11-10', 30)).toBe('2026-12-10');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
