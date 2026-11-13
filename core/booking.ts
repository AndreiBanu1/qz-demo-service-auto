import { isTestAddress, normalizeEmail } from './recipients';
import type { IsoDate, Status, Work } from './types';

export type BookingInput = {
  firstName: string;
  email: string;
  make: string;
  model: string;
  work: Work;
  preferredDate: IsoDate;
  itpExpiry?: IsoDate;
  lastOilChange?: IsoDate;
  remindersAccepted: boolean;
};

export const WORK_LABELS: Record<Work, string> = {
  revizie: 'Revizie',
  ulei: 'Schimb de ulei',
  itp: 'Pregătire ITP',
  frane: 'Frâne',
  diagnoza: 'Diagnoză',
};

export const STATUS_LABELS: Record<Status, string> = {
  primita: 'Primită',
  'in-lucru': 'În lucru',
  gata: 'Gata de ridicare',
  predata: 'Predată',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-13-45). */
function isIsoDate(s: unknown): s is IsoDate {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function validateBooking(
  input: unknown,
  today: IsoDate,
): { ok: true; value: BookingInput } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (typeof input !== 'object' || input === null) return fail('Completează formularul.');
  const r = input as Record<string, unknown>;

  const firstName = str(r.firstName);
  if (firstName.length < 2 || firstName.length > 40) {
    return fail('Scrie un prenume între 2 și 40 de caractere.');
  }
  const emailRaw = str(r.email);
  if (!isTestAddress(emailRaw)) {
    return fail('În demo folosește o adresă de test, de exemplu ion@turbo-garaj.test.');
  }
  const make = str(r.make);
  const model = str(r.model);
  if (!make || !model) return fail('Completează marca și modelul.');
  const work = r.work;
  if (typeof work !== 'string' || !Object.hasOwn(WORK_LABELS, work)) {
    return fail('Alege tipul lucrării.');
  }
  const preferredDate = r.preferredDate;
  if (!isIsoDate(preferredDate) || preferredDate < today) {
    return fail('Alege o dată de azi încolo.');
  }

  const optional = (v: unknown): IsoDate | undefined | null => {
    const s = str(v);
    if (!s) return undefined;
    return isIsoDate(s) ? s : null;
  };
  const itpExpiry = optional(r.itpExpiry);
  const lastOilChange = optional(r.lastOilChange);
  if (itpExpiry === null || lastOilChange === null) return fail('Data nu e validă.');

  const value: BookingInput = {
    firstName,
    email: normalizeEmail(emailRaw),
    make,
    model,
    work: work as Work,
    preferredDate,
    remindersAccepted: r.remindersAccepted === true,
  };
  if (itpExpiry) value.itpExpiry = itpExpiry;
  if (lastOilChange) value.lastOilChange = lastOilChange;
  return { ok: true, value };
}
