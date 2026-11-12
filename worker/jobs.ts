import type { BookingInput } from '../core/booking';
import { budgetMonth, EMAIL_BUDGET_CAP } from '../core/budget';
import { todayInBucharest } from '../core/dates';
import {
  bookingConfirmation,
  carReady,
  carReadySms,
  reminderEmail,
  reminderSms,
  serviceNotification,
} from '../core/messages';
import { isTestAddress, maskEmail, normalizeEmail } from '../core/recipients';
import { findDueReminders } from '../core/reminders';
import { buildSeed } from '../core/seed';
import type { Appointment, Outcome, OutboxMessage, Run, Status } from '../core/types';
import {
  claimReminder,
  deleteAppointmentCascade,
  emailsUsed,
  getAppointment,
  insertAppointment,
  insertCar,
  listOutbox,
  listReminderCars,
  listRuns,
  listSentKeys,
  purgeOld,
  releaseReminder,
  replaceSeed,
  updateAppointmentStatus,
  wipeAll,
} from './db';
import type { Deps } from './deps';
import { runJob } from './runner';

export const SERVICE_EMAIL = 'service@turbo-garaj.test';

const DAY_MS = 86_400_000;
const DATA_RETENTION_DAYS = 7;
const LOG_RETENTION_DAYS = 30;
const OUTBOX_LIMIT = 100;

export function statusUrl(deps: Deps, token: string): string {
  return `${deps.siteUrl}/status/${token}`;
}

/** Saves a booking (and its car, when there is anything to remind about), then confirms it. */
export async function createBooking(
  deps: Deps,
  input: BookingInput,
): Promise<{ appointment: Appointment; run: Run }> {
  const email = normalizeEmail(input.email);
  // Routes validate first; this keeps a non-test address out of the database regardless.
  if (!isTestAddress(email)) throw new Error('createBooking: not a test address');

  const now = deps.now().toISOString();
  const appointment: Appointment = {
    id: deps.newId(),
    token: deps.newToken(),
    firstName: input.firstName.trim(),
    email,
    car: { make: input.make.trim(), model: input.model.trim() },
    work: input.work,
    preferredDate: input.preferredDate,
    status: 'primita',
    createdAt: now,
    updatedAt: now,
    seed: false,
  };
  await insertAppointment(deps.db, appointment);

  if (input.remindersAccepted || input.itpExpiry || input.lastOilChange) {
    await insertCar(deps.db, {
      id: deps.newId(),
      appointmentId: appointment.id,
      firstName: appointment.firstName,
      email,
      make: appointment.car.make,
      model: appointment.car.model,
      ...(input.itpExpiry ? { itpExpiry: input.itpExpiry } : {}),
      ...(input.lastOilChange ? { lastOilChange: input.lastOilChange } : {}),
      remindersAccepted: input.remindersAccepted,
      seed: false,
      createdAt: now,
    });
  }

  const run = await runJob(deps, 'confirmare-programare', 'formular', async (ctx) => {
    await ctx.sendEmail(email, bookingConfirmation(appointment, statusUrl(deps, appointment.token)), appointment.id);
    await ctx.sendEmail(SERVICE_EMAIL, serviceNotification(appointment), appointment.id);
  });
  return { appointment, run };
}

/** Null for an unknown id. Moving to „gata” sends the car-ready email and SMS preview. */
export async function setStatus(
  deps: Deps,
  id: string,
  status: Status,
): Promise<{ appointment: Appointment; run?: Run } | null> {
  const current = await getAppointment(deps.db, id);
  if (!current) return null;

  const updatedAt = deps.now().toISOString();
  if (!(await updateAppointmentStatus(deps.db, id, status, updatedAt))) return null;
  const appointment: Appointment = { ...current, status, updatedAt };

  if (status !== 'gata' || current.status === 'gata') return { appointment };

  const url = statusUrl(deps, appointment.token);
  const run = await runJob(deps, 'masina-gata', 'schimbare-status', async (ctx) => {
    await ctx.sendEmail(appointment.email, carReady(appointment, url), appointment.id);
    await ctx.sendSmsPreview(appointment.email, carReadySms(appointment, url), appointment.id);
  });
  return { appointment, run };
}

/** The daily reminders job, shared by the cron and „Rulează acum”. */
export async function runReminders(deps: Deps, trigger: 'cron' | 'buton'): Promise<Run> {
  return runJob(deps, 'remindere-zilnice', trigger, async (ctx) => {
    const { db } = deps;
    const cars = await listReminderCars(db);
    const due = findDueReminders(cars, await listSentKeys(db), todayInBucharest(deps.now()));
    const byId = new Map(cars.map((c) => [c.id, c]));

    for (const r of due) {
      const car = byId.get(r.carId);
      if (!car) continue;
      const at = deps.now().toISOString();
      // Atomic claim: when two runs overlap, only one of them gets each reminder.
      if (!(await claimReminder(db, r.key, at))) continue;

      let outcome: Outcome;
      try {
        outcome = await ctx.sendEmail(car.email, reminderEmail(car, r), car.appointmentId);
      } catch (e) {
        await releaseReminder(db, r.key);
        throw e;
      }
      if (outcome === 'eroare') {
        // Give the claim back so the next run retries this reminder (email and SMS together).
        await releaseReminder(db, r.key);
        continue;
      }
      await ctx.sendSmsPreview(car.email, reminderSms(car, r), car.appointmentId);
      for (const key of r.alsoMarkSent) await claimReminder(db, key, at);
    }
  });
}

/** Nightly retention or a full demo reset; both end by recreating today's seed. */
export async function cleanup(
  deps: Deps,
  trigger: 'cron' | 'buton',
  mode: 'nightly' | 'reset',
): Promise<Run> {
  return runJob(deps, 'curatenie', trigger, async () => {
    const now = deps.now();
    if (mode === 'nightly') {
      const before = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
      await purgeOld(deps.db, before(DATA_RETENTION_DAYS), before(LOG_RETENTION_DAYS));
    } else {
      await wipeAll(deps.db);
    }
    await replaceSeed(deps.db, buildSeed(todayInBucharest(now), now.toISOString()));
  });
}

/** „Șterge clientul”. False for an unknown id. */
export async function deleteCustomer(deps: Deps, appointmentId: string): Promise<boolean> {
  const a = await getAppointment(deps.db, appointmentId);
  if (!a) return false;
  return deleteAppointmentCascade(deps.db, a.id, maskEmail(a.email));
}

export function recentRuns(deps: Deps, limit = 50): Promise<Run[]> {
  return listRuns(deps.db, limit);
}

export async function outboxWithBudget(
  deps: Deps,
): Promise<{ messages: OutboxMessage[]; used: number; cap: number }> {
  const [messages, used] = await Promise.all([
    listOutbox(deps.db, OUTBOX_LIMIT),
    emailsUsed(deps.db, budgetMonth(deps.now())),
  ]);
  return { messages, used, cap: EMAIL_BUDGET_CAP };
}
