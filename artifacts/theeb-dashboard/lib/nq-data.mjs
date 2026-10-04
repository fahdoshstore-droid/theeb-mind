// ═══════════════════════════════════════════════════════════════
// NQ futures OHLC providers (server-side). Real data only.
//
//   Databento (CME Globex, dataset GLBX.MDP3, schema ohlcv-1m)
//     DATABENTO_API_KEY           required (Basic auth, key as username)
//     DATABENTO_SYMBOL            default NQ.c.0  (continuous front month, stype_in=continuous)
//     DATABENTO_LOOKBACK_HOURS    default 72 (live/last-available window)
//   CSV ingestion (reliable fallback / historical research)
//     NQ_CSV_PATH                 file with timestamp,open,high,low,close[,volume][,contract|symbol]
//     NQ_CSV_TZ                   timezone for naive timestamps (default UTC, e.g. America/Chicago)
//
// Every bar: { t (ms UTC, bar START), o, h, l, c, v?, contract? }.
// Nothing is filled, interpolated or defaulted: unparsable rows are dropped and counted.
// ═══════════════════════════════════════════════════════════════
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../public/engine.js');

export const DATABENTO_URL = 'https://hist.databento.com/v0/timeseries.get_range';

let fetchImpl = (...a) => fetch(...a);
export function setNqFetch(fn) { fetchImpl = fn; }

// ── CSV helpers ──────────────────────────────────────────────
function splitCSVLine(line) {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { q = !q; continue; }
        if ((ch === ',' || ch === ';' || ch === '\t') && !q) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur.trim());
    return out;
}

/** Offset (minutes) of an IANA zone at a given UTC instant. */
function tzOffsetMin(utcMs, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {};
    for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return (asUTC - utcMs) / 60000;
}

/** Parses a timestamp: epoch s/ms/ns, ISO with offset, or naive local time in `tz`. */
export function parseTimestamp(raw, tz = 'UTC') {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/^\d{10}(\.\d+)?$/.test(s)) return Math.round(Number(s) * 1000);
    if (/^\d{13}$/.test(s)) return Number(s);
    if (/^\d{19}$/.test(s)) return Math.round(Number(BigInt(s) / 1000000n)); // nanoseconds (Databento ts_event)
    const iso = s.replace(' ', 'T');
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso)) { const ms = Date.parse(iso); return Number.isFinite(ms) ? ms : null; }
    const m = iso.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/) ||
        iso.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return null;
    let y, mo, d;
    if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3]; } else { mo = +m[1]; d = +m[2]; y = +m[3]; }
    const naive = Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    if (tz === 'UTC') return naive;
    // two-pass offset resolution (handles DST transitions)
    let guess = naive - tzOffsetMin(naive, tz) * 60000;
    guess = naive - tzOffsetMin(guess, tz) * 60000;
    return guess;
}

const COL = {
    t: /^(ts_event|timestamp|datetime|date_?time|time|date|t)$/i,
    time: /^(time|hour)$/i,
    o: /^(open|o)$/i, h: /^(high|h)$/i, l: /^(low|l)$/i, c: /^(close|last|c)$/i,
    v: /^(volume|vol|v)$/i,
    contract: /^(symbol|contract|raw_symbol|instrument)$/i,
};

/**
 * Parses OHLC CSV text. Accepts Databento CSV (ts_event,…,open,high,low,close,volume,symbol),
 * TradingView / NinjaTrader style exports, and split Date + Time columns.
 */
export function parseOHLCCSV(text, { tz = 'UTC', defaultContract = null } = {}) {
    const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('CSV: no data rows');
    const header = splitCSVLine(lines[0]).map((h) => h.replace(/^﻿/, ''));
    const find = (re, not) => header.findIndex((h, i) => re.test(h) && i !== not);
    let it = find(COL.t);
    const dateIdx = header.findIndex((h) => /^date$/i.test(h));
    const timeIdx = header.findIndex((h) => COL.time.test(h));
    const split = dateIdx >= 0 && timeIdx >= 0 && dateIdx !== timeIdx;
    if (split) it = dateIdx;
    const idx = { o: find(COL.o), h: find(COL.h), l: find(COL.l), c: find(COL.c), v: find(COL.v), contract: find(COL.contract) };
    if (it < 0 || [idx.o, idx.h, idx.l, idx.c].some((i) => i < 0)) throw new Error('CSV: required columns timestamp, open, high, low, close not found (header: ' + header.join(',') + ')');
    const bars = [];
    let dropped = 0;
    for (let i = 1; i < lines.length; i++) {
        const c = splitCSVLine(lines[i]);
        const t = parseTimestamp(split ? c[dateIdx] + ' ' + c[timeIdx] : c[it], tz);
        const num = (j) => (j >= 0 && c[j] !== '' ? Number(c[j]) : NaN);
        const b = { t, o: num(idx.o), h: num(idx.h), l: num(idx.l), c: num(idx.c) };
        if (!Number.isFinite(b.t) || ![b.o, b.h, b.l, b.c].every(Number.isFinite) || b.h < b.l || b.h < Math.max(b.o, b.c) || b.l > Math.min(b.o, b.c)) { dropped++; continue; }
        const v = num(idx.v);
        if (Number.isFinite(v)) b.v = v;
        const contract = idx.contract >= 0 ? c[idx.contract] : defaultContract;
        if (contract) b.contract = contract;
        bars.push(b);
    }
    // de-duplicate (last row wins) and sort
    const map = new Map();
    for (const b of bars) map.set(b.t, b);
    const out = [...map.values()].sort((a, b) => a.t - b.t);
    return { bars: out, dropped, duplicates: bars.length - out.length, baseTf: detectTimeframe(out) };
}

/** Native timeframe = most common spacing between consecutive bars (must be a supported timeframe). */
export function detectTimeframe(bars) {
    const counts = new Map();
    for (let i = 1; i < bars.length; i++) {
        const d = Math.round((bars[i].t - bars[i - 1].t) / 60000);
        if (d > 0) counts.set(d, (counts.get(d) || 0) + 1);
    }
    let best = null, n = 0;
    for (const [d, k] of counts) if (k > n) { best = d; n = k; }
    const tf = Object.keys(E.TIMEFRAMES).find((k) => E.TIMEFRAMES[k] === best);
    return tf || null;
}

/** Builds every supported timeframe that can be derived from the native one. */
export function deriveTimeframes(bars, baseTf, wanted = Object.keys(E.TIMEFRAMES)) {
    const out = {};
    for (const tf of wanted) {
        const bm = E.tfMinutes(baseTf), tm = E.tfMinutes(tf);
        if (!bm || !tm || tm < bm || tm % bm !== 0) continue;
        out[tf] = E.resampleBars(bars, baseTf, tf);
    }
    return out;
}

// ── Databento ────────────────────────────────────────────────
export function databentoConfigured(env = process.env) { return Boolean(env.DATABENTO_API_KEY); }

/** Databento CSV (pretty_px, pretty_ts, map_symbols) → bars with the real contract per bar. */
export function parseDatabentoCSV(text) {
    const r = parseOHLCCSV(text, { tz: 'UTC' });
    return r;
}

export async function fetchDatabentoBars({ start, end, env = process.env } = {}) {
    if (!databentoConfigured(env)) {
        const e = new Error('DATABENTO_API_KEY not set');
        e.code = 'NOT_CONFIGURED';
        throw e;
    }
    const symbol = env.DATABENTO_SYMBOL || 'NQ.c.0';
    const hours = Number(env.DATABENTO_LOOKBACK_HOURS) || 72;
    const endMs = end || Date.now();
    const startMs = start || endMs - hours * 3600000;
    const body = new URLSearchParams({
        dataset: 'GLBX.MDP3', schema: 'ohlcv-1m', symbols: symbol,
        stype_in: symbol.includes('.c.') || symbol.includes('.v.') || symbol.includes('.n.') ? 'continuous' : symbol.endsWith('.FUT') ? 'parent' : 'raw_symbol',
        stype_out: 'instrument_id', start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(),
        encoding: 'csv', compression: 'none', pretty_px: 'true', pretty_ts: 'true', map_symbols: 'true',
    });
    const res = await fetchImpl(DATABENTO_URL, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(env.DATABENTO_API_KEY + ':').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/csv' },
        body,
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
        const deny = res.headers && typeof res.headers.get === 'function' ? res.headers.get('x-deny-reason') : null;
        if (deny) throw new Error(`Databento BLOCKED by network egress proxy (${deny}) — hist.databento.com never reached`);
        throw new Error(`Databento HTTP ${res.status}${detail ? ': ' + detail : ''}`);
    }
    const parsed = parseDatabentoCSV(await res.text());
    if (!parsed.bars.length) throw new Error('Databento returned no bars for ' + symbol);
    return { bars: parsed.bars, baseTf: '1m', symbol, dataset: 'GLBX.MDP3', provider: 'Databento (CME GLBX.MDP3)', delayed: true, dropped: parsed.dropped };
}

// ── CSV file ─────────────────────────────────────────────────
export function csvConfigured(env = process.env) { return Boolean(env.NQ_CSV_PATH); }

export async function loadCSVBars({ path, tz, env = process.env } = {}) {
    const file = path || env.NQ_CSV_PATH;
    if (!file) { const e = new Error('NQ_CSV_PATH not set'); e.code = 'NOT_CONFIGURED'; throw e; }
    const parsed = parseOHLCCSV(await readFile(file, 'utf8'), { tz: tz || env.NQ_CSV_TZ || 'UTC' });
    if (!parsed.bars.length) throw new Error('CSV ' + file + ': no valid bars');
    if (!parsed.baseTf) throw new Error('CSV ' + file + ': bar spacing is not a supported timeframe (1m/5m/15m/30m/1h)');
    return { bars: parsed.bars, baseTf: parsed.baseTf, symbol: 'NQ (CSV)', provider: 'CSV file ' + file.split('/').pop(), delayed: true, historical: true, dropped: parsed.dropped, duplicates: parsed.duplicates };
}
