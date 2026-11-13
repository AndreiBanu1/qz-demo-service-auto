import { LOCKOUT_WINDOW_MS, isLockedOut, passwordMatches } from '../../core/session';
import { recentLoginFailures, recordLoginFailure } from '../db';
import type { Deps } from '../deps';
import { FORM_ERROR, adminCookie, clearCookie, fail, isAdmin, json, readJson } from '../http';

export async function login(req: Request, deps: Deps): Promise<Response> {
  const body = await readJson(req);
  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== 'string') return fail(400, FORM_ERROR);

  const now = deps.now().getTime();
  const failures = await recentLoginFailures(deps.db, now - LOCKOUT_WINDOW_MS);
  if (isLockedOut(failures, now)) return fail(429, 'Prea multe încercări. Mai încearcă peste 15 minute.');

  if (!(await passwordMatches(password, deps.adminPassword))) {
    await recordLoginFailure(deps.db, now);
    return fail(401, 'Parolă greșită.');
  }
  const res = json({ admin: true });
  res.headers.set('Set-Cookie', await adminCookie(deps));
  return res;
}

export async function logout(): Promise<Response> {
  const res = json({ admin: false });
  res.headers.set('Set-Cookie', clearCookie());
  return res;
}

export async function session(req: Request, deps: Deps): Promise<Response> {
  return json({ admin: await isAdmin(req, deps) });
}
