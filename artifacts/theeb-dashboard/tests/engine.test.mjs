import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../public/engine.js');
const DEMO = require('../public/demo.js');

// Tue 2026-10-06 09:30 ET (inside NY AM kill zone)
const NOW = Date.parse('2026-10-06T13:30:00Z');
const RECENT = '2026-10-02';

const ctxOf = (cot, seas, vix) => E.buildContext(E.analyzeCOT(cot, NOW), E.analyzeSeasonality(seas), E.analyzeVIX(vix));
const seas = (sign) => ({ month: 'October', y10: { avg: sign * 1.5, winRate: sign > 0 ? 0.7 : 0.3, n: 10 }, y5: { avg: sign * 2, winRate: sign > 0 ? 0.8 : 0.2, n: 5 }, y2: { avg: sign, winRate: sign > 0 ? 1 : 0, n: 2 } });
const run = (key, user) => E.runPipeline(DEMO.scenario(key, NOW), Object.assign({ instrument: 'MNQ', trades: [], userReady: true, sessionOverride: DEMO.SESSION }, user), NOW);

describe('Market context — COT / Seasonality / VIX', () => {
    test('COT index drives bias', () => {
        assert.equal(E.analyzeCOT({ net: 1, change: 1, index: 75, reportDate: RECENT }, NOW).bias, 'BULLISH');
        assert.equal(E.analyzeCOT({ net: 1, change: 1, index: 25, reportDate: RECENT }, NOW).bias, 'BEARISH');
        assert.equal(E.analyzeCOT({ net: 1, change: 1, index: 50, reportDate: RECENT }, NOW).bias, 'NEUTRAL');
    });
    test('COT without index falls back to net + weekly change agreement', () => {
        assert.equal(E.analyzeCOT({ net: 5000, change: 300, index: null, reportDate: RECENT }, NOW).bias, 'BULLISH');
        assert.equal(E.analyzeCOT({ net: 5000, change: -300, index: null, reportDate: RECENT }, NOW).bias, 'NEUTRAL');
    });
    test('missing or stale COT → UNAVAILABLE (no guessing)', () => {
        assert.equal(E.analyzeCOT(null, NOW).status, 'UNAVAILABLE');
        assert.equal(E.analyzeCOT({ net: 1, change: 1, index: 90, reportDate: '2026-08-01' }, NOW).status, 'UNAVAILABLE');
    });
    test('seasonality majority of 10Y/5Y/2Y', () => {
        assert.equal(E.analyzeSeasonality(seas(1)).bias, 'BULLISH');
        assert.equal(E.analyzeSeasonality(seas(-1)).bias, 'BEARISH');
        const mixed = seas(1); mixed.y5 = { avg: -1, winRate: 0.2, n: 5 }; mixed.y2 = { avg: 0.1, winRate: 0.5, n: 2 };
        assert.equal(E.analyzeSeasonality(mixed).bias, 'NEUTRAL');
        assert.equal(E.analyzeSeasonality({ y10: null, y5: null, y2: { avg: 1, winRate: 1, n: 2 } }).status, 'UNAVAILABLE');
    });
    test('VIX states LOW / NORMAL / HIGH / UNAVAILABLE', () => {
        assert.equal(E.analyzeVIX({ value: 12 }).state, 'LOW');
        assert.equal(E.analyzeVIX({ value: 20 }).state, 'NORMAL');
        assert.equal(E.analyzeVIX({ value: 31 }).state, 'HIGH');
        assert.equal(E.analyzeVIX(null).status, 'UNAVAILABLE');
    });
    test('context combinations; VIX never flips direction', () => {
        const cotBull = { net: 1, change: 1, index: 80, reportDate: RECENT };
        const cotBear = { net: -1, change: -1, index: 20, reportDate: RECENT };
        assert.equal(ctxOf(cotBull, seas(1), { value: 12 }).bias, 'BULLISH');
        assert.equal(ctxOf(cotBull, seas(1), { value: 45 }).bias, 'BULLISH');
        assert.equal(ctxOf(cotBear, seas(-1), { value: 45 }).bias, 'BEARISH');
        assert.equal(ctxOf(cotBull, seas(-1), { value: 15 }).bias, 'NEUTRAL'); // conflict
        assert.equal(ctxOf(null, null, { value: 15 }).bias, 'UNAVAILABLE');
        const partial = ctxOf(cotBull, null, null);
        assert.equal(partial.bias, 'BULLISH');
        assert.equal(partial.partial, true);
    });
});

describe('Market structure & TRIL', () => {
    test('demo long bars → bullish 15m structure with raid, FVG, discount', () => {
        const r = run('long');
        assert.equal(r.s15.status, 'OK');
        assert.equal(r.s15.bias, 'BULLISH');
        assert.equal(r.e5.confirmation, 'CONFIRMED');
        assert.equal(r.tril.status, 'PASS');
        assert.equal(r.tril.passCount, 4);
    });
    test('mirrored bars → bearish structure', () => {
        const r = run('short');
        assert.equal(r.s15.bias, 'BEARISH');
        assert.equal(r.tril.status, 'PASS');
    });
    test('too few bars → UNAVAILABLE', () => {
        assert.equal(E.analyzeStructure15([{ o: 1, h: 2, l: 0, c: 1 }]).status, 'UNAVAILABLE');
        assert.equal(E.analyzeStructure15(null).status, 'UNAVAILABLE');
    });
    test('TRIL FAIL when trend opposes context', () => {
        const r = run('tril');
        assert.equal(r.tril.items.trend.status, 'FAIL');
        assert.equal(r.tril.status, 'FAIL');
    });
    test('TRIL UNCLEAR when context is neutral', () => {
        const d = DEMO.scenario('long', NOW);
        d.cot.index = 50;
        const r = E.runPipeline(d, { instrument: 'MNQ', trades: [], sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.tril.items.trend.status, 'UNCLEAR');
        assert.equal(r.tril.status, 'UNCLEAR');
    });
    test('manual overrides win over AUTO', () => {
        const r = run('long', { trilOverrides: { raid: 'FAIL' } });
        assert.equal(r.tril.items.raid.status, 'FAIL');
        assert.equal(r.tril.items.raid.source, 'MANUAL');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.ok(r.decision.reasons.some((x) => x.code === 'TRIL FAIL'));
    });
    test('FVG + swing detection primitives', () => {
        const bars = [{ o: 1, h: 2, l: 0, c: 2 }, { o: 2, h: 6, l: 2, c: 6 }, { o: 6, h: 8, l: 4, c: 7 }];
        const f = E.findFVGs(bars, 10);
        assert.equal(f.length, 1);
        assert.deepEqual([f[0].dir, f[0].lo, f[0].hi], ['UP', 2, 4]);
    });
});

describe('News filter', () => {
    const at = (min) => new Date(NOW + min * 60000).toISOString();
    test('HIGH event within 30 min → HIGH IMPACT with restriction', () => {
        const n = E.analyzeNews({ events: [{ title: 'CPI m/m', country: 'USD', impact: 'High', time: at(18) }] }, NOW);
        assert.equal(n.status, 'HIGH IMPACT');
        assert.equal(n.trading_restriction, true);
        assert.equal(n.time_to_event, '18m');
    });
    test('HIGH event 10 min ago still blocks; 20 min ago does not', () => {
        assert.equal(E.analyzeNews({ events: [{ title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', time: at(-10) }] }, NOW).status, 'HIGH IMPACT');
        assert.equal(E.analyzeNews({ events: [{ title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', time: at(-20) }] }, NOW).status, 'LOW');
    });
    test('HIGH within 2h → CAUTION, no restriction', () => {
        const n = E.analyzeNews({ events: [{ title: 'FOMC Statement', country: 'USD', impact: 'High', time: at(90) }] }, NOW);
        assert.equal(n.status, 'CAUTION');
        assert.equal(n.trading_restriction, false);
    });
    test('keyword upgrade: Powell speech counts as HIGH even if feed says Medium', () => {
        assert.equal(E.classifyEventImpact({ title: 'Fed Chair Powell Speaks', impact: 'Medium' }), 'HIGH');
        assert.equal(E.classifyEventImpact({ title: 'Core PCE Price Index m/m', impact: 'Medium' }), 'HIGH');
    });
    test('non-USD events ignored → CLEAR', () => {
        const n = E.analyzeNews({ events: [{ title: 'ECB Rate Decision', country: 'EUR', impact: 'High', time: at(5) }] }, NOW);
        assert.equal(n.status, 'LOW');
        assert.equal(n.trading_restriction, false);
    });
    test('feed unavailable → UNAVAILABLE, never invents events', () => {
        const n = E.analyzeNews(null, NOW);
        assert.equal(n.status, 'UNAVAILABLE');
        assert.equal(n.event, null);
    });
});

describe('Risk engine (deterministic)', () => {
    test('MNQ: $2/pt, $500 cap, floor contracts', () => {
        const r = E.computeRisk({ direction: 'LONG', entry: 20000, sl: 19980, tp: 20060, instrument: 'MNQ' });
        assert.equal(r.status, 'PASS');
        assert.equal(r.rrr, 3);
        assert.equal(r.contracts, 12); // 500 / (20 × 2) = 12.5
        assert.equal(r.riskUsd, 480);
        assert.equal(r.rewardUsd, 1440);
    });
    test('NQ: $20/pt', () => {
        const r = E.computeRisk({ direction: 'SHORT', entry: 20000, sl: 20010, tp: 19970, instrument: 'NQ' });
        assert.equal(r.contracts, 2); // 500 / 200
        assert.equal(r.riskUsd, 400);
        assert.equal(r.status, 'PASS');
    });
    test('exact 1:2.5 passes, 1:2.4 fails', () => {
        assert.equal(E.computeRisk({ direction: 'LONG', entry: 100, sl: 90, tp: 125, instrument: 'MNQ' }).status, 'PASS');
        const f = E.computeRisk({ direction: 'LONG', entry: 100, sl: 90, tp: 124, instrument: 'MNQ' });
        assert.equal(f.status, 'FAIL');
        assert.match(f.reasons[0], /RRR/);
    });
    test('stop too wide → 0 contracts → FAIL', () => {
        const r = E.computeRisk({ direction: 'LONG', entry: 20000, sl: 19970, tp: 20100, instrument: 'NQ' }); // $600/ct
        assert.equal(r.contracts, 0);
        assert.equal(r.status, 'FAIL');
    });
    test('wrong-side levels and missing values fail', () => {
        assert.equal(E.computeRisk({ direction: 'LONG', entry: 100, sl: 110, tp: 130, instrument: 'MNQ' }).status, 'FAIL');
        assert.equal(E.computeRisk({ direction: 'SHORT', entry: 100, sl: null, tp: 80, instrument: 'MNQ' }).status, 'FAIL');
        assert.equal(E.computeRisk({ direction: null, entry: 100, sl: 90, tp: 130, instrument: 'MNQ' }).status, 'N/A');
    });
    test('risk shrinks to the remaining daily loss allowance', () => {
        const r = E.computeRisk({ direction: 'LONG', entry: 20000, sl: 19980, tp: 20060, instrument: 'MNQ', remainingLoss: 100 });
        assert.equal(r.contracts, 2);
        assert.ok(r.riskUsd <= 100);
    });
    test('1% of a smaller balance limits risk below $500', () => {
        const r = E.computeRisk({ direction: 'LONG', entry: 20000, sl: 19990, tp: 20030, instrument: 'MNQ', rules: { balance: 20000 } });
        assert.equal(r.riskBudget, 200);
        assert.equal(r.contracts, 10);
    });
});

describe('Trading state & session', () => {
    const inKZ = { marketOpen: true, inKillZone: true, killZone: 'NY AM KZ' };
    const t = (minAgo, pnl) => ({ createdAt: new Date(NOW - minAgo * 60000).toISOString(), pnlUsd: pnl, symbol: 'MNQ' });
    test('READY by default inside a kill zone', () => {
        assert.equal(E.computeTradingState({ trades: [], now: NOW, session: inKZ }).status, 'READY');
    });
    test('two consecutive losses', () => {
        const s = E.computeTradingState({ trades: [t(60, -100), t(30, -150)], now: NOW, session: inKZ });
        assert.equal(s.status, 'NOT READY');
        assert.ok(s.reasons.includes('Two consecutive losses'));
    });
    test('daily loss limit', () => {
        const s = E.computeTradingState({ trades: [t(30, -600)], now: NOW, session: inKZ });
        assert.ok(s.reasons.includes('Daily loss limit reached'));
    });
    test('max trades / day', () => {
        const s = E.computeTradingState({ trades: [t(60, 300), t(30, 200)], now: NOW, session: inKZ });
        assert.ok(s.reasons.some((x) => x.startsWith('Max trades reached')));
    });
    test('yesterday trades do not count', () => {
        const s = E.computeTradingState({ trades: [t(60 * 26, -600), t(60 * 25, -600)], now: NOW, session: inKZ });
        assert.equal(s.status, 'READY');
    });
    test('legacy journal entries (exit price, points) use contract point value', () => {
        const legacy = { dateTime: new Date(NOW - 3600000).toISOString(), symbol: 'NQ', direction: 'LONG', entryPrice: 20000, exitPrice: 19970 };
        const s = E.computeTradingState({ trades: [legacy], now: NOW, session: inKZ });
        assert.equal(s.pnlToday, -600);
        assert.ok(s.reasons.includes('Daily loss limit reached'));
    });
    test('outside session / market closed / user not ready', () => {
        assert.ok(E.computeTradingState({ trades: [], now: NOW, session: { marketOpen: true, inKillZone: false } }).reasons.includes('Outside session'));
        assert.ok(E.computeTradingState({ trades: [], now: NOW, session: { marketOpen: false } }).reasons.includes('Market closed'));
        assert.ok(E.computeTradingState({ trades: [], now: NOW, session: inKZ, userReady: false }).reasons.includes('User not ready'));
        const off = E.computeTradingState({ trades: [], now: NOW, session: { marketOpen: true, inKillZone: false }, rules: { requireKillZone: false } });
        assert.equal(off.status, 'READY');
    });
    test('kill zones follow New York time incl. DST', () => {
        assert.equal(E.getSession(Date.parse('2026-10-06T13:30:00Z')).killZone, 'NY AM KZ'); // 09:30 EDT
        assert.equal(E.getSession(Date.parse('2026-12-08T14:30:00Z')).killZone, 'NY AM KZ'); // 09:30 EST
        assert.equal(E.getSession(Date.parse('2026-10-06T16:00:00Z')).inKillZone, false);  // 12:00 ET
        assert.equal(E.getSession(Date.parse('2026-10-10T15:00:00Z')).marketOpen, false);  // Saturday
        assert.equal(E.getSession(Date.parse('2026-10-11T23:00:00Z')).marketOpen, true);   // Sunday 19:00 ET
    });
});

describe('Decision engine', () => {
    test('LONG candidate when everything aligns', () => {
        const r = run('long');
        assert.equal(r.decision.decision, 'LONG');
        assert.equal(r.decision.candidate, true);
        assert.equal(r.risk.status, 'PASS');
        assert.ok(r.risk.rrr >= 2.5);
        assert.ok(r.decision.confidence.value >= 75 && r.decision.confidence.value <= 95);
    });
    test('SHORT candidate', () => {
        const r = run('short');
        assert.equal(r.decision.decision, 'SHORT');
        assert.equal(r.agents.analyst.bias, 'SHORT');
    });
    test('NEWS HIGH IMPACT blocks an otherwise valid long', () => {
        const r = run('news');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'NEWS HIGH IMPACT');
        assert.equal(r.agents.news.trading_restriction, true);
        assert.equal(r.decision.bias, 'LONG BIAS'); // bias still reported
    });
    test('News CAUTION keeps the candidate but lowers confidence', () => {
        const clear = run('long'), caution = run('caution');
        assert.equal(caution.decision.decision, 'LONG');
        assert.ok(caution.decision.warnings.some((w) => w.startsWith('News caution')));
        assert.ok(caution.decision.confidence.value < clear.decision.confidence.value);
    });
    test('context conflict / TRIL fail → NO TRADE', () => {
        const r = run('tril');
        assert.equal(r.decision.decision, 'NO TRADE');
        const codes = r.decision.reasons.map((x) => x.code);
        assert.ok(codes.includes('CONTEXT CONFLICT'));
        assert.ok(codes.includes('TRIL FAIL'));
    });
    test('RISK FAIL → NO TRADE', () => {
        const r = run('long', { levels: { entry: 20183.25, sl: 20089.5, tp: 20250 } });
        assert.equal(r.risk.status, 'FAIL');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.ok(r.decision.reasons.some((x) => x.code === 'RISK FAIL'));
    });
    test('Trading state NOT READY → NO TRADE', () => {
        const r = run('long', { userReady: false });
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'TRADING STATE: NOT READY');
    });
    test('all data missing → NO TRADE / DATA UNAVAILABLE / confidence N/A', () => {
        const r = E.runPipeline({ cot: null, seasonality: null, vix: null, bars15: null, bars5: null, news: null }, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'DATA UNAVAILABLE');
        assert.equal(r.decision.confidence.value, null);
        assert.equal(r.decision.confidence.label, 'N/A');
        assert.equal(r.agents.analyst.confidence, null);
        assert.equal(r.agents.news.status, 'UNAVAILABLE');
    });
    test('price data present but context missing → NO TRADE (DATA UNAVAILABLE)', () => {
        const d = DEMO.scenario('long', NOW);
        d.cot = null; d.seasonality = null;
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.ok(r.decision.reasons.some((x) => x.code === 'DATA UNAVAILABLE'));
    });
    test('confidence is deterministic (same input → same output)', () => {
        assert.deepEqual(run('long').decision.confidence, run('long').decision.confidence);
    });
    test('structured agent outputs have the documented shape', () => {
        const r = run('news');
        assert.deepEqual(Object.keys(r.agents.analyst), ['agent', 'context', 'structure', 'tril', 'bias', 'confidence', 'reason']);
        assert.deepEqual(Object.keys(r.agents.news), ['agent', 'status', 'event', 'impact', 'time_to_event', 'trading_restriction']);
        assert.ok(!('bias' in r.agents.news)); // the news agent never gives a direction
    });
});
