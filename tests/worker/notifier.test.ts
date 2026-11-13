import { describe, expect, it } from 'vitest';
import { createMailtrapSandbox, createMemoryEmail } from '../../worker/notifier';
import { createDeps, type Env } from '../../worker/deps';

const email = { to: 'ion@turbo-garaj.test', subject: 'Salut', text: 'Corp' };

describe('Mailtrap sandbox', () => {
  it('posts to the sandbox send endpoint with a Bearer header', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"success":true}', { status: 200 });
    }) as unknown as typeof fetch;

    await createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn }).send(email);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://sandbox.api.mailtrap.io/api/send/123');
    expect(calls[0].init.method).toBe('POST');
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from: { email: 'robot@turbo-garaj.test', name: 'Turbo Garaj (demo)' },
      to: [{ email: 'ion@turbo-garaj.test' }],
      subject: 'Salut',
      text: 'Corp',
    });
  });

  it('throws on a 500', async () => {
    const fetchFn = (async () => new Response('oops', { status: 500 })) as unknown as typeof fetch;
    const sender = createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn });
    await expect(sender.send(email)).rejects.toThrow('500');
  });

  it('waits and retries once when Mailtrap answers 429', async () => {
    const statuses = [429, 200];
    let calls = 0;
    const fetchFn = (async () => {
      const status = statuses[calls++];
      return new Response('', { status, headers: status === 429 ? { 'Retry-After': '3' } : {} });
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const sleepFn = async (ms: number) => {
      waits.push(ms);
    };
    const sender = createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn, sleepFn });

    await sender.send(email);

    expect(calls).toBe(2);
    expect(waits).toEqual([3000]);
  });

  it('waits about 10 seconds without Retry-After, and gives up after a second 429', async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      return new Response('', { status: 429 });
    }) as unknown as typeof fetch;
    const waits: number[] = [];
    const sleepFn = async (ms: number) => {
      waits.push(ms);
    };
    const sender = createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn, sleepFn });

    await expect(sender.send(email)).rejects.toThrow('Mailtrap a răspuns cu codul 429.');
    expect(calls).toBe(2);
    expect(waits).toEqual([10_500]);
  });

  it('turns a timeout into a short Romanian message', async () => {
    const fetchFn = (async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    }) as unknown as typeof fetch;
    const sender = createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn });
    await expect(sender.send(email)).rejects.toThrow('Serverul de email nu a răspuns la timp.');
  });

  it('turns other network failures into a short Romanian message', async () => {
    const fetchFn = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const sender = createMailtrapSandbox({ token: 'tok', inboxId: '123', fetchFn });
    await expect(sender.send(email)).rejects.toThrow('Trimiterea emailului a eșuat.');
  });
});

describe('memory email', () => {
  it('records sends and fails only the next one', async () => {
    const mem = createMemoryEmail();
    mem.failNext('boom');
    await expect(mem.send(email)).rejects.toThrow('boom');
    await mem.send(email);
    expect(mem.sent).toEqual([email]);
  });
});

describe('createDeps', () => {
  const base: Env = {
    DB: {} as D1Database,
    ASSETS: {} as Fetcher,
    MAIL_MODE: 'memory',
    SITE_URL: 'http://127.0.0.1:8787',
    ADMIN_PASSWORD: 'admin',
    SESSION_SECRET: 'secret',
  };

  it('throws when MAIL_MODE is sandbox and MAILTRAP_API_TOKEN is missing', () => {
    expect(() => createDeps({ ...base, MAIL_MODE: 'sandbox', MAILTRAP_INBOX_ID: '123' })).toThrow(
      /MAILTRAP_API_TOKEN/,
    );
  });

  it('throws when MAIL_MODE is sandbox and MAILTRAP_INBOX_ID is missing', () => {
    expect(() => createDeps({ ...base, MAIL_MODE: 'sandbox', MAILTRAP_API_TOKEN: 'tok' })).toThrow(
      /MAILTRAP_INBOX_ID/,
    );
  });

  it('throws when ADMIN_PASSWORD or SESSION_SECRET is empty', () => {
    expect(() => createDeps({ ...base, ADMIN_PASSWORD: '' })).toThrow(/ADMIN_PASSWORD/);
    expect(() => createDeps({ ...base, SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/);
    const missing = { ...base } as Partial<Env>;
    delete missing.SESSION_SECRET;
    expect(() => createDeps(missing as Env)).toThrow(/SESSION_SECRET/);
  });

  it('throws when SITE_URL is empty', () => {
    expect(() => createDeps({ ...base, SITE_URL: '' })).toThrow(/SITE_URL/);
  });

  it('throws when MAIL_MODE is memory but SITE_URL is not local', () => {
    expect(() => createDeps({ ...base, SITE_URL: 'https://turbo-garaj-demo.x.workers.dev' })).toThrow(
      /MAIL_MODE is memory/,
    );
    expect(() => createDeps({ ...base, SITE_URL: 'http://localhost:8787' })).not.toThrow();
  });

  it('builds memory deps with 32-byte base64url tokens', () => {
    const deps = createDeps(base);
    expect(deps.siteUrl).toBe('http://127.0.0.1:8787');
    expect(deps.adminPassword).toBe('admin');
    const a = deps.newToken();
    const b = deps.newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(deps.newId()).not.toBe(deps.newId());
  });

  it('builds sandbox deps when both Mailtrap values are set', () => {
    const deps = createDeps({
      ...base,
      MAIL_MODE: 'sandbox',
      MAILTRAP_API_TOKEN: 'tok',
      MAILTRAP_INBOX_ID: '123',
    });
    expect(typeof deps.email.send).toBe('function');
  });
});
