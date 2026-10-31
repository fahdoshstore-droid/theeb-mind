// TRIL decision records. A pre-trade record is written BEFORE any AI comment and is immutable once locked;
// later knowledge goes into a separate post-trade record, so reports can't leak hindsight into the decision.
import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import { audit, badRequest, notFound, j } from './common.js';
import { evaluateTril, TRIL_METHODOLOGY_VERSION, type TrilInput } from '../../domain/tril.js';
import { activeRules } from './profile.service.js';

export interface TrilRecordInput {
  phase: 'pre_trade' | 'post_trade'; tradeId?: string | null; instrument?: string | null; direction?: 'long' | 'short' | null;
  decisionTime?: string | null; analysisText?: string | null; readiness?: number | null; emotion?: string | null;
  evidence: Omit<TrilInput, 'enabledSessions' | 'decisionTime' | 'sessionsConfirmed'>;
}

const rowOut = (r: any, entryTime?: string | null) => ({
  id: r.id, phase: r.phase, tradeId: r.trade_id, instrument: r.instrument, direction: r.direction, decisionTime: r.decision_time,
  analysisText: r.analysis_text, readiness: r.readiness, emotion: r.emotion, evidence: j(r.input_json, {}), result: j(r.result_json, {}),
  overall: r.overall, methodologyVersion: r.methodology_version, recordedAt: r.recorded_at, lockedAt: r.locked_at, supersedesId: r.supersedes_id,
  retrospective: r.phase === 'pre_trade' && entryTime ? Date.parse(r.recorded_at) > Date.parse(entryTime) : false,
});

function tradeEntry(userId: string, tradeId: string): string {
  const t = db.raw.prepare('SELECT entry_time FROM trades WHERE id = ? AND user_id = ?').get(tradeId, userId) as { entry_time: string } | undefined;
  if (!t) throw notFound('trade');
  return t.entry_time;
}

function evaluate(userId: string, inp: TrilRecordInput) {
  const rules = activeRules(userId);
  return evaluateTril({ ...inp.evidence, decisionTime: inp.decisionTime ?? null, enabledSessions: rules.enabledSessions, sessionsConfirmed: rules.sessionsConfirmed });
}

export function createEvaluation(userId: string, inp: TrilRecordInput) {
  const entry = inp.tradeId ? tradeEntry(userId, inp.tradeId) : null;
  if (inp.phase === 'post_trade' && !inp.tradeId) throw badRequest('a post-trade review must be linked to a trade');
  if (inp.decisionTime && !Number.isFinite(Date.parse(inp.decisionTime))) throw badRequest('decisionTime is not a valid timestamp');
  const result = evaluate(userId, inp);
  const id = uuid();
  db.raw.prepare(`INSERT INTO tril_evaluations (id, user_id, trade_id, phase, instrument, direction, decision_time, analysis_text, readiness, emotion, input_json, result_json, overall, methodology_version, locked_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, userId, inp.tradeId ?? null, inp.phase, inp.instrument ?? null, inp.direction ?? null, inp.decisionTime ?? null,
    inp.analysisText?.slice(0, 20000) ?? null, inp.readiness ?? null, inp.emotion?.slice(0, 200) ?? null, JSON.stringify(inp.evidence), JSON.stringify(result), result.overall,
    TRIL_METHODOLOGY_VERSION, inp.phase === 'post_trade' || (inp.tradeId && entry) ? new Date().toISOString() : null);
  audit(userId, 'ledger.tril.create', { id, phase: inp.phase, tradeId: inp.tradeId ?? null, overall: result.overall });
  return getEvaluation(userId, id);
}

export function getEvaluation(userId: string, id: string) {
  const r = db.raw.prepare('SELECT * FROM tril_evaluations WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!r) throw notFound('TRIL record');
  const entry = r.trade_id ? (db.raw.prepare('SELECT entry_time FROM trades WHERE id = ? AND user_id = ?').get(r.trade_id, userId) as any)?.entry_time : null;
  return rowOut(r, entry);
}

export function listEvaluations(userId: string, f: { tradeId?: string } = {}) {
  const rows = (f.tradeId
    ? db.raw.prepare('SELECT e.*, t.entry_time FROM tril_evaluations e LEFT JOIN trades t ON t.id = e.trade_id AND t.user_id = e.user_id WHERE e.user_id = ? AND e.trade_id = ? ORDER BY e.recorded_at DESC').all(userId, f.tradeId)
    : db.raw.prepare('SELECT e.*, t.entry_time FROM tril_evaluations e LEFT JOIN trades t ON t.id = e.trade_id AND t.user_id = e.user_id WHERE e.user_id = ? ORDER BY e.recorded_at DESC LIMIT 500').all(userId)) as any[];
  return rows.map((r) => rowOut(r, r.entry_time));
}

/** Editable only while unlocked (still before the trade). */
export function updateEvaluation(userId: string, id: string, inp: TrilRecordInput) {
  const cur = db.raw.prepare('SELECT * FROM tril_evaluations WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!cur) throw notFound('TRIL record');
  if (cur.locked_at) throw badRequest('this record is locked — add a post-trade review instead of changing what was known at decision time', 'LOCKED');
  const result = evaluate(userId, inp);
  db.raw.prepare(`UPDATE tril_evaluations SET instrument=?, direction=?, decision_time=?, analysis_text=?, readiness=?, emotion=?, input_json=?, result_json=?, overall=? WHERE id=? AND user_id=?`)
    .run(inp.instrument ?? null, inp.direction ?? null, inp.decisionTime ?? null, inp.analysisText ?? null, inp.readiness ?? null, inp.emotion ?? null,
      JSON.stringify(inp.evidence), JSON.stringify(result), result.overall, id, userId);
  audit(userId, 'ledger.tril.update', { id, before: { overall: cur.overall, input: j(cur.input_json, {}) } });
  return getEvaluation(userId, id);
}

/** Lock and optionally link to the executed trade. */
export function lockEvaluation(userId: string, id: string, tradeId: string | null) {
  const cur = db.raw.prepare('SELECT * FROM tril_evaluations WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!cur) throw notFound('TRIL record');
  if (tradeId) tradeEntry(userId, tradeId);
  if (cur.locked_at && (!tradeId || cur.trade_id)) throw badRequest('already locked', 'LOCKED');
  db.raw.prepare('UPDATE tril_evaluations SET locked_at = COALESCE(locked_at, ?), trade_id = COALESCE(trade_id, ?) WHERE id = ? AND user_id = ?').run(new Date().toISOString(), tradeId, id, userId);
  audit(userId, 'ledger.tril.lock', { id, tradeId });
  return getEvaluation(userId, id);
}

/** Re-evaluate any record against the current methodology/profile without changing the stored record. */
export function previewEvaluation(userId: string, inp: TrilRecordInput) {
  return evaluate(userId, inp);
}
