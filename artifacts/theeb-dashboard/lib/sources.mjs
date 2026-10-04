// ═══════════════════════════════════════════════════════════════
// THEEB MIND — Market data service (server-side only)
//
//   COT / Seasonality : MarketBulls (primary) → CFTC / Yahoo (fallback, labelled)
//   Live market bars  : TradingView MCP (primary) → Yahoo (fallback, always DELAYED)
//   VIX               : TradingView MCP → Yahoo
//   News              : ForexFactory weekly calendar
//
// Nothing here invents a number: a failed source returns
// status DATA_UNAVAILABLE with the errors of every provider tried.
// ═══════════════════════════════════════════════════════════════
import { MB_URLS, parseMarketBullsCOT, parseMarketBullsSeasonality, toCOTSchema, toSeasonalitySchema } from './marketbulls.mjs';
import { tvConfigured, fetchTradingViewBars, TV_SYMBOLS } from './tradingview-mcp.mjs';

const UA = 'Mozilla/5.0 (THEEB MIND dashboard)';
const TIMEOUT_MS = 12_000;

export const SOURCES = {
    cftc: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json',
    yahoo: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    calendar: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
};
export const NQ_CFTC_CODE = '209742'; // E-mini Nasdaq-100
const YAHOO_SYMBOLS = { NQ: 'NQ=F', NAS100: '^NDX', SPX: 'ES=F', VIX: '^VIX' };

// ── test hooks ───────────────────────────────────────────────
let fetchImpl = (...a) => fetch(...a);
let tvImpl = fetchTradingViewBars;
let tvEnabled = () => tvConfigured();
export function setFetch(fn) { fetchImpl = fn; }
export function setTradingView(fn, enabled = true) { tvImpl = fn; tvEnabled = () => enabled; }

async function request(url, accept) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res;
}
const getJSON = async (url) => (await request(url, 'application/json')).json();
const getText = async (url) => (await request(url, 'text/html')).text();
const errMsg = (e) => (String(e && e.message ? e.message : e) + (e && e.cause && e.cause.message ? ' (' + e.cause.message + ')' : '')).slice(0, 300);

// ── TTL cache with single-flight; failures are not cached ─────
const cache = new Map();
export function clearCache() { cache.clear(); }
async function cached(key, ttlMs, loader, isOk) {
    const hit = cache.get(key);
    if (hit && hit.value && Date.now() - hit.at < ttlMs) return hit.value;
    if (hit && hit.pending) return hit.pending;
    const pending = loader().then((value) => {
        cache.set(key, isOk(value) ? { at: Date.now(), value } : {});
        return value;
    }, (err) => { cache.delete(key); throw err; });
    cache.set(key, Object.assign({}, hit, { pending }));
    return pending;
}

// ═══════════════════════════════════════════════════════════
// COT
// ═══════════════════════════════════════════════════════════
export function parseCFTC(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('CFTC: empty response');
    const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : NaN; };
    const out = rows.map((r) => ({
        date: String(r.report_date_as_yyyy_mm_dd || '').slice(0, 10),
        lsLong: n(r.noncomm_positions_long_all), lsShort: n(r.noncomm_positions_short_all), lsNet: NaN,
        lsChange: n(r.change_in_noncomm_long_all) - n(r.change_in_noncomm_short_all),
        cLong: n(r.comm_positions_long_all), cShort: n(r.comm_positions_short_all), cNet: NaN,
        sLong: n(r.nonrept_positions_long_all), sShort: n(r.nonrept_positions_short_all), sNet: NaN,
        idx6: NaN, idx36: NaN, idx: NaN,
    })).filter((r) => r.date && Number.isFinite(r.lsLong) && Number.isFinite(r.lsShort))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!out.length) throw new Error('CFTC: no usable rows');
    return out;
}

export function getCOT() {
    return cached('cot', 6 * 3600_000, async () => {
        const errors = [];
        try {
            return toCOTSchema(parseMarketBullsCOT(await getText(MB_URLS.cot)), 'MarketBulls');
        } catch (e) { errors.push('MarketBulls: ' + errMsg(e)); }
        try {
            const q = new URLSearchParams({ cftc_contract_market_code: NQ_CFTC_CODE, $order: 'report_date_as_yyyy_mm_dd DESC', $limit: '156' });
            const s = toCOTSchema(parseCFTC(await getJSON(`${SOURCES.cftc}?${q}`)), 'CFTC Legacy COT (fallback — MarketBulls unavailable)');
            s.fallbackReason = errors[0];
            return s;
        } catch (e) { errors.push('CFTC: ' + errMsg(e)); }
        return { status: 'DATA_UNAVAILABLE', source: null, fetchedAt: new Date().toISOString(), errors };
    }, (v) => v.status === 'OK');
}

// ═══════════════════════════════════════════════════════════
// Yahoo helpers (fallback provider)
// ═══════════════════════════════════════════════════════════
export function parseYahooBars(json) {
    const r = json && json.chart && json.chart.result && json.chart.result[0];
    if (!r) throw new Error((json && json.chart && json.chart.error && json.chart.error.description) || 'Yahoo: no result');
    const ts = r.timestamp || [];
    const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
    const bars = [];
    for (let i = 0; i < ts.length; i++) {
        const o = q.open && q.open[i], h = q.high && q.high[i], l = q.low && q.low[i], c = q.close && q.close[i], v = q.volume && q.volume[i];
        if ([o, h, l, c].every((x) => typeof x === 'number' && Number.isFinite(x))) {
            const b = { t: ts[i] * 1000, o, h, l, c };
            if (typeof v === 'number' && Number.isFinite(v)) b.v = v;
            bars.push(b);
        }
    }
    return { bars, meta: r.meta || {} };
}

/** Monthly-close seasonality for the current month (fallback when MarketBulls is unavailable). */
export function computeSeasonality(bars, now) {
    const d = new Date(now);
    const month = d.getUTCMonth(), year = d.getUTCFullYear();
    const closes = new Map();
    for (const b of bars) {
        const tt = new Date(b.t + 2 * 86400000); // monthly bars are stamped on the 1st in exchange time
        closes.set(tt.getUTCFullYear() + '-' + tt.getUTCMonth(), b.c);
    }
    const yearly = [];
    for (let y = year - 1; y >= year - 10; y--) {
        const cur = closes.get(y + '-' + month);
        const prev = closes.get(month === 0 ? (y - 1) + '-11' : y + '-' + (month - 1));
        if (typeof cur === 'number' && typeof prev === 'number' && prev > 0) yearly.push((cur / prev - 1) * 100);
    }
    const win = (n, minN) => {
        const s = yearly.slice(0, n);
        if (s.length < minN) return null;
        const avg = s.reduce((a, x) => a + x, 0) / s.length;
        const winRate = s.filter((x) => x > 0).length / s.length;
        const seasonalBias = avg > 0 && winRate >= 0.6 ? 'BULLISH' : avg < 0 && winRate <= 0.4 ? 'BEARISH' : 'NEUTRAL';
        return { averageChange: Math.round(avg * 100) / 100, winRate, n: s.length, seasonalBias, basis: 'monthly return' };
    };
    return { y10: win(10, 8), y5: win(5, 5), y2: win(2, 2) };
}

export function getSeasonality(now = Date.now()) {
    return cached('seasonality', 12 * 3600_000, async () => {
        const errors = [];
        try {
            return toSeasonalitySchema(parseMarketBullsSeasonality(await getText(MB_URLS.seasonality), now), 'MarketBulls', now);
        } catch (e) { errors.push('MarketBulls: ' + errMsg(e)); }
        try {
            const { bars } = parseYahooBars(await getJSON(`${SOURCES.yahoo}%5ENDX?interval=1mo&range=15y`));
            if (bars.length < 30) throw new Error('not enough monthly history');
            const s = toSeasonalitySchema(computeSeasonality(bars, now), 'Yahoo ^NDX monthly (fallback — MarketBulls unavailable)', now);
            if (s.status !== 'OK') throw new Error('insufficient years');
            s.fallbackReason = errors[0];
            return s;
        } catch (e) { errors.push('Yahoo: ' + errMsg(e)); }
        return { status: 'DATA_UNAVAILABLE', source: null, fetchedAt: new Date().toISOString(), errors };
    }, (v) => v.status === 'OK');
}

// ═══════════════════════════════════════════════════════════
// Market bars — NQ / NAS100 / SPX, 15m + 5m
// ═══════════════════════════════════════════════════════════
const YF = { '15m': { interval: '15m', range: '5d' }, '5m': { interval: '5m', range: '2d' } };

async function yahooBars(key, tf) {
    const spec = YF[tf];
    const { bars } = parseYahooBars(await getJSON(`${SOURCES.yahoo}${encodeURIComponent(YAHOO_SYMBOLS[key])}?interval=${spec.interval}&range=${spec.range}&includePrePost=true`));
    if (bars.length < 30) throw new Error('not enough bars (' + bars.length + ')');
    return { bars, symbol: YAHOO_SYMBOLS[key], provider: 'Yahoo Finance', delayed: true };
}

async function tvBars(key, tf) {
    const r = await tvImpl(key, tf, { count: 200 });
    if (r.bars.length < 30) throw new Error('not enough bars (' + r.bars.length + ')');
    return { bars: r.bars, symbol: r.symbol, provider: 'TradingView MCP', delayed: !!r.delayed };
}

/** One series (both timeframes from the SAME provider, so fresh and stale data are never mixed). */
export async function getSeries(key) {
    return cached('series:' + key, 30_000, async () => {
        const errors = [];
        const providers = [];
        if (tvEnabled()) providers.push(['TradingView MCP', tvBars]);
        providers.push(['Yahoo', yahooBars]);
        for (const [name, fn] of providers) {
            const [r15, r5] = await Promise.allSettled([fn(key, '15m'), fn(key, '5m')]);
            if (r15.status === 'fulfilled') {
                const base = r15.value;
                return {
                    key, status: 'OK', provider: base.provider, symbol: base.symbol, delayed: base.delayed,
                    bars15: base.bars,
                    bars5: r5.status === 'fulfilled' ? r5.value.bars : null,
                    error5: r5.status === 'rejected' ? errMsg(r5.reason) : null,
                    errors, fetchedAt: new Date().toISOString(),
                };
            }
            errors.push(name + ': ' + errMsg(r15.reason));
        }
        return { key, status: 'DATA_UNAVAILABLE', provider: null, symbol: TV_SYMBOLS[key] || key, bars15: null, bars5: null, errors, fetchedAt: new Date().toISOString() };
    }, (v) => v.status === 'OK');
}

export async function getMarket() {
    const [NQ, NAS100, SPX] = await Promise.all(['NQ', 'NAS100', 'SPX'].map(getSeries));
    return { series: { NQ, NAS100, SPX }, primaryProvider: tvEnabled() ? 'TradingView MCP' : 'Yahoo Finance (delayed fallback — TradingView MCP not configured)', fetchedAt: new Date().toISOString() };
}

export function getVIX() {
    return cached('vix', 5 * 60_000, async () => {
        const errors = [];
        if (tvEnabled()) {
            try {
                const r = await tvImpl('VIX', '1d', { count: 5 });
                const last = r.bars[r.bars.length - 1];
                return { status: 'OK', value: last.c, asOf: new Date(last.t).toISOString(), source: 'TradingView MCP ' + r.symbol, fetchedAt: new Date().toISOString() };
            } catch (e) { errors.push('TradingView MCP: ' + errMsg(e)); }
        }
        try {
            const { bars, meta } = parseYahooBars(await getJSON(`${SOURCES.yahoo}%5EVIX?interval=1d&range=1mo`));
            const value = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : bars.length ? bars[bars.length - 1].c : null;
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('VIX: no value');
            return { status: 'OK', value, asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null, source: 'Yahoo Finance ^VIX' + (errors.length ? ' (fallback)' : ''), fetchedAt: new Date().toISOString() };
        } catch (e) { errors.push('Yahoo: ' + errMsg(e)); }
        return { status: 'DATA_UNAVAILABLE', value: null, source: null, errors, fetchedAt: new Date().toISOString() };
    }, (v) => v.status === 'OK');
}

// ═══════════════════════════════════════════════════════════
// Economic calendar
// ═══════════════════════════════════════════════════════════
export function parseCalendar(json) {
    if (!Array.isArray(json)) throw new Error('Calendar: unexpected format');
    return json
        .filter((e) => e && e.title && e.date && !isNaN(Date.parse(e.date)))
        .map((e) => ({ title: String(e.title), country: String(e.country || ''), impact: String(e.impact || ''), time: new Date(Date.parse(e.date)).toISOString(), forecast: e.forecast || null, previous: e.previous || null }));
}

export function getNews() {
    return cached('news', 15 * 60_000, async () => {
        try {
            const events = parseCalendar(await getJSON(SOURCES.calendar));
            return { status: 'OK', events, source: 'ForexFactory weekly calendar', fetchedAt: new Date().toISOString() };
        } catch (e) {
            return { status: 'DATA_UNAVAILABLE', events: null, source: null, errors: ['Calendar: ' + errMsg(e)], fetchedAt: new Date().toISOString() };
        }
    }, (v) => v.status === 'OK');
}
