import { budgetMonth, EMAIL_BUDGET_CAP } from '../core/budget';
import type { Message } from '../core/messages';
import { isTestAddress, maskEmail, normalizeEmail } from '../core/recipients';
import type { Channel, Job, Outcome, Run, RunItem, Trigger } from '../core/types';
import { insertOutbox, insertRun, releaseEmail, reserveEmail } from './db';
import type { Deps } from './deps';
import { EmailError, EMAIL_FAILED_MESSAGE } from './notifier';

export type RunContext = {
  runId: string;
  sendEmail(to: string, m: Message, appointmentId?: string): Promise<Outcome>;
  sendSmsPreview(to: string, m: Message, appointmentId?: string): Promise<Outcome>;
};

const NOT_TEST_ADDRESS = 'adresă care nu e de test';
const SMS_RECIPIENT = 'telefon de test';

const RUN_ERROR = 'Eroare la rulare. Detaliile sunt în jurnalul serverului.';

/** Runs `fn`, then writes one log entry (spec §7) and returns it. */
export async function runJob(
  deps: Deps,
  job: Job,
  trigger: Trigger,
  fn: (ctx: RunContext) => Promise<void>,
  // Jobs that send no messages by design (cleanup) log `ok`, not `nimic-de-trimis`.
  options: { sendsMessages?: boolean } = {},
): Promise<Run> {
  const sendsMessages = options.sendsMessages ?? true;
  const { db } = deps;
  const runId = deps.newId();
  const started = deps.now();
  const items: RunItem[] = [];

  async function record(
    channel: Channel,
    outboxTo: string,
    itemTo: string,
    m: Message,
    outcome: Outcome,
    error: string | undefined,
    appointmentId: string | undefined,
  ): Promise<void> {
    await insertOutbox(db, {
      id: deps.newId(),
      runId,
      channel,
      to: outboxTo,
      subject: m.subject,
      body: m.text,
      outcome,
      createdAt: deps.now().toISOString(),
      ...(appointmentId ? { appointmentId } : {}),
    });
    items.push({ channel, to: itemTo, subject: m.subject, outcome, ...(error ? { error } : {}) });
  }

  const ctx: RunContext = {
    runId,

    async sendEmail(to, m, appointmentId) {
      const addr = normalizeEmail(to);
      const masked = maskEmail(addr);
      let outcome: Outcome;
      let error: string | undefined;

      if (!isTestAddress(addr)) {
        // Never sent, and only the masked address is stored.
        outcome = 'eroare';
        error = NOT_TEST_ADDRESS;
        await record('email', masked, masked, m, outcome, error, appointmentId);
        return outcome;
      }

      const month = budgetMonth(deps.now());
      if (!(await reserveEmail(db, month, EMAIL_BUDGET_CAP))) {
        outcome = 'netrimis-limita';
      } else {
        try {
          await deps.email.send({ to: addr, subject: m.subject, text: m.text });
          outcome = 'trimis-sandbox';
        } catch (e) {
          await releaseEmail(db, month);
          outcome = 'eroare';
          console.error('Email send failed', e);
          error = e instanceof EmailError ? e.message : EMAIL_FAILED_MESSAGE;
        }
      }
      await record('email', addr, masked, m, outcome, error, appointmentId);
      return outcome;
    },

    async sendSmsPreview(to, m, appointmentId) {
      // No network call: the preview is the outbox row.
      await record('sms-simulat', SMS_RECIPIENT, SMS_RECIPIENT, m, 'simulat', undefined, appointmentId);
      return 'simulat';
    },
  };

  let error: string | undefined;
  try {
    await fn(ctx);
  } catch (e) {
    console.error(`Job ${job} failed`, e);
    error = RUN_ERROR;
  }

  const finished = deps.now();
  const result: Run['result'] =
    error !== undefined || items.some((i) => i.outcome === 'eroare')
      ? 'eroare'
      : items.length === 0 && sendsMessages
        ? 'nimic-de-trimis'
        : 'ok';

  const run: Run = {
    id: runId,
    job,
    trigger,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: Math.max(0, finished.getTime() - started.getTime()),
    result,
    items,
    ...(error !== undefined ? { error } : {}),
  };
  await insertRun(db, run);
  return run;
}
