import { describe, expect, it } from 'vitest';
import { STATUS_LABELS, WORK_LABELS, validateBooking } from '../../core/booking';

const TODAY = '2026-11-10';
const valid = {
  firstName: 'Ion',
  email: ' Ion@Turbo-Garaj.TEST',
  make: 'Dacia',
  model: 'Logan',
  work: 'revizie',
  preferredDate: '2026-11-12',
  remindersAccepted: true,
};
const err = (patch: object) => {
  const r = validateBooking({ ...valid, ...patch }, TODAY);
  return r.ok ? null : r.error;
};

describe('validateBooking', () => {
  it('accepts valid input and normalizes the email', () => {
    const r = validateBooking(valid, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.email).toBe('ion@turbo-garaj.test');
  });
  it('trims strings', () => {
    const r = validateBooking({ ...valid, firstName: '  Ion ', make: ' Dacia ' }, TODAY);
    expect(r.ok && r.value.firstName).toBe('Ion');
    expect(r.ok && r.value.make).toBe('Dacia');
  });
  it('accepts today as preferredDate', () => {
    expect(validateBooking({ ...valid, preferredDate: TODAY }, TODAY).ok).toBe(true);
  });
  it('rejects a short or long first name', () => {
    const msg = 'Scrie un prenume între 2 și 40 de caractere.';
    expect(err({ firstName: 'I' })).toBe(msg);
    expect(err({ firstName: 'a'.repeat(41) })).toBe(msg);
  });
  it('rejects a non-test email', () => {
    expect(err({ email: 'ion@gmail.com' })).toBe(
      'În demo folosește o adresă de test, de exemplu ion@turbo-garaj.test.',
    );
  });
  it('rejects an empty make or model', () => {
    expect(err({ make: '  ' })).toBe('Completează marca și modelul.');
    expect(err({ model: '' })).toBe('Completează marca și modelul.');
  });
  it('rejects an unknown work type', () => {
    expect(err({ work: 'zugrav' })).toBe('Alege tipul lucrării.');
  });
  it('rejects a missing or past preferredDate', () => {
    const msg = 'Alege o dată de azi încolo.';
    expect(err({ preferredDate: '2026-11-09' })).toBe(msg);
    expect(err({ preferredDate: undefined })).toBe(msg);
  });
  it('rejects a malformed optional date', () => {
    expect(err({ itpExpiry: 'mâine' })).toBe('Data nu e validă.');
    expect(err({ lastOilChange: '2026-13-45' })).toBe('Data nu e validă.');
  });
  it('keeps valid optional dates', () => {
    const r = validateBooking({ ...valid, itpExpiry: '2027-01-01' }, TODAY);
    expect(r.ok && r.value.itpExpiry).toBe('2027-01-01');
  });
  it('rejects non-object input', () => {
    expect(validateBooking(null, TODAY).ok).toBe(false);
  });
});

describe('labels', () => {
  it('has Romanian labels', () => {
    expect(WORK_LABELS.itp).toBe('Pregătire ITP');
    expect(STATUS_LABELS.gata).toBe('Gata de ridicare');
  });
});
