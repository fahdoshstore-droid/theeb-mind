import { db } from '../../db/db.js';
import { createError } from '../../middleware/error-handler.js';

export const nowIso = () => new Date().toISOString();

export function audit(userId: string, type: string, data: unknown): void {
  db.raw.prepare('INSERT INTO audit_events (user_id, event_type, event_data) VALUES (?, ?, ?)').run(userId, type, JSON.stringify(data ?? {}));
}

export const notFound = (what: string) => createError(`${what} not found`, 404, 'NOT_FOUND');
export const badRequest = (msg: string, code = 'VALIDATION_ERROR') => createError(msg, 400, code);

export const j = <T>(s: string | null | undefined, fallback: T): T => {
  if (s == null) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
