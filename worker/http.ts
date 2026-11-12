import { SESSION_TTL_MS, signSession, verifySession } from '../core/session';
import type { Deps } from './deps';

export const COOKIE_NAME = 'tg_admin';
const COOKIE_ATTRS = 'HttpOnly; Secure; SameSite=Strict; Path=/';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** API errors are always `{ error: <Romanian message> }`. */
export function fail(status: number, message: string): Response {
  return json({ error: message }, status);
}

/** Adds the indexing and hardening headers to a Worker response. */
export function withHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('Referrer-Policy', 'no-referrer');
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Cache-Control', 'no-store');
  return out;
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

export function isAdmin(req: Request, deps: Deps): Promise<boolean> {
  return verifySession(readCookie(req, COOKIE_NAME), deps.sessionSecret, deps.now().getTime());
}

export async function adminCookie(deps: Deps): Promise<string> {
  const expiresAt = deps.now().getTime() + SESSION_TTL_MS;
  const token = await signSession(expiresAt, deps.sessionSecret);
  return `${COOKIE_NAME}=${token}; ${COOKIE_ATTRS}; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export const FORM_ERROR = 'Completează formularul.';

/** Parses a JSON body; null when it is missing or malformed. */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
