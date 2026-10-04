// ═══════════════════════════════════════════════════════════════
// THEEB MIND — Market data service (server-side only)
// Every source returns { ok, data, source, asOf, error }.
// On failure: ok=false, data=null → the UI shows DATA UNAVAILABLE.
// No fallback numbers are ever substituted.
// ═══════════════════════════════════════════════════════════════

const UA = 'Mozilla/5.0 (THEEB MIND dashboard)';
const TIMEOUT_MS = 12_000;

export const SOURCES = {
    // CFTC Public Reporting (Socrata) — Legacy Futures-Only report, no API key
    cot: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json',
    // Yahoo Finance chart API (delayed quotes), no API key
    yahoo: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    // ForexFactory weekly calendar export (faireconomy mirror), no API key
    calendar: 'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
};

// E-mini Nasdaq-100 (CME) — CFTC contract market code
export const NQ_CFTC_CODE = '209742';

let fetchImpl = (...a) => fetch(...a);
/** Test hook: replace the network layer. */
export function setFetch(fn) { fetchImpl = fn; }

async function getJSON(url) {
    const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res.json();
}

// ── tiny TTL cache with single-flight ────────────────────────
const cache = new Map();
export function clearCache() { cache.clear(); }
async function cached(key, ttlMs, loader) {
    const hit = cache.get(key);
    const now = Date.now();
    if (hit && hit.value && now - hit.at < ttlMs) return hit.value;
    if (hit && hit.pending) return hit.pending;
    const pending = loader().then(
        (value) => { cache.set(key, { at: Date.now(), value: value.ok ? value : null }); return value; },
        (err) => { cache.delete(key); throw err; },
    );
    cache.set(key, Object.assign({}, hit, { pending }));
    return pending;
}

const fail = (source, err) => ({ ok: false, data: null, source, asOf: null, error: String(err && err.message ? err.message : err) });

// ═══════════════════════════════════════════════════════════
// COT — Large Speculators (non-commercial) net, weekly Δ, COT Index (3y)
// ═══════════════════════════════════════════════════════════
export function parseCOT(rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('COT: empty response');
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const pts = rows.map((r) => ({
        date: String(r.report_date_as_yyyy_mm_dd || '').slice(0, 10),
        long: num(r.noncomm_positions_long_all),
        short: num(r.noncomm_positions_short_all),
        chLong: num(r.change_in_noncomm_long_all),
        chShort: num(r.change_in_noncomm_short_all),
        market: r.market_and_exchange_names,
    })).filter((p) => p.date && p.long !== null && p.short !== null)
        .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
    if (!pts.length) throw new Error('COT: no usable rows');
    const latest = pts[0];
    const net = latest.long - latest.short;
    let change = latest.chLong !== null && latest.chShort !== null ? latest.chLong - latest.chShort : null;
    if (change === null && pts[1]) change = net - (pts[1].long - pts[1].short);
    const nets = pts.slice(0, 156).map((p) => p.long - p.short);
    let index = null;
    if (nets.length >= 26) {
        const min = Math.min(...nets), max = Math.max(...nets);
        index = max > min ? ((net - min) / (max - min)) * 100 : null;
    }
    return { net, change, index: index === null ? null : Math.round(index * 10) / 10, reportDate: latest.date, weeks: nets.length, market: latest.market };
}

export function getCOT() {
    return cached('cot', 6 * 3600_000, async () => {
        try {
            const q = new URLSearchParams({ cftc_contract_market_code: NQ_CFTC_CODE, $order: 'report_date_as_yyyy_mm_dd DESC', $limit: '156' });
            const data = parseCOT(await getJSON(`${SOURCES.cot}?${q}`));
            return { ok: true, data, source: 'CFTC Legacy COT (Non-Commercial)', asOf: data.reportDate, error: null };
        } catch (e) { return fail('CFTC', e); }
    });
}

// ═══════════════════════════════════════════════════════════
// Yahoo chart helpers — bars, VIX, monthly seasonality
// ═══════════════════════════════════════════════════════════
export function parseYahooBars(json) {
    const r = json && json.chart && json.chart.result && json.chart.result[0];
    if (!r) throw new Error((json && json.chart && json.chart.error && json.chart.error.description) || 'Yahoo: no result');
    const ts = r.timestamp || [];
    const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
    const bars = [];
    for (let i = 0; i < ts.length; i++) {
        const o = q.open && q.open[i], h = q.high && q.high[i], l = q.low && q.low[i], c = q.close && q.close[i];
        if ([o, h, l, c].every((v) => typeof v === 'number' && Number.isFinite(v))) bars.push({ t: ts[i] * 1000, o, h, l, c });
    }
    return { bars, meta: r.meta || {} };
}

const TF = { '15m': { interval: '15m', range: '5d', ttl: 60_000 }, '5m': { interval: '5m', range: '2d', ttl: 60_000 } };

export function getBars(tf) {
    const spec = TF[tf];
    if (!spec) return Promise.resolve(fail('Yahoo', 'unsupported timeframe'));
    return cached('bars:' + tf, spec.ttl, async () => {
        try {
            const { bars, meta } = parseYahooBars(await getJSON(`${SOURCES.yahoo}NQ%3DF?interval=${spec.interval}&range=${spec.range}&includePrePost=true`));
            if (bars.length < 30) throw new Error('not enough bars (' + bars.length + ')');
            const last = bars[bars.length - 1].t;
            return { ok: true, data: { bars, symbol: 'NQ=F', interval: spec.interval, delayed: true, exchangeTz: meta.exchangeTimezoneName || null }, source: 'Yahoo Finance NQ=F (delayed)', asOf: new Date(last).toISOString(), error: null };
        } catch (e) { return fail('Yahoo', e); }
    });
}

export function getVIX() {
    return cached('vix', 5 * 60_000, async () => {
        try {
            const { bars, meta } = parseYahooBars(await getJSON(`${SOURCES.yahoo}%5EVIX?interval=1d&range=1mo`));
            const value = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : bars.length ? bars[bars.length - 1].c : null;
            if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('VIX: no value');
            const prev = bars.length > 1 ? bars[bars.length - 2].c : null;
            return { ok: true, data: { value, prevClose: prev }, source: 'Yahoo Finance ^VIX', asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null, error: null };
        } catch (e) { return fail('Yahoo', e); }
    });
}

/** Seasonality of the current calendar month from monthly closes (10Y / 5Y / 2Y, completed years only). */
export function computeSeasonality(bars, now) {
    const d = new Date(now);
    const month = d.getUTCMonth(), year = d.getUTCFullYear();
    const closes = new Map(); // 'YYYY-M' → close
    for (const b of bars) {
        // Yahoo monthly bars are stamped at the start of the month in exchange time — shift 2 days into the month
        const tt = new Date(b.t + 2 * 86400000);
        closes.set(tt.getUTCFullYear() + '-' + tt.getUTCMonth(), b.c);
    }
    const yearly = [];
    for (let y = year - 1; y >= year - 10; y--) {
        const cur = closes.get(y + '-' + month);
        const prevKey = month === 0 ? (y - 1) + '-11' : y + '-' + (month - 1);
        const prev = closes.get(prevKey);
        if (typeof cur === 'number' && typeof prev === 'number' && prev > 0) yearly.push({ year: y, ret: (cur / prev - 1) * 100 });
    }
    const win = (n) => {
        const s = yearly.slice(0, n);
        if (s.length < Math.min(n, 2)) return null;
        const avg = s.reduce((a, x) => a + x.ret, 0) / s.length;
        return { avg: Math.round(avg * 100) / 100, winRate: s.filter((x) => x.ret > 0).length / s.length, n: s.length };
    };
    return {
        month: d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
        y10: yearly.length >= 8 ? win(10) : null,
        y5: yearly.length >= 5 ? win(5) : null,
        y2: yearly.length >= 2 ? win(2) : null,
        years: yearly,
    };
}

export function getSeasonality(now = Date.now()) {
    return cached('seasonality', 12 * 3600_000, async () => {
        try {
            const { bars } = parseYahooBars(await getJSON(`${SOURCES.yahoo}%5ENDX?interval=1mo&range=15y`));
            if (bars.length < 30) throw new Error('not enough monthly history');
            const data = computeSeasonality(bars, now);
            if (!data.y10 && !data.y5) throw new Error('insufficient years');
            return { ok: true, data, source: 'Yahoo Finance ^NDX monthly', asOf: new Date(bars[bars.length - 1].t).toISOString(), error: null };
        } catch (e) { return fail('Yahoo', e); }
    });
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
            return { ok: true, data: { events }, source: 'ForexFactory weekly calendar', asOf: new Date().toISOString(), error: null };
        } catch (e) { return fail('Calendar', e); }
    });
}
