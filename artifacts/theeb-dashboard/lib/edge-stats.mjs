// ═══════════════════════════════════════════════════════════════
// Edge Stats — timeframe validation on REAL historical NQ OHLC.
//
// For each candidate timeframe configuration (structure TF, execution TF) the
// SAME engine functions the live dashboard uses are replayed bar by bar:
//   analyzeStructure → analyzeEntry → computeTRIL → suggestLevels (risk)
// A setup is counted when Structure has a direction, TRIL R/I/L PASS and the
// planned trade meets Min RRR. The trade is then simulated on the finest bars:
// limit fill at entry, SL / TP, conservative when both are hit in one bar.
//
// T (Trend) is the CONTEXT layer (weekly COT + seasonality). It does not depend on
// the chart timeframe and historical context data is not part of this dataset, so
// T is not evaluated here; the comparison between timeframes is R / I / L + Structure.
//
// No data is generated: with no history, every configuration is INSUFFICIENT.
// ═══════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const E = require('../public/engine.js');

export const CANDIDATE_CONFIGS = [
    // single timeframe (structure = execution)
    ['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1h', '1h'],
    // higher-timeframe structure + lower-timeframe execution
    ['5m', '1m'], ['15m', '1m'], ['15m', '5m'], ['30m', '5m'], ['30m', '15m'], ['1h', '5m'], ['1h', '15m'],
];

export const EVIDENCE = { INSUFFICIENT: 10, USABLE: 30 }; // <10 insufficient · 10–29 weak · 30+ usable

const DEFAULTS = { structWindow: 200, execWindow: 150, minRRR: 2.5, fillBars: 12, maxHoldHours: 48 };

// ── statistics ───────────────────────────────────────────────
export function wilson(k, n, z = 1.96) {
    if (!n) return null;
    const p = k / n, d = 1 + (z * z) / n;
    const c = (p + (z * z) / (2 * n)) / d;
    const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const r3 = (v) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);

export function evidenceClass(n) {
    return n < EVIDENCE.INSUFFICIENT ? 'INSUFFICIENT' : n < EVIDENCE.USABLE ? 'WEAK' : 'USABLE';
}

/** trades: [{ t, r }] in chronological order (r = outcome in R multiples). */
export function computeStats(trades) {
    const n = trades.length;
    const R = trades.map((x) => x.r);
    const wins = R.filter((r) => r > 0).length;
    const pos = R.filter((r) => r > 0).reduce((a, b) => a + b, 0), neg = -R.filter((r) => r < 0).reduce((a, b) => a + b, 0);
    const m = mean(R), s = sd(R);
    const periods = [];
    if (n >= 4) for (let k = 0; k < 4; k++) {
        const part = R.slice(Math.floor((k * n) / 4), Math.floor(((k + 1) * n) / 4));
        periods.push({ n: part.length, expectancy: r3(mean(part)) });
    }
    const recentPart = R.slice(Math.floor(n * 0.7));
    const yearly = {};
    for (const x of trades) {
        const y = new Date(x.t).getUTCFullYear();
        (yearly[y] = yearly[y] || []).push(x.r);
    }
    return {
        n, evidence: evidenceClass(n),
        wins, losses: R.filter((r) => r < 0).length,
        winRate: n ? r3(wins / n) : null,
        wilson95: n ? wilson(wins, n).map(r3) : null,
        avgR: r3(m), expectancy: r3(m),
        avgWinR: wins ? r3(pos / wins) : null,
        avgLossR: R.some((r) => r < 0) ? r3(-neg / R.filter((r) => r < 0).length) : null,
        profitFactor: neg > 0 ? r3(pos / neg) : pos > 0 ? Infinity : null,
        sdR: r3(s),
        expectancyLB95: n >= 2 && s !== null ? r3(m - (1.96 * s) / Math.sqrt(n)) : null,
        recent: { n: recentPart.length, expectancy: r3(mean(recentPart)) },
        periods,
        stability: periods.length ? r3(periods.filter((p) => p.expectancy > 0).length / periods.length) : null,
        yearly: Object.fromEntries(Object.entries(yearly).map(([y, a]) => [y, { n: a.length, expectancy: r3(mean(a)), winRate: r3(a.filter((r) => r > 0).length / a.length) }])),
    };
}

/** A configuration is eligible only with usable sample size AND a stable, positive edge. */
export function eligibility(st) {
    const why = [];
    if (st.n < EVIDENCE.USABLE) why.push('n = ' + st.n + ' (< ' + EVIDENCE.USABLE + ')');
    if (!(st.expectancyLB95 > 0)) why.push('expectancy 95% lower bound ' + st.expectancyLB95 + ' ≤ 0');
    if (!(st.profitFactor >= 1.2)) why.push('profit factor ' + st.profitFactor + ' < 1.2');
    if (!(st.stability >= 0.75)) why.push('positive in ' + Math.round((st.stability || 0) * 4) + '/4 periods');
    if (!(st.recent && st.recent.expectancy > 0)) why.push('recent expectancy ' + (st.recent && st.recent.expectancy) + ' ≤ 0');
    return { eligible: why.length === 0, why };
}

// ── replay ───────────────────────────────────────────────────
/** Simulates one planned trade on the finest bars after `fromT`. Returns { r, exitT } or null (never filled). */
export function simulateTrade(fine, startIdx, plan, opts) {
    const { direction, entry, sl, tp } = plan;
    const risk = Math.abs(entry - sl);
    if (!(risk > 0)) return null;
    const long = direction === 'LONG';
    const fineMin = opts.fineMin;
    const fillUntil = fine[startIdx] ? fine[startIdx].t + opts.fillBars * opts.execMin * 60000 : 0;
    let i = startIdx, filled = false, fillT = null;
    for (; i < fine.length && fine[i].t < fillUntil; i++) {
        const b = fine[i];
        // target reached before the limit fills → setup missed, no trade
        if (long ? b.h >= tp : b.l <= tp) return null;
        if (long ? b.l <= entry : b.h >= entry) { filled = true; fillT = b.t; break; }
    }
    if (!filled) return null;
    const holdUntil = fillT + opts.maxHoldHours * 3600000;
    for (; i < fine.length && fine[i].t <= holdUntil; i++) {
        const b = fine[i];
        const hitSL = long ? b.l <= sl : b.h >= sl;
        const hitTP = long ? b.h >= tp : b.l <= tp;
        if (hitSL) return { r: -1, exitT: b.t + fineMin * 60000, exit: 'SL' }; // SL first when both hit in the same bar (conservative)
        if (hitTP) return { r: r3(Math.abs(tp - entry) / risk), exitT: b.t + fineMin * 60000, exit: 'TP' };
    }
    const last = fine[Math.min(i, fine.length) - 1];
    if (!last) return null;
    return { r: r3(((last.c - entry) / risk) * (long ? 1 : -1)), exitT: last.t + fineMin * 60000, exit: 'TIME' };
}

/** Replays one configuration over one contract segment of fine (base) bars. */
function replaySegment(fine, baseTf, structTf, execTf, o) {
    const sBars = E.resampleBars(fine, baseTf, structTf).filter((b) => b.complete !== false || structTf === baseTf);
    const xBars = E.resampleBars(fine, baseTf, execTf).filter((b) => b.complete !== false || execTf === baseTf);
    const sMs = E.tfMinutes(structTf) * 60000, xMs = E.tfMinutes(execTf) * 60000;
    const trades = [];
    let si = 0, structCache = { idx: -1, res: null }, busyUntil = -Infinity, lastKey = null;
    let fi = 0;
    for (let xi = 0; xi < xBars.length; xi++) {
        const closeT = xBars[xi].t + xMs;
        if (closeT <= busyUntil) continue;
        while (si < sBars.length && sBars[si].t + sMs <= closeT) si++;
        if (si < 30 || xi + 1 < 30) continue;
        if (structCache.idx !== si) structCache = { idx: si, res: E.analyzeStructure(sBars.slice(Math.max(0, si - o.structWindow), si)) };
        const s = structCache.res;
        if (s.status !== 'OK') continue;
        const direction = s.bias === 'BULLISH' ? 'LONG' : s.bias === 'BEARISH' ? 'SHORT' : null;
        if (!direction) continue;
        const e = E.analyzeEntry(xBars.slice(Math.max(0, xi + 1 - o.execWindow), xi + 1), direction);
        const lv = E.suggestLevels(direction, s, e, 'NQ', o.minRRR);
        if (!lv || ![lv.entry, lv.sl, lv.tp].every(Number.isFinite)) continue;
        // T is the context layer (not timeframe-dependent) → context set to the setup direction; R / I / L are evaluated
        const tril = E.computeTRIL({ direction, context: { bias: s.bias }, sStruct: s, eExec: e, tf: { structure: structTf, execution: execTf }, plannedEntry: lv.entry });
        if (tril.status !== 'PASS') continue;
        if (Math.abs(lv.tp - lv.entry) / Math.abs(lv.entry - lv.sl) < o.minRRR - 1e-9) continue;
        const key = direction + lv.entry + '/' + lv.sl;
        if (key === lastKey) continue; // same setup re-detected on the next bar
        lastKey = key;
        while (fi < fine.length && fine[fi].t < closeT) fi++;
        const res = simulateTrade(fine, fi, { direction, entry: lv.entry, sl: lv.sl, tp: lv.tp }, { fineMin: E.tfMinutes(baseTf), execMin: E.tfMinutes(execTf), fillBars: o.fillBars, maxHoldHours: o.maxHoldHours });
        if (!res) { busyUntil = closeT + o.fillBars * xMs; continue; }
        trades.push({ t: closeT, direction, r: res.r, exit: res.exit, entry: lv.entry, sl: lv.sl, tp: lv.tp });
        busyUntil = res.exitT;
    }
    return trades;
}

/**
 * Runs every candidate configuration that the base timeframe can support.
 * bars: real OHLC bars (one series, chronological), baseTf: their native timeframe.
 */
export function validateTimeframes(bars, baseTf, opts = {}) {
    const o = Object.assign({}, DEFAULTS, opts);
    const baseMin = E.tfMinutes(baseTf);
    const segments = E.splitAtRolls(bars || []); // never let a setup or trade span a contract roll
    const results = [];
    for (const [structTf, execTf] of o.configs || CANDIDATE_CONFIGS) {
        const sm = E.tfMinutes(structTf), xm = E.tfMinutes(execTf);
        if (!baseMin || sm < baseMin || xm < baseMin || sm % baseMin || xm % baseMin) {
            results.push({ structure: structTf, execution: execTf, supported: false, reason: 'base data is ' + (baseTf || 'unknown') + ' — cannot build ' + (xm < baseMin ? execTf : structTf) });
            continue;
        }
        const trades = [];
        for (const seg of segments) if (seg.length) trades.push(...replaySegment(seg, baseTf, structTf, execTf, o));
        trades.sort((a, b) => a.t - b.t);
        const stats = computeStats(trades);
        const el = eligibility(stats);
        results.push({ structure: structTf, execution: execTf, supported: true, stats, eligible: el.eligible, rejectedBecause: el.why });
    }
    const eligible = results.filter((r) => r.eligible).sort((a, b) => b.stats.expectancyLB95 - a.stats.expectancyLB95);
    const best = eligible[0] || null;
    const span = bars && bars.length ? { from: new Date(bars[0].t).toISOString(), to: new Date(bars[bars.length - 1].t).toISOString(), bars: bars.length, contracts: [...new Set(bars.map((b) => b.contract).filter(Boolean))] } : null;
    return {
        generatedAt: new Date().toISOString(),
        baseTf, data: span, rolls: Math.max(0, segments.length - 1),
        method: 'Replay of analyzeStructure / analyzeEntry / computeTRIL (R,I,L) / suggestLevels; limit fill at entry, SL before TP in the same bar, 48h max hold. T = context layer, not evaluated.',
        selection: best
            ? { status: 'VALIDATED', structure: best.structure, execution: best.execution, detail: 'Highest expectancy 95% lower bound among eligible configs (n=' + best.stats.n + ', E=' + best.stats.expectancy + 'R, LB95=' + best.stats.expectancyLB95 + 'R)' }
            : { status: 'INSUFFICIENT', structure: null, execution: null, detail: 'NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE' },
        results,
    };
}

/** Timeframe configuration for the live engine from a validation report (+ optional explicit choice). */
export function timeframesFromValidation(report, choice = {}) {
    if (!report) return { structure: null, execution: null, status: 'NOT_RUN', detail: 'NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE (no validation run on real NQ data)' };
    if (choice.structure) {
        const r = (report.results || []).find((x) => x.structure === choice.structure && x.execution === (choice.execution || choice.structure));
        if (!r || !r.supported) return { structure: choice.structure, execution: choice.execution || choice.structure, status: 'NOT_RUN', detail: 'Configured timeframe was not validated' };
        return { structure: r.structure, execution: r.execution, status: r.eligible ? 'VALIDATED' : 'INSUFFICIENT', detail: r.eligible ? 'Validated n=' + r.stats.n : r.rejectedBecause.join(' · '), evidence: r.stats };
    }
    const sel = report.selection || {};
    if (sel.status === 'VALIDATED') {
        const r = report.results.find((x) => x.structure === sel.structure && x.execution === sel.execution);
        return { structure: sel.structure, execution: sel.execution, status: 'VALIDATED', detail: sel.detail, evidence: r && r.stats };
    }
    return { structure: null, execution: null, status: 'INSUFFICIENT', detail: sel.detail || 'NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE' };
}
