import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../lib/sources.mjs';
import { normalizeReading } from '../lib/chart-reader.mjs';
import { createServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// ── Fixtures in the documented upstream formats ──
function cotRows(n) {
    const rows = [];
    for (let i = 0; i < n; i++) {
        const d = new Date(Date.UTC(2026, 8, 29) - i * 7 * 86400000).toISOString().slice(0, 10);
        rows.push({
            market_and_exchange_names: 'NASDAQ MINI - CHICAGO MERCANTILE EXCHANGE', report_date_as_yyyy_mm_dd: d + 'T00:00:00.000',
            noncomm_positions_long_all: String(60000 + (i === 0 ? 30000 : (i % 10) * 1000)), noncomm_positions_short_all: '40000',
            change_in_noncomm_long_all: i === 0 ? '5000' : '0', change_in_noncomm_short_all: i === 0 ? '1000' : '0',
        });
    }
    return rows;
}
function yahoo(bars, meta = {}) {
    return { chart: { result: [{ meta, timestamp: bars.map((b) => b.t / 1000), indicators: { quote: [{ open: bars.map((b) => b.o), high: bars.map((b) => b.h), low: bars.map((b) => b.l), close: bars.map((b) => b.c) }] } }], error: null } };
}
function intradayBars(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const c = 20000 + Math.sin(i / 3) * 40 + i; out.push({ t: 1_790_000_000_000 + i * 900_000, o: c - 2, h: c + 5, l: c - 6, c }); }
    return out;
}
function monthlyBars() {
    const out = [];
    let p = 5000;
    for (let y = 2011; y <= 2026; y++) for (let m = 0; m < 12; m++) {
        if (y === 2026 && m > 9) break;
        p *= m === 9 ? 1.02 : 1.005; // October always +2%
        out.push({ t: Date.UTC(y, m, 1, 4), o: p, h: p, l: p, c: p });
    }
    return out;
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('Data parsers', () => {
    test('COT: large spec net, weekly change, 3Y COT index', () => {
        const c = S.parseCOT(cotRows(156));
        assert.equal(c.net, 50000);
        assert.equal(c.change, 4000);
        assert.equal(c.index, 100);
        assert.equal(c.reportDate, '2026-09-29');
        assert.equal(c.weeks, 156);
    });
    test('COT: under 26 weeks → index null (not invented)', () => {
        assert.equal(S.parseCOT(cotRows(10)).index, null);
    });
    test('COT: empty → throws', () => {
        assert.throws(() => S.parseCOT([]));
    });
    test('Yahoo bars drop null candles', () => {
        const j = yahoo(intradayBars(3));
        j.chart.result[0].indicators.quote[0].close[1] = null;
        assert.equal(S.parseYahooBars(j).bars.length, 2);
        assert.throws(() => S.parseYahooBars({ chart: { result: null, error: { description: 'No data' } } }), /No data/);
    });
    test('Seasonality: current month 10Y/5Y/2Y from monthly closes', () => {
        const s = S.computeSeasonality(monthlyBars(), Date.parse('2026-10-15T12:00:00Z'));
        assert.equal(s.month, 'October');
        assert.equal(s.y10.n, 10);
        assert.equal(s.y10.winRate, 1);
        assert.ok(Math.abs(s.y10.avg - 2) < 0.01);
        assert.equal(s.y2.n, 2);
    });
    test('Calendar parsing', () => {
        const ev = S.parseCalendar([{ title: 'CPI m/m', country: 'USD', date: '2026-10-14T08:30:00-04:00', impact: 'High' }, { bad: 1 }]);
        assert.equal(ev.length, 1);
        assert.equal(ev[0].time, '2026-10-14T12:30:00.000Z');
    });
});

describe('Server API', () => {
    let server, base;
    let mode = 'ok';
    before(async () => {
        delete process.env.ANTHROPIC_API_KEY;
        S.setFetch(async (url) => {
            if (mode === 'down') throw new Error('getaddrinfo ENOTFOUND');
            if (mode === '500') return response(500, {});
            const u = String(url);
            if (u.includes('cftc.gov')) return response(200, cotRows(156));
            if (u.includes('%5EVIX')) return response(200, yahoo(intradayBars(20).map((b) => ({ ...b, c: 17 })), { regularMarketPrice: 17.4, regularMarketTime: 1_790_000_000 }));
            if (u.includes('%5ENDX')) return response(200, yahoo(monthlyBars()));
            if (u.includes('NQ%3DF')) return response(200, yahoo(intradayBars(200)));
            if (u.includes('faireconomy')) return response(200, [{ title: 'CPI m/m', country: 'USD', date: new Date(Date.now() + 3600e3).toISOString(), impact: 'High' }]);
            return response(404, {});
        });
        server = createServer();
        await new Promise((r) => server.listen(0, '127.0.0.1', r));
        base = 'http://127.0.0.1:' + server.address().port;
    });
    after(() => server.close());
    beforeEach(() => { mode = 'ok'; S.clearCache(); });

    test('health + config (AI off without key, no execution)', async () => {
        assert.equal((await (await fetch(base + '/api/health')).json()).status, 'ok');
        const c = await (await fetch(base + '/api/config')).json();
        assert.equal(c.aiConfigured, false);
        assert.equal(c.execution, false);
    });
    test('context endpoint returns live-shaped data', async () => {
        const j = await (await fetch(base + '/api/context')).json();
        assert.equal(j.cot.ok, true);
        assert.equal(j.cot.data.net, 50000);
        assert.equal(j.vix.data.value, 17.4);
        assert.equal(j.seasonality.ok, true);
    });
    test('bars + news endpoints', async () => {
        const b = await (await fetch(base + '/api/bars?tf=15m')).json();
        assert.equal(b.ok, true);
        assert.equal(b.data.bars.length, 200);
        assert.equal(b.data.delayed, true);
        assert.equal((await fetch(base + '/api/bars?tf=1h')).status, 400);
        const n = await (await fetch(base + '/api/news')).json();
        assert.equal(n.data.events[0].title, 'CPI m/m');
    });
    test('upstream network failure → ok:false, data:null (no fallback numbers)', async () => {
        mode = 'down';
        const j = await (await fetch(base + '/api/context')).json();
        for (const k of ['cot', 'seasonality', 'vix']) {
            assert.equal(j[k].ok, false);
            assert.equal(j[k].data, null);
            assert.match(j[k].error, /ENOTFOUND/);
        }
        const b = await (await fetch(base + '/api/bars?tf=5m')).json();
        assert.equal(b.ok, false);
        assert.equal(b.data, null);
    });
    test('upstream HTTP 500 → ok:false', async () => {
        mode = '500';
        const n = await (await fetch(base + '/api/news')).json();
        assert.equal(n.ok, false);
        assert.match(n.error, /HTTP 500/);
    });
    test('AI agent endpoint: 503 when key missing (agent failure is non-fatal)', async () => {
        const r = await fetch(base + '/api/agent/chart-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: 'AAAA', mediaType: 'image/png' }) });
        assert.equal(r.status, 503);
        assert.equal((await r.json()).error, 'AI_NOT_CONFIGURED');
    });
    test('static files, path traversal blocked, security headers', async () => {
        const r = await fetch(base + '/');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
        assert.equal(r.headers.get('x-frame-options'), 'DENY');
        assert.match(await r.text(), /THEEB MIND/);
        assert.equal((await fetch(base + '/engine.js')).status, 200);
        assert.notEqual((await fetch(base + '/%2e%2e/server.mjs')).status, 200);
        assert.notEqual((await fetch(base + '/..%2fpackage.json')).status, 200);
        assert.equal((await fetch(base + '/api/nope')).status, 404);
    });
});

describe('AI output validation', () => {
    test('off-schema values become UNCLEAR', () => {
        const r = normalizeReading({ readable: true, structure: 'MOON', direction: 'UP', trend: 'PASS', raid: 'yes', imbalance: 'FAIL', location: 'UNCLEAR', notes: 'x' });
        assert.equal(r.structure, 'UNCLEAR');
        assert.equal(r.direction, 'NONE');
        assert.equal(r.trend, 'PASS');
        assert.equal(r.raid, 'UNCLEAR');
    });
    test('unreadable chart → everything UNCLEAR', () => {
        const r = normalizeReading({ readable: false, trend: 'PASS', raid: 'PASS', imbalance: 'PASS', location: 'PASS' });
        assert.deepEqual([r.trend, r.raid, r.imbalance, r.location], ['UNCLEAR', 'UNCLEAR', 'UNCLEAR', 'UNCLEAR']);
    });
    test('garbage input does not throw', () => {
        assert.equal(normalizeReading(null).readable, false);
    });
});

describe('Security', () => {
    test('no API keys or secrets in client files', async () => {
        const dir = path.join(here, '..', 'public');
        for (const f of await readdir(dir)) {
            const src = await readFile(path.join(dir, f), 'utf8');
            assert.doesNotMatch(src, /sk-ant-|x-api-key|api\.anthropic\.com|ANTHROPIC_API_KEY\s*=/i, f + ' must not contain credentials or direct LLM calls');
        }
    });
});
