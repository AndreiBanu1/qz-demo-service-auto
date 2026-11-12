// Email adapters. The only send URL in the codebase is Mailtrap's *sandbox*
// endpoint, which delivers into a test inbox and never to a real mailbox.
// SMS has no adapter: an SMS preview is just an outbox row (see runner.ts).

export type Email = { to: string; subject: string; text: string };

/** Throws on failure. */
export interface EmailSender {
  send(e: Email): Promise<void>;
}

const SANDBOX_SEND_URL = 'https://sandbox.api.mailtrap.io/api/send/';
const SEND_TIMEOUT_MS = 10_000;

export function createMailtrapSandbox(o: {
  token: string;
  inboxId: string;
  fetchFn?: typeof fetch;
}): EmailSender {
  // Wrapped so the global fetch is never called with a foreign `this`.
  const doFetch = o.fetchFn ?? ((input, init) => fetch(input, init));
  return {
    async send(e) {
      const res = await doFetch(`${SANDBOX_SEND_URL}${encodeURIComponent(o.inboxId)}`, {
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
      // Drain the body so the connection is released either way.
      await res.body?.cancel();
      if (!res.ok) throw new Error(`Mailtrap a răspuns cu codul ${res.status}.`);
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
