// ═══════════════════════════════════════════════════════════════
// LIVE DATA INTEGRATION TEST — real sources only (no mocks, no demo data)
//
//   node tests/live.integration.mjs
//   TRADINGVIEW_MCP_COMMAND=... TRADINGVIEW_MCP_ARGS='[...]'  → real TradingView MCP
//   PLAYWRIGHT_MODULE=...                                      → also checks the live UI
//   REPORT_PATH=out.json                                       → writes the full report
//
// Source failures are RECORDED (source, error, HTTP/MCP status, fallback, effect),
// not hidden. The test fails only if an invariant is broken:
//   • no simulated data reaches LIVE
//   • an unavailable source carries errors and no numbers
//   • market CLOSED / UNKNOWN ⇒ NO TRADE, never LONG/SHORT
// ═══════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCOT, getSeasonality, getVIX, getMarket, getNews } from '../lib/sources.mjs';
import { tvConfigured, resetTradingViewClient } from '../lib/tradingview-mcp.mjs';
import { DATABENTO_URL, databentoConfigured, fetchDatabentoBars, csvConfigured } from '../lib/nq-data.mjs';
import { currentTimeframes, neededTimeframes } from '../lib/timeframe-config.mjs';
import { createServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const E = require('../public/engine.js');
const here = path.dirname(fileURLToPath(import.meta.url));
const now = Date.now();
const t0 = Date.now();

const timeframes = await currentTimeframes();
const [cot, seasonality, vix, market, news] = await Promise.all([getCOT(), getSeasonality(), getVIX(), getMarket(neededTimeframes(timeframes)), getNews()]);
const data = { cot, seasonality, vix, market, news, timeframes };

// Databento (CME) — real request. Without a key, an unauthenticated probe records whether the API is even reachable.
let databento;
if (databentoConfigured()) {
    try { const r = await fetchDatabentoBars(); databento = { status: 'AVAILABLE', bars: r.bars.length, lastBar: new Date(r.bars[r.bars.length - 1].t).toISOString(), contract: r.bars[r.bars.length - 1].contract || null }; }
    catch (e) { databento = { status: 'DATA_UNAVAILABLE', error: e.message }; }
} else {
    try {
        const res = await fetch(DATABENTO_URL, { method: 'POST', signal: AbortSignal.timeout(15000) });
        const deny = res.headers.get('x-deny-reason');
        databento = { status: 'NOT_CONFIGURED', error: 'DATABENTO_API_KEY not set; ' + (deny ? 'hist.databento.com BLOCKED by network egress proxy (' + deny + ')' : 'API reachable (HTTP ' + res.status + ' without credentials)') };
    } catch (e) {
        databento = { status: 'NOT_CONFIGURED', error: 'DATABENTO_API_KEY not set; API unreachable: ' + e.message + (e.cause ? ' (' + e.cause.message + ')' : '') };
    }
}
const r = E.runPipeline(data, { instrument: 'MNQ', trades: [], userReady: true }, now); // real clock, no session override

const httpOf = (msg) => { const m = String(msg || '').match(/HTTP (\d{3})|(\d{3}) Forbidden|Tunnel connection failed: (\d{3})/); return m ? (m[1] || m[2] || m[3]) + (/BLOCKED by network egress proxy|Tunnel connection failed/.test(msg) ? ' (egress proxy)' : '') : null; };
const row = (name, x, extra = {}) => ({
    source: name,
    provider: x && (x.source || x.provider) || null,
    status: x && x.status === 'OK' ? 'AVAILABLE' : 'DATA_UNAVAILABLE',
    errors: (x && x.errors) || [],
    httpStatus: ((x && x.errors) || []).map(httpOf).filter(Boolean),
    fallbackUsed: !!(x && x.fallbackReason) || /fallback/i.test((x && (x.source || x.provider)) || ''),
    fetchedAt: x && x.fetchedAt || null,
    ...extra,
});
const series = (k) => {
    const s = market.series[k];
    const d = E.describeSeries(s, now, r.mkt);
    return row(k, s, { symbol: s.symbol, contract: d.contract || s.contractNote || null, baseTf: d.baseTf || null, timeframes: d.availableTfs || [], lastPrice: d.lastPrice, lastBarTime: d.fStruct.lastBarAt ? new Date(d.fStruct.lastBarAt).toISOString() : null, freshness: d.fStruct.state });
};
const report = {
    ranAt: new Date(now).toISOString(),
    durationMs: Date.now() - t0,
    tradingViewMcpConfigured: tvConfigured(),
    databentoConfigured: databentoConfigured(),
    csvConfigured: csvConfigured(),
    databento,
    timeframes,
    marketStatus: r.marketStatus,
    sources: [
        row('MarketBulls COT', cot, cot.status === 'OK' ? { reportDate: cot.reportDate, largeSpecNet: cot.largeSpecNet } : {}),
        row('MarketBulls Seasonality', seasonality, seasonality.status === 'OK' ? { seasonalBias: seasonality.seasonalBias } : {}),
        row('VIX', vix, vix.status === 'OK' ? { value: vix.value } : {}),
        series('NQ'), series('NAS100'), series('SPX'),
        row('News', news, news.status === 'OK' ? { events: news.events.length, next: r.news.event } : {}),
    ],
    layers: {
        context: r.context.bias, source: r.source.status === 'OK' ? r.source.label : 'UNAVAILABLE', freshness: r.source.freshness,
        structure: r.sStruct.status === 'OK' ? r.sStruct.bias : 'UNAVAILABLE', tril: r.tril.status, smt: r.smt.confluence + ' — ' + r.smt.detail,
        news: r.news.status, risk: r.risk.status, tradingState: r.tradingState.status,
    },
    decision: { decision: r.decision.decision, reasons: r.decision.reasons, confidence: r.decision.confidence.value, warnings: r.decision.warnings },
    agents: r.agents,
    invariants: [],
};

const inv = (name, fn) => { try { fn(); report.invariants.push({ name, pass: true }); } catch (e) { report.invariants.push({ name, pass: false, error: e.message }); } };
inv('no simulated data in LIVE', () => assert.ok(!JSON.stringify(data).includes('"simulated":true')));
inv('unavailable sources carry errors and no numbers', () => {
    for (const [k, x] of Object.entries({ cot, seasonality, vix, news })) if (x.status !== 'OK') {
        assert.ok(x.errors && x.errors.length, k + ' has no error recorded');
        assert.ok(!('largeSpecNet' in x) && !x.value && !x.events, k + ' leaked a value');
    }
    for (const k of ['NQ', 'NAS100', 'SPX']) if (market.series[k].status !== 'OK') {
        assert.ok(market.series[k].errors.length, k + ' has no error recorded');
        assert.equal(market.series[k].barsByTf, null);
    }
});
inv('UNAVAILABLE is never shown as NEUTRAL', () => {
    if (cot.status !== 'OK' && seasonality.status !== 'OK') assert.equal(r.context.bias, 'UNAVAILABLE');
    if (news.status !== 'OK') assert.equal(r.news.status, 'UNAVAILABLE');
});
inv('market not OPEN ⇒ NO TRADE (never LONG/SHORT)', () => {
    if (r.marketStatus.status !== 'OPEN') {
        assert.equal(r.decision.decision, 'NO TRADE');
        assert.equal(r.decision.candidate, false);
        assert.equal(r.decision.confidence.value, null);
    }
    if (r.marketStatus.status === 'CLOSED') assert.equal(r.decision.reasons[0].code, 'MARKET CLOSED');
});
inv('NAS100 proxy is never labelled as NQ', () => { if (r.source.role === 'NAS100_PROXY') assert.match(r.source.label, /^NAS100 PROXY/); });
inv('no validated timeframe ⇒ NO TRADE', () => { if (timeframes.status !== 'VALIDATED') assert.equal(r.decision.decision, 'NO TRADE'); });
inv('live timeframe config is never SIMULATED', () => assert.notEqual(timeframes.status, 'SIMULATED'));
inv('news agent never gives a direction', () => assert.ok(!('bias' in r.agents.news) && !('direction' in r.agents.news)));

// ── optional: the live UI on the real server ───────────────────
if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
    const server = createServer();
    await new Promise((res) => server.listen(0, '127.0.0.1', res));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const consoleErrors = [];
    page.on('pageerror', (e) => consoleErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) consoleErrors.push(m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (rt) => rt.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('mode-text').textContent !== 'LOADING', null, { timeout: 120000 });
    const ui = {
        decision: await page.locator('#d-word').innerText(),
        why: await page.locator('#d-why').innerText(),
        marketStatus: await page.locator('#d-mkt').innerText(),
        mode: await page.locator('#mode-text').innerText(),
        dataSource: await page.locator('#d-src').innerText(),
        demoBannerVisible: await page.locator('.demo-banner').isVisible(),
        bodyHasSimulated: (await page.locator('body').innerText()).includes('SIMULATED'),
        consoleErrors,
    };
    if (process.env.SHOTS_DIR) await page.screenshot({ path: path.join(process.env.SHOTS_DIR, 'live-integration.png'), fullPage: true });
    report.ui = ui;
    inv('UI: no demo leakage in LIVE', () => { assert.equal(ui.demoBannerVisible, false); assert.equal(ui.bodyHasSimulated, false); });
    inv('UI: decision matches engine', () => assert.equal(ui.decision, r.decision.decision));
    inv('UI: market status shown', () => assert.equal(ui.marketStatus, r.marketStatus.status));
    inv('UI: never claims LIVE when market not OPEN', () => { if (r.marketStatus.status !== 'OPEN') assert.ok(!/^LIVE\b/.test(ui.mode), ui.mode); });
    inv('UI: no console errors (network failures are reported in-app)', () => assert.deepEqual(consoleErrors, []));
    await browser.close();
    server.closeAllConnections(); server.close();
}
await resetTradingViewClient();

// ── print ──────────────────────────────────────────────────────
console.log(`\nLIVE DATA INTEGRATION — ${report.ranAt}`);
console.log(`MARKET STATUS: ${r.marketStatus.status} (${r.marketStatus.detail})`);
console.log(`TradingView MCP configured: ${report.tradingViewMcpConfigured} · Databento: ${databento.status} — ${databento.error || databento.bars + ' bars'} · CSV: ${report.csvConfigured}`);
console.log(`TIMEFRAMES: ${timeframes.structure ? timeframes.structure + ' → ' + timeframes.execution + ' (' + timeframes.status + ')' : timeframes.status + ' — ' + timeframes.detail}\n`);
for (const s of report.sources) {
    console.log(`${s.status === 'AVAILABLE' ? 'OK  ' : 'FAIL'} ${s.source.padEnd(24)} provider=${s.provider || '—'} fallback=${s.fallbackUsed ? 'YES' : 'no'}` +
        (s.symbol ? ` symbol=${s.symbol} contract=${s.contract || '—'} base=${s.baseTf || '—'} tfs=${s.timeframes.join('/') || '—'} last=${s.lastPrice ?? '—'} lastBar=${s.lastBarTime || '—'} fresh=${s.freshness}` : ''));
    for (const e of s.errors) console.log('       ↳ ' + e);
}
console.log('\nLAYERS', JSON.stringify(report.layers));
console.log('DECISION', r.decision.decision, '—', r.decision.reasons.map((x) => x.code).join(' | '));
for (const i of report.invariants) console.log((i.pass ? 'PASS ' : 'FAIL ') + i.name + (i.error ? ' — ' + i.error : ''));
if (process.env.REPORT_PATH) await writeFile(process.env.REPORT_PATH, JSON.stringify(report, null, 2));
const failed = report.invariants.filter((i) => !i.pass).length;
console.log(`\n${report.invariants.length - failed}/${report.invariants.length} invariants hold`);
process.exit(failed ? 1 : 0);
