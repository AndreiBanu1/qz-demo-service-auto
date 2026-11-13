import type { IsoDate } from './types';

const MONTHS_RO = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
];

/** 'YYYY-MM-DD' to „12 noiembrie 2026”. A fixed month list, so it never depends on the runtime's locale data. */
export function formatDateRo(iso: IsoDate): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_RO[m - 1]} ${y}`;
}

/** „într-o zi”, „în 7 zile”, „în 30 de zile”; 0 is „azi”. */
export function daysPhrase(n: number): string {
  if (n === 0) return 'azi';
  if (n === 1) return 'într-o zi';
  return n < 20 ? `în ${n} zile` : `în ${n} de zile`;
}
