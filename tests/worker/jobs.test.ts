import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { BookingInput } from '../../core/booking';
import type { Outcome } from '../../core/types';
import {
  claimReminder,
  emailsUsed,
  getAppointment,
  insertAppointment,
  insertCar,
  insertOutbox,
  insertRun,
  listOutbox,
  listReminderCars,
  listRuns,
  reserveEmail,
} from '../../worker/db';
import {
  SERVICE_EMAIL,
  cleanup,
  createBooking,
  deleteCustomer,
  outboxWithBudget,
  runReminders,
  setStatus,
  statusUrl,
} from '../../worker/jobs';
import { runJob } from '../../worker/runner';
import { appointmentFixture, carFixture, daysAgo, runFixture, testDeps } from './helpers';

const booking = (over: Partial<BookingInput> = {}): BookingInput => ({
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  make: 'Dacia',
  model: 'Logan',
  work: 'revizie',
  preferredDate: '2026-11-12',
  remindersAccepted: false,
  ...over,
});

const msg = { subject: 'Test', text: 'Corp' };
const NOW_ISO = '2026-11-10T06:00:00.000Z';

describe('bookings and status', () => {
  it('booking sends confirmation and service notification', async () => {
    const deps = testDeps();
    const { appointment, run } = await createBooking(deps, booking());

    expect(run.job).toBe('confirmare-programare');
    expect(run.trigger).toBe('formular');
    expect(run.result).toBe('ok');
    expect(run.items).toHaveLength(2);
    expect(run.items.every((i) => i.channel === 'email' && i.outcome === 'trimis-sandbox')).toBe(true);
    expect(run.items[0].to).toBe('i***@turbo-garaj.test');
    expect(deps.email.sent[0].to).toBe('ion@turbo-garaj.test');
    expect(deps.email.sent[0].text).toContain(statusUrl(deps, appointment.token));
    expect(deps.email.sent[1].to).toBe(SERVICE_EMAIL);
    expect(await listOutbox(deps.db, 50)).toHaveLength(2);
    expect(await listRuns(deps.db, 50)).toEqual([run]);
  });

  it('booking stores normalized email', async () => {
    const deps = testDeps();
    const { appointment } = await createBooking(deps, booking({ email: 'Ion@Turbo-Garaj.TEST ' }));
    const stored = await getAppointment(deps.db, appointment.id);
    expect(stored?.email).toBe('ion@turbo-garaj.test');
    expect(stored?.status).toBe('primita');
    expect(stored?.seed).toBe(false);
  });

  it('booking with reminders stores a linked car', async () => {
    const deps = testDeps();
    const { appointment } = await createBooking(
      deps,
      booking({ remindersAccepted: true, itpExpiry: '2027-01-01' }),
    );
    const cars = await listReminderCars(deps.db);
    expect(cars).toHaveLength(1);
    expect(cars[0]).toMatchObject({
      appointmentId: appointment.id,
      itpExpiry: '2027-01-01',
      remindersAccepted: true,
      seed: false,
    });
    expect(cars[0].lastOilChange).toBeUndefined();
  });

  it('non-test recipient is never sent', async () => {
    const deps = testDeps();
    let outcome: Outcome | undefined;
    const run = await runJob(deps, 'confirmare-programare', 'formular', async (ctx) => {
      outcome = await ctx.sendEmail('ion@gmail.com', msg);
    });
    expect(outcome).toBe('eroare');
    expect(run.result).toBe('eroare');
    expect(run.items[0]).toMatchObject({ outcome: 'eroare', error: 'adresă care nu e de test' });
    expect(deps.email.sent.length).toBe(0);
    expect(await emailsUsed(deps.db, '2026-11')).toBe(0);
    const outbox = await listOutbox(deps.db, 50);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).not.toContain('ion@gmail.com');
  });

  it('car ready sends email and sms preview', async () => {
    const deps = testDeps();
    const { appointment } = await createBooking(deps, booking());
    const result = await setStatus(deps, appointment.id, 'gata');

    expect(result?.appointment.status).toBe('gata');
    expect(result?.run?.job).toBe('masina-gata');
    expect(result?.run?.trigger).toBe('schimbare-status');
    expect(result?.run?.items.map((i) => i.outcome)).toEqual(['trimis-sandbox', 'simulat']);
    expect(result?.run?.items[1]).toMatchObject({ channel: 'sms-simulat', to: 'telefon de test' });
    expect((await getAppointment(deps.db, appointment.id))?.status).toBe('gata');
  });

  it('other status changes send nothing, unknown id gives null', async () => {
    const deps = testDeps();
    const { appointment } = await createBooking(deps, booking());
    const result = await setStatus(deps, appointment.id, 'in-lucru');
    expect(result?.appointment.status).toBe('in-lucru');
    expect(result?.run).toBeUndefined();
    expect(await setStatus(deps, 'nope', 'gata')).toBeNull();
  });
});

describe('reminders', () => {
  it('seed day sends exactly one reminder', async () => {
    const deps = testDeps();
    await cleanup(deps, 'cron', 'reset');
    const run = await runReminders(deps, 'cron');
    expect(run.job).toBe('remindere-zilnice');
    expect(run.items).toHaveLength(2);
    expect(run.items.map((i) => i.channel)).toEqual(['email', 'sms-simulat']);
    expect(run.result).toBe('ok');
    expect(deps.email.sent).toHaveLength(1);
  });

  it('second run sends nothing', async () => {
    const deps = testDeps();
    await cleanup(deps, 'cron', 'reset');
    await runReminders(deps, 'cron');
    const second = await runReminders(deps, 'buton');
    expect(second.result).toBe('nimic-de-trimis');
    expect(second.items).toHaveLength(0);
    expect(deps.email.sent).toHaveLength(1);
  });

  it('concurrent runs send each reminder once', async () => {
    const deps = testDeps();
    await cleanup(deps, 'cron', 'reset');
    const runs = await Promise.all([runReminders(deps, 'cron'), runReminders(deps, 'buton')]);
    expect(deps.email.sent.length).toBe(1);
    expect(runs.map((r) => r.result).sort()).toEqual(['nimic-de-trimis', 'ok']);
    expect(await emailsUsed(deps.db, '2026-11')).toBe(1);
  });

  it('failed send is retried next run', async () => {
    const deps = testDeps();
    await cleanup(deps, 'cron', 'reset');
    deps.email.failNext('boom');
    const first = await runReminders(deps, 'cron');
    expect(first.result).toBe('eroare');
    expect(first.items[0]).toMatchObject({ outcome: 'eroare', error: 'Trimiterea emailului a eșuat.' });
    expect(deps.email.sent).toHaveLength(0);

    const second = await runReminders(deps, 'buton');
    expect(second.result).toBe('ok');
    expect(second.items.map((i) => i.outcome)).toEqual(['trimis-sandbox', 'simulat']);
    expect(deps.email.sent).toHaveLength(1);
  });

  it('a more urgent threshold also marks the less urgent one as sent', async () => {
    const deps = testDeps();
    // ITP in 5 days: threshold 7 is due, threshold 30 must never follow.
    await insertCar(deps.db, carFixture({ id: 'c-urgent', itpExpiry: '2026-11-15' }));
    const first = await runReminders(deps, 'cron');
    expect(first.items).toHaveLength(2);
    const later = await runReminders(deps, 'buton');
    expect(later.result).toBe('nimic-de-trimis');
  });
});

describe('budget', () => {
  it('budget cap', async () => {
    const deps = testDeps();
    await env.DB.prepare("INSERT INTO email_budget (month, used) VALUES ('2026-11', 40)").run();
    const { run } = await createBooking(deps, booking());
    expect(run.items.map((i) => i.outcome)).toEqual(['netrimis-limita', 'netrimis-limita']);
    expect(run.result).toBe('ok');
    expect(deps.email.sent.length).toBe(0);
    expect(await listOutbox(deps.db, 50)).toHaveLength(2);
    expect(await emailsUsed(deps.db, '2026-11')).toBe(40);
    expect(await outboxWithBudget(deps)).toMatchObject({ used: 40, cap: 40 });
  });

  it('failed send gives the budget slot back', async () => {
    const deps = testDeps();
    deps.email.failNext('boom');
    const run = await runJob(deps, 'confirmare-programare', 'formular', async (ctx) => {
      await ctx.sendEmail('ion@turbo-garaj.test', msg);
    });
    expect(run.items[0]).toMatchObject({ outcome: 'eroare', error: 'Trimiterea emailului a eșuat.' });
    expect(await emailsUsed(deps.db, '2026-11')).toBe(0);
  });
});

describe('atomic statements', () => {
  it('two simultaneous claims of the same key: exactly one wins', async () => {
    const deps = testDeps();
    const results = await Promise.all([
      claimReminder(deps.db, 'c-1:itp:30', NOW_ISO),
      claimReminder(deps.db, 'c-1:itp:30', NOW_ISO),
      claimReminder(deps.db, 'c-1:itp:30', NOW_ISO),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('simultaneous reservations never go over the cap', async () => {
    const deps = testDeps();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => reserveEmail(deps.db, '2026-11', 4)),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
    expect(await emailsUsed(deps.db, '2026-11')).toBe(4);
  });
});

describe('cleanup and deletion', () => {
  it('nightly cleanup keeps recent data and drops old', async () => {
    const deps = testDeps();
    await insertAppointment(deps.db, appointmentFixture({ id: 'old', token: 't-old', createdAt: daysAgo(8) }));
    await insertCar(deps.db, carFixture({ id: 'c-old', appointmentId: 'old', createdAt: daysAgo(8) }));
    await insertOutbox(deps.db, {
      id: 'o-old',
      runId: 'r-x',
      channel: 'email',
      to: 'ion@turbo-garaj.test',
      subject: 's',
      body: 'b',
      outcome: 'trimis-sandbox',
      createdAt: daysAgo(8),
      appointmentId: 'old',
    });
    await insertAppointment(deps.db, appointmentFixture({ id: 'new', token: 't-new', createdAt: daysAgo(6) }));
    await insertRun(deps.db, runFixture({ id: 'r-old', startedAt: daysAgo(31) }));
    await insertRun(deps.db, runFixture({ id: 'r-new', startedAt: daysAgo(29) }));

    const run = await cleanup(deps, 'cron', 'nightly');

    expect(run).toMatchObject({ job: 'curatenie', trigger: 'cron', result: 'ok' });
    expect(await getAppointment(deps.db, 'old')).toBeNull();
    expect(await getAppointment(deps.db, 'new')).not.toBeNull();
    expect((await listOutbox(deps.db, 50)).map((m) => m.id)).not.toContain('o-old');
    const cars = (await listReminderCars(deps.db)).map((c) => c.id).sort();
    expect(cars).toEqual(['seed-1', 'seed-2', 'seed-3']);
    const runIds = (await listRuns(deps.db, 50)).map((r) => r.id);
    expect(runIds).not.toContain('r-old');
    expect(runIds).toContain('r-new');
    expect(runIds).toContain(run.id);
  });

  it('reset wipes everything but the email budget, then reseeds', async () => {
    const deps = testDeps();
    await createBooking(deps, booking({ remindersAccepted: true }));
    expect(await emailsUsed(deps.db, '2026-11')).toBe(2);
    const run = await cleanup(deps, 'buton', 'reset');
    expect(await listOutbox(deps.db, 50)).toHaveLength(0);
    expect((await listRuns(deps.db, 50)).map((r) => r.id)).toEqual([run.id]);
    expect((await listReminderCars(deps.db)).every((c) => c.seed)).toBe(true);
    expect(await emailsUsed(deps.db, '2026-11')).toBe(2);
  });

  it('delete customer', async () => {
    const deps = testDeps();
    const { appointment } = await createBooking(
      deps,
      booking({ remindersAccepted: true, itpExpiry: '2026-11-15' }),
    );
    await setStatus(deps, appointment.id, 'gata');
    await runReminders(deps, 'cron');

    expect(await deleteCustomer(deps, appointment.id)).toBe(true);

    expect(await getAppointment(deps.db, appointment.id)).toBeNull();
    expect(await listReminderCars(deps.db)).toHaveLength(0);
    expect(await listOutbox(deps.db, 50)).toHaveLength(0);
    const items = (await listRuns(deps.db, 50)).flatMap((r) => r.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => typeof i === 'object' && typeof i.subject === 'string')).toBe(true);
    expect(items.some((i) => i.to === 'i***@turbo-garaj.test')).toBe(false);
    expect(items.filter((i) => i.to === '(șters)').length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => i.to === 's***@turbo-garaj.test')).toBe(true);

    expect(await deleteCustomer(deps, appointment.id)).toBe(false);
  });
});

describe('runJob', () => {
  it('thrown error marks run eroare', async () => {
    const deps = testDeps();
    const run = await runJob(deps, 'curatenie', 'buton', async () => {
      throw new Error('x');
    });
    expect(run).toMatchObject({
      result: 'eroare',
      error: 'Eroare la rulare. Detaliile sunt în jurnalul serverului.',
    });
    expect(JSON.stringify(run)).not.toContain('"x"');
    expect(await listRuns(deps.db, 50)).toEqual([run]);
  });

  it('a messaging job with nothing to send logs nimic-de-trimis, a non-messaging job logs ok', async () => {
    const deps = testDeps();
    const messaging = await runJob(deps, 'remindere-zilnice', 'buton', async () => {});
    const silent = await runJob(deps, 'curatenie', 'buton', async () => {}, { sendsMessages: false });
    expect(messaging.result).toBe('nimic-de-trimis');
    expect(silent.result).toBe('ok');
  });

  it('sms rows store the test-phone label, not the customer email', async () => {
    const deps = testDeps();
    await runJob(deps, 'masina-gata', 'schimbare-status', async (ctx) => {
      await ctx.sendSmsPreview('ion@turbo-garaj.test', { subject: 's', text: 't' });
    });
    const outbox = await listOutbox(deps.db, 50);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe('telefon de test');
  });
});
