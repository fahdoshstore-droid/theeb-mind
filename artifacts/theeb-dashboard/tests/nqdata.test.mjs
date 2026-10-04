import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as NQ from '../lib/nq-data.mjs';
import * as EDGE from '../lib/edge-stats.mjs';
import { currentTimeframes, neededTimeframes } from '../lib/timeframe-config.mjs';

const E = createRequire(import.meta.url)('../public/engine.js');
const dir = await mkdtemp(path.join(tmpdir(), 'theeb-nq-'));
after(() => rm(dir, { recursive: true, force: true }));

// Databento CSV layout (encoding=csv, pretty_px, pretty_ts, map_symbols) — FORMAT fixture for the parser
const DBN_CSV = `ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol
2026-12-17T14:30:00.000000000Z,33,1,42005347,21500.250000000,21510.000000000,21498.500000000,21505.750000000,812,NQZ6
2026-12-17T14:31:00.000000000Z,33,1,42005347,21505.750000000,21507.000000000,21490.000000000,21492.250000000,640,NQZ6
2026-12-17T14:32:00.000000000Z,33,1,42008913,21610.000000000,21612.500000000,21605.000000000,21611.000000000,233,NQH7
`;

describe('CSV / Databento ingestion', () => {
    test('Databento CSV → bars with nanosecond timestamps, prices, volume and real contract', () => {
        const r = NQ.parseOHLCCSV(DBN_CSV);
        assert.equal(r.bars.length, 3);
        assert.deepEqual(r.bars[0], { t: Date.parse('2026-12-17T14:30:00Z'), o: 21500.25, h: 21510, l: 21498.5, c: 21505.75, v: 812, contract: 'NQZ6' });
        assert.equal(r.bars[2].contract, 'NQH7');
        assert.equal(r.baseTf, '1m');
    });
    test('roll inside the data: two contract segments, resampled bucket flagged', () => {
        const { bars } = NQ.parseOHLCCSV(DBN_CSV);
        assert.equal(E.splitAtRolls(bars).length, 2);
        const [b5] = E.resampleBars(bars, '1m', '5m');
        assert.equal(b5.roll, true);
        assert.equal(b5.n, 3);
    });
    test('TradingView export (unix seconds, Volume) and epoch milliseconds', () => {
        const tv = NQ.parseOHLCCSV('time,open,high,low,close,Volume\n1790947800,1,2,0.5,1.5,10\n1790947860,1.5,2,1,1.75,4\n');
        assert.equal(tv.bars[0].t, 1790947800000);
        assert.equal(tv.bars[1].v, 4);
        const ms = NQ.parseOHLCCSV('timestamp,open,high,low,close\n1790947800000,1,2,0.5,1.5\n');
        assert.equal(ms.bars[0].t, 1790947800000);
    });
    test('split Date + Time columns in exchange time (America/Chicago, DST-aware)', () => {
        const csv = 'Date,Time,Open,High,Low,Close,Volume\n2026-07-01,08:30,1,2,0,1,5\n2026-12-01,08:30,1,2,0,1,5\n';
        const r = NQ.parseOHLCCSV(csv, { tz: 'America/Chicago' });
        assert.equal(new Date(r.bars[0].t).toISOString(), '2026-07-01T13:30:00.000Z'); // CDT = UTC-5
        assert.equal(new Date(r.bars[1].t).toISOString(), '2026-12-01T14:30:00.000Z'); // CST = UTC-6
    });
    test('invalid rows are dropped (never defaulted), duplicates removed', () => {
        const csv = 'timestamp,open,high,low,close\n2026-10-01T13:30:00Z,1,2,0,1\n2026-10-01T13:31:00Z,,2,0,1\n2026-10-01T13:32:00Z,1,0.5,2,1\n2026-10-01T13:30:00Z,1,3,0,2\nnot-a-date,1,2,0,1\n';
        const r = NQ.parseOHLCCSV(csv);
        assert.equal(r.bars.length, 1);
        assert.equal(r.bars[0].h, 3); // last duplicate wins
        assert.equal(r.dropped, 3);
        assert.equal(r.duplicates, 1);
    });
    test('missing required columns → clear error', () => {
        assert.throws(() => NQ.parseOHLCCSV('timestamp,price\n2026-10-01T13:30:00Z,1\n'), /required columns/);
    });
    test('native timeframe detection + deriving every supported higher timeframe', () => {
        const T0 = Date.parse('2026-10-05T13:00:00Z');
        const bars = Array.from({ length: 240 }, (_, i) => ({ t: T0 + i * 60000, o: 1, h: 2, l: 0, c: 1, v: 1 }));
        assert.equal(NQ.detectTimeframe(bars), '1m');
        const d = NQ.deriveTimeframes(bars, '1m');
        assert.deepEqual(Object.keys(d), ['1m', '5m', '15m', '30m', '1h']);
        assert.equal(d['1h'].length, 4);
        assert.equal(d['1h'][0].v, 60);
        assert.deepEqual(Object.keys(NQ.deriveTimeframes(d['5m'], '5m')), ['5m', '15m', '30m', '1h']); // 5m data cannot produce 1m
    });
    test('CSV file provider labels data as historical/delayed', async () => {
        const f = path.join(dir, 'nq.csv');
        await writeFile(f, DBN_CSV);
        const r = await NQ.loadCSVBars({ path: f });
        assert.equal(r.historical, true);
        assert.equal(r.delayed, true);
        assert.equal(r.baseTf, '1m');
        await assert.rejects(NQ.loadCSVBars({ env: {} }), /NQ_CSV_PATH not set/);
    });
});

describe('Databento provider (request contract)', () => {
    test('POST timeseries.get_range: GLBX.MDP3 · ohlcv-1m · NQ.c.0 continuous · CSV · Basic auth', async () => {
        let seen;
        NQ.setNqFetch(async (url, init) => { seen = { url, init }; return { ok: true, status: 200, text: async () => DBN_CSV }; });
        const r = await NQ.fetchDatabentoBars({ start: Date.parse('2026-12-17T14:00:00Z'), end: Date.parse('2026-12-17T15:00:00Z'), env: { DATABENTO_API_KEY: 'db-TEST' } });
        assert.equal(seen.url, 'https://hist.databento.com/v0/timeseries.get_range');
        assert.equal(seen.init.method, 'POST');
        assert.equal(seen.init.headers.Authorization, 'Basic ' + Buffer.from('db-TEST:').toString('base64'));
        const p = new URLSearchParams(seen.init.body.toString());
        for (const [k, v] of Object.entries({ dataset: 'GLBX.MDP3', schema: 'ohlcv-1m', symbols: 'NQ.c.0', stype_in: 'continuous', encoding: 'csv', map_symbols: 'true', pretty_px: 'true', pretty_ts: 'true' })) assert.equal(p.get(k), v, k);
        assert.equal(p.get('start'), '2026-12-17T14:00:00.000Z');
        assert.equal(r.bars.length, 3);
        assert.equal(r.provider, 'Databento (CME GLBX.MDP3)');
        assert.equal(r.delayed, true); // historical endpoint — never labelled real-time
    });
    test('HTTP errors are surfaced with status; missing key → NOT_CONFIGURED', async () => {
        NQ.setNqFetch(async () => ({ ok: false, status: 401, text: async () => '{"detail":"Authentication failed."}' }));
        await assert.rejects(NQ.fetchDatabentoBars({ env: { DATABENTO_API_KEY: 'bad' } }), /Databento HTTP 401: .*Authentication failed/);
        await assert.rejects(NQ.fetchDatabentoBars({ env: {} }), (e) => e.code === 'NOT_CONFIGURED');
        NQ.setNqFetch(async () => ({ ok: true, status: 200, text: async () => 'ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol\n' }));
        await assert.rejects(NQ.fetchDatabentoBars({ env: { DATABENTO_API_KEY: 'k' } }), /no data rows|no bars/);
        NQ.setNqFetch((...a) => fetch(...a));
    });
});

describe('Edge statistics', () => {
    test('Wilson 95% interval (7/10 → 0.397–0.892)', () => {
        const [lo, hi] = EDGE.wilson(7, 10);
        assert.ok(Math.abs(lo - 0.3968) < 0.001 && Math.abs(hi - 0.8922) < 0.001);
        assert.equal(EDGE.wilson(0, 0), null);
    });
    test('evidence classes: <10 insufficient · 10–29 weak · 30+ usable', () => {
        assert.equal(EDGE.evidenceClass(9), 'INSUFFICIENT');
        assert.equal(EDGE.evidenceClass(10), 'WEAK');
        assert.equal(EDGE.evidenceClass(29), 'WEAK');
        assert.equal(EDGE.evidenceClass(30), 'USABLE');
    });
    test('stats: win rate, expectancy, profit factor, LB95, periods, recent, yearly', () => {
        const R = [2.5, -1, -1, 2.5, -1, 3, -1, -1, 2.5, -1, 2.5, -1];
        const trades = R.map((r, i) => ({ t: Date.UTC(2025 + (i >= 8 ? 1 : 0), 0, 1 + i), r }));
        const s = EDGE.computeStats(trades);
        assert.equal(s.n, 12);
        assert.equal(s.wins, 5);
        assert.equal(s.winRate, 0.417);
        assert.equal(s.expectancy, 0.5);                // (13 − 7) / 12
        assert.equal(s.profitFactor, 1.857);            // 13 / 7
        assert.equal(s.periods.length, 4);
        assert.deepEqual(Object.keys(s.yearly), ['2025', '2026']);
        assert.ok(s.expectancyLB95 < s.expectancy);
        assert.equal(s.evidence, 'WEAK');
    });
    test('eligibility rejects small samples even with a great win rate', () => {
        const s = EDGE.computeStats(Array.from({ length: 12 }, (_, i) => ({ t: i, r: 2.5 })));
        assert.equal(s.winRate, 1);
        const el = EDGE.eligibility(s);
        assert.equal(el.eligible, false);
        assert.match(el.why[0], /n = 12/);
    });
    test('trade simulation: fill → TP, SL-first when both hit, TP-before-fill = no trade, no fill = no trade, time exit', () => {
        const b = (i, o, h, l, c) => ({ t: i * 60000, o, h, l, c });
        const opt = { fineMin: 1, execMin: 1, fillBars: 5, maxHoldHours: 1 };
        const plan = { direction: 'LONG', entry: 100, sl: 96, tp: 110 };
        assert.deepEqual(EDGE.simulateTrade([b(0, 101, 102, 100, 101), b(1, 101, 111, 101, 110)], 0, plan, opt).r, 2.5);
        assert.equal(EDGE.simulateTrade([b(0, 101, 102, 100, 101), b(1, 100, 112, 95, 100)], 0, plan, opt).r, -1);
        assert.equal(EDGE.simulateTrade([b(0, 105, 111, 104, 110)], 0, plan, opt), null);
        assert.equal(EDGE.simulateTrade([b(0, 105, 106, 104, 105), b(1, 105, 106, 104, 105)], 0, plan, opt), null);
        const timed = EDGE.simulateTrade([b(0, 101, 101, 100, 100), b(1, 100, 104, 99, 102)], 0, plan, opt);
        assert.equal(timed.exit, 'TIME');
        assert.equal(timed.r, 0.5);
    });
    test('no data → every config INSUFFICIENT, NO TIMEFRAME SELECTED', () => {
        const rep = EDGE.validateTimeframes([], '1m');
        assert.equal(rep.selection.status, 'INSUFFICIENT');
        assert.equal(rep.selection.detail, 'NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE');
        assert.ok(rep.results.every((r) => r.stats.n === 0 && !r.eligible));
    });
    test('5m base data cannot validate 1m configurations', () => {
        const rep = EDGE.validateTimeframes([], '5m');
        const r = rep.results.find((x) => x.structure === '15m' && x.execution === '1m');
        assert.equal(r.supported, false);
        assert.match(r.reason, /cannot build 1m/);
    });
    test('replay runs end-to-end on a (test-only) generated series without crossing rolls', () => {
        // Mechanical test of the replay loop. Generated values are NEVER used for selection or shipped.
        let seed = 7, p = 20000;
        const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        const T0 = Date.parse('2026-01-05T00:00:00Z');
        const bars = Array.from({ length: 6000 }, (_, i) => {
            const o = p; p += (rnd() - 0.5) * 12;
            return { t: T0 + i * 60000, o, h: Math.max(o, p) + rnd() * 4, l: Math.min(o, p) - rnd() * 4, c: p, v: 1, contract: i < 3000 ? 'NQH6' : 'NQM6' };
        });
        const rep = EDGE.validateTimeframes(bars, '1m', { configs: [['15m', '5m'], ['5m', '5m']] });
        assert.equal(rep.rolls, 1);
        assert.deepEqual(rep.data.contracts, ['NQH6', 'NQM6']);
        for (const r of rep.results) {
            assert.ok(r.supported);
            assert.ok(Number.isInteger(r.stats.n));
            assert.ok(['INSUFFICIENT', 'WEAK', 'USABLE'].includes(r.stats.evidence));
        }
    });
});

describe('Timeframe configuration for LIVE', () => {
    test('no validation report → NOT_RUN, nothing selected', async () => {
        const tf = await currentTimeframes({ THEEB_TF_VALIDATION_PATH: path.join(dir, 'missing.json') });
        assert.equal(tf.structure, null);
        assert.equal(tf.status, 'NOT_RUN');
        assert.match(tf.detail, /NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE/);
        assert.deepEqual(neededTimeframes(tf), []);
    });
    test('validated report → its selection; explicit choice is still gated by its own evidence', async () => {
        const stats = (n, lb) => ({ n, expectancy: 0.3, expectancyLB95: lb });
        const report = {
            generatedAt: '2026-10-04T00:00:00Z', data: null,
            selection: { status: 'VALIDATED', structure: '1h', execution: '15m', detail: 'x' },
            results: [
                { structure: '1h', execution: '15m', supported: true, eligible: true, stats: stats(64, 0.1), rejectedBecause: [] },
                { structure: '15m', execution: '5m', supported: true, eligible: false, stats: stats(14, -0.2), rejectedBecause: ['n = 14 (< 30)'] },
            ],
        };
        const f = path.join(dir, 'v.json');
        await writeFile(f, JSON.stringify(report));
        const a = await currentTimeframes({ THEEB_TF_VALIDATION_PATH: f });
        assert.deepEqual([a.structure, a.execution, a.status], ['1h', '15m', 'VALIDATED']);
        const b = await currentTimeframes({ THEEB_TF_VALIDATION_PATH: f, THEEB_TF_STRUCTURE: '15m', THEEB_TF_EXECUTION: '5m' });
        assert.deepEqual([b.structure, b.status], ['15m', 'INSUFFICIENT']);
        const c = await currentTimeframes({ THEEB_TF_VALIDATION_PATH: f, THEEB_TF_STRUCTURE: '30m', THEEB_TF_EXECUTION: '5m' });
        assert.equal(c.status, 'NOT_RUN');
    });
});

describe('Network failure attribution', () => {
    test('egress-proxy block is reported as BLOCKED, not as an answer from the source', async () => {
        const { httpError } = await import('../lib/sources.mjs');
        const hdr = (h) => ({ get: (k) => h[k.toLowerCase()] ?? null });
        assert.match(httpError({ status: 403, headers: hdr({ 'x-deny-reason': 'host_not_allowed' }) }, 'https://market-bulls.com/x'), /^BLOCKED by network egress proxy \(host_not_allowed\) — market-bulls\.com never reached/);
        assert.equal(httpError({ status: 403, headers: hdr({}) }, 'https://market-bulls.com/x'), 'HTTP 403 from market-bulls.com');
        NQ.setNqFetch(async () => ({ ok: false, status: 403, headers: hdr({ 'x-deny-reason': 'host_not_allowed' }), text: async () => 'Host not in allowlist' }));
        await assert.rejects(NQ.fetchDatabentoBars({ env: { DATABENTO_API_KEY: 'k' } }), /BLOCKED by network egress proxy/);
        NQ.setNqFetch((...a) => fetch(...a));
    });
});
