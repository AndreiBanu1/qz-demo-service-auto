import { addDays, addMonths } from './dates';
import type { Car, IsoDate } from './types';

export const SEED_IDS = ['seed-1', 'seed-2', 'seed-3'] as const;

/** 1-based day of the year of a 'YYYY-MM-DD' date. */
function dayOfYear(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number);
  return (Date.UTC(y, m - 1, day) - Date.UTC(y, 0, 0)) / 86_400_000;
}

/**
 * The three demo cars. On any given day exactly one reminder is due, always
 * from seed-1, so the daily cron has something to send without ever repeating.
 */
export function buildSeed(today: IsoDate, createdAt: string): Car[] {
  const base = { remindersAccepted: true, seed: true, createdAt };
  const even = dayOfYear(today) % 2 === 0;

  return [
    {
      ...base,
      id: SEED_IDS[0],
      firstName: 'Mihai',
      email: 'mihai@turbo-garaj.test',
      make: 'Dacia',
      model: 'Logan',
      // Even day: ITP in 30 days, oil far from due. Odd day: oil due in 10 days, ITP far away.
      itpExpiry: even ? addDays(today, 30) : addDays(today, 200),
      lastOilChange: even ? addMonths(today, -3) : addDays(addMonths(today, -12), 10),
    },
    {
      ...base,
      id: SEED_IDS[1],
      firstName: 'Elena',
      email: 'elena@turbo-garaj.test',
      make: 'Skoda',
      model: 'Octavia',
      itpExpiry: addDays(today, 120),
      lastOilChange: addMonths(today, -2),
    },
    {
      ...base,
      id: SEED_IDS[2],
      firstName: 'Radu',
      email: 'radu@turbo-garaj.test',
      make: 'Volkswagen',
      model: 'Golf',
      itpExpiry: addDays(today, 300),
      lastOilChange: addMonths(today, -5),
    },
  ];
}
