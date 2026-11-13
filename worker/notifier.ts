// Email adapters. The only send URL in the codebase is Mailtrap's *sandbox*
// endpoint, which delivers into a test inbox and never to a real mailbox.
// SMS has no adapter: an SMS preview is just an outbox row (see runner.ts).

export type Email = { to: string; subject: string; text: string };

/** Throws on failure. */
export interface EmailSender {
  send(e: Email): Promise<void>;
}

/** An email failure whose message is safe to show on the public log (Romanian, no internals). */
export class EmailError extends Error {}

export const EMAIL_TIMEOUT_MESSAGE = 'Serverul de email nu a răspuns la timp.';
export const EMAIL_FAILED_MESSAGE = 'Trimiterea emailului a eșuat.';

const SANDBOX_SEND_URL = 'https://sandbox.api.mailtrap.io/api/send/';
const SEND_TIMEOUT_MS = 10_000;
// Mailtrap's free sandbox accepts about one email per 10 seconds and answers 429 to the next one.
const RATE_LIMIT_WAIT_MS = 10_500;
const MAX_RATE_LIMIT_WAIT_MS = 15_000;

/** How long to wait after a 429: Mailtrap's Retry-After (seconds) when given, else ~10 s, capped. */
function rateLimitWait(res: Response): number {
  const seconds = Number(res.headers.get('Retry-After'));
  const ms = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : RATE_LIMIT_WAIT_MS;
  return Math.min(ms, MAX_RATE_LIMIT_WAIT_MS);
}

export function createMailtrapSandbox(o: {
  token: string;
  inboxId: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}): EmailSender {
  // Wrapped so the global fetch is never called with a foreign `this`.
  const doFetch = o.fetchFn ?? ((input, init) => fetch(input, init));
  const sleep = o.sleepFn ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  /** One POST to the sandbox. Network failures become a Romanian EmailError. */
  async function post(e: Email): Promise<Response> {
    let res: Response;
    try {
      res = await doFetch(`${SANDBOX_SEND_URL}${encodeURIComponent(o.inboxId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${o.token}`,
          'Content-Type': 'application/json',
          // Mailtrap's API notes that requests without a User-Agent may be blocked.
          'User-Agent': 'turbo-garaj-demo',
        },
        body: JSON.stringify({
          from: { email: 'robot@turbo-garaj.test', name: 'Turbo Garaj (demo)' },
          to: [{ email: e.to }],
          subject: e.subject,
          text: e.text,
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (err) {
      console.error('Mailtrap request failed', err);
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new EmailError(timedOut ? EMAIL_TIMEOUT_MESSAGE : EMAIL_FAILED_MESSAGE);
    }
    // Drain the body so the connection is released either way.
    await res.body?.cancel();
    return res;
  }

  return {
    async send(e) {
      let res = await post(e);
      if (res.status === 429) {
        // One retry after the rate-limit window; a second 429 is reported as a failure.
        await sleep(rateLimitWait(res));
        res = await post(e);
      }
      if (!res.ok) {
        console.error(`Mailtrap responded with status ${res.status}`);
        throw new EmailError(`Mailtrap a răspuns cu codul ${res.status}.`);
      }
    },
  };
}

/** For tests and MAIL_MODE=memory: keeps what was sent, can fail on demand. */
export function createMemoryEmail(): EmailSender & { sent: Email[]; failNext(msg: string): void } {
  const sent: Email[] = [];
  let failure: string | null = null;
  return {
    sent,
    failNext(msg) {
      failure = msg;
    },
    async send(e) {
      if (failure !== null) {
        const msg = failure;
        failure = null;
        throw new Error(msg);
      }
      sent.push({ ...e });
    },
  };
}
