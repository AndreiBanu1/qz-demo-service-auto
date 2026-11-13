export const EMAIL_BUDGET_CAP = 40;

const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: '2-digit',
});

/** 'YYYY-MM' for the Europe/Bucharest calendar month of `now`. */
export function budgetMonth(now: Date): string {
  const parts = monthFormat.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

export function budgetKey(now: Date): string {
  return `email-budget-${budgetMonth(now)}`;
}

export function canSendEmail(used: number, cap = EMAIL_BUDGET_CAP): boolean {
  return used < cap;
}
