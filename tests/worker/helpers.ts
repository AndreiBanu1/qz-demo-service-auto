import { env } from 'cloudflare:workers';
import type { Deps } from '../../worker/deps';
import { createMemoryEmail } from '../../worker/notifier';
import type { Appointment, Car, Run } from '../../core/types';

export const NOW = new Date('2026-11-10T06:00:00Z');

export type TestDeps = Omit<Deps, 'email'> & { email: ReturnType<typeof createMemoryEmail> };

/** Real local D1, in-memory email, a fixed clock and deterministic ids. */
export function testDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  let id = 0;
  let token = 0;
  return {
    db: env.DB,
    email: createMemoryEmail(),
    now: () => new Date(NOW),
    siteUrl: 'http://127.0.0.1:8787',
    newId: () => `id-${++id}`,
    newToken: () => `token-${++token}`,
    adminPassword: 'test-admin',
    sessionSecret: 'test-secret',
    ...overrides,
  };
}

const TABLES = [
  'outbox',
  'cars',
  'appointments',
  'runs',
  'sent_reminders',
  'email_budget',
  'login_attempts',
];

export async function clearTables(): Promise<void> {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}

/** ISO timestamp `days` days before NOW. */
export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

export function appointmentFixture(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a-1',
    token: 'tok-a-1',
    firstName: 'Ion',
    email: 'ion@turbo-garaj.test',
    car: { make: 'Dacia', model: 'Logan' },
    work: 'revizie',
    preferredDate: '2026-11-12',
    status: 'primita',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    seed: false,
    ...over,
  };
}

export function carFixture(over: Partial<Car> = {}): Car {
  return {
    id: 'c-1',
    firstName: 'Ion',
    email: 'ion@turbo-garaj.test',
    make: 'Dacia',
    model: 'Logan',
    remindersAccepted: true,
    seed: false,
    createdAt: NOW.toISOString(),
    ...over,
  };
}

export function runFixture(over: Partial<Run> = {}): Run {
  return {
    id: 'r-1',
    job: 'remindere-zilnice',
    trigger: 'cron',
    startedAt: NOW.toISOString(),
    finishedAt: NOW.toISOString(),
    durationMs: 0,
    result: 'nimic-de-trimis',
    items: [],
    ...over,
  };
}
