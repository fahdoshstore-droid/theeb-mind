import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedParts, zonedToUtc } from '../src/domain/ny-time.js';
import { parseTimestamp, parseNumber } from '../src/domain/timestamps.js';
import { evaluateTril, timeContext, type TrilInput } from '../src/domain/tril.js';
import { recomputeGross, resolvePnl, computeRisk, rMultiple } from '../src/domain/pnl.js';
import { instrumentRoot, specFor } from '../src/domain/instruments.js';
import { parseCsv, csvCell, toCsv } from '../src/domain/csv.js';
import { normalizeTradeRow, normalizeFillRow, suggestMapping, PRESETS } from '../src/domain/import-normalize.js';
import { groupFills } from '../src/domain/fills.js';
import { computeAnalytics, type LedgerTrade } from '../src/domain/analytics.js';
import { snapshotInternalChecks, TRADEZELLA_REPORT_2024_12_11_TO_2025_05_30 as TZ } from '../src/domain/reconcile.js';
import { planAccount } from '../src/domain/payout.js';
import { checkRisk, RULE_SEEDS } from '../src/domain/risk-profile.js';
import { detectBehavior } from '../src/domain/behavior.js';

// ── New York time / DST ─────────────────────────────────────
test('NY time: EDT vs EST offsets and kill zone membership across DST', () => {
  // 2025-03-07 (EST, UTC-5): 09:30 NY = 14:30Z
  assert.equal(zonedParts(Date.parse('2025-03-07T14:30:00Z')).minutesOfDay, 9 * 60 + 30);
  assert.equal(zonedParts(Date.parse('2025-03-07T14:30:00Z')).offsetMinutes, -300);
  // 2025-03-10 (EDT, UTC-4): 09:30 NY = 13:30Z
  assert.equal(zonedParts(Date.parse('2025-03-10T13:30:00Z')).minutesOfDay, 9 * 60 + 30);
  assert.equal(zonedParts(Date.parse('2025-03-10T13:30:00Z')).offsetMinutes, -240);
  // same UTC wall-clock 14:30Z is 10:30 NY after DST starts
  assert.equal(timeContext(Date.parse('2025-03-10T14:30:00Z'), ['ny_am']).nyTime, '10:30');
  // a fixed UTC-hour rule would get this wrong: 13:45Z is 08:45 NY in winter (outside) and 09:45 in summer (inside)
  assert.equal(timeContext(Date.parse('2025-01-15T13:45:00Z'), ['ny_am']).sourceKillzone, null);
  assert.equal(timeContext(Date.parse('2025-07-15T13:45:00Z'), ['ny_am']).sourceKillzone, 'ny_am');
});

test('zonedToUtc: spring-forward gap and fall-back ambiguity are flagged', () => {
  const gap = zonedToUtc(2025, 3, 9, 2, 30, 0, 'America/New_York');
  assert.equal(gap.gap, true);
  const amb = zonedToUtc(2025, 11, 2, 1, 30, 0, 'America/New_York');
  assert.equal(amb.ambiguous, true);
  assert.equal(new Date(amb.utcMs).toISOString(), '2025-11-02T05:30:00.000Z'); // earlier instant (EDT)
  assert.equal(new Date(zonedToUtc(2025, 1, 15, 9, 30, 0, 'America/New_York').utcMs).toISOString(), '2025-01-15T14:30:00.000Z');
});

test('parseTimestamp: offsets, naive local, US dates, AM/PM, epoch', () => {
  assert.equal(parseTimestamp('2025-01-15T09:30:00-05:00', 'UTC')!.iso, '2025-01-15T14:30:00.000Z');
  const naive = parseTimestamp('2025-01-15 09:30:00', 'America/New_York')!;
  assert.equal(naive.iso, '2025-01-15T14:30:00.000Z'); assert.equal(naive.hadOffset, false);
  assert.equal(parseTimestamp('01/15/2025 09:30 AM', 'America/New_York')!.iso, '2025-01-15T14:30:00.000Z');
  assert.equal(parseTimestamp('15/01/2025 21:30', 'America/New_York', 'DMY')!.iso, '2025-01-16T02:30:00.000Z');
  assert.equal(parseTimestamp('1736951400', 'UTC')!.iso, '2025-01-15T14:30:00.000Z');
  assert.equal(parseTimestamp('not a date', 'UTC'), null);
  assert.equal(parseTimestamp('2025-13-01', 'UTC'), null);
});

test('parseNumber: currency formats, parentheses negatives, rejects ambiguous', () => {
  assert.equal(parseNumber('$1,234.50'), 1234.5);
  assert.equal(parseNumber('(12.50)'), -12.5);
  assert.equal(parseNumber('-$3.25'), -3.25);
  assert.equal(parseNumber('1.234,50'), null);
  assert.equal(parseNumber(''), null);
});

// ── TRIL ────────────────────────────────────────────────────
const ok = { state: 'yes' as const, source: 'manual' as const };
const full = (over: Partial<TrilInput> = {}): TrilInput => ({
  decisionTime: '2025-01-15T15:52:00Z', // 10:52 NY (EST) — AM KZ, macro xx:50–xx:10
  enabledSessions: ['ny_am'],
  raid: { liquiditySwept: { ...ok, level: 'Asia low' }, smtVsEs: ok },
  inversion: { type: 'ifvg', state: 'retest_seen', source: 'screenshot' },
  liquidity: { drawOnLiquidity: 'PDH', dolType: 'ERL', target: '21500', invalidation: '21380', erlIrlStoryClear: ok },
  topDown: { htfBias: 'bullish', mtf: 'aligned', ltfModel: ok },
  ...over,
});

test('TRIL: complete evidence → PASS (and it is not a probability)', () => {
  const r = evaluateTril(full());
  assert.equal(r.overall, 'PASS');
  assert.ok(r.disclaimer.includes('not a probability'));
  assert.deepEqual(r.components.map((c) => c.status), ['PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
});

test('TRIL: empty input → INSUFFICIENT_EVIDENCE, never PASS', () => {
  const r = evaluateTril({ enabledSessions: ['ny_am'] });
  assert.equal(r.overall, 'INSUFFICIENT_EVIDENCE');
  assert.ok(r.components.slice(0, 4).every((c) => c.status === 'INSUFFICIENT_EVIDENCE'));
});

test('TRIL: "yes" without an evidence source does not count', () => {
  const r = evaluateTril(full({ raid: { liquiditySwept: { state: 'yes' }, smtVsEs: ok } }));
  assert.equal(r.components[1].status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(r.overall, 'INSUFFICIENT_EVIDENCE');
});

test('TRIL: AI-assisted evidence requires trader confirmation', () => {
  const ai = { state: 'yes' as const, source: 'ai_assisted' as const };
  assert.equal(evaluateTril(full({ raid: { liquiditySwept: ok, smtVsEs: ai } })).components[1].status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(evaluateTril(full({ raid: { liquiditySwept: ok, smtVsEs: { ...ai, confirmedByUser: true } } })).components[1].status, 'PASS');
});

test('TRIL: SMT unclear/unknown → insufficient, SMT no → FAIL', () => {
  assert.equal(evaluateTril(full({ raid: { liquiditySwept: ok, smtVsEs: { state: 'unclear', source: 'manual' } } })).overall, 'INSUFFICIENT_EVIDENCE');
  assert.equal(evaluateTril(full({ raid: { liquiditySwept: ok, smtVsEs: { state: 'no', source: 'manual' } } })).overall, 'FAIL');
});

test('TRIL Time: PM KZ is FAIL when only AM is enabled in the personal profile', () => {
  const pm = '2025-01-15T19:51:00Z'; // 14:51 NY
  const r = evaluateTril(full({ decisionTime: pm }));
  assert.equal(r.components[0].status, 'FAIL');
  assert.ok(r.components[0].reasons[0].includes('not enabled'));
  assert.equal(evaluateTril(full({ decisionTime: pm, enabledSessions: ['ny_am', 'ny_pm'] })).components[0].status, 'PASS');
});

test('TRIL Time: kill-zone boundaries (09:30 inclusive, 12:10 exclusive)', () => {
  assert.equal(timeContext(Date.parse('2025-01-15T14:30:00Z'), ['ny_am']).sourceKillzone, 'ny_am'); // 09:30
  assert.equal(timeContext(Date.parse('2025-01-15T14:29:00Z'), ['ny_am']).sourceKillzone, null);    // 09:29
  assert.equal(timeContext(Date.parse('2025-01-15T17:09:00Z'), ['ny_am']).sourceKillzone, 'ny_am'); // 12:09
  assert.equal(timeContext(Date.parse('2025-01-15T17:10:00Z'), ['ny_am']).sourceKillzone, null);    // 12:10
});

test('TRIL Time: macro windows xx:50–xx:10 wrap the hour; xx:20–xx:40; outside needs the raid→PD exception', () => {
  assert.equal(timeContext(Date.parse('2025-01-15T16:05:00Z'), ['ny_am']).macroWindow, 'cr');      // 11:05
  assert.equal(timeContext(Date.parse('2025-01-15T16:25:00Z'), ['ny_am']).macroWindow, 'mss_acc'); // 11:25
  assert.equal(timeContext(Date.parse('2025-01-15T16:45:00Z'), ['ny_am']).macroWindow, null);      // 11:45
  const outside = '2025-01-15T16:45:00Z';
  assert.equal(evaluateTril(full({ decisionTime: outside })).components[0].status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(evaluateTril(full({ decisionTime: outside, time: { macroExceptionRaidToPdArray: { state: 'no', source: 'manual' } } })).components[0].status, 'FAIL');
  assert.equal(evaluateTril(full({ decisionTime: outside, time: { macroExceptionRaidToPdArray: { state: 'yes', source: 'screenshot' } } })).components[0].status, 'PASS');
});

test('TRIL Inversion: formed ≠ confirmed; confirmed needs retest unless raid→PD exception; invalidated fails', () => {
  const inv = (state: any, extra: any = {}) => evaluateTril(full({ inversion: { type: 'breaker', state, source: 'manual', ...extra } })).components[2].status;
  assert.equal(inv('formed'), 'FAIL');
  assert.equal(inv('invalidated'), 'FAIL');
  assert.equal(inv('confirmed'), 'INSUFFICIENT_EVIDENCE');
  assert.equal(inv('confirmed', { directPdArrayAfterRaid: { state: 'no', source: 'manual' } }), 'FAIL');
  assert.equal(inv('confirmed', { directPdArrayAfterRaid: { state: 'yes', source: 'manual' } }), 'PASS');
  assert.equal(inv('retest_seen'), 'PASS');
  // exception without a recorded raid does not apply
  const r = evaluateTril(full({ raid: { smtVsEs: ok }, inversion: { type: 'ifvg', state: 'confirmed', source: 'manual', directPdArrayAfterRaid: { state: 'yes', source: 'manual' } } }));
  assert.equal(r.components[2].status, 'INSUFFICIENT_EVIDENCE');
});

test('TRIL Liquidity: unclear ERL/IRL story → FAIL; missing target → insufficient', () => {
  assert.equal(evaluateTril(full({ liquidity: { drawOnLiquidity: 'PDH', target: 'x', invalidation: 'y', erlIrlStoryClear: { state: 'no', source: 'manual' } } })).components[3].status, 'FAIL');
  assert.equal(evaluateTril(full({ liquidity: { drawOnLiquidity: 'PDH', invalidation: 'y', erlIrlStoryClear: ok } })).components[3].status, 'INSUFFICIENT_EVIDENCE');
});

test('TRIL: HTF/MTF conflict adds the source-specific note but does not change T/R/I/L', () => {
  const r = evaluateTril(full({ topDown: { htfBias: 'bullish', mtf: 'conflict', ltfModel: ok } }));
  assert.equal(r.overall, 'PASS');
  assert.ok(r.notes.some((n) => n.includes('reduce contract size')));
});

// ── P&L / risk ──────────────────────────────────────────────
test('instrument roots and specs', () => {
  assert.equal(instrumentRoot('MNQZ4'), 'MNQ'); assert.equal(instrumentRoot('NQH25'), 'NQ'); assert.equal(instrumentRoot('CME_MINI:NQ1!'), 'NQ');
  assert.equal(instrumentRoot('MESM5'), 'MES'); assert.equal(instrumentRoot('/MGC'), 'MGC'); assert.equal(instrumentRoot('AAPL'), null);
  assert.equal(specFor('NQ')!.tickValue, 5); assert.equal(specFor('MNQ')!.tickValue, 0.5);
});

test('round-trip P&L: NQ long 10 points × 2 = $400; MNQ short 10 points × 3 = $60', () => {
  assert.equal(recomputeGross({ side: 'long', quantity: 2, entryPrice: 21000, exitPrice: 21010, tickSize: 0.25, tickValue: 5 }), 400);
  assert.equal(recomputeGross({ side: 'short', quantity: 3, entryPrice: 21010, exitPrice: 21000, tickSize: 0.25, tickValue: 0.5 }), 60);
});

test('resolvePnl: reported values win, gaps are recomputed and labelled, mismatches flagged, nothing estimated', () => {
  const base = { side: 'long' as const, quantity: 1, entryPrice: 21000, exitPrice: 21010, tickSize: 0.25, tickValue: 5, closed: true };
  const a = resolvePnl({ ...base, reportedGross: null, reportedNet: 195.5, reportedFees: 4.5 });
  assert.deepEqual([a.gross, a.grossSource, a.net, a.netSource, a.mismatch], [200, 'recomputed', 195.5, 'source_reported', 0]);
  const b = resolvePnl({ ...base, reportedGross: 210, reportedNet: null, reportedFees: null });
  assert.equal(b.mismatch, 10); assert.equal(b.net, null); assert.equal(b.netSource, 'unknown');
  const c = resolvePnl({ ...base, tickSize: null, tickValue: null, reportedGross: null, reportedNet: null, reportedFees: null });
  assert.equal(c.net, null); assert.ok(c.warnings.some((w) => w.includes('unknown')));
  const open = resolvePnl({ ...base, exitPrice: null, closed: false, reportedGross: null, reportedNet: null, reportedFees: null });
  assert.equal(open.netSource, 'unknown');
});

test('computeRisk: NQ 20-pt stop × 1 = $400, RRR, fees, wrong-side stop rejected; R only from initial risk', () => {
  const r = computeRisk({ side: 'long', entryPrice: 21000, stopPrice: 20980, targetPrice: 21040, quantity: 1, tickSize: 0.25, tickValue: 5, feesPerContractRoundTrip: 4 });
  assert.equal(r.riskUsd, 400); assert.equal(r.totalRiskUsd, 404); assert.equal(r.rrr, 2); assert.equal(r.stopDistanceTicks, 80);
  assert.equal(computeRisk({ side: 'long', entryPrice: 21000, stopPrice: 21010, quantity: 1, tickSize: 0.25, tickValue: 5 }).valid, false);
  assert.equal(computeRisk({ side: 'short', entryPrice: 21000, stopPrice: 21010, quantity: 2, tickSize: 0.25, tickValue: 0.5 }).riskUsd, 40);
  assert.equal(rMultiple(200, 400), 0.5); assert.equal(rMultiple(200, null), null);
});

test('checkRisk detail', () => {
  const rules = { maxTradeRiskUsd: 500, minRrr: 2, dailyLossLimitUsd: 1000, enabledSessions: ['ny_am' as const], sessionsConfirmed: false, confirmed: {}, sources: {} };
  const r = checkRisk({ side: 'long', entryPrice: 21000, stopPrice: 20980, targetPrice: 21030, quantity: 1, tickSize: 0.25, tickValue: 5 }, rules, { realizedNet: -700, trades: 9 });
  const by = Object.fromEntries(r.checks.map((c) => [c.key, c.status]));
  assert.equal(by.max_risk, 'ok');               // $400 ≤ $500
  assert.equal(by.min_rrr, 'below');             // 1.5 < 2
  assert.equal(by.daily_loss, 'exceeds');        // $400 > $300 remaining
  assert.equal(by.trade_count, 'info');          // 9 trades — informational only
  assert.equal(r.dailyLossRemaining, 300);
  assert.equal(r.maxContractsByRisk, 0);         // budget = min(500, 300) / 400 per contract
});

test('seeds: historical values exist but are not active; no active trade-count rule', () => {
  const active = RULE_SEEDS.filter((s) => s.status === 'active');
  assert.deepEqual(active.map((s) => [s.key, s.value]), [['max_trade_risk_usd', 500], ['min_rrr', 2], ['daily_loss_limit_usd', 1000], ['enabled_sessions', ['ny_am']]]);
  assert.ok(RULE_SEEDS.some((s) => s.key === 'min_rrr' && s.value === 2.5 && s.status === 'historical'));
  assert.ok(RULE_SEEDS.some((s) => s.key === 'daily_loss_limit_usd' && s.value === 600 && s.status === 'historical'));
  assert.equal(RULE_SEEDS.find((s) => s.key === 'max_trades_per_day')!.status, 'historical');
});

// ── CSV ─────────────────────────────────────────────────────
test('CSV: quotes, embedded commas/newlines, BOM, semicolon delimiter', () => {
  const t = parseCsv('﻿a,b,c\r\n1,"x, y","multi\nline"\r\n2,"he said ""hi""",z\n');
  assert.deepEqual(t.headers, ['a', 'b', 'c']);
  assert.deepEqual(t.rows, [['1', 'x, y', 'multi\nline'], ['2', 'he said "hi"', 'z']]);
  assert.equal(parseCsv('a;b\n1;2').delimiter, ';');
});

test('CSV export neutralises formula injection but keeps numbers numeric', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+1'), "'+1"); assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)"); assert.equal(csvCell('-cmd'), "'-cmd");
  assert.equal(csvCell(-12.5), '-12.5');
  assert.equal(toCsv(['a'], [{ a: '=1+1' }]), "a\r\n'=1+1\r\n");
});

// ── Import normalization ────────────────────────────────────
const H = ['Trade ID', 'Account', 'Symbol', 'Side', 'Qty', 'Entry Time', 'Exit Time', 'Entry Price', 'Exit Price', 'Commission', 'Net P&L', 'Stop Loss'];
test('suggestMapping finds common headers; split date/time columns are joined', () => {
  const m = suggestMapping(H, 'trades');
  assert.equal(m.external_id, 'Trade ID'); assert.equal(m.net_pnl, 'Net P&L'); assert.equal(m.stop_price, 'Stop Loss'); assert.equal(m.commission, 'Commission');
  const m2 = suggestMapping(['Symbol', 'Open Date', 'Open Time', 'Close Date', 'Close Time'], 'trades');
  assert.deepEqual(m2.entry_time, ['Open Date', 'Open Time']);
});

test('normalizeTradeRow: valid row with provenance, initial risk from imported stop', () => {
  const m = suggestMapping(H, 'trades');
  const raw = { 'Trade ID': 'T1', Account: 'Elite', Symbol: 'NQH5', Side: 'Long', Qty: '1', 'Entry Time': '2025-01-15 09:45:00', 'Exit Time': '2025-01-15 10:05:00',
    'Entry Price': '21000', 'Exit Price': '21010', Commission: '4.50', 'Net P&L': '195.50', 'Stop Loss': '20990' };
  const r = normalizeTradeRow(raw, 1, m, { timezone: 'America/New_York' });
  assert.equal(r.ok, true, r.errors.join());
  const v = r.value!;
  assert.equal(v.entryTime, '2025-01-15T14:45:00.000Z');
  assert.equal(v.netPnl, 195.5); assert.equal(v.netSource, 'source_reported'); assert.equal(v.grossPnl, 200); assert.equal(v.pnlMismatch, 0);
  assert.equal(v.initialRiskUsd, 200); assert.ok(v.fieldSources.net_pnl.startsWith('import:'));
  assert.equal(r.dedupeKey, 'ext:T1');
  assert.ok(r.warnings.some((w) => w.includes('no UTC offset')));
});

test('normalizeTradeRow: errors reported per row (bad side, exit before entry, missing qty)', () => {
  const m = suggestMapping(H, 'trades');
  const r = normalizeTradeRow({ Symbol: 'NQ', Side: 'up', Qty: '', 'Entry Time': '2025-01-15 10:00', 'Exit Time': '2025-01-15 09:00' }, 2, m, { timezone: 'UTC' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('side'))); assert.ok(r.errors.some((e) => e.includes('quantity'))); assert.ok(r.errors.some((e) => e.includes('before entry')));
});

test('Tradovate performance preset derives side from timestamps', () => {
  const preset = PRESETS.find((p) => p.id === 'tradovate_performance')!;
  const raw = { symbol: 'MNQH5', qty: '2', buyPrice: '21000.00', sellPrice: '21010.00', pnl: '$40.00', boughtTimestamp: '01/15/2025 10:05:00', soldTimestamp: '01/15/2025 09:50:00', buyFillId: '11', sellFillId: '10' };
  const r = normalizeTradeRow(raw, 1, preset.mapping, { timezone: 'America/New_York', preset });
  assert.equal(r.ok, true, r.errors.join());
  assert.equal(r.value!.side, 'short'); assert.equal(r.value!.entryPrice, 21010); assert.equal(r.value!.grossPnl, 40); assert.equal(r.value!.pnlMismatch, 0);
  assert.equal(r.value!.recomputedGross, 40); assert.equal(r.value!.externalId, '11-10');
});

// ── Fills grouping ──────────────────────────────────────────
const fill = (id: string, side: 'buy' | 'sell', qty: number, price: number, t: string, fees: number | null = 1) =>
  ({ key: id, fill: { externalId: id, orderId: null, accountName: 'A', symbol: 'NQH5', side, quantity: qty, price, time: t, timeMs: Date.parse(t), fees, tickSize: 0.25, tickValue: 5, currency: 'USD', hadOffset: true } });

test('groupFills: scale-in/partial exits → one round trip; P&L from cash flows; adds-against flagged', () => {
  const g = groupFills([
    fill('1', 'buy', 1, 21000, '2025-01-15T15:00:00Z'), fill('2', 'buy', 1, 20990, '2025-01-15T15:01:00Z'),
    fill('3', 'sell', 1, 21010, '2025-01-15T15:05:00Z'), fill('4', 'sell', 1, 21020, '2025-01-15T15:06:00Z'),
  ]);
  assert.equal(g.length, 1);
  const p = g[0];
  assert.equal(p.side, 'long'); assert.equal(p.quantity, 2); assert.equal(p.avgEntry, 20995); assert.equal(p.avgExit, 21015);
  assert.equal(p.grossPnl, 800); assert.equal(p.fees, 4); assert.equal(p.netPnl, 796); assert.equal(p.confidence, 'high');
  assert.equal(p.addedWhileAgainst.length, 1);
});

test('groupFills: reversal fill is split, two positions, medium confidence; open remainder stays open', () => {
  const g = groupFills([
    fill('1', 'buy', 2, 21000, '2025-01-15T15:00:00Z'), fill('2', 'sell', 3, 21010, '2025-01-15T15:05:00Z'),
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].status, 'closed'); assert.equal(g[0].grossPnl, 400); assert.equal(g[0].confidence, 'medium');
  assert.equal(g[1].side, 'short'); assert.equal(g[1].status, 'open'); assert.equal(g[1].netPnl, null);
});

// ── Analytics ───────────────────────────────────────────────
const lt = (id: string, net: number | null, extra: Partial<LedgerTrade> = {}): LedgerTrade => ({
  id, accountId: 'a', accountName: 'A', symbol: 'NQ', instrumentRoot: 'NQ', side: 'long', quantity: 1, status: 'closed',
  entryTime: '2025-01-15T15:00:00Z', exitTime: '2025-01-15T15:10:00Z', netPnl: net, netSource: 'source_reported', grossPnl: net, fees: 0,
  initialRiskUsd: null, initialRiskSource: null, setup: null, pnlMismatch: null, currency: 'USD', isDemo: false, timestampsHadOffset: true, ...extra,
});
test('analytics formulas: win rate excludes BE, profit factor, expectancy, avg R only with initial risk', () => {
  const a = computeAnalytics([lt('1', 300, { initialRiskUsd: 150 }), lt('2', -100, { initialRiskUsd: 100 }), lt('3', 0), lt('4', 200), lt('5', null, { status: 'open', exitTime: null })]);
  const m = Object.fromEntries(a.metrics.map((x) => [x.key, x]));
  assert.equal(m.net_pnl.value, 400); assert.equal(m.win_rate.value, 66.67); assert.equal(m.win_rate.sample, 3);
  assert.equal(m.win_rate_incl_be.value, 50); assert.equal(m.profit_factor.value, 5); assert.equal(m.expectancy.value, 100);
  assert.equal(m.avg_r.value, 0.5); assert.equal(m.avg_r.sample, 2);
  assert.ok(a.notices.some((n) => n.code === 'small_sample')); assert.ok(a.notices.some((n) => n.code === 'open_positions'));
  assert.ok(a.groups.symbol[0].sufficient === false);
});
test('analytics: no losers → profit factor not available; peak-to-trough labelled as not an official drawdown', () => {
  const a = computeAnalytics([lt('1', 100, { exitTime: '2025-01-15T15:10:00Z' }), lt('2', 50, { exitTime: '2025-01-15T15:20:00Z' })]);
  const pf = a.metrics.find((x) => x.key === 'profit_factor')!;
  assert.equal(pf.value, null); assert.ok(pf.note!.includes('no losing'));
  const b = computeAnalytics([lt('1', 100, { exitTime: '2025-01-15T15:10:00Z' }), lt('2', -150, { exitTime: '2025-01-15T15:20:00Z' }), lt('3', 30, { exitTime: '2025-01-15T15:30:00Z' })]);
  assert.equal(b.peakToTrough.value, -150); assert.ok(b.peakToTrough.label.includes('not an official'));
});

// ── Reconciliation ──────────────────────────────────────────
test('TradeZella snapshot: counts and side totals reconcile; avg×count does not — shown as mismatch', () => {
  const c = Object.fromEntries(snapshotInternalChecks(TZ.metrics).map((x) => [x.key, x]));
  assert.equal(c.count_sum.status, 'match');
  assert.equal(c.win_rate.status, 'match');
  assert.equal(c.side_net_sum.status, 'match');
  assert.equal(c.side_count_sum.status, 'match');
  assert.equal(c.avg_x_count.status, 'mismatch');
  assert.equal(c.avg_x_count.computed, 18607.05);
  assert.equal(c.avg_x_count.diff, 850.68);
  assert.equal(c.symbol_count_gap.computed, 490);
});

// ── Planner ─────────────────────────────────────────────────
test('planner: unknown rules → UNKNOWN eligibility; static floor + buffer; consistency; video numbers are suggestions', () => {
  const trades = [{ exitTime: '2025-02-03T16:00:00Z', netPnl: 800, status: 'closed' }, { exitTime: '2025-02-04T16:00:00Z', netPnl: 300, status: 'closed' }, { exitTime: '2025-02-05T16:00:00Z', netPnl: -100, status: 'closed' }];
  const none = planAccount({ phase: 'funded_pre_payout', startingBalance: 50000, rules: {}, trades, payouts: [] });
  assert.equal(none.eligibility, 'UNKNOWN'); assert.equal(none.floor.value, null);
  assert.equal(none.riskSuggestion!.min, 250); assert.ok(none.riskSuggestion!.source.includes('not a firm rule'));
  const p = planAccount({ phase: 'funded_pre_payout', startingBalance: 50000, rules: { drawdownModel: 'static', maxDrawdownUsd: 2000, consistencyMaxDayPct: 50, minProfitableDays: 2, minProfitPerDayUsd: 200, maxPayoutPctOfProfit: 100, minBufferAboveFloorUsd: 500 },
    trades, payouts: [{ kind: 'submitted', amount: 300, date: '2025-02-06' }] });
  assert.equal(p.equity.value, 51000); assert.equal(p.floor.value, 48000); assert.equal(p.buffer.value, 3000);
  const c = Object.fromEntries(p.checks.map((x) => [x.key, x.status]));
  assert.equal(c.profitable_days, 'pass'); assert.equal(c.consistency, 'fail'); // 800 / 1000 = 80% > 50%
  assert.equal(p.eligibility, 'NOT_ELIGIBLE');
  assert.equal(p.payouts.submitted, 300); assert.equal(p.payouts.received, 0);
  const t = planAccount({ phase: 'funded_post_payout', startingBalance: 50000, rules: { drawdownModel: 'trailing_eod', maxDrawdownUsd: 2000, trailingStopsAtStart: true }, trades, payouts: [] });
  assert.equal(t.floor.value, 49100); // EOD peak 51100 − 2000
  assert.equal(planAccount({ phase: 'challenge', startingBalance: 50000, rules: { drawdownModel: 'trailing_intraday', maxDrawdownUsd: 2000 }, trades, payouts: [] }).floor.value, null);
});

// ── Behavior ────────────────────────────────────────────────
test('behavior: quick re-entry after loss is an observation with evidence, never "revenge" without the trader\'s words', () => {
  const b = (id: string, entry: string, exit: string, net: number, qty = 1, notes: string | null = null) => ({ id, accountId: 'a', symbol: 'NQ', side: 'long' as const, quantity: qty, entryTime: entry, exitTime: exit, netPnl: net, initialRiskUsd: null, notes });
  const r = detectBehavior([
    b('1', '2025-01-15T15:00:00Z', '2025-01-15T15:10:00Z', -200),
    b('2', '2025-01-15T15:13:00Z', '2025-01-15T15:20:00Z', -100, 3),
  ], ['ny_am']);
  const q = r.findings.find((f) => f.pattern === 'quick_reentry_after_loss')!;
  assert.deepEqual(q.evidence.map((e) => e.tradeId), ['2']);
  assert.ok(!r.findings.some((f) => f.pattern === 'self_reported_revenge'));
  assert.ok(r.findings.some((f) => f.pattern === 'size_up_after_loss'));
  const r2 = detectBehavior([b('9', '2025-01-15T15:00:00Z', '2025-01-15T15:10:00Z', -50, 1, 'كانت صفقة انتقامية')], ['ny_am']);
  assert.equal(r2.findings.find((f) => f.pattern === 'self_reported_revenge')!.evidence[0].tradeId, '9');
  assert.ok(r.notAssessed.some((n) => n.pattern === 'trading_during_news'));
});
