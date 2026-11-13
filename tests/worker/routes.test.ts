import { createExecutionContext } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { appointmentFixture, testDeps, type TestDeps } from './helpers';
import { insertAppointment, insertRun } from '../../worker/db';
import { route } from '../../worker/router';
import { runFixture } from './helpers';

const BASE = 'http://127.0.0.1:8787';

const call = (deps: TestDeps, path: string, init: RequestInit & { json?: unknown } = {}) => {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set('content-type', 'application/json');
  return route(
    new Request(`${BASE}${path}`, { ...rest, headers, body: json === undefined ? rest.body : JSON.stringify(json) }),
    deps,
  );
};

async function adminCookie(deps: TestDeps): Promise<string> {
  const res = await call(deps, '/api/login', { method: 'POST', json: { password: 'test-admin' } });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0];
}

const goodBooking = {
  firstName: 'Ion',
  email: 'ion@turbo-garaj.test',
  make: 'Dacia',
  model: 'Logan',
  work: 'revizie',
  preferredDate: '2026-11-12',
  remindersAccepted: false,
};

describe('auth', () => {
  it('login sets a cookie', async () => {
    const res = await call(testDeps(), '/api/login', { method: 'POST', json: { password: 'test-admin' } });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie')!;
    for (const part of ['tg_admin=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=28800']) {
      expect(cookie).toContain(part);
    }
  });

  it('wrong password 401', async () => {
    const res = await call(testDeps(), '/api/login', { method: 'POST', json: { password: 'nope' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Parolă greșită.' });
  });

  it('sixth attempt in 15 min is 429', async () => {
    const deps = testDeps();
    for (let i = 0; i < 5; i++) {
      expect((await call(deps, '/api/login', { method: 'POST', json: { password: 'x' } })).status).toBe(401);
    }
    const res = await call(deps, '/api/login', { method: 'POST', json: { password: 'test-admin' } });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'Prea multe încercări. Mai încearcă peste 15 minute.' });
  });

  it('malformed JSON is 400', async () => {
    const res = await call(testDeps(), '/api/login', { method: 'POST', body: '{nope' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Completează formularul.' });
  });

  it('session and logout', async () => {
    const deps = testDeps();
    expect(await (await call(deps, '/api/session')).json()).toEqual({ admin: false });
    const cookie = await adminCookie(deps);
    expect(await (await call(deps, '/api/session', { headers: { cookie } })).json()).toEqual({ admin: true });
    const out = await call(deps, '/api/logout', { method: 'POST' });
    expect(out.status).toBe(200);
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});

describe('admin routes', () => {
  it('admin routes 401 without cookie', async () => {
    const deps = testDeps();
    const calls: [string, string, unknown?][] = [
      ['GET', '/api/appointments'],
      ['POST', '/api/appointments', goodBooking],
      ['PATCH', '/api/appointments/x', { status: 'gata' }],
      ['DELETE', '/api/appointments/x'],
      ['POST', '/api/run-reminders'],
      ['POST', '/api/reset'],
      ['GET', '/api/outbox'],
    ];
    for (const [method, path, json] of calls) {
      const res = await call(deps, path, { method, json });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(await res.json()).toEqual({ error: 'Intră în cont ca administrator.' });
    }
  });

  it('POST appointments 400 with non-test email copy', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    const res = await call(deps, '/api/appointments', {
      method: 'POST',
      headers: { cookie },
      json: { ...goodBooking, email: 'ion@gmail.com' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'În demo folosește o adresă de test, de exemplu ion@turbo-garaj.test.',
    });
  });

  it('POST appointments 201 returns statusUrl', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    const res = await call(deps, '/api/appointments', { method: 'POST', headers: { cookie }, json: goodBooking });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { appointment: { token: string }; statusUrl: string; run: { job: string } };
    expect(body.statusUrl).toBe(`${BASE}/status/${body.appointment.token}`);
    expect(body.run.job).toBe('confirmare-programare');
    const list = (await (await call(deps, '/api/appointments', { headers: { cookie } })).json()) as unknown[];
    expect(list).toHaveLength(1);
  });

  it('PATCH and DELETE', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    await insertAppointment(deps.db, appointmentFixture());
    const ok = await call(deps, '/api/appointments/a-1', { method: 'PATCH', headers: { cookie }, json: { status: 'in-lucru' } });
    expect(ok.status).toBe(200);
    const bad = await call(deps, '/api/appointments/a-1', { method: 'PATCH', headers: { cookie }, json: { status: 'zzz' } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Alege un status valid.' });
    const missing = await call(deps, '/api/appointments/nope', { method: 'PATCH', headers: { cookie }, json: { status: 'gata' } });
    expect(missing.status).toBe(404);
    expect((await call(deps, '/api/appointments/a-1', { method: 'DELETE', headers: { cookie } })).status).toBe(204);
    expect((await call(deps, '/api/appointments/a-1', { method: 'DELETE', headers: { cookie } })).status).toBe(404);
  });

  it('run-reminders, reset and outbox for admin', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    const reset = await call(deps, '/api/reset', { method: 'POST', headers: { cookie } });
    expect(reset.status).toBe(200);
    expect(((await reset.json()) as { job: string }).job).toBe('curatenie');
    const rr = await call(deps, '/api/run-reminders', { method: 'POST', headers: { cookie } });
    expect(((await rr.json()) as { trigger: string }).trigger).toBe('buton');
    const outbox = (await (await call(deps, '/api/outbox', { headers: { cookie } })).json()) as { cap: number; used: number };
    expect(outbox.cap).toBe(40);
    expect(typeof outbox.used).toBe('number');
  });
});

describe('public routes', () => {
  it('status by token hides email', async () => {
    const deps = testDeps();
    await insertAppointment(deps.db, appointmentFixture({ token: 'tok-abc' }));
    const res = await call(deps, '/api/status/tok-abc');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['car', 'firstName', 'status', 'updatedAt', 'work']);
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('id');
  });

  it('status unknown token 404', async () => {
    const res = await call(testDeps(), '/api/status/unknown-token');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Linkul nu mai e valid.' });
  });

  it('status malformed token 404', async () => {
    const res = await call(testDeps(), '/api/status/' + encodeURIComponent("a b'; DROP--"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Linkul nu mai e valid.' });
  });

  it('status of deleted customer 404', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    await insertAppointment(deps.db, appointmentFixture({ token: 'tok-del' }));
    await call(deps, '/api/appointments/a-1', { method: 'DELETE', headers: { cookie } });
    const res = await call(deps, '/api/status/tok-del');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Linkul nu mai e valid.' });
  });

  it('log is public and masked', async () => {
    const deps = testDeps();
    const cookie = await adminCookie(deps);
    const created = await call(deps, '/api/appointments', { method: 'POST', headers: { cookie }, json: goodBooking });
    expect(created.status).toBe(201);

    // No cookie: the log is public.
    const res = await call(deps, '/api/log');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('ion@turbo-garaj.test');
    expect(text).not.toContain('ion@');
    const runs = JSON.parse(text) as { items: Record<string, unknown>[] }[];
    const items = runs.flatMap((r) => r.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item).not.toHaveProperty('email');
  });

  it('unknown api path is 404', async () => {
    const res = await call(testDeps(), '/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Pagina nu există.' });
  });

  it('unexpected errors are a Romanian 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = testDeps({ db: {} as D1Database });
    const res = await call(deps, '/api/log');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Ceva n-a mers. Încearcă din nou.' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('headers', () => {
  it('api responses carry X-Robots-Tag', async () => {
    const { default: worker } = await import('../../worker/index');
    const { env } = await import('cloudflare:workers');
    const res = await worker.fetch(new Request(`${BASE}/api/session`), env as never, createExecutionContext());
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBeTruthy();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});
