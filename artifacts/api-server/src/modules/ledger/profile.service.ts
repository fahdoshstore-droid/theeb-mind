// Personal rules profile — versioned rules; every change is recorded in risk_rule_history.
import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import { audit, badRequest, notFound, j } from './common.js';
import { RULE_KEYS, RULE_SEEDS, validateRuleValue, type ActiveRules, type RuleKey, type RuleStatus } from '../../domain/risk-profile.js';
import type { SessionKey } from '../../domain/tril.js';

interface RuleRow { id: string; user_id: string; rule_key: RuleKey; value_json: string; status: RuleStatus; source: string; note: string | null;
  effective_from: string | null; effective_to: string | null; confirmed_at: string | null; version: number; created_at: string }

const out = (r: RuleRow) => ({ id: r.id, key: r.rule_key, label: RULE_KEYS[r.rule_key]?.label ?? r.rule_key, value: j(r.value_json, null), status: r.status, source: r.source, note: r.note,
  effectiveFrom: r.effective_from, effectiveTo: r.effective_to, confirmedAt: r.confirmed_at, version: r.version, createdAt: r.created_at });

function history(userId: string, ruleId: string, key: string, action: string, oldV: unknown, newV: unknown, reason: string | null) {
  db.raw.prepare('INSERT INTO risk_rule_history (user_id, rule_id, rule_key, action, old_json, new_json, reason, changed_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(userId, ruleId, key, action, oldV === undefined ? null : JSON.stringify(oldV), newV === undefined ? null : JSON.stringify(newV), reason, userId);
}

export function ensureSeeded(userId: string): void {
  const has = db.raw.prepare('SELECT 1 FROM risk_rules WHERE user_id = ? LIMIT 1').get(userId);
  if (has) return;
  db.raw.transaction(() => {
    for (const s of RULE_SEEDS) {
      const id = uuid();
      db.raw.prepare('INSERT INTO risk_rules (id, user_id, rule_key, value_json, status, source, note, effective_from) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, userId, s.key, JSON.stringify(s.value), s.status, s.source, s.note ?? null, s.effectiveFrom);
      history(userId, id, s.key, 'seed', undefined, { value: s.value, status: s.status }, 'initial profile seed — awaiting your confirmation');
    }
  })();
}

export function listRules(userId: string) {
  ensureSeeded(userId);
  const rows = (db.raw.prepare('SELECT * FROM risk_rules WHERE user_id = ? ORDER BY rule_key, version DESC, created_at DESC').all(userId) as RuleRow[]).map(out);
  const byKey = Object.keys(RULE_KEYS).map((key) => {
    const versions = rows.filter((r) => r.key === key);
    const active = versions.find((v) => v.status === 'active') ?? null;
    const others = versions.filter((v) => v.status !== 'active');
    const conflicts = active ? others.filter((o) => JSON.stringify(o.value) !== JSON.stringify(active.value)) : [];
    return { key, label: RULE_KEYS[key as RuleKey].label, active, versions, conflicts: conflicts.map((c) => ({ id: c.id, value: c.value, status: c.status, source: c.source })),
      needsConfirmation: Boolean(active && !active.confirmedAt) };
  });
  return { rules: byKey, enforcesTradeCount: false, note: 'Trade count is tracked for analysis; no daily trade-count limit blocks trades unless you activate one yourself.' };
}

function getRule(userId: string, id: string): RuleRow {
  const r = db.raw.prepare('SELECT * FROM risk_rules WHERE id = ? AND user_id = ?').get(id, userId) as RuleRow | undefined;
  if (!r) throw notFound('rule');
  return r;
}

/** New value for a rule key → new active version; the previous active version becomes historical. */
export function setRule(userId: string, key: string, value: unknown, reason: string | null, status: RuleStatus = 'active') {
  if (!(key in RULE_KEYS)) throw badRequest(`unknown rule "${key}"`);
  const err = validateRuleValue(key as RuleKey, value);
  if (err) throw badRequest(`${key}: ${err}`);
  ensureSeeded(userId);
  const now = new Date().toISOString();
  return db.raw.transaction(() => {
    const prev = db.raw.prepare("SELECT * FROM risk_rules WHERE user_id = ? AND rule_key = ? AND status = 'active'").get(userId, key) as RuleRow | undefined;
    const maxV = (db.raw.prepare('SELECT MAX(version) v FROM risk_rules WHERE user_id = ? AND rule_key = ?').get(userId, key) as { v: number | null }).v ?? 0;
    if (status === 'active' && prev) {
      db.raw.prepare("UPDATE risk_rules SET status = 'historical', effective_to = ? WHERE id = ?").run(now, prev.id);
      history(userId, prev.id, key, 'superseded', { value: j(prev.value_json, null), status: 'active' }, { status: 'historical' }, reason);
    }
    const id = uuid();
    db.raw.prepare('INSERT INTO risk_rules (id, user_id, rule_key, value_json, status, source, effective_from, confirmed_at, version) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, userId, key, JSON.stringify(value), status, 'set by you in Settings', status === 'active' ? now : null, status === 'active' ? now : null, maxV + 1);
    history(userId, id, key, 'set', prev ? j(prev.value_json, null) : undefined, { value, status }, reason);
    audit(userId, 'ledger.rule.set', { key, value, status, reason });
    return out(getRule(userId, id));
  })();
}

export function confirmRule(userId: string, id: string) {
  const r = getRule(userId, id);
  if (r.status !== 'active') throw badRequest('only the active version can be confirmed');
  const now = new Date().toISOString();
  db.raw.prepare('UPDATE risk_rules SET confirmed_at = ?, effective_from = COALESCE(effective_from, ?) WHERE id = ?').run(now, now, id);
  history(userId, id, r.rule_key, 'confirm', undefined, { value: j(r.value_json, null) }, null);
  audit(userId, 'ledger.rule.confirm', { key: r.rule_key, id });
  return out(getRule(userId, id));
}

/** Re-activate a historical version (copied as a new version) or change a version's status. */
export function changeStatus(userId: string, id: string, status: RuleStatus, reason: string | null) {
  const r = getRule(userId, id);
  if (status === 'active') return setRule(userId, r.rule_key, j(r.value_json, null), reason ?? `re-activated version ${r.version}`);
  db.raw.prepare('UPDATE risk_rules SET status = ?, effective_to = CASE WHEN ? IN (\'historical\',\'disabled\') THEN COALESCE(effective_to, strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')) ELSE effective_to END WHERE id = ?').run(status, status, id);
  history(userId, id, r.rule_key, 'status', { status: r.status }, { status }, reason);
  audit(userId, 'ledger.rule.status', { key: r.rule_key, id, from: r.status, to: status, reason });
  return out(getRule(userId, id));
}

export function ruleHistory(userId: string) {
  return db.raw.prepare('SELECT rule_id, rule_key, action, old_json, new_json, reason, changed_by, changed_at FROM risk_rule_history WHERE user_id = ? ORDER BY id DESC LIMIT 500').all(userId)
    .map((h: any) => ({ ...h, old: j(h.old_json, null), new: j(h.new_json, null) }));
}

export function activeRules(userId: string): ActiveRules {
  ensureSeeded(userId);
  const rows = db.raw.prepare("SELECT * FROM risk_rules WHERE user_id = ? AND status = 'active'").all(userId) as RuleRow[];
  const get = (k: RuleKey) => rows.find((r) => r.rule_key === k);
  const num = (k: RuleKey) => { const r = get(k); const v = r ? j<unknown>(r.value_json, null) : null; return typeof v === 'number' ? v : null; };
  const confirmed: ActiveRules['confirmed'] = {}, sources: ActiveRules['sources'] = {};
  for (const r of rows) { confirmed[r.rule_key] = Boolean(r.confirmed_at); sources[r.rule_key] = r.source; }
  const sess = get('enabled_sessions');
  return {
    maxTradeRiskUsd: num('max_trade_risk_usd'), minRrr: num('min_rrr'), dailyLossLimitUsd: num('daily_loss_limit_usd'),
    enabledSessions: (sess ? j<SessionKey[]>(sess.value_json, []) : []), sessionsConfirmed: Boolean(sess?.confirmed_at), confirmed, sources,
  };
}
