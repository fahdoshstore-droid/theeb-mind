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
const w = (ch) => ({ averageChange: ch, seasonalBias: ch > 0.25 ? 'BULLISH' : ch < -0.25 ? 'BEARISH' : 'NEUTRAL' });
const seas = (sign) => ({ status: 'OK', currentMonth: 'October', y10: w(sign * 1.5), y5: w(sign * 2), y2: w(sign) });
const COT = (o) => Object.assign({ status: 'OK', reportDate: RECENT, largeSpecNet: 1000, weeklyChange: 100, cotIndex6m: null, cotIndex36m: null }, o);
const run = (key, user) => E.runPipeline(DEMO.scenario(key, NOW), Object.assign({ instrument: 'MNQ', trades: [], userReady: true, sessionOverride: DEMO.SESSION }, user), NOW);

describe('Market context — COT / Seasonality / VIX', () => {
    test('COT index drives bias', () => {
        assert.equal(E.analyzeCOT(COT({ cotIndex36m: 75 }), NOW).bias, 'BULLISH');
        assert.equal(E.analyzeCOT(COT({ cotIndex36m: 25 }), NOW).bias, 'BEARISH');
        assert.equal(E.analyzeCOT(COT({ cotIndex36m: 50 }), NOW).bias, 'NEUTRAL');
        assert.equal(E.analyzeCOT(COT({ cotIndex6m: 80 }), NOW).bias, 'BULLISH'); // 6M used when 36M missing
    });
    test('COT without index falls back to net + weekly change agreement', () => {
        assert.equal(E.analyzeCOT(COT({ largeSpecNet: 5000, weeklyChange: 300 }), NOW).bias, 'BULLISH');
        assert.equal(E.analyzeCOT(COT({ largeSpecNet: 5000, weeklyChange: -300 }), NOW).bias, 'NEUTRAL');
    });
    test('missing or stale COT → UNAVAILABLE (no guessing)', () => {
        assert.equal(E.analyzeCOT(null, NOW).status, 'UNAVAILABLE');
        assert.equal(E.analyzeCOT({ status: 'DATA_UNAVAILABLE' }, NOW).status, 'UNAVAILABLE');
        assert.equal(E.analyzeCOT(COT({ cotIndex36m: 90, reportDate: '2026-08-01' }), NOW).status, 'UNAVAILABLE');
    });
    test('seasonality majority of 10Y/5Y/2Y', () => {
        assert.equal(E.analyzeSeasonality(seas(1)).bias, 'BULLISH');
        assert.equal(E.analyzeSeasonality(seas(-1)).bias, 'BEARISH');
        const mixed = seas(1); mixed.y5 = w(-1); mixed.y2 = w(0.1);
        assert.equal(E.analyzeSeasonality(mixed).bias, 'NEUTRAL');
        assert.equal(E.analyzeSeasonality({ status: 'OK', y10: null, y5: null, y2: w(1) }).status, 'UNAVAILABLE');
        assert.equal(E.analyzeSeasonality({ status: 'DATA_UNAVAILABLE' }).status, 'UNAVAILABLE');
    });
    test('VIX states LOW / NORMAL / HIGH / UNAVAILABLE', () => {
        assert.equal(E.analyzeVIX({ status: 'OK', value: 12 }).state, 'LOW');
        assert.equal(E.analyzeVIX({ status: 'OK', value: 20 }).state, 'NORMAL');
        assert.equal(E.analyzeVIX({ status: 'OK', value: 31 }).state, 'HIGH');
        assert.equal(E.analyzeVIX(null).status, 'UNAVAILABLE');
        assert.equal(E.analyzeVIX({ status: 'DATA_UNAVAILABLE', value: null }).status, 'UNAVAILABLE');
    });
    test('context combinations; VIX never flips direction', () => {
        const cotBull = COT({ cotIndex36m: 80 });
        const cotBear = COT({ largeSpecNet: -1, weeklyChange: -1, cotIndex36m: 20 });
        const vix = (v) => ({ status: 'OK', value: v });
        assert.equal(ctxOf(cotBull, seas(1), vix(12)).bias, 'BULLISH');
        assert.equal(ctxOf(cotBull, seas(1), vix(45)).bias, 'BULLISH');
        assert.equal(ctxOf(cotBear, seas(-1), vix(45)).bias, 'BEARISH');
        assert.equal(ctxOf(cotBull, seas(-1), vix(15)).bias, 'NEUTRAL'); // conflict
        assert.equal(ctxOf(null, null, vix(15)).bias, 'UNAVAILABLE'); // never NEUTRAL
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
        assert.equal(r.tril.ready, 'READY');
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
        const d = DEMO.scenario('long', NOW);
        d.cot.cotIndex36m = 20; d.seasonality = seas(-1);
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.tril.items.trend.status, 'FAIL');
        assert.equal(r.tril.status, 'FAIL');
        assert.equal(r.tril.ready, 'NOT READY');
        assert.ok(r.decision.reasons.some((x) => x.code === 'CONTEXT CONFLICT'));
    });
    test('TRIL FAIL when no raid (scenario tril_fail)', () => {
        const r = run('tril_fail');
        assert.equal(r.tril.items.raid.status, 'FAIL');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.ok(r.decision.reasons.some((x) => x.code === 'TRIL FAIL'));
    });
    test('TRIL UNCLEAR when context is neutral', () => {
        const d = DEMO.scenario('long', NOW);
        d.cot.cotIndex36m = 50;
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
        assert.equal(n.tradingRestriction, true);
        assert.equal(n.timeToEvent, '18m');
    });
    test('HIGH event 10 min ago still blocks; 20 min ago does not', () => {
        assert.equal(E.analyzeNews({ events: [{ title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', time: at(-10) }] }, NOW).status, 'HIGH IMPACT');
        assert.equal(E.analyzeNews({ events: [{ title: 'Non-Farm Employment Change', country: 'USD', impact: 'High', time: at(-20) }] }, NOW).status, 'CLEAR');
    });
    test('HIGH within 2h → CAUTION, no restriction', () => {
        const n = E.analyzeNews({ events: [{ title: 'FOMC Statement', country: 'USD', impact: 'High', time: at(90) }] }, NOW);
        assert.equal(n.status, 'CAUTION');
        assert.equal(n.tradingRestriction, false);
    });
    test('keyword upgrade: Powell speech counts as HIGH even if feed says Medium', () => {
        assert.equal(E.classifyEventImpact({ title: 'Fed Chair Powell Speaks', impact: 'Medium' }), 'HIGH');
        assert.equal(E.classifyEventImpact({ title: 'Core PCE Price Index m/m', impact: 'Medium' }), 'HIGH');
    });
    test('non-USD events ignored → CLEAR', () => {
        const n = E.analyzeNews({ events: [{ title: 'ECB Rate Decision', country: 'EUR', impact: 'High', time: at(5) }] }, NOW);
        assert.equal(n.status, 'CLEAR');
        assert.equal(n.tradingRestriction, false);
    });
    test('feed unavailable → UNAVAILABLE, never invents events', () => {
        const n = E.analyzeNews(null, NOW);
        assert.equal(n.status, 'UNAVAILABLE');
        assert.equal(E.analyzeNews({ status: 'DATA_UNAVAILABLE', events: null }, NOW).status, 'UNAVAILABLE');
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

describe('Data freshness & source selection (NQ → NAS100 proxy)', () => {
    const bars = (lastStart, n = 40, tf = 15) => Array.from({ length: n }, (_, i) => ({ t: lastStart - (n - 1 - i) * tf * 60000, o: 1, h: 2, l: 0, c: 1 }));
    test('FRESH / DELAYED / STALE / UNAVAILABLE', () => {
        assert.equal(E.computeFreshness(bars(NOW - 5 * 60000), 15, NOW, false).state, 'FRESH');   // bar still forming
        assert.equal(E.computeFreshness(bars(NOW - 16 * 60000), 15, NOW, false).state, 'FRESH');  // just closed
        assert.equal(E.computeFreshness(bars(NOW - 30 * 60000), 15, NOW, false).state, 'DELAYED');
        assert.equal(E.computeFreshness(bars(NOW - 5 * 60000), 15, NOW, true).state, 'DELAYED');  // delayed provider capped
        assert.equal(E.computeFreshness(bars(NOW - 3 * 3600000), 15, NOW, false).state, 'STALE');
        assert.equal(E.computeFreshness(null, 15, NOW, false).state, 'UNAVAILABLE');
        assert.equal(E.computeFreshness(bars(NOW, 10), 15, NOW, false).state, 'UNAVAILABLE'); // too few bars
    });
    test('9. NQ live (fresh) → NQ is the source', () => {
        const r = run('long');
        assert.equal(r.source.role, 'NQ');
        assert.equal(r.source.freshness, 'FRESH');
        assert.equal(r.agents.analyst.freshness, 'FRESH');
    });
    test('10. NQ delayed → still used, labelled DELAYED, confidence lowered', () => {
        const fresh = run('long'), r = run('nq_delayed');
        assert.equal(r.source.role, 'NQ');
        assert.equal(r.source.freshness, 'DELAYED');
        assert.equal(r.decision.decision, 'LONG');
        assert.ok(r.decision.warnings.some((x) => x.startsWith('DELAYED DATA')));
        assert.ok(r.decision.confidence.value < fresh.decision.confidence.value);
    });
    test('11. NQ unavailable + NAS100 fresh → NAS100 PROXY, clearly labelled', () => {
        const r = run('nas_proxy');
        assert.equal(r.source.role, 'NAS100_PROXY');
        assert.match(r.source.label, /^NAS100 PROXY/);
        assert.equal(r.levels.priceBasis, 'NAS100');
        assert.ok(r.decision.warnings.some((x) => /NAS100 PROXY/.test(x)));
        assert.match(r.smt.detail, /NAS100/);
        assert.match(r.decision.why, /NAS100 proxy/);
    });
    test('NQ delayed + NAS100 fresh → prefer the fresh proxy', () => {
        const d = DEMO.scenario('long', NOW);
        d.market.series.NQ.delayed = true;
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.source.role, 'NAS100_PROXY');
        assert.equal(r.source.candidates.NQ.f15.state, 'DELAYED');
    });
    test('12. NQ + NAS100 unavailable → NO TRADE, confidence N/A', () => {
        const r = run('no_data');
        assert.equal(r.source.status, 'UNAVAILABLE');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'DATA UNAVAILABLE');
        assert.equal(r.decision.confidence.value, null);
        assert.equal(r.agents.analyst.dataSource, 'UNAVAILABLE');
    });
    test('stale 5m is dropped (never mixed silently with fresh 15m)', () => {
        const d = DEMO.scenario('long', NOW);
        d.market.series.NQ.bars5 = d.market.series.NQ.bars5.map((b) => Object.assign({}, b, { t: b.t - 3 * 3600000 }));
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.source.role, 'NQ');
        assert.equal(r.source.bars5, null);
        assert.equal(r.e5.status, 'UNAVAILABLE');
        assert.ok(r.decision.warnings.some((x) => /5m STALE — not used/.test(x)));
    });
});

describe('SMT (confluence only)', () => {
    test('13. bullish SMT on a long (NQ took the low, S&P did not), 5m confirms', () => {
        const r = run('long');
        assert.equal(r.smt.confluence, 'BULLISH_CONFLUENCE');
        assert.equal(r.smt.tf, '15m');
        assert.equal(r.smt.confirmed5m, true);
        assert.equal(r.agents.analyst.smt, 'BULLISH_CONFLUENCE');
    });
    test('14. bearish SMT on a short', () => {
        const r = run('short');
        assert.equal(r.smt.confluence, 'BEARISH_CONFLUENCE');
        assert.match(r.smt.detail, /took the high/);
    });
    test('15. SMT NONE when S&P confirms — decision unchanged, lower confidence', () => {
        const r = run('smt_none'), base = run('long');
        assert.equal(r.smt.confluence, 'NONE');
        assert.equal(r.decision.decision, 'LONG');
        assert.ok(r.decision.confidence.value < base.decision.confidence.value);
    });
    test('16. SMT UNCLEAR when S&P data is unavailable — not a blocker', () => {
        const r = run('smt_unclear');
        assert.equal(r.smt.confluence, 'UNCLEAR');
        assert.match(r.smt.detail, /UNAVAILABLE/);
        assert.equal(r.decision.decision, 'LONG');
    });
    test('SMT alone never creates a trade', () => {
        const d = DEMO.scenario('long', NOW);
        d.cot.cotIndex36m = 50; d.seasonality = seas(0); // context neutral
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.smt.confluence, 'BULLISH_CONFLUENCE');
        assert.equal(r.decision.decision, 'NO TRADE');
    });
    test('misaligned timestamps → UNCLEAR', () => {
        const d = DEMO.scenario('long', NOW);
        d.market.series.SPX.bars15 = d.market.series.SPX.bars15.map((b) => Object.assign({}, b, { t: b.t + 7 * 60000 }));
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.smt.confluence, 'UNCLEAR');
    });
});

describe('Decision engine — scenarios', () => {
    test('1. LONG candidate when everything aligns', () => {
        const r = run('long');
        assert.equal(r.decision.decision, 'LONG');
        assert.equal(r.decision.candidate, true);
        assert.equal(r.risk.status, 'PASS');
        assert.ok(r.risk.rrr >= 2.5);
        assert.ok(r.decision.confidence.value >= 75 && r.decision.confidence.value <= 95);
        assert.match(r.decision.why, /SMT BULLISH_CONFLUENCE/);
    });
    test('2. SHORT candidate', () => {
        const r = run('short');
        assert.equal(r.decision.decision, 'SHORT');
        assert.equal(r.agents.analyst.bias, 'SHORT');
    });
    test('3/4. News HIGH IMPACT blocks an otherwise valid long', () => {
        const r = run('news_high');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'NEWS HIGH IMPACT');
        assert.equal(r.agents.news.tradingRestriction, true);
        assert.equal(r.decision.bias, 'LONG BIAS');
    });
    test('5. News CLEAR', () => {
        const r = run('long');
        assert.equal(r.news.status, 'CLEAR');
        assert.equal(r.agents.news.tradingRestriction, false);
    });
    test('6. COT unavailable → partial context, confidence lowered, shown as UNAVAILABLE', () => {
        const r = run('cot_off');
        assert.equal(r.context.cot.status, 'UNAVAILABLE');
        assert.equal(r.context.partial, true);
        assert.ok(r.decision.confidence.value < run('long').decision.confidence.value);
    });
    test('7. Seasonality unavailable', () => {
        const r = run('seas_off');
        assert.equal(r.context.seasonality.status, 'UNAVAILABLE');
        assert.equal(r.context.bias, 'BULLISH');
        assert.equal(r.context.partial, true);
    });
    test('8. VIX unavailable → context unaffected, VIX UNAVAILABLE', () => {
        const r = run('vix_off');
        assert.equal(r.context.vix.status, 'UNAVAILABLE');
        assert.equal(r.decision.decision, 'LONG');
    });
    test('19. RISK FAIL → NO TRADE', () => {
        const r = run('risk_fail');
        assert.equal(r.risk.status, 'FAIL');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.ok(r.decision.reasons.some((x) => x.code === 'RISK FAIL'));
    });
    test('manual bad levels → RISK FAIL', () => {
        const r = run('long', { levels: { entry: 20183.25, sl: 20089.5, tp: 20250 } });
        assert.equal(r.risk.status, 'FAIL');
        assert.equal(r.decision.decision, 'NO TRADE');
    });
    test('Trading state NOT READY → NO TRADE', () => {
        const r = run('long', { userReady: false });
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'TRADING STATE: NOT READY');
    });
    test('COT + seasonality both unavailable → NO TRADE, confidence N/A', () => {
        const d = DEMO.scenario('long', NOW);
        d.cot = { status: 'DATA_UNAVAILABLE' }; d.seasonality = { status: 'DATA_UNAVAILABLE' };
        const r = E.runPipeline(d, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.context.bias, 'UNAVAILABLE');
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.confidence.value, null);
    });
    test('everything missing → NO TRADE / DATA UNAVAILABLE', () => {
        const r = E.runPipeline({ cot: null, seasonality: null, vix: null, market: null, news: null }, { sessionOverride: DEMO.SESSION }, NOW);
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.reasons[0].code, 'DATA UNAVAILABLE');
        assert.equal(r.agents.news.status, 'UNAVAILABLE');
    });
    test('confidence: deterministic, 0–95, never 100', () => {
        for (const k of Object.keys(DEMO.SCENARIOS)) {
            const a = run(k).decision.confidence, b = run(k).decision.confidence;
            assert.deepEqual(a, b);
            if (a.value !== null) assert.ok(a.value >= 0 && a.value <= 95, k);
        }
    });
    test('structured agent outputs have the documented shape', () => {
        const r = run('news_high');
        assert.deepEqual(Object.keys(r.agents.analyst), ['agent', 'context', 'structure', 'tril', 'smt', 'bias', 'confidence', 'dataSource', 'freshness', 'reason']);
        assert.deepEqual(Object.keys(r.agents.news), ['agent', 'status', 'event', 'impact', 'timeToEvent', 'tradingRestriction']);
        assert.ok(!('bias' in r.agents.news));
    });
});
