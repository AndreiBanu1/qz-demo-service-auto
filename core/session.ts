// Web Crypto only (no node:crypto, no Buffer): runs in Node 20+ and in Workers.

export const SESSION_TTL_MS = 8 * 3600_000;
export const LOCKOUT_WINDOW_MS = 15 * 60_000;
export const LOCKOUT_MAX = 5;

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns null when the input isn't valid base64url. */
function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function signSession(expiresAt: number, secret: string): Promise<string> {
  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(expiresAt)));
  return `${expiresAt}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(
  token: string | undefined,
  secret: string,
  now: number,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expPart = token.slice(0, dot);
  if (!/^\d+$/.test(expPart)) return false;
  const sig = fromBase64Url(token.slice(dot + 1));
  if (!sig || sig.length === 0) return false;
  const key = await hmacKey(secret, 'verify');
  // crypto.subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify('HMAC', key, sig, enc.encode(expPart));
  return valid && Number(expPart) >= now;
}

/** Constant-time comparison of the SHA-256 digests of both passwords. */
export async function passwordMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function isLockedOut(failures: number[], now: number): boolean {
  return failures.filter((t) => now - t < LOCKOUT_WINDOW_MS).length >= LOCKOUT_MAX;
}
