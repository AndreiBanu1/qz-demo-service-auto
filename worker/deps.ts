import { createMailtrapSandbox, createMemoryEmail, type EmailSender } from './notifier';

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  MAIL_MODE: 'sandbox' | 'memory';
  SITE_URL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  MAILTRAP_API_TOKEN?: string;
  MAILTRAP_INBOX_ID?: string;
};

export type Deps = {
  db: D1Database;
  email: EmailSender;
  now: () => Date;
  siteUrl: string;
  newId: () => string;
  newToken: () => string;
  adminPassword: string;
  sessionSecret: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Status-link token: 32 random bytes, base64url (43 characters). */
function newToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function required(env: Env, name: 'ADMIN_PASSWORD' | 'SESSION_SECRET' | 'SITE_URL'): string {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set (use .dev.vars locally; in production set SITE_URL in wrangler.toml and secrets with wrangler secret put)`);
  }
  return value;
}

function emailSender(env: Env): EmailSender {
  if (env.MAIL_MODE === 'memory') return createMemoryEmail();
  if (env.MAIL_MODE === 'sandbox') {
    const token = env.MAILTRAP_API_TOKEN?.trim();
    const inboxId = env.MAILTRAP_INBOX_ID?.trim();
    if (!token) throw new Error('MAIL_MODE is sandbox but MAILTRAP_API_TOKEN is not set');
    if (!inboxId) throw new Error('MAIL_MODE is sandbox but MAILTRAP_INBOX_ID is not set');
    return createMailtrapSandbox({ token, inboxId });
  }
  throw new Error(`MAIL_MODE must be 'sandbox' or 'memory', got ${JSON.stringify(env.MAIL_MODE)}`);
}

/** Throws a clear Error when a secret or the Mailtrap settings are missing. */
export function createDeps(env: Env): Deps {
  const adminPassword = required(env, 'ADMIN_PASSWORD');
  const sessionSecret = required(env, 'SESSION_SECRET');
  const siteUrl = required(env, 'SITE_URL').replace(/\/+$/, '');
  if (env.MAIL_MODE === 'memory') {
    let host = '';
    try {
      host = new URL(siteUrl).hostname;
    } catch {
      // handled below
    }
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error(`MAIL_MODE is memory but SITE_URL (${siteUrl}) is not a local address`);
    }
  }
  return {
    db: env.DB,
    email: emailSender(env),
    now: () => new Date(),
    siteUrl,
    newId: () => crypto.randomUUID(),
    newToken,
    adminPassword,
    sessionSecret,
  };
}
