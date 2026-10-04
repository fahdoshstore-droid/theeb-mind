import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../lib/sources.mjs';
import * as MB from '../lib/marketbulls.mjs';
import * as TV from '../lib/tradingview-mcp.mjs';
import { normalizeReading } from '../lib/chart-reader.mjs';
import { createServer } from '../server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse('2026-10-06T13:30:00Z');

// ── Fixtures ──────────────────────────────────────────────────
function mbCotHtml(weeks = 40) {
    const rows = [];
    for (let i = 0; i < weeks; i++) {
        const d = new Date(Date.UTC(2026, 8, 29) - i * 7 * 86400000);
        const date = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
        const l = 60000 + (i === 0 ? 30000 : (i % 10) * 1000), s = 40000;
        rows.push(`<tr><td>${date}</td><td>${l.toLocaleString('en-US')}</td><td>${s.toLocaleString('en-US')}</td><td>${(l - s).toLocaleString('en-US')}</td><td>${i === 0 ? '+4,000' : '0'}</td>` +
            `<td>120,000</td><td>150,000</td><td>-30,000</td><td>20,000</td><td>18,000</td><td>2,000</td><td>${i === 0 ? '92.5' : '50'}</td><td>${i === 0 ? '77.1' : '50'}</td></tr>`);
    }
    return `<html><body><h1>COT Report Nasdaq-100</h1><table class="cot">
<thead><tr><th rowspan="2">Date</th><th colspan="4">Large Speculators</th><th colspan="3">Commercials</th><th colspan="3">Small Traders</th><th rowspan="2">COT Index 6M</th><th rowspan="2">COT Index 36M</th></tr>
<tr><th>Long</th><th>Short</th><th>Net</th><th>Change</th><th>Long</th><th>Short</th><th>Net</th><th>Long</th><th>Short</th><th>Net</th></tr></thead>
<tbody>${rows.join('\n')}</tbody></table></body></html>`;
}
function mbSeasonHtml() {
    const curve = (k) => Array.from({ length: 365 }, (_, i) => +(i * k * 0.03).toFixed(3)); // rising cumulative %
    return `<html><body><div id="chart"></div><script>
Highcharts.chart('chart', { series: [ { name: "10 Years", data: [${curve(1)}] }, { name: "5 Years", data: [${curve(1.2)}] }, { name: "2 Years", data: [${curve(-1)}] } ] });
</script></body></html>`;
}
function mbSeasonTableHtml() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '<table><tr><th>Month</th><th>10 Years</th><th>5 Years</th><th>2 Years</th></tr>' +
        months.map((m, i) => `<tr><td>${m}</td><td>${i === 9 ? '-1.20%' : '0.5%'}</td><td>${i === 9 ? '-0.80%' : '0.2%'}</td><td>${i === 9 ? '0.10%' : '0.1%'}</td></tr>`).join('') + '</table>';
}
function cftcRows(n) {
    return Array.from({ length: n }, (_, i) => ({
        report_date_as_yyyy_mm_dd: new Date(Date.UTC(2026, 8, 29) - i * 7 * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000',
        noncomm_positions_long_all: String(60000 + (i === 0 ? 30000 : (i % 10) * 1000)), noncomm_positions_short_all: '40000',
        change_in_noncomm_long_all: i === 0 ? '5000' : '0', change_in_noncomm_short_all: i === 0 ? '1000' : '0',
        comm_positions_long_all: '120000', comm_positions_short_all: '150000', nonrept_positions_long_all: '20000', nonrept_positions_short_all: '18000',
    }));
}
function yahoo(bars, meta = {}) {
    return { chart: { result: [{ meta, timestamp: bars.map((b) => b.t / 1000), indicators: { quote: [{ open: bars.map((b) => b.o), high: bars.map((b) => b.h), low: bars.map((b) => b.l), close: bars.map((b) => b.c), volume: bars.map(() => 10) }] } }], error: null } };
}
function intraday(n, tfMin = 15) {
    const last = Math.floor(Date.now() / (tfMin * 60000)) * tfMin * 60000;
    return Array.from({ length: n }, (_, i) => { const c = 20000 + Math.sin(i / 3) * 40; return { t: last - (n - 1 - i) * tfMin * 60000, o: c - 2, h: c + 5, l: c - 6, c }; });
}
function monthly() {
    const out = []; let p = 5000;
    for (let y = 2011; y <= 2026; y++) for (let m = 0; m < 12; m++) { if (y === 2026 && m > 9) break; p *= m === 9 ? 1.02 : 1.005; out.push({ t: Date.UTC(y, m, 1, 4), o: p, h: p, l: p, c: p }); }
    return out;
}
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

// ═══════════════════════════════════════════════════════════
describe('MarketBulls adapter', () => {
    test('COT table with grouped headers → unified schema', () => {
        const rows = MB.parseMarketBullsCOT(mbCotHtml());
        const c = MB.toCOTSchema(rows, 'MarketBulls');
        assert.equal(c.reportDate, '2026-09-29');
        assert.equal(c.largeSpecLong, 90000);
        assert.equal(c.largeSpecShort, 40000);
        assert.equal(c.largeSpecNet, 50000);
        assert.equal(c.weeklyChange, 4000);
        assert.equal(c.cotIndex6m, 92.5);   // taken from the page, not recomputed
        assert.equal(c.cotIndex36m, 77.1);
        assert.deepEqual(c.commercials, { long: 120000, short: 150000, net: -30000 });
        assert.deepEqual(c.smallTraders, { long: 20000, short: 18000, net: 2000 });
        assert.equal(c.status, 'OK');
        assert.equal(c.source, 'MarketBulls');
        for (const k of ['reportDate', 'largeSpecLong', 'largeSpecShort', 'largeSpecNet', 'weeklyChange', 'cotIndex6m', 'cotIndex36m', 'commercials', 'smallTraders', 'source', 'fetchedAt', 'status']) assert.ok(k in c, k);
    });
    test('COT: unrecognised page → throws (no guessing)', () => {
        assert.throws(() => MB.parseMarketBullsCOT('<html><table><tr><th>Foo</th></tr><tr><td>1</td></tr></table></html>'), /not recognised/);
        assert.throws(() => MB.parseMarketBullsCOT('<html>Access denied</html>'), /not recognised/);
    });
    test('COT index computed from page history only when the page lacks it', () => {
        const html = mbCotHtml(30).replace(/<th rowspan="2">COT Index 6M<\/th><th rowspan="2">COT Index 36M<\/th>/, '');
        const c = MB.toCOTSchema(MB.parseMarketBullsCOT(html), 'MarketBulls');
        assert.equal(c.cotIndex6m, 100); // latest net is the 26-week max
        assert.equal(c.cotIndex36m, null); // only 30 weeks of history → not invented
    });
    test('Seasonality from embedded chart series (10Y/5Y/2Y)', () => {
        const s = MB.toSeasonalitySchema(MB.parseMarketBullsSeasonality(mbSeasonHtml(), NOW), 'MarketBulls', NOW);
        assert.equal(s.status, 'OK');
        assert.equal(s.currentMonth, 'October');
        assert.equal(s.currentDay, 6);
        assert.equal(s.y10.seasonalBias, 'BULLISH');
        assert.equal(s.y5.seasonalBias, 'BULLISH');
        assert.equal(s.y2.seasonalBias, 'BEARISH');
        assert.equal(s.seasonalBias, 'BULLISH');
        assert.ok(Number.isFinite(s.averageChange));
    });
    test('Seasonality from a monthly table', () => {
        const s = MB.toSeasonalitySchema(MB.parseMarketBullsSeasonality(mbSeasonTableHtml(), NOW), 'MarketBulls', NOW);
        assert.equal(s.y10.averageChange, -1.2);
        assert.equal(s.y10.seasonalBias, 'BEARISH');
        assert.equal(s.seasonalBias, 'BEARISH');
    });
    test('Seasonality: unrecognised page → throws', () => {
        assert.throws(() => MB.parseMarketBullsSeasonality('<html><img src="chart.png"></html>', NOW), /not recognised/);
    });
    test('number / date parsing', () => {
        assert.equal(MB.parseNum('-1,234'), -1234);
        assert.equal(MB.parseNum('(2,500)'), -2500);
        assert.equal(MB.parseNum('12.5%'), 12.5);
        assert.ok(Number.isNaN(MB.parseNum('n/a')));
        assert.equal(MB.parseDate('Sep 29, 2026'), '2026-09-29');
        assert.equal(MB.parseDate('09/29/2026'), '2026-09-29');
        assert.equal(MB.parseDate('2026-09-29'), '2026-09-29');
    });
});

describe('TradingView MCP adapter', () => {
    test('extractBars handles objects, arrays, column payloads and seconds/ms/ISO time', () => {
        const objs = TV.extractBars({ data: [{ time: 1790000000, open: 1, high: 2, low: 0, close: 1, volume: 5 }, { timestamp: '2026-09-21T15:00:00Z', o: 1, h: 3, l: 0, c: 2 }] });
        assert.equal(objs.length, 2);
        assert.equal(objs[0].t, 1790000000000);
        assert.equal(objs[0].v, 5);
        const arrs = TV.extractBars({ bars: [[1790000000000, 1, 2, 0, 1, 9], [1790000900000, 1, 2, 0, 1, 9]] });
        assert.equal(arrs.length, 2);
        const cols = TV.extractBars({ t: [1, 2], o: [1, 1], h: [2, 2], l: [0, 0], c: [1, 1] });
        assert.equal(cols.length, 2);
        assert.equal(TV.extractBars({ foo: 'bar' }).length, 0);
        assert.equal(TV.extractBars([{ time: 1, open: 1, high: 0, low: 2, close: 1 }]).length, 0); // high < low rejected
    });
    test('tool-call template fills symbol / interval / count', () => {
        assert.deepEqual(TV.fillTemplate('{"symbol":"{symbol}","interval":"{interval}","bars":{count}}', { symbol: 'CME_MINI:NQ1!', interval: '15m', count: 200 }), { symbol: 'CME_MINI:NQ1!', interval: '15m', bars: 200 });
        assert.deepEqual(TV.fillTemplate('{"exchange":"{exchange}","ticker":"{ticker}"}', { exchange: 'CME_MINI', ticker: 'NQ1!' }), { exchange: 'CME_MINI', ticker: 'NQ1!' });
    });
    test('tool detection on the REAL tradingview-mcp-server 0.8.1 tool list: no OHLC tool → null (scanners rejected)', () => {
        const names = ['top_gainers', 'top_losers', 'bollinger_scan', 'rating_filter', 'coin_analysis', 'consecutive_candles_scan', 'advanced_candle_pattern', 'volume_breakout_scanner', 'multi_timeframe_analysis', 'yahoo_price', 'futures_category_snapshot', 'stock_prices'];
        const tool = (n) => ({ name: n, inputSchema: { properties: n === 'consecutive_candles_scan' ? { exchange: {}, timeframe: {}, pattern_type: {} } : n === 'coin_analysis' ? { symbol: {}, exchange: {}, timeframe: {} } : { symbol: {} } } });
        assert.equal(TV.detectBarsTool(names.map(tool)), null);
        assert.equal(TV.detectBarsTool([{ name: 'get_ohlcv', inputSchema: { properties: { symbol: {}, interval: {} } } }]), 'get_ohlcv');
        assert.equal(TV.detectBarsTool([{ name: 'get_historical_bars', inputSchema: { properties: { ticker: {}, timeframe: {} } } }]), 'get_historical_bars');
    });
    test('errors inside the JSON payload (isError=false) are surfaced — seen on the real server', () => {
        assert.throws(() => TV.payloadFromToolResult({ content: [{ type: 'text', text: '{"symbol":"NQ=F","error":"403 Forbidden","source":"Yahoo Finance"}' }] }), /403 Forbidden/);
        assert.throws(() => TV.payloadFromToolResult({ content: [{ type: 'text', text: '{"error":{"code":"UPSTREAM_ERROR","message":"Tunnel connection failed: 403"}}' }] }), /Tunnel connection failed/);
    });
    test('MCP tool error / no JSON → throws', () => {
        assert.throws(() => TV.payloadFromToolResult({ isError: true, content: [{ type: 'text', text: 'symbol not found' }] }), /symbol not found/);
        assert.throws(() => TV.payloadFromToolResult({ content: [{ type: 'text', text: 'hello' }] }), /no JSON/);
    });

    const mockEnv = (extra) => Object.assign({ TRADINGVIEW_MCP_COMMAND: process.execPath, TRADINGVIEW_MCP_ARGS: JSON.stringify([path.join(here, 'fixtures', 'mock-tv-mcp.mjs')]) }, extra);
    after(() => TV.resetTradingViewClient());
    for (const shape of ['objects', 'arrays', 'columns']) {
        test(`real stdio MCP round-trip (${shape} payload)`, async () => {
            await TV.resetTradingViewClient();
            process.env.MOCK_SHAPE = shape; process.env.MOCK_MODE = 'ok';
            const r = await TV.fetchTradingViewBars('NQ', '15m', { count: 120, env: mockEnv() });
            assert.equal(r.symbol, 'CME_MINI:NQ1!');
            assert.equal(r.bars.length, 120);
            assert.ok(Date.now() - r.bars[r.bars.length - 1].t < 16 * 60000, 'latest bar is current');
        });
    }
    test('MCP server tool error is surfaced, not swallowed', async () => {
        await TV.resetTradingViewClient();
        process.env.MOCK_MODE = 'error';
        await assert.rejects(TV.fetchTradingViewBars('NQ', '15m', { env: mockEnv() }), /symbol not found/);
        await TV.resetTradingViewClient();
        process.env.MOCK_MODE = 'empty';
        await assert.rejects(TV.fetchTradingViewBars('NQ', '15m', { env: mockEnv() }), /no OHLC bars/);
        process.env.MOCK_MODE = 'ok';
        await TV.resetTradingViewClient();
    });
    test('unknown tool name → clear error', async () => {
        await TV.resetTradingViewClient();
        await assert.rejects(TV.fetchTradingViewBars('NQ', '15m', { env: mockEnv({ TRADINGVIEW_MCP_TOOL: 'nope' }) }), /not offered/);
        await TV.resetTradingViewClient();
    });
});

describe('Other parsers', () => {
    test('CFTC fallback → same unified schema', () => {
        const c = MB.toCOTSchema(S.parseCFTC(cftcRows(156)), 'CFTC');
        assert.equal(c.largeSpecNet, 50000);
        assert.equal(c.weeklyChange, 4000);
        assert.equal(c.cotIndex36m, 100);
        assert.equal(c.commercials.net, -30000);
        assert.equal(c.smallTraders.net, 2000);
    });
    test('Yahoo monthly seasonality fallback', () => {
        const s = MB.toSeasonalitySchema(S.computeSeasonality(monthly(), Date.parse('2026-10-15T12:00:00Z')), 'Yahoo', Date.parse('2026-10-15T12:00:00Z'));
        assert.equal(s.y10.n, 10);
        assert.equal(s.y10.seasonalBias, 'BULLISH');
        assert.equal(s.status, 'OK');
    });
    test('Calendar parsing', () => {
        const ev = S.parseCalendar([{ title: 'CPI m/m', country: 'USD', date: '2026-10-14T08:30:00-04:00', impact: 'High' }, { bad: 1 }]);
        assert.equal(ev.length, 1);
        assert.equal(ev[0].time, '2026-10-14T12:30:00.000Z');
    });
});

// ═══════════════════════════════════════════════════════════
describe('Server API', () => {
    let server, base;
    let net = { mb: 'ok', cftc: 'ok', yahoo: 'ok', cal: 'ok' };
    let tv = { enabled: false, mode: 'ok' };
    before(async () => {
        delete process.env.ANTHROPIC_API_KEY;
        S.setFetch(async (url) => {
            const u = String(url);
            const st = (k) => (net[k] === 'down' ? Promise.reject(new Error('getaddrinfo ENOTFOUND')) : net[k] === '500' ? resp(500, {}) : null);
            if (u.includes('market-bulls.com')) return (await st('mb')) || resp(200, u.includes('cot-report') ? mbCotHtml() : mbSeasonHtml());
            if (u.includes('cftc.gov')) return (await st('cftc')) || resp(200, cftcRows(156));
            if (u.includes('yahoo')) {
                const r = await st('yahoo'); if (r) return r;
                if (u.includes('%5EVIX')) return resp(200, yahoo(intraday(20, 1440), { regularMarketPrice: 17.4, regularMarketTime: 1_790_000_000 }));
                if (u.includes('%5ENDX') && u.includes('1mo')) return resp(200, yahoo(monthly()));
                return resp(200, yahoo(intraday(600, Number((u.match(/interval=(\d+)m/) || [0, 15])[1]))));
            }
            if (u.includes('faireconomy')) return (await st('cal')) || resp(200, [{ title: 'CPI m/m', country: 'USD', date: new Date(Date.now() + 3600e3).toISOString(), impact: 'High' }]);
            return resp(404, {});
        });
        S.setTradingView(async (key, tf) => {
            if (tv.mode === 'down') throw new Error('MCP connection refused');
            const bars = intraday(200, { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '1d': 1440 }[tf] || 15);
            return { bars, symbol: TV.TV_SYMBOLS[key], delayed: false };
        }, false);
        server = createServer();
        await new Promise((r) => server.listen(0, '127.0.0.1', r));
        base = 'http://127.0.0.1:' + server.address().port;
    });
    after(() => { server.closeAllConnections(); server.close(); });
    beforeEach(() => { net = { mb: 'ok', cftc: 'ok', yahoo: 'ok', cal: 'ok' }; tv = { enabled: false, mode: 'ok' }; S.setTradingView(async () => { throw new Error('TradingView MCP not configured'); }, false); S.clearCache(); });
    const enableTV = () => S.setTradingView(async (key, tf) => {
        if (tv.mode === 'down') throw new Error('MCP connection refused');
        return { bars: intraday(200, { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '1d': 1440 }[tf] || 15), symbol: TV.TV_SYMBOLS[key], delayed: false };
    }, true);
    const get = async (p) => (await fetch(base + p)).json();

    test('health + config (no execution, provider reported)', async () => {
        assert.equal((await get('/api/health')).status, 'ok');
        const c = await get('/api/config');
        assert.equal(c.aiConfigured, false);
        assert.equal(c.execution, false);
        assert.match(c.marketProvider, /Yahoo|TradingView/);
    });
    test('context: MarketBulls is the primary COT + seasonality source', async () => {
        const j = await get('/api/context');
        assert.equal(j.cot.source, 'MarketBulls');
        assert.equal(j.cot.largeSpecNet, 50000);
        assert.equal(j.seasonality.source, 'MarketBulls');
        assert.equal(j.vix.value, 17.4);
    });
    test('MarketBulls down → CFTC / Yahoo fallback, clearly labelled', async () => {
        net.mb = 'down';
        const j = await get('/api/context');
        assert.match(j.cot.source, /CFTC.*fallback/);
        assert.match(j.cot.fallbackReason, /MarketBulls/);
        assert.match(j.seasonality.source, /fallback/);
    });
    test('every provider down → DATA_UNAVAILABLE with errors (no fallback numbers)', async () => {
        net = { mb: 'down', cftc: '500', yahoo: 'down', cal: 'down' };
        const j = await get('/api/context');
        for (const k of ['cot', 'seasonality', 'vix']) {
            assert.equal(j[k].status, 'DATA_UNAVAILABLE', k);
            assert.ok(j[k].errors.length >= 1);
            assert.ok(!('largeSpecNet' in j[k]) && !j[k].value);
        }
        const m = await get('/api/market');
        for (const k of ['NQ', 'NAS100', 'SPX']) { assert.equal(m.series[k].status, 'DATA_UNAVAILABLE'); assert.equal(m.series[k].barsByTf, null); }
        const n = await get('/api/news');
        assert.equal(n.status, 'DATA_UNAVAILABLE');
        assert.equal(n.events, null);
    });
    test('market without TradingView MCP → Yahoo, flagged delayed', async () => {
        const m = await get('/api/market');
        assert.equal(m.series.NQ.provider, 'Yahoo Finance');
        assert.equal(m.series.NQ.delayed, true);
        assert.equal(m.series.NQ.baseTf, '1m');
        assert.equal(m.series.NQ.barsByTf['1m'].length, 400); // trimmed for the browser
        assert.deepEqual(Object.keys(m.series.NQ.barsByTf), ['1m']); // no timeframe selected → base only
        assert.equal(m.series.SPX.symbol, 'ES=F');
    });
    test('market with TradingView MCP → primary provider, real-time', async () => {
        enableTV();
        const m = await get('/api/market');
        assert.equal(m.series.NQ.provider, 'TradingView MCP');
        assert.equal(m.series.NQ.symbol, 'CME_MINI:NQ1!');
        assert.equal(m.series.NQ.delayed, false);
        assert.equal(m.series.NAS100.symbol, 'OANDA:NAS100USD');
        assert.equal(m.series.SPX.symbol, 'CME_MINI:ES1!');
        const v = await get('/api/context');
        assert.match(v.vix.source, /TradingView/);
    });
    test('TradingView MCP down → Yahoo fallback with the MCP error recorded', async () => {
        enableTV(); tv.mode = 'down';
        const m = await get('/api/market');
        assert.equal(m.series.NQ.provider, 'Yahoo Finance');
        assert.match(m.series.NQ.errors[0], /TradingView MCP: MCP connection refused/);
    });
    test('NQ chain: network sources down + NQ_CSV_PATH → CSV provider, historical, real contract, base 1m', async () => {
        const { mkdtemp, writeFile } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const d = await mkdtemp(path.join(tmpdir(), 'theeb-csv-'));
        const T0 = Date.parse('2026-10-02T19:00:00Z');
        const rows = Array.from({ length: 120 }, (_, i) => `${new Date(T0 + i * 60000).toISOString()},33,1,1,${20000 + i},${20002 + i},${19999 + i},${20001 + i},${10 + i},NQZ6`);
        await writeFile(path.join(d, 'nq.csv'), 'ts_event,rtype,publisher_id,instrument_id,open,high,low,close,volume,symbol\n' + rows.join('\n'));
        process.env.NQ_CSV_PATH = path.join(d, 'nq.csv');
        try {
            net.yahoo = 'down';
            const m = await get('/api/market');
            const nq = m.series.NQ;
            assert.equal(nq.status, 'OK');
            assert.match(nq.provider, /^CSV file nq\.csv$/);
            assert.equal(nq.historical, true);
            assert.equal(nq.delayed, true);
            assert.equal(nq.contract, 'NQZ6');
            assert.equal(nq.baseTf, '1m');
            assert.match(nq.errors.join(' '), /Yahoo: getaddrinfo ENOTFOUND/);
            assert.equal(m.timeframes.status, 'NOT_RUN'); // no validation report → nothing selected
        } finally { delete process.env.NQ_CSV_PATH; }
    });
    test('AI agent endpoint: 503 when key missing', async () => {
        const r = await fetch(base + '/api/agent/chart-read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: 'AAAA', mediaType: 'image/png' }) });
        assert.equal(r.status, 503);
        assert.equal((await r.json()).error, 'AI_NOT_CONFIGURED');
    });
    test('static files, traversal blocked, security headers, unknown API 404', async () => {
        const r = await fetch(base + '/');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
        assert.equal(r.headers.get('x-frame-options'), 'DENY');
        assert.match(await r.text(), /THEEB MIND/);
        assert.notEqual((await fetch(base + '/%2e%2e/server.mjs')).status, 200);
        assert.notEqual((await fetch(base + '/..%2fpackage.json')).status, 200);
        assert.equal((await fetch(base + '/api/bars')).status, 404);
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
    test('unreadable chart → everything UNCLEAR; garbage does not throw', () => {
        const r = normalizeReading({ readable: false, trend: 'PASS', raid: 'PASS', imbalance: 'PASS', location: 'PASS' });
        assert.deepEqual([r.trend, r.raid, r.imbalance, r.location], ['UNCLEAR', 'UNCLEAR', 'UNCLEAR', 'UNCLEAR']);
        assert.equal(normalizeReading(null).readable, false);
    });
});

describe('Security', () => {
    test('no API keys, credentials or direct LLM calls in client files', async () => {
        const dir = path.join(here, '..', 'public');
        for (const f of await readdir(dir)) {
            const src = await readFile(path.join(dir, f), 'utf8');
            assert.doesNotMatch(src, /sk-ant-|x-api-key|api\.anthropic\.com|ANTHROPIC_API_KEY\s*=|TRADINGVIEW_[A-Z_]*\s*=|tradingview\.com\/.*(session|token)/i, f);
        }
    });
    test('LIVE client code never reads demo data as a fallback', async () => {
        const html = await readFile(path.join(here, '..', 'public', 'index.html'), 'utf8');
        const fetchFns = html.slice(html.indexOf('async function fetchContext'), html.indexOf('function loadDemo'));
        assert.doesNotMatch(fetchFns, /DEMO\.|scenario\(/);
    });
});

describe('TradingView MCP connect backoff', () => {
    test('a failed connect is not retried (no process respawn) within the backoff window', async () => {
        await TV.resetTradingViewClient();
        const env = { TRADINGVIEW_MCP_COMMAND: process.execPath, TRADINGVIEW_MCP_ARGS: JSON.stringify([path.join(here, 'fixtures', 'mock-tv-mcp.mjs')]), TRADINGVIEW_MCP_TOOL: 'missing_tool' };
        const t0 = Date.now();
        await assert.rejects(TV.fetchTradingViewBars('NQ', '15m', { env }), /not offered/);
        const first = Date.now() - t0;
        const t1 = Date.now();
        await assert.rejects(TV.fetchTradingViewBars('NQ', '15m', { env }), /not offered/);
        assert.ok(Date.now() - t1 < Math.max(20, first / 4), 'second call must fail fast from the backoff cache');
        await TV.resetTradingViewClient();
    });
});
