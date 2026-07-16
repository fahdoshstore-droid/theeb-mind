import { db } from '../../db/db.js';

export interface AuditLogEntry {
  userId: string;
  eventType: string;
  eventData: Record<string, unknown>;
}

export function appendAuditLog(entry: AuditLogEntry): void {
  db.stmt('insertAuditEvent').run(
    entry.userId,
    entry.eventType,
    JSON.stringify(entry.eventData)
  );
}

export function getAuditLog(userId: string, limit: number = 50): any[] {
  const stmt = db.raw.prepare(
    'SELECT * FROM audit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(userId, limit);
}