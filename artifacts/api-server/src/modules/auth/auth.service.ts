// Server-side identity: scrypt password hashes, random session tokens stored only as SHA-256 hashes.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
export const SESSION_COOKIE = 'tm_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function hasAnyCredentials(): boolean {
  return Boolean(db.raw.prepare('SELECT 1 FROM auth_credentials LIMIT 1').get());
}

export function registrationOpen(): boolean {
  return !hasAnyCredentials() || process.env.ALLOW_REGISTRATION === 'true';
}

export interface PublicUser { id: string; username: string }

export function createUser(username: string, password: string, opts: { claimLegacyUserId?: string | null } = {}): PublicUser {
  const raw = db.raw;
  return raw.transaction(() => {
    if (raw.prepare('SELECT 1 FROM users WHERE username = ? AND id IN (SELECT user_id FROM auth_credentials)').get(username)) {
      throw Object.assign(new Error('username already taken'), { statusCode: 409, code: 'USERNAME_TAKEN' });
    }
    let id: string;
    const legacy = opts.claimLegacyUserId
      ? raw.prepare('SELECT id FROM users WHERE id = ? AND id NOT IN (SELECT user_id FROM auth_credentials)').get(opts.claimLegacyUserId) as { id: string } | undefined
      : undefined;
    if (legacy) {
      id = legacy.id;
      raw.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, id);
    } else {
      if (raw.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw Object.assign(new Error('username already taken'), { statusCode: 409, code: 'USERNAME_TAKEN' });
      id = uuid();
      raw.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
    }
    raw.prepare('INSERT INTO auth_credentials (user_id, password_hash) VALUES (?, ?)').run(id, hashPassword(password));
    raw.prepare('INSERT INTO audit_events (user_id, event_type, event_data) VALUES (?, ?, ?)').run(id, 'auth.register', JSON.stringify({ claimedLegacy: Boolean(legacy) }));
    return { id, username };
  })();
}

// Dummy hash so unknown usernames take the same time as wrong passwords.
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex'));

export function authenticate(username: string, password: string): PublicUser | null {
  const row = db.raw.prepare(`SELECT u.id, u.username, c.password_hash FROM users u JOIN auth_credentials c ON c.user_id = u.id WHERE u.username = ?`)
    .get(username) as { id: string; username: string; password_hash: string } | undefined;
  const ok = verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  return row && ok ? { id: row.id, username: row.username } : null;
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.raw.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expiresAt);
  return { token, expiresAt };
}

export function userForSession(token: string): PublicUser | null {
  const row = db.raw.prepare(`SELECT u.id, u.username, s.expires_at FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`)
    .get(sha256(token)) as { id: string; username: string; expires_at: string } | undefined;
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) { revokeSession(token); return null; }
  return { id: row.id, username: row.username };
}

export function revokeSession(token: string): void {
  db.raw.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(sha256(token));
}

/** API keys for scripts: THEEB_API_KEYS="<key>:<userId>,…" (server env only). Keys are compared by hash. */
function apiKeyRegistry(): Map<string, string> {
  const m = new Map<string, string>();
  for (const pair of (process.env.THEEB_API_KEYS ?? '').split(',')) {
    const i = pair.lastIndexOf(':');
    if (i <= 0) continue;
    const key = pair.slice(0, i).trim(), uid = pair.slice(i + 1).trim();
    if (key.length >= 24 && uid) m.set(sha256(key), uid);   // short keys are refused
  }
  return m;
}
let registry: Map<string, string> | null = null;
export function resetApiKeyRegistry(): void { registry = null; }
export function userForApiKey(key: string): PublicUser | null {
  registry ??= apiKeyRegistry();
  const uid = registry.get(sha256(key));
  if (!uid) return null;
  const row = db.raw.prepare('SELECT id, username FROM users WHERE id = ?').get(uid) as PublicUser | undefined;
  return row ?? null;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore malformed */ }
  }
  return out;
}

export function sessionCookie(token: string, maxAgeMs: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure}`;
}
