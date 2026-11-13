// The only file with SQL. Rows are snake_case; the rest of the code sees the
// camelCase types from core/types.ts.
import type { Appointment, Car, OutboxMessage, Run, RunItem, Status, Work } from '../core/types';

type AppointmentRow = {
  id: string;
  token: string;
  first_name: string;
  email: string;
  make: string;
  model: string;
  work: string;
  preferred_date: string;
  status: string;
  created_at: string;
  updated_at: string;
  seed: number;
};

type CarRow = {
  id: string;
  appointment_id: string | null;
  first_name: string;
  email: string;
  make: string;
  model: string;
  itp_expiry: string | null;
  last_oil_change: string | null;
  reminders_accepted: number;
  seed: number;
  created_at: string;
};

type OutboxRow = {
  id: string;
  run_id: string;
  appointment_id: string | null;
  channel: string;
  to_addr: string;
  subject: string;
  body: string;
  outcome: string;
  created_at: string;
};

type RunRow = {
  id: string;
  job: string;
  trigger: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  result: string;
  items: string;
  error: string | null;
};

function toAppointment(r: AppointmentRow): Appointment {
  return {
    id: r.id,
    token: r.token,
    firstName: r.first_name,
    email: r.email,
    car: { make: r.make, model: r.model },
    work: r.work as Work,
    preferredDate: r.preferred_date,
    status: r.status as Status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    seed: r.seed === 1,
  };
}

function toCar(r: CarRow): Car {
  const car: Car = {
    id: r.id,
    firstName: r.first_name,
    email: r.email,
    make: r.make,
    model: r.model,
    remindersAccepted: r.reminders_accepted === 1,
    seed: r.seed === 1,
    createdAt: r.created_at,
  };
  if (r.appointment_id !== null) car.appointmentId = r.appointment_id;
  if (r.itp_expiry !== null) car.itpExpiry = r.itp_expiry;
  if (r.last_oil_change !== null) car.lastOilChange = r.last_oil_change;
  return car;
}

function toOutbox(r: OutboxRow): OutboxMessage {
  const m: OutboxMessage = {
    id: r.id,
    runId: r.run_id,
    channel: r.channel as OutboxMessage['channel'],
    to: r.to_addr,
    subject: r.subject,
    body: r.body,
    outcome: r.outcome as OutboxMessage['outcome'],
    createdAt: r.created_at,
  };
  if (r.appointment_id !== null) m.appointmentId = r.appointment_id;
  return m;
}

function toRun(r: RunRow): Run {
  const run: Run = {
    id: r.id,
    job: r.job as Run['job'],
    trigger: r.trigger as Run['trigger'],
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    result: r.result as Run['result'],
    items: JSON.parse(r.items) as RunItem[],
  };
  if (r.error !== null) run.error = r.error;
  return run;
}

const bool = (b: boolean): number => (b ? 1 : 0);

// ---- appointments ----

export async function insertAppointment(db: D1Database, a: Appointment): Promise<void> {
  await db
    .prepare(
      `INSERT INTO appointments (id, token, first_name, email, make, model, work, preferred_date,
         status, created_at, updated_at, seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      a.id,
      a.token,
      a.firstName,
      a.email,
      a.car.make,
      a.car.model,
      a.work,
      a.preferredDate,
      a.status,
      a.createdAt,
      a.updatedAt,
      bool(a.seed),
    )
    .run();
}

export async function getAppointment(db: D1Database, id: string): Promise<Appointment | null> {
  const row = await db.prepare('SELECT * FROM appointments WHERE id = ?').bind(id).first<AppointmentRow>();
  return row ? toAppointment(row) : null;
}

export async function getAppointmentByToken(db: D1Database, token: string): Promise<Appointment | null> {
  const row = await db
    .prepare('SELECT * FROM appointments WHERE token = ?')
    .bind(token)
    .first<AppointmentRow>();
  return row ? toAppointment(row) : null;
}

/** Newest first. */
export async function listAppointments(db: D1Database): Promise<Appointment[]> {
  const { results } = await db
    .prepare('SELECT * FROM appointments ORDER BY created_at DESC, rowid DESC')
    .all<AppointmentRow>();
  return results.map(toAppointment);
}

export async function updateAppointmentStatus(
  db: D1Database,
  id: string,
  s: Status,
  at: string,
): Promise<boolean> {
  const res = await db
    .prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?')
    .bind(s, at, id)
    .run();
  return res.meta.changes > 0;
}

// ---- cars ----

function insertCarStatement(db: D1Database, c: Car): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO cars (id, appointment_id, first_name, email, make, model, itp_expiry,
         last_oil_change, reminders_accepted, seed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      c.id,
      c.appointmentId ?? null,
      c.firstName,
      c.email,
      c.make,
      c.model,
      c.itpExpiry ?? null,
      c.lastOilChange ?? null,
      bool(c.remindersAccepted),
      bool(c.seed),
      c.createdAt,
    );
}

export async function insertCar(db: D1Database, c: Car): Promise<void> {
  await insertCarStatement(db, c).run();
}

/** Cars whose owner accepted reminders, oldest first. */
export async function listReminderCars(db: D1Database): Promise<Car[]> {
  const { results } = await db
    .prepare('SELECT * FROM cars WHERE reminders_accepted = 1 ORDER BY created_at, rowid')
    .all<CarRow>();
  return results.map(toCar);
}

// ---- sent reminders ----

/** Atomic claim: true only for the one caller whose INSERT created the row. */
export async function claimReminder(db: D1Database, key: string, at: string): Promise<boolean> {
  const { results } = await db
    .prepare(
      'INSERT INTO sent_reminders (key, sent_at) VALUES (?, ?) ON CONFLICT (key) DO NOTHING RETURNING key',
    )
    .bind(key, at)
    .all();
  return results.length > 0;
}

export async function releaseReminder(db: D1Database, key: string): Promise<void> {
  await db.prepare('DELETE FROM sent_reminders WHERE key = ?').bind(key).run();
}

export async function listSentKeys(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare('SELECT key FROM sent_reminders').all<{ key: string }>();
  return new Set(results.map((r) => r.key));
}

// ---- email budget ----

/**
 * Reserves one sandbox email for `month`. The UPDATE is a single atomic
 * statement, so concurrent callers can never push `used` past `cap`.
 */
export async function reserveEmail(db: D1Database, month: string, cap: number): Promise<boolean> {
  const [, reserved] = await db.batch([
    db
      .prepare('INSERT INTO email_budget (month, used) VALUES (?, 0) ON CONFLICT (month) DO NOTHING')
      .bind(month),
    db
      .prepare('UPDATE email_budget SET used = used + 1 WHERE month = ? AND used < ? RETURNING used')
      .bind(month, cap),
  ]);
  return reserved.results.length > 0;
}

export async function releaseEmail(db: D1Database, month: string): Promise<void> {
  await db
    .prepare('UPDATE email_budget SET used = used - 1 WHERE month = ? AND used > 0')
    .bind(month)
    .run();
}

export async function emailsUsed(db: D1Database, month: string): Promise<number> {
  const row = await db
    .prepare('SELECT used FROM email_budget WHERE month = ?')
    .bind(month)
    .first<{ used: number }>();
  return row?.used ?? 0;
}

// ---- outbox ----

export async function insertOutbox(db: D1Database, m: OutboxMessage): Promise<void> {
  await db
    .prepare(
      `INSERT INTO outbox (id, run_id, appointment_id, channel, to_addr, subject, body, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      m.id,
      m.runId,
      m.appointmentId ?? null,
      m.channel,
      m.to,
      m.subject,
      m.body,
      m.outcome,
      m.createdAt,
    )
    .run();
}

/** Newest first. */
export async function listOutbox(db: D1Database, limit: number): Promise<OutboxMessage[]> {
  const { results } = await db
    .prepare('SELECT * FROM outbox ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .bind(limit)
    .all<OutboxRow>();
  return results.map(toOutbox);
}

// ---- runs ----

export async function insertRun(db: D1Database, r: Run): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (id, job, "trigger", started_at, finished_at, duration_ms, result, items, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      r.id,
      r.job,
      r.trigger,
      r.startedAt,
      r.finishedAt,
      r.durationMs,
      r.result,
      JSON.stringify(r.items),
      r.error ?? null,
    )
    .run();
}

/** Newest first. */
export async function listRuns(db: D1Database, limit: number): Promise<Run[]> {
  const { results } = await db
    .prepare('SELECT * FROM runs ORDER BY started_at DESC, rowid DESC LIMIT ?')
    .bind(limit)
    .all<RunRow>();
  return results.map(toRun);
}

// ---- login attempts ----

export async function recordLoginFailure(db: D1Database, at: number): Promise<void> {
  await db.prepare('INSERT INTO login_attempts (at) VALUES (?)').bind(at).run();
}

export async function recentLoginFailures(db: D1Database, since: number): Promise<number[]> {
  const { results } = await db
    .prepare('SELECT at FROM login_attempts WHERE at >= ? ORDER BY at')
    .bind(since)
    .all<{ at: number }>();
  return results.map((r) => r.at);
}

// ---- deletion and cleanup ----

/** Drops sent_reminders keys ('<carId>:<type>:<threshold>') whose car no longer exists. */
function deleteOrphanKeys(db: D1Database): D1PreparedStatement {
  return db.prepare(
    "DELETE FROM sent_reminders WHERE substr(key, 1, instr(key, ':') - 1) NOT IN (SELECT id FROM cars)",
  );
}

/**
 * Deletes an appointment, its car (FK cascade), its outbox rows and the car's
 * reminder keys, and replaces `maskedTo` with '(șters)' in the items of the runs
 * that sent messages for it. One batch, so it all happens or nothing does.
 */
export async function deleteAppointmentCascade(
  db: D1Database,
  id: string,
  maskedTo: string,
): Promise<boolean> {
  const results = await db.batch([
    db
      .prepare(
        `UPDATE runs SET items = (
           SELECT json_group_array(
             CASE WHEN json_extract(value, '$.to') = ?1
               THEN json_set(value, '$.to', '(șters)')
               ELSE json(value) END)
           FROM (SELECT value FROM json_each(runs.items) ORDER BY key)
         )
         WHERE id IN (SELECT run_id FROM outbox WHERE appointment_id = ?2)
           AND EXISTS (SELECT 1 FROM json_each(runs.items) WHERE json_extract(value, '$.to') = ?1)`,
      )
      .bind(maskedTo, id),
    db.prepare('DELETE FROM outbox WHERE appointment_id = ?').bind(id),
    db.prepare('DELETE FROM appointments WHERE id = ?').bind(id),
    deleteOrphanKeys(db),
  ]);
  return results[2].meta.changes > 0;
}

/**
 * Nightly retention: admin-created appointments and cars (and their outbox rows)
 * created before `dataBefore`; runs and any remaining outbox rows before `runsBefore`.
 */
export async function purgeOld(db: D1Database, dataBefore: string, runsBefore: string): Promise<void> {
  await db.batch([
    db
      .prepare(
        'DELETE FROM outbox WHERE appointment_id IN (SELECT id FROM appointments WHERE seed = 0 AND created_at < ?)',
      )
      .bind(dataBefore),
    db.prepare('DELETE FROM appointments WHERE seed = 0 AND created_at < ?').bind(dataBefore),
    db.prepare('DELETE FROM cars WHERE seed = 0 AND created_at < ?').bind(dataBefore),
    db.prepare('DELETE FROM outbox WHERE created_at < ?').bind(runsBefore),
    db.prepare('DELETE FROM runs WHERE started_at < ?').bind(runsBefore),
    db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(Date.parse(runsBefore)),
    deleteOrphanKeys(db),
  ]);
}

/** „Resetează demo”: every table except email_budget. */
export async function wipeAll(db: D1Database): Promise<void> {
  await db.batch(
    ['outbox', 'cars', 'appointments', 'runs', 'sent_reminders', 'login_attempts'].map((t) =>
      db.prepare(`DELETE FROM ${t}`),
    ),
  );
}

/** Replaces the seed cars and their reminder keys with `cars`. */
export async function replaceSeed(db: D1Database, cars: Car[]): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM cars WHERE seed = 1'),
    db.prepare("DELETE FROM sent_reminders WHERE key LIKE 'seed-%'"),
    ...cars.map((c) => insertCarStatement(db, c)),
  ]);
}
