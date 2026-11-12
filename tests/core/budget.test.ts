import { describe, expect, it } from 'vitest';
import { budgetKey, budgetMonth, canSendEmail } from '../../core/budget';

describe('canSendEmail', () => {
  it('allows below the cap and blocks at the cap', () => {
    expect(canSendEmail(39)).toBe(true);
    expect(canSendEmail(40)).toBe(false);
  });
});

describe('budgetMonth / budgetKey', () => {
  const jan = new Date('2026-12-31T22:30:00Z'); // 00:30 on 1 Jan in Bucharest
  const dec = new Date('2026-12-31T21:30:00Z'); // 23:30 on 31 Dec in Bucharest

  it('uses the Bucharest month', () => {
    expect(budgetMonth(jan)).toBe('2027-01');
    expect(budgetMonth(dec)).toBe('2026-12');
  });

  it('builds the key from the month', () => {
    expect(budgetKey(jan)).toBe('email-budget-2027-01');
    expect(budgetKey(dec)).toBe('email-budget-2026-12');
  });
});
