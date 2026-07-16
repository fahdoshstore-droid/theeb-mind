import { db } from '../../db/db.js';
import type { OutcomeInput } from './journal.types.js';
import { calculateAnalytics } from './analytics.js';
import type { JournalAnalytics } from './journal.types.js';
import type { Decision } from '../../shared/types.js';
import { updateFailurePatterns } from '../memory/memory.service.js';
import { invalidateCacheForUser } from '../intelligence/intelligence.service.js';

export function getDecisionsByUser(userId: string): Decision[] {
  return db.stmt('getDecisionsByUser').all(userId) as Decision[];
}

export function recordOutcome(input: OutcomeInput): void {
  // Verify ownership: only allow updates to decisions belonging to this user
  const row = db.raw
    .prepare('SELECT user_id FROM decisions WHERE id = ?')
    .get(input.decisionId) as { user_id: string } | undefined;

  if (!row) {
    throw new Error('الصفقة غير موجودة');
  }
  if (row.user_id !== input.userId) {
    throw new Error('غير مصرح — الصفقة لا تنتمي لهذا المستخدم');
  }

  db.stmt('updateOutcome').run(
    input.outcome,
    input.pnl ?? null,
    input.notes ?? null,
    input.decisionId
  );

  // ── Memory Engine: update failure patterns ────────────
  try {
    updateFailurePatterns(input.userId, input.decisionId, input.outcome);
  } catch { /* non-critical — never fail the outcome record */ }

  // ── Intelligence: bust stale cache immediately ─────────
  try {
    invalidateCacheForUser(input.userId);
  } catch { /* non-critical */ }
}

export function getAnalytics(userId: string, period: string): JournalAnalytics {
  return calculateAnalytics(userId, period);
}
