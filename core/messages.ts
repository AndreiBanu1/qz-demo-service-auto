import { STATUS_LABELS, WORK_LABELS } from './booking';
import type { Appointment, Car, DueReminder } from './types';

export type Message = { subject: string; text: string };

export const FOOTER =
  'Mesaj demonstrativ trimis de site-ul Turbo Garaj, realizat de Quality Zone. Service-ul nu există.';

const body = (lines: string[]): string => `${lines.join('\n')}\n\n${FOOTER}`;

export function bookingConfirmation(a: Appointment, statusUrl: string): Message {
  return {
    subject: 'Programarea ta la Turbo Garaj a fost primită',
    text: body([
      `Salut, ${a.firstName}!`,
      `Am primit programarea ta pentru ${a.car.make} ${a.car.model}: ${WORK_LABELS[a.work]}, pe ${a.preferredDate}.`,
      `Poți urmări starea lucrării aici: ${statusUrl}`,
    ]),
  };
}

export function serviceNotification(a: Appointment): Message {
  return {
    subject: `Programare nouă: ${a.car.make} ${a.car.model}, ${a.preferredDate}`,
    text: body([
      `Salut, echipă! Clientul ${a.firstName} (${a.email}) a făcut o programare.`,
      `Mașina: ${a.car.make} ${a.car.model}`,
      `Lucrarea: ${WORK_LABELS[a.work]}`,
      `Data dorită: ${a.preferredDate}`,
      `Stare: ${STATUS_LABELS[a.status]}`,
    ]),
  };
}

export function carReady(a: Appointment, statusUrl: string): Message {
  return {
    subject: 'Mașina ta e gata',
    text: body([
      `Salut, ${a.firstName}!`,
      `${a.car.make} ${a.car.model} e gata de ridicare.`,
      `Detalii aici: ${statusUrl}`,
    ]),
  };
}

export function carReadySms(a: Appointment, statusUrl: string): Message {
  return {
    subject: 'Mașina ta e gata',
    text: body([`Salut, ${a.firstName}! Mașina ta e gata de ridicare: ${statusUrl}`]),
  };
}

function reminderSubject(r: DueReminder): string {
  if (r.type === 'itp') {
    return r.daysLeft === 0
      ? 'Reminder: ITP-ul expiră azi'
      : `Reminder: ITP-ul expiră în ${r.daysLeft} zile`;
  }
  return 'Reminder: e timpul pentru schimbul de ulei';
}

function reminderLine(c: Car, r: DueReminder): string {
  const car = `${c.make} ${c.model}`;
  if (r.type === 'itp') {
    return r.daysLeft === 0
      ? `ITP-ul pentru ${car} expiră azi.`
      : `ITP-ul pentru ${car} expiră în ${r.daysLeft} zile.`;
  }
  return `E timpul pentru schimbul de ulei la ${car}.`;
}

export function reminderEmail(c: Car, r: DueReminder): Message {
  return {
    subject: reminderSubject(r),
    text: body([
      `Salut, ${c.firstName}!`,
      reminderLine(c, r),
      'Poți face o programare nouă pe site oricând.',
    ]),
  };
}

export function reminderSms(c: Car, r: DueReminder): Message {
  return {
    subject: reminderSubject(r),
    text: body([`Salut, ${c.firstName}! ${reminderLine(c, r)}`]),
  };
}
