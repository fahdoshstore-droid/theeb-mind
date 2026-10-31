import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import { audit, badRequest, notFound, j } from './common.js';
import { queryTrades, toLedgerTrade, tradeOut, type TradeFilter } from './trades.service.js';
import { computeAnalytics, DEFAULT_MIN_SAMPLE } from '../../domain/analytics.js';
import { reconcileWithLedger, snapshotInternalChecks, TRADEZELLA_REPORT_2024_12_11_TO_2025_05_30, ALPHA_FUTURES_REPORT_HISTORICAL, type ReportedMetrics } from '../../domain/reconcile.js';
import { planAccount, VIDEO_PHASE_SUGGESTIONS, type FirmRules, type PayoutRecord } from '../../domain/payout.js';
import { detectBehavior, type BehaviorTrade } from '../../domain/behavior.js';
import { checkRisk } from '../../domain/risk-profile.js';
import { specFor } from '../../domain/instruments.js';
import { zonedParts, NY_TZ } from '../../domain/ny-time.js';
import { round2 } from '../../domain/pnl.js';
import { activeRules } from './profile.service.js';
import { getAccount, getFirmProfile, listAccounts, findOrCreateAccount } from './accounts.service.js';
import { insertTrade } from './trades.store.js';
import { toCsv } from '../../domain/csv.js';
import { resolvePnl } from '../../domain/pnl.js';

// ── Analytics ──
export function analytics(userId: string, f: TradeFilter, minSample = DEFAULT_MIN_SAMPLE) {
  const rows = queryTrades(userId, { ...f, limit: 20000 });
  return { filter: f, ...computeAnalytics(rows.map(toLedgerTrade), minSample) };
}

// ── Reported snapshots & reconciliation ──
const TEMPLATES = { tradezella_515: TRADEZELLA_REPORT_2024_12_11_TO_2025_05_30, alpha_futures_103: ALPHA_FUTURES_REPORT_HISTORICAL } as const;

export function snapshotTemplates() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({ id, ...t, internalChecks: snapshotInternalChecks(t.metrics) }));
}

export function addSnapshot(userId: string, s: { template?: keyof typeof TEMPLATES; dataset?: string; sourceName?: string; periodStart?: string | null; periodEnd?: string | null; accountIds?: string[]; metrics?: ReportedMetrics; notes?: string | null }) {
  const base = s.template ? TEMPLATES[s.template] : null;
  if (s.template && !base) throw badRequest('unknown template');
  const dataset = base?.dataset ?? s.dataset;
  if (!dataset || !(base?.metrics ?? s.metrics)) throw badRequest('dataset and metrics are required');
  for (const a of s.accountIds ?? []) getAccount(userId, a);
  const id = uuid();
  try {
    db.raw.prepare('INSERT INTO reported_snapshots (id, user_id, dataset, source_name, period_start, period_end, account_ids_json, metrics_json, notes) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, userId, dataset, base?.sourceName ?? s.sourceName ?? dataset, s.periodStart ?? base?.periodStart ?? null, s.periodEnd ?? base?.periodEnd ?? null,
        JSON.stringify(s.accountIds ?? []), JSON.stringify(base?.metrics ?? s.metrics), s.notes ?? base?.notes ?? null);
  } catch (e) { if (String(e).includes('UNIQUE')) throw badRequest(`snapshot "${dataset}" already stored`, 'DUPLICATE_SNAPSHOT'); throw e; }
  audit(userId, 'ledger.snapshot.add', { id, dataset });
  return getSnapshot(userId, id);
}

export function setSnapshotAccounts(userId: string, id: string, accountIds: string[]) {
  getSnapshot(userId, id);
  for (const a of accountIds) getAccount(userId, a);
  db.raw.prepare('UPDATE reported_snapshots SET account_ids_json = ? WHERE id = ? AND user_id = ?').run(JSON.stringify(accountIds), id, userId);
  return getSnapshot(userId, id);
}

export function getSnapshot(userId: string, id: string) {
  const r = db.raw.prepare('SELECT * FROM reported_snapshots WHERE id = ? AND user_id = ?').get(id, userId) as any;
  if (!r) throw notFound('snapshot');
  const metrics = j<ReportedMetrics>(r.metrics_json, {});
  const accountIds = j<string[]>(r.account_ids_json, []);
  const f: TradeFilter = { accountIds: accountIds.length ? accountIds : undefined, from: r.period_start ? `${r.period_start}T00:00:00.000Z` : undefined,
    to: r.period_end ? `${r.period_end}T23:59:59.999Z` : undefined };
  const trades = queryTrades(userId, { ...f, limit: 20000 }).map(toLedgerTrade);
  return {
    id: r.id, dataset: r.dataset, sourceName: r.source_name, periodStart: r.period_start, periodEnd: r.period_end, accountIds, metrics, notes: r.notes, createdAt: r.created_at,
    kind: 'reported_snapshot' as const,
    internalChecks: snapshotInternalChecks(metrics),
    ledgerScope: { trades: trades.length, filter: f, note: 'period filter uses entry time in UTC date bounds; choose accounts to narrow the comparison' },
    vsLedger: reconcileWithLedger(metrics, trades),
  };
}

export function listSnapshots(userId: string) {
  return (db.raw.prepare('SELECT id FROM reported_snapshots WHERE user_id = ? ORDER BY created_at').all(userId) as { id: string }[]).map((r) => getSnapshot(userId, r.id));
}

// ── Funded planner ──
export function addPayout(userId: string, accountId: string, p: { kind: PayoutRecord['kind']; amount: number; date: string; reference?: string | null; note?: string | null }) {
  getAccount(userId, accountId);
  if (!(p.amount > 0)) throw badRequest('amount must be positive');
  const id = uuid();
  db.raw.prepare('INSERT INTO payout_records (id, user_id, account_id, kind, amount, record_date, reference, note) VALUES (?,?,?,?,?,?,?,?)').run(id, userId, accountId, p.kind, p.amount, p.date, p.reference ?? null, p.note ?? null);
  audit(userId, 'ledger.payout.add', { id, accountId, kind: p.kind, amount: p.amount });
  return { id };
}

export function addEquity(userId: string, accountId: string, e: { equity: number; asOf: string }) {
  getAccount(userId, accountId);
  const id = uuid();
  db.raw.prepare('INSERT INTO account_equity_records (id, user_id, account_id, equity, as_of) VALUES (?,?,?,?,?)').run(id, userId, accountId, e.equity, e.asOf);
  audit(userId, 'ledger.equity.add', { id, accountId, equity: e.equity, asOf: e.asOf });
  return { id };
}

export function planner(userId: string, accountId: string) {
  const acc = getAccount(userId, accountId);
  const firm = acc.firm_profile_id ? getFirmProfile(userId, acc.firm_profile_id) : null;
  const rules = firm ? j<FirmRules>(firm.rules_json, {}) : {};
  const trades = queryTrades(userId, { accountIds: [accountId], limit: 20000 }).map((t) => ({ exitTime: t.exit_time, netPnl: t.net_pnl, status: t.status }));
  const payouts = db.raw.prepare('SELECT kind, amount, record_date AS date, reference, note, created_at FROM payout_records WHERE user_id = ? AND account_id = ? ORDER BY record_date').all(userId, accountId) as (PayoutRecord & Record<string, unknown>)[];
  const eq = db.raw.prepare('SELECT equity, as_of FROM account_equity_records WHERE user_id = ? AND account_id = ? ORDER BY as_of DESC LIMIT 1').get(userId, accountId) as { equity: number; as_of: string } | undefined;
  const plan = planAccount({ phase: acc.phase, startingBalance: acc.starting_balance, rules, trades, equityOverride: eq ? { value: eq.equity, asOf: eq.as_of } : null, payouts });
  return {
    account: { id: acc.id, name: acc.name, phase: acc.phase, startingBalance: acc.starting_balance, isDemo: Boolean(acc.is_demo) },
    firm: firm ? { id: firm.id, name: firm.name, sourceUrl: firm.source_url, sourceCheckedAt: firm.source_checked_at, rules } : null,
    firmRulesNote: firm ? (firm.source_url ? `rules entered by you from ${firm.source_url}${firm.source_checked_at ? ` (checked ${firm.source_checked_at})` : ''}` : 'rules entered by you without a source URL — verify with the firm') : 'no firm profile linked',
    plan, payouts, videoSuggestions: VIDEO_PHASE_SUGGESTIONS,
  };
}

// ── Pre-trade risk check (uses ACTIVE profile) ──
export function riskCheck(userId: string, r: { accountId?: string | null; symbol: string; side: 'long' | 'short'; entryPrice: number; stopPrice: number; targetPrice?: number | null; quantity: number;
  tickSize?: number | null; tickValue?: number | null; feesPerContractRoundTrip?: number | null; slippageTicks?: number | null; at?: string | null }) {
  const spec = specFor(r.symbol);
  const tickSize = r.tickSize ?? spec?.tickSize, tickValue = r.tickValue ?? spec?.tickValue;
  if (!tickSize || !tickValue) throw badRequest(`no contract spec for "${r.symbol}" — enter tick size and tick value`);
  const at = r.at ? Date.parse(r.at) : Date.now();
  const day = zonedParts(at, NY_TZ).date;
  const f: TradeFilter = r.accountId ? { accountIds: [r.accountId] } : {};
  if (r.accountId) getAccount(userId, r.accountId);
  const todays = queryTrades(userId, { ...f, limit: 20000 }).filter((t) => zonedParts(Date.parse(t.entry_time), NY_TZ).date === day);
  const closedToday = todays.filter((t) => t.status === 'closed' && t.exit_time && zonedParts(Date.parse(t.exit_time), NY_TZ).date === day);
  const unknown = closedToday.some((t) => t.net_pnl == null);
  const rules = activeRules(userId);
  const res = checkRisk({ side: r.side, entryPrice: r.entryPrice, stopPrice: r.stopPrice, targetPrice: r.targetPrice, quantity: r.quantity, tickSize, tickValue,
    feesPerContractRoundTrip: r.feesPerContractRoundTrip, slippageTicks: r.slippageTicks }, rules,
    { realizedNet: unknown ? null : round2(closedToday.reduce((s, t) => s + (t.net_pnl ?? 0), 0)), trades: todays.length });
  return { ...res, spec: { tickSize, tickValue, source: r.tickSize ? 'entered by you' : spec?.source }, nyDate: day, scope: r.accountId ? 'selected account' : 'all non-demo accounts',
    rulesUnconfirmed: Object.entries(rules.confirmed).filter(([, v]) => !v).map(([k]) => k) };
}

// ── Behavior ──
export function behavior(userId: string, f: TradeFilter) {
  const rows = queryTrades(userId, { ...f, limit: 20000 });
  const fills = db.raw.prepare('SELECT trade_id, id, side, quantity, price, fill_time, role FROM trade_fills WHERE user_id = ? ORDER BY fill_time').all(userId) as any[];
  const fillsBy = new Map<string, any[]>();
  for (const x of fills) { if (!fillsBy.has(x.trade_id)) fillsBy.set(x.trade_id, []); fillsBy.get(x.trade_id)!.push(x); }
  const pre = db.raw.prepare("SELECT trade_id, input_json FROM tril_evaluations WHERE user_id = ? AND phase = 'pre_trade' AND trade_id IS NOT NULL").all(userId) as any[];
  const preBy = new Map(pre.map((p) => [p.trade_id, j<any>(p.input_json, {})?.inversion?.state ?? null]));
  const bt: BehaviorTrade[] = rows.map((t) => {
    const fl = fillsBy.get(t.id);
    let adds: BehaviorTrade['addedWhileAgainst'];
    if (fl) {
      adds = []; let q = 0, cost = 0;
      for (const x of fl) {
        const opening = (t.side === 'long' && x.side === 'buy') || (t.side === 'short' && x.side === 'sell');
        if (!opening) continue;
        if (q > 0) { const avg = cost / q; if ((t.side === 'long' && x.price < avg) || (t.side === 'short' && x.price > avg)) adds.push({ fillKey: x.id, price: x.price, avgBefore: round2(avg) }); }
        q += x.quantity; cost += x.quantity * x.price;
      }
    }
    return { id: t.id, accountId: t.account_id, symbol: t.instrument_root ?? t.symbol, side: t.side, quantity: t.quantity, entryTime: t.entry_time, exitTime: t.exit_time,
      netPnl: t.net_pnl, initialRiskUsd: t.initial_risk_usd, notes: [t.user_notes, t.imported_notes].filter(Boolean).join(' \n ') || null,
      addedWhileAgainst: adds, trilInversionAtEntry: preBy.get(t.id) ?? null };
  });
  const res = detectBehavior(bt, activeRules(userId).enabledSessions);
  const fb = db.raw.prepare('SELECT pattern, trade_id, verdict, note, created_at FROM behavior_feedback WHERE user_id = ?').all(userId) as any[];
  const fbKey = new Map(fb.map((x) => [`${x.pattern}|${x.trade_id}`, x]));
  return {
    ...res,
    findings: res.findings.map((fi) => ({ ...fi, evidence: fi.evidence.map((e) => ({ ...e, feedback: fbKey.get(`${fi.pattern}|${e.tradeId}`) ?? null })) })),
    note: 'Observations from your data and your own notes. A loss is not evidence of a bad decision, and no finding blocks trading unless you add a rule yourself.',
  };
}

export function behaviorFeedback(userId: string, b: { pattern: string; tradeId: string; verdict: 'confirmed' | 'rejected'; note?: string | null }) {
  const t = db.raw.prepare('SELECT 1 FROM trades WHERE id = ? AND user_id = ?').get(b.tradeId, userId);
  if (!t) throw notFound('trade');
  db.raw.prepare(`INSERT INTO behavior_feedback (id, user_id, pattern, trade_id, verdict, note) VALUES (?,?,?,?,?,?)
    ON CONFLICT(user_id, pattern, trade_id) DO UPDATE SET verdict = excluded.verdict, note = excluded.note, created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .run(uuid(), userId, b.pattern.slice(0, 64), b.tradeId, b.verdict, b.note?.slice(0, 1000) ?? null);
  audit(userId, 'ledger.behavior.feedback', b);
  return { ok: true };
}

// ── Session journal ──
export function listSessionNotes(userId: string, from?: string, to?: string) {
  return db.raw.prepare(`SELECT id, kind, session_date, body, mood, readiness, created_at, updated_at FROM journal_notes WHERE user_id = ? AND kind IN ('session_pre','session_post')
    AND (? IS NULL OR session_date >= ?) AND (? IS NULL OR session_date <= ?) ORDER BY session_date DESC, kind`).all(userId, from ?? null, from ?? null, to ?? null, to ?? null);
}
export function addNote(userId: string, n: { kind: 'session_pre' | 'session_post' | 'trade'; sessionDate?: string | null; tradeId?: string | null; body: string; mood?: number | null; readiness?: number | null }) {
  if (n.kind === 'trade') { if (!n.tradeId || !db.raw.prepare('SELECT 1 FROM trades WHERE id = ? AND user_id = ?').get(n.tradeId, userId)) throw notFound('trade'); }
  else if (!n.sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(n.sessionDate)) throw badRequest('sessionDate (YYYY-MM-DD, New York date) required');
  const id = uuid();
  db.raw.prepare('INSERT INTO journal_notes (id, user_id, kind, session_date, trade_id, body, mood, readiness) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, userId, n.kind, n.kind === 'trade' ? null : n.sessionDate, n.kind === 'trade' ? n.tradeId : null, n.body.slice(0, 20000), n.mood ?? null, n.readiness ?? null);
  audit(userId, 'ledger.note.add', { id, kind: n.kind, tradeId: n.tradeId ?? null });
  return { id };
}
export function updateNote(userId: string, id: string, body: string) {
  const r = db.raw.prepare("UPDATE journal_notes SET body = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?").run(body.slice(0, 20000), id, userId);
  if (!r.changes) throw notFound('note');
  audit(userId, 'ledger.note.update', { id });
  return { id };
}

// ── Export (everything the user owns in the ledger) ──
export function exportAll(userId: string) {
  const q = (sql: string) => db.raw.prepare(sql).all(userId);
  return {
    exportedAt: new Date().toISOString(), format: 'theeb-mind-ledger-export/v1',
    accounts: q('SELECT * FROM trading_accounts WHERE user_id = ?'),
    firmProfiles: q('SELECT * FROM firm_profiles WHERE user_id = ?'),
    trades: queryTrades(userId, { includeDemo: true, limit: 20000 }).map(tradeOut),
    fills: q('SELECT * FROM trade_fills WHERE user_id = ?'),
    importBatches: q('SELECT id, kind, preset, filename, file_sha256, file_size, timezone, date_order, mapping_json, duplicate_policy, row_count, imported_count, updated_count, duplicate_count, error_count, source_net_total, imported_net_total, status, is_demo, created_at FROM import_batches WHERE user_id = ?'),
    rawRows: q('SELECT batch_id, row_index, raw_json, row_sha256, outcome, errors_json, warnings_json, trade_id, fill_id FROM import_raw_rows WHERE user_id = ?'),
    notes: q('SELECT * FROM journal_notes WHERE user_id = ?'),
    trilEvaluations: q('SELECT * FROM tril_evaluations WHERE user_id = ?'),
    riskRules: q('SELECT * FROM risk_rules WHERE user_id = ?'),
    riskRuleHistory: q('SELECT * FROM risk_rule_history WHERE user_id = ?'),
    reportedSnapshots: q('SELECT * FROM reported_snapshots WHERE user_id = ?'),
    payouts: q('SELECT * FROM payout_records WHERE user_id = ?'),
    equityRecords: q('SELECT * FROM account_equity_records WHERE user_id = ?'),
    behaviorFeedback: q('SELECT * FROM behavior_feedback WHERE user_id = ?'),
    attachments: q('SELECT id, trade_id, mime, size, sha256, caption, created_at FROM trade_attachments WHERE user_id = ?'),
  };
}

export const TRADE_CSV_COLUMNS = ['id', 'accountName', 'externalId', 'symbol', 'side', 'quantity', 'status', 'entryTime', 'exitTime', 'entryPrice', 'exitPrice',
  'grossPnl', 'grossSource', 'fees', 'feesSource', 'netPnl', 'netSource', 'stopPrice', 'stopSource', 'targetPrice', 'initialRiskUsd', 'rMultiple', 'setup', 'executionGrade',
  'tags', 'userNotes', 'importedNotes', 'isDemo'];
export function exportTradesCsv(userId: string, f: TradeFilter) {
  return toCsv(TRADE_CSV_COLUMNS, queryTrades(userId, { ...f, limit: 20000 }).map((t) => { const o: any = tradeOut(t); o.tags = o.tags.join(';'); return o; }));
}

// ── DEMO data (clearly labelled; lives only in a DEMO account; excluded from real analytics by default) ──
export const DEMO_ACCOUNT = 'DEMO — sample data (not real trades)';
export function seedDemo(userId: string) {
  const acc = findOrCreateAccount(userId, DEMO_ACCOUNT, true);
  const existing = (db.raw.prepare('SELECT COUNT(*) c FROM trades WHERE user_id = ? AND account_id = ?').get(userId, acc.id) as { c: number }).c;
  if (existing) return { accountId: acc.id, created: 0, note: 'DEMO data already present' };
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let created = 0;
  db.raw.transaction(() => {
    for (let i = 0; i < 40; i++) {
      const day = new Date(Date.UTC(2025, 0, 6 + Math.floor(i / 2) + Math.floor(i / 10) * 2));
      const entry = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 14 + (i % 2), 35 + Math.floor(rnd() * 20));
      const side = rnd() > 0.35 ? 'long' : 'short' as const;
      const symbol = rnd() > 0.5 ? 'MNQH5' : 'NQH5';
      const spec = specFor(symbol)!;
      const ep = 21000 + Math.round(rnd() * 400) * 0.25 * 4;
      const stopPts = 10 + Math.round(rnd() * 20), win = rnd() > 0.47;
      const xp = side === 'long' ? ep + (win ? stopPts * 2 : -stopPts) : ep - (win ? stopPts * 2 : -stopPts);
      const qty = symbol.startsWith('MNQ') ? 3 : 1;
      const fees = round2((symbol.startsWith('MNQ') ? 0.74 : 2.24) * qty);
      const pnl = resolvePnl({ side, quantity: qty, entryPrice: ep, exitPrice: xp, tickSize: spec.tickSize, tickValue: spec.tickValue, reportedGross: null, reportedNet: null, reportedFees: fees, closed: true });
      const stop = side === 'long' ? ep - stopPts : ep + stopPts;
      insertTrade(userId, acc.id, null, 'demo', `demo:${i}`, {
        externalId: `DEMO-${i + 1}`, accountName: acc.name, symbol, instrumentRoot: spec.root, side, quantity: qty, status: 'closed',
        entryTime: new Date(entry).toISOString(), exitTime: new Date(entry + (8 + Math.floor(rnd() * 40)) * 60000).toISOString(),
        entryPrice: ep, exitPrice: xp, tickSize: spec.tickSize, tickValue: spec.tickValue, tickSource: spec.source,
        grossPnl: pnl.gross, grossSource: 'recomputed', fees, feesSource: 'estimated', netPnl: pnl.net, netSource: 'estimated', recomputedGross: pnl.gross, pnlMismatch: null,
        stopPrice: stop, targetPrice: null, initialRiskUsd: round2(stopPts * (spec.tickValue / spec.tickSize) * qty), initialRiskSource: 'DEMO',
        setup: i % 3 === 0 ? 'DEMO setup A' : 'DEMO setup B', notes: 'DEMO — generated sample trade', tags: ['DEMO'], currency: 'USD', timestampsHadOffset: true,
        fieldSources: { '*': 'DEMO generator — not real data' },
      }, true);
      created++;
    }
  })();
  audit(userId, 'ledger.demo.seed', { accountId: acc.id, created });
  return { accountId: acc.id, created };
}

export function deleteDemo(userId: string) {
  const accs = listAccounts(userId).filter((a) => a.is_demo);
  db.raw.transaction(() => {
    for (const a of accs) {
      db.raw.prepare('DELETE FROM tril_evaluations WHERE user_id = ? AND trade_id IN (SELECT id FROM trades WHERE account_id = ? AND user_id = ?)').run(userId, a.id, userId);
      db.raw.prepare('DELETE FROM behavior_feedback WHERE user_id = ? AND trade_id IN (SELECT id FROM trades WHERE account_id = ? AND user_id = ?)').run(userId, a.id, userId);
      db.raw.prepare('DELETE FROM trades WHERE user_id = ? AND account_id = ?').run(userId, a.id);
      db.raw.prepare('DELETE FROM payout_records WHERE user_id = ? AND account_id = ?').run(userId, a.id);
      db.raw.prepare('DELETE FROM account_equity_records WHERE user_id = ? AND account_id = ?').run(userId, a.id);
      db.raw.prepare('DELETE FROM trading_accounts WHERE user_id = ? AND id = ?').run(userId, a.id);
    }
  })();
  audit(userId, 'ledger.demo.delete', { accounts: accs.length });
  return { deletedAccounts: accs.length };
}
