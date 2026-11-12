import type { Deps } from './deps';
import { fail, isAdmin } from './http';
import * as appointments from './routes/appointments';
import * as auth from './routes/auth';
import { log } from './routes/log';
import { outbox } from './routes/outbox';
import { reset } from './routes/reset';
import { runRemindersNow } from './routes/run-reminders';
import { status } from './routes/status';

type Handler = (req: Request, deps: Deps, params: Record<string, string>) => Promise<Response>;
type Entry = { method: string; pattern: RegExp; admin: boolean; handler: Handler };

const entry = (method: string, path: string, admin: boolean, handler: Handler): Entry => ({
  method,
  // `:name` matches one path segment.
  pattern: new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
  admin,
  handler,
});

const ROUTES: Entry[] = [
  entry('POST', '/api/login', false, auth.login),
  entry('POST', '/api/logout', false, auth.logout),
  entry('GET', '/api/session', false, auth.session),
  entry('GET', '/api/appointments', true, appointments.list),
  entry('POST', '/api/appointments', true, appointments.create),
  entry('PATCH', '/api/appointments/:id', true, appointments.patch),
  entry('DELETE', '/api/appointments/:id', true, appointments.remove),
  entry('GET', '/api/status/:token', false, status),
  entry('POST', '/api/run-reminders', true, runRemindersNow),
  entry('POST', '/api/reset', true, reset),
  entry('GET', '/api/outbox', true, outbox),
  entry('GET', '/api/log', false, log),
];

export async function route(req: Request, deps: Deps): Promise<Response> {
  try {
    const path = new URL(req.url).pathname;
    for (const e of ROUTES) {
      if (e.method !== req.method) continue;
      const m = e.pattern.exec(path);
      if (!m) continue;
      if (e.admin && !(await isAdmin(req, deps))) return fail(401, 'Intră în cont ca administrator.');
      let params: Record<string, string>;
      try {
        params = Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      } catch {
        return fail(404, 'Pagina nu există.');
      }
      return await e.handler(req, deps, params);
    }
    return fail(404, 'Pagina nu există.');
  } catch (e) {
    console.error('api error', e);
    return fail(500, 'Ceva n-a mers. Încearcă din nou.');
  }
}
