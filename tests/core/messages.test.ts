import { describe, expect, it } from 'vitest';
import {
  FOOTER,
  bookingConfirmation,
  carReady,
  carReadySms,
  reminderEmail,
  reminderSms,
  serviceNotification,
} from '../../core/messages';
import type { Appointment, Car, DueReminder } from '../../core/types';

const appt: Appointment = {
  id: 'a1',
  token: 't',
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  car: { make: 'Dacia', model: 'Logan' },
  work: 'revizie',
  preferredDate: '2026-11-12',
  status: 'primita',
  createdAt: '2026-11-10T08:00:00.000Z',
  updatedAt: '2026-11-10T08:00:00.000Z',
  seed: false,
};
const car: Car = {
  id: 'c1',
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  make: 'Dacia',
  model: 'Logan',
  remindersAccepted: true,
  seed: false,
  createdAt: '2026-11-10T08:00:00.000Z',
};
const due = (type: 'itp' | 'ulei', daysLeft: number): DueReminder => ({
  carId: 'c1',
  type,
  threshold: 7,
  daysLeft,
  key: 'k',
  alsoMarkSent: [],
});
const URL = 'https://turbo-garaj-demo.example.workers.dev/status/abc';

describe('messages', () => {
  it('subjects match the copy', () => {
    expect(bookingConfirmation(appt, URL).subject).toBe('Programarea ta la Turbo Garaj a fost primită');
    expect(serviceNotification(appt).subject).toBe('Programare nouă: Dacia Logan, 2026-11-12');
    expect(carReady(appt, URL).subject).toBe('Mașina ta e gata');
    expect(reminderEmail(car, due('itp', 7)).subject).toBe('Reminder: ITP-ul expiră în 7 zile');
    expect(reminderEmail(car, due('itp', 0)).subject).toBe('Reminder: ITP-ul expiră azi');
    expect(reminderEmail(car, due('ulei', 14)).subject).toBe('Reminder: e timpul pentru schimbul de ulei');
  });
  it('status URL appears in the confirmation and ready messages', () => {
    expect(bookingConfirmation(appt, URL).text).toContain(URL);
    expect(carReady(appt, URL).text).toContain(URL);
    expect(carReadySms(appt, URL).text).toContain(URL);
  });
  it('every body greets and ends with the footer', () => {
    const all = [
      bookingConfirmation(appt, URL),
      serviceNotification(appt),
      carReady(appt, URL),
      carReadySms(appt, URL),
      reminderEmail(car, due('itp', 7)),
      reminderEmail(car, due('ulei', 14)),
      reminderSms(car, due('itp', 7)),
      reminderSms(car, due('ulei', 14)),
    ];
    for (const m of all) expect(m.text.endsWith(FOOTER)).toBe(true);
    for (const m of all.filter((m) => m !== all[1])) expect(m.text).toContain('Salut, Ion!');
  });
  it('SMS texts stay under 160 characters excluding the URL', () => {
    expect(carReadySms(appt, URL).text.replace(URL, '').length).toBeLessThan(160);
    expect(reminderSms(car, due('itp', 7)).text.length).toBeLessThan(160);
    expect(reminderSms(car, due('ulei', 14)).text.length).toBeLessThan(160);
  });
});
