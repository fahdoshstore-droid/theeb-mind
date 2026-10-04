// Browser end-to-end check of the dashboard.
// Run: node tests/ui.e2e.mjs   (needs Playwright + Chromium; set PLAYWRIGHT_MODULE if not resolvable)
// Starts the real server; upstream fetches are forced to fail so the
// "API down / DATA UNAVAILABLE" path is exercised, then demo scenarios.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as S from '../lib/sources.mjs';
import * as TV from '../lib/tradingview-mcp.mjs';
import { createServer } from '../server.mjs';

const require = createRequire(import.meta.url);
const Engine = require('../public/engine.js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const shots = process.env.SHOTS_DIR || path.join(here, '..', '.shots');
await mkdir(shots, { recursive: true });

S.setFetch(async () => { throw new Error('upstream unreachable (test)'); });
S.setTradingView(async () => { throw new Error('TradingView MCP not configured'); }, false);
const server = createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const check = async (name, fn) => {
    try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ' — ' + e.message]); }
};

async function open(url, viewport = { width: 1440, height: 1000 }) {
    const ctx = await browser.newContext({ viewport, timezoneId: 'Asia/Riyadh' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)/.test(m.text()) && !/ERR_(TUNNEL|NAME|CONNECTION|PROXY)/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    return { page, ctx, errors };
}
const text = (page, sel) => page.locator(sel).innerText();

// 1) Live mode with all upstream sources failing
await check('live mode, upstream down → NO TRADE / DATA UNAVAILABLE, no JS errors', async () => {
    const { page, ctx, errors } = await open('/');
    await page.waitForFunction(() => document.getElementById('mode-text').textContent !== 'LOADING', null, { timeout: 15000 });
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    assert.match(await text(page, '#d-why'), /DATA UNAVAILABLE/);
    assert.match(await text(page, '#mode-text'), /DATA UNAVAILABLE/);
    assert.match(await text(page, '#src-text'), /UNAVAILABLE/);
    assert.equal(await text(page, '#d-src'), 'UNAVAILABLE');
    assert.match(await text(page, '#smt-state'), /UNCLEAR/);
    assert.equal(await text(page, '#d-conf'), 'N/A');
    assert.match(await text(page, '#cot-net'), /DATA UNAVAILABLE/);
    assert.match(await text(page, '#news-status'), /DATA UNAVAILABLE/);
    assert.match(await text(page, '#ag1-status'), /ERROR/);
    assert.match(await text(page, '#ag2-status'), /ERROR/);
    assert.ok(!/\bNEUTRAL\b/.test(await text(page, '#ctx-overall')), 'UNAVAILABLE must never be shown as NEUTRAL');
    assert.ok(!(await page.locator('body').innerText()).includes('SIMULATED'), 'LIVE must not show simulated data');
    assert.equal(await page.locator('.demo-banner').isVisible(), false);
    await page.screenshot({ path: path.join(shots, 'live-unavailable.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await ctx.close();
});

// 2) Demo scenarios (one per required test case)
const expectations = {
    long: ['LONG', { '#smt-state': /BULLISH CONFLUENCE/, '#news-status': /CLEAR/, '#tril-overall': /PASS · READY/, '#d-fresh': /FRESH/ }],
    short: ['SHORT', { '#smt-state': /BEARISH CONFLUENCE/ }],
    news_high: ['NO TRADE', { '#d-why': /NEWS HIGH IMPACT/, '#news-status': /HIGH IMPACT/, '#news-restrict': /YES/ }],
    tril_fail: ['NO TRADE', { '#d-why': /TRIL FAIL/, '#tril-overall': /NOT READY/ }],
    risk_fail: ['NO TRADE', { '#d-why': /RISK FAIL/, '#risk-status': /FAIL/ }],
    cot_off: ['LONG', { '#cot-bias': /DATA UNAVAILABLE/, '#ctx-overall': /PARTIAL/ }],
    seas_off: ['LONG', { '#seas-bias': /DATA UNAVAILABLE/ }],
    vix_off: ['LONG', { '#vix-state': /DATA UNAVAILABLE/ }],
    nq_delayed: ['LONG', { '#d-fresh': /DELAYED/, '#d-warnings': /DELAYED DATA/, '#src-text': /NQ · DELAYED/ }],
    nas_proxy: ['LONG', { '#d-src': /NAS100 PROXY/, '#src-text': /NAS100 PROXY/, '#lv-basis': /NAS100 PROXY prices/ }],
    no_data: ['NO TRADE', { '#d-why': /DATA UNAVAILABLE/, '#d-conf': /N\/A/, '#st-src': /NONE/ }],
    smt_none: ['LONG', { '#smt-state': /NONE/ }],
    smt_unclear: ['LONG', { '#smt-state': /UNCLEAR/, '#smt-15': /S&P 500 data UNAVAILABLE/ }],
};
for (const [key, [word, sels]] of Object.entries(expectations)) {
    await check(`demo "${key}" → ${word}`, async () => {
        const { page, ctx, errors } = await open('/?demo=' + key);
        await page.waitForFunction((w) => document.getElementById('d-word').textContent === w, word, { timeout: 10000 });
        assert.equal(await page.locator('.demo-banner').isVisible(), true, 'DEMO banner must be visible');
        assert.match(await text(page, '#mode-text'), /DEMO \/ SIMULATED/);
        assert.match(await text(page, '#d-conf-label'), /CONFIDENCE SCORE/);
        assert.ok(!/probab/i.test(await page.locator('#hero').innerText()), 'no win-probability wording');
        for (const [sel, re] of Object.entries(sels)) assert.match(await text(page, sel), re, sel);
        if (word !== 'NO TRADE') assert.match(await text(page, '#d-plan'), /ENTRY/);
        if (['long', 'nas_proxy', 'no_data', 'news_high'].includes(key)) await page.screenshot({ path: path.join(shots, 'demo-' + key + '.png'), fullPage: true });
        assert.deepEqual(errors, []);
        await ctx.close();
    });
}

// 3) Interactions on the LONG scenario
await check('interactions: TRIL override, risk edit, NQ switch, trading state, settings', async () => {
    const { page, ctx, errors } = await open('/?demo=long');
    await page.waitForFunction(() => document.getElementById('d-word').textContent === 'LONG');
    // TRIL manual override: AUTO → PASS → FAIL
    await page.click('[data-tril="raid"]');
    await page.click('[data-tril="raid"]');
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    assert.match(await text(page, '#d-why'), /TRIL FAIL/);
    await page.click('[data-tril="raid"]'); await page.click('[data-tril="raid"]'); // UNCLEAR → AUTO
    assert.equal(await text(page, '#d-word'), 'LONG');
    // Risk: bad TP → RISK FAIL; then reset
    await page.fill('#lv-tp', '20200');
    await page.press('#lv-tp', 'Enter');
    await page.locator('#lv-tp').blur();
    await page.waitForFunction(() => document.getElementById('risk-status').textContent === 'FAIL');
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    await page.click('#btn-auto-levels');
    assert.equal(await text(page, '#d-word'), 'LONG');
    // Instrument switch: MNQ 2 ct → NQ 0 ct (stop $1,875/ct > $500) → RISK FAIL
    const mnq = await text(page, '#rk-ct');
    await page.click('[data-inst="NQ"]');
    assert.match(mnq, /^2 × MNQ/);
    assert.match(await text(page, '#rk-ct'), /^0 × NQ/);
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    await page.click('[data-inst="MNQ"]');
    // Trading state: two losses → NOT READY
    for (let i = 0; i < 2; i++) { await page.fill('#log-amt', '120'); await page.click('#btn-log-loss'); }
    assert.equal(await text(page, '#ts-status'), 'NOT READY');
    assert.match(await text(page, '#ts-reasons'), /Two consecutive losses/);
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    await page.click('#btn-undo'); await page.click('#btn-undo');
    assert.equal(await text(page, '#ts-status'), 'READY');
    // User not ready toggle
    await page.click('#btn-ready');
    assert.match(await text(page, '#ts-reasons'), /User not ready/);
    await page.click('#btn-ready');
    assert.equal(await text(page, '#d-word'), 'LONG');
    // Settings: min RRR 4 → RISK FAIL; restore defaults
    await page.click('#btn-settings');
    await page.fill('#set-minrrr', '4');
    await page.click('#btn-save-settings');
    assert.equal(await text(page, '#risk-status'), 'FAIL');
    await page.click('#btn-settings'); await page.click('#btn-defaults'); await page.click('#btn-save-settings');
    assert.equal(await text(page, '#d-word'), 'LONG');
    // AI button disabled in demo / without key
    assert.equal(await page.locator('#btn-ai-read').isDisabled(), true);
    assert.deepEqual(errors, []);
    await ctx.close();
});

// 4) Mobile layout: no horizontal scroll
await check('mobile 390px: no horizontal overflow', async () => {
    const { page, ctx, errors } = await open('/?demo=news_high', { width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById('d-word').textContent === 'NO TRADE');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, 'horizontal overflow ' + overflow + 'px');
    await page.screenshot({ path: path.join(shots, 'mobile-news.png'), fullPage: false });
    assert.deepEqual(errors, []);
    await ctx.close();
});

// 5) AI agent failure is non-fatal; a valid reading can be applied to TRIL
await check('AI agent failure → toast, dashboard keeps working; success → apply to TRIL', async () => {
    const { page, ctx, errors } = await open('/');
    await page.route('**/api/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ aiConfigured: true, execution: false }) }));
    let ok = false;
    await page.route('**/api/agent/chart-read', (r) => r.fulfill(ok
        ? { status: 200, contentType: 'application/json', body: JSON.stringify({ reading: { readable: true, timeframe: '15m', structure: 'BULLISH', direction: 'LONG', trend: 'PASS', raid: 'PASS', imbalance: 'FAIL', location: 'UNCLEAR', notes: '<img src=x onerror=alert(1)>' } }) }
        : { status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'AI_ERROR', message: 'AI request failed' }) }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('mode-text').textContent !== 'LOADING', null, { timeout: 15000 });
    await page.setInputFiles('#chart-file', path.join(shots, 'mobile-news.png'));
    await page.waitForFunction(() => !document.getElementById('btn-ai-read').disabled);
    await page.click('#btn-ai-read');
    await page.waitForSelector('.toast:has-text("AI agent failed")');
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    ok = true;
    await page.click('#btn-ai-read');
    await page.waitForSelector('#btn-ai-apply');
    assert.equal(await page.locator('#ai-out img').count(), 0, 'AI notes must be escaped');
    await page.click('#btn-ai-apply');
    const pills = await page.locator('[data-tril] .src-tag').allInnerTexts();
    assert.deepEqual(pills, ['MANUAL', 'MANUAL', 'MANUAL', 'AUTO']); // UNCLEAR location not applied
    assert.deepEqual(errors.filter((e) => !/status of 502/.test(e)), []); // the 502 is the simulated failure itself
    await ctx.close();
});

// 6) Exit demo returns to live (unavailable) state
await check('exit demo → live mode again', async () => {
    const { page, ctx } = await open('/?demo=long');
    await page.waitForFunction(() => document.getElementById('d-word').textContent === 'LONG');
    await page.click('#btn-exit-demo');
    await page.waitForFunction(() => document.getElementById('mode-text').textContent.includes('UNAVAILABLE'), null, { timeout: 15000 });
    assert.equal(await text(page, '#d-word'), 'NO TRADE');
    assert.equal(await page.locator('.demo-banner').isVisible(), false);
    await ctx.close();
});

// 7) LIVE through a real TradingView MCP connection (local mock server over stdio)
await check('LIVE via TradingView MCP → NQ from MCP with real-clock market status, other sources honestly UNAVAILABLE', async () => {
    process.env.TRADINGVIEW_MCP_COMMAND = process.execPath;
    process.env.TRADINGVIEW_MCP_ARGS = JSON.stringify([path.join(here, 'fixtures', 'mock-tv-mcp.mjs')]);
    S.setTradingView(TV.fetchTradingViewBars, true);
    S.clearCache();
    const { page, ctx, errors } = await open('/');
    // Expectations follow the REAL clock: open market → FRESH; closed → LAST AVAILABLE + NO TRADE (MARKET CLOSED)
    const isOpen = Engine.getSession(Date.now()).marketOpen;
    const fresh = isOpen ? 'FRESH' : 'LAST AVAILABLE';
    await page.waitForFunction((f) => document.getElementById('src-text').textContent === 'NQ · ' + f, fresh, { timeout: 20000 });
    assert.match(await text(page, '#st-src'), /CME_MINI:NQ1! · TradingView MCP/);
    assert.equal(await text(page, '#st-cands'), 'NQ ' + fresh + ' · NAS100 ' + fresh);
    assert.match(await text(page, '#mode-text'), isOpen ? /LIVE · PARTIAL/ : /MARKET CLOSED · LAST AVAILABLE DATA/);
    assert.equal(await text(page, '#d-mkt'), isOpen ? 'OPEN' : 'CLOSED');
    if (!isOpen) assert.match(await text(page, '#d-why'), /MARKET CLOSED/);
    assert.match(await text(page, '#lin-body'), /TradingView MCP · CME_MINI:NQ1!/);
    assert.match(await text(page, '#cot-bias'), /DATA UNAVAILABLE/);
    assert.match(await text(page, '#vix-val'), /^1\d\.\d\d$/); // VIX from MCP
    assert.match(await text(page, '#smt-pair'), /CME_MINI:ES1!/);
    assert.equal(await text(page, '#d-word'), 'NO TRADE'); // context missing → no candidate
    await page.screenshot({ path: path.join(shots, 'live-mcp.png'), fullPage: true });
    assert.deepEqual(errors, []);
    await ctx.close();
    await TV.resetTradingViewClient();
});

await browser.close();
server.closeAllConnections();
server.close();
for (const [s, n] of results) console.log(s.padEnd(5), n);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} UI checks passed · screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
