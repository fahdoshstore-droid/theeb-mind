/* ═══════════════════════════════════════════════════════════════
   THEEB MIND — DEMO / SIMULATED scenarios
   ⚠ Synthetic data for testing the decision pipeline. NEVER used in LIVE.
   Every payload carries `simulated: true`, every source is labelled
   "SIMULATED", and the UI shows a permanent DEMO banner while active.
═══════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    const M15 = 15 * 60000, M5 = 5 * 60000;

    // Bars from waypoints: [price, barsToReach] or { bar: {o,h,l,c} }
    function path(start, legs, lastStart, stepMs) {
        const raw = [];
        let prev = start;
        for (const leg of legs) {
            if (leg.bar) { raw.push(Object.assign({}, leg.bar)); prev = leg.bar.c; continue; }
            const [target, n] = leg;
            for (let j = 1; j <= n; j++) {
                const c = prev + (target - prev) / (n - j + 1);
                const w = 2 + (raw.length % 3);
                raw.push({ o: prev, h: Math.max(prev, c) + w, l: Math.min(prev, c) - w, c });
                prev = c;
            }
        }
        const t0 = lastStart - (raw.length - 1) * stepMs;
        return raw.map((b, i) => ({ t: t0 + i * stepMs, o: +b.o.toFixed(2), h: +b.h.toFixed(2), l: +b.l.toFixed(2), c: +b.c.toFixed(2), v: 900 + ((i * 37) % 400) }));
    }
    const mirror = (bars, axis) => bars.map((b) => ({ t: b.t, o: +(2 * axis - b.o).toFixed(2), h: +(2 * axis - b.l).toFixed(2), l: +(2 * axis - b.h).toFixed(2), c: +(2 * axis - b.c).toFixed(2), v: b.v }));
    const shift = (bars, dp, dt) => bars.map((b) => ({ t: b.t + (dt || 0), o: +(b.o + dp).toFixed(2), h: +(b.h + dp).toFixed(2), l: +(b.l + dp).toFixed(2), c: +(b.c + dp).toFixed(2), v: b.v }));
    const scale = (bars, k) => bars.map((b) => ({ t: b.t, o: +(b.o * k).toFixed(2), h: +(b.h * k).toFixed(2), l: +(b.l * k).toFixed(2), c: +(b.c * k).toFixed(2), v: b.v }));

    /** S&P does not confirm the low taken in the recent window → bullish SMT (mirrors into bearish). */
    function noConfirmLow(bars, R, W) {
        const n = bars.length;
        const refMin = Math.min(...bars.slice(n - R - W, n - R).map((b) => b.l));
        return bars.map((b, i) => {
            if (i < n - R || b.l >= refMin) return b;
            const l = +(refMin + 0.5).toFixed(2);
            return { t: b.t, o: Math.max(b.o, l), h: Math.max(b.h, l), l, c: Math.max(b.c, l), v: b.v };
        });
    }

    // Long setup: external high (draw on liquidity) → pullback structure → SSL raid → displacement + MSS → retrace into discount
    function longLegs15(opts) {
        return [
            [opts.noExternalHigh ? 20330 : 20420, 4], [opts.noExternalHigh ? 20335 : 20460, 3], [20300, 8], [20340, 4], [20180, 8], [20250, 5], [20110, 6], [20210, 5], [20135, 5],
            opts.noRaid ? [20125, 1] : { bar: { o: 20135, h: 20140, l: 20090, c: 20128 } },
            [20175, 2], [20265, 2], [20330, 2], [20345, 2], [20260, 3], [20196, 3],
        ];
    }
    function longLegs5(opts) {
        return [
            [20330, 20], [20300, 6], [20330, 5], [20250, 8], [20280, 5], [20200, 8], [20230, 4], [20140, 6],
            opts.noRaid ? [20135, 1] : { bar: { o: 20140, h: 20144, l: 20092, c: 20131 } },
            [20200, 2], [20290, 3], [20296, 2], [20240, 3], [20195, 3],
        ];
    }

    const OK = 'OK';
    const SCENARIOS = {
        long:          { label: 'LONG — all aligned, SMT bullish, news clear', dir: 'LONG' },
        short:         { label: 'SHORT — all aligned, SMT bearish', dir: 'SHORT' },
        news_high:     { label: 'NO TRADE — News HIGH IMPACT (CPI in 18m)', dir: 'LONG', news: [['CPI m/m', 'High', 18], ['Core CPI m/m', 'High', 18]] },
        tril_fail:     { label: 'NO TRADE — TRIL FAIL (no raid)', dir: 'LONG', noRaid: true },
        risk_fail:     { label: 'NO TRADE — RISK FAIL (RRR below 1:2.5)', dir: 'LONG', noExternalHigh: true },
        cot_off:       { label: 'COT unavailable (seasonality-only context)', dir: 'LONG', cot: null },
        seas_off:      { label: 'Seasonality unavailable (COT-only context)', dir: 'LONG', seas: null },
        vix_off:       { label: 'VIX unavailable', dir: 'LONG', vix: null },
        nq_delayed:    { label: 'NQ DELAYED feed (no fresh NAS100)', dir: 'LONG', nq: 'delayed', nas: 'delayed' },
        nas_proxy:     { label: 'NQ unavailable → NAS100 PROXY', dir: 'LONG', nq: 'off', nas: 'fresh' },
        no_data:       { label: 'NO TRADE — NQ + NAS100 unavailable', dir: 'LONG', nq: 'off', nas: 'stale' },
        smt_none:      { label: 'SMT NONE (S&P confirms the low)', dir: 'LONG', spx: 'none' },
        smt_unclear:   { label: 'SMT UNCLEAR (S&P data unavailable)', dir: 'LONG', spx: 'off' },
    };

    function isoIn(now, minutes) { return new Date(now + minutes * 60000).toISOString(); }
    const LABEL = 'SIMULATED';

    function seasonality(sign, now) {
        const w = (avg, n) => ({ averageChange: sign * avg, winRate: sign > 0 ? 0.8 : 0.2, n, seasonalBias: sign > 0 ? 'BULLISH' : 'BEARISH', basis: 'monthly return' });
        const d = new Date(now);
        return {
            y10: w(1.9, 10), y5: w(2.4, 5), y2: w(1.1, 2),
            currentMonth: d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), currentDay: d.getUTCDate(),
            averageChange: sign * 1.8, seasonalBias: sign > 0 ? 'BULLISH' : 'BEARISH', source: LABEL, fetchedAt: d.toISOString(), status: OK, simulated: true,
        };
    }

    function series(key, b15, b5, opts) {
        const mode = opts || 'fresh';
        const base = { key, symbol: { NQ: 'CME_MINI:NQ1!', NAS100: 'OANDA:NAS100USD', SPX: 'CME_MINI:ES1!' }[key] + ' (SIM)', provider: LABEL, simulated: true };
        if (mode === 'off') return Object.assign(base, { status: 'DATA_UNAVAILABLE', bars15: null, bars5: null, errors: ['SIMULATED: source unavailable'] });
        if (mode === 'stale') return Object.assign(base, { status: OK, delayed: false, bars15: shift(b15, 0, -3 * 3600000), bars5: shift(b5, 0, -3 * 3600000) });
        return Object.assign(base, { status: OK, delayed: mode === 'delayed', bars15: b15, bars5: b5 });
    }

    /** Returns the same shapes the live server returns, every item flagged simulated. */
    function scenario(key, now) {
        const s = Object.assign({ cot: 'on', seas: 'on', vix: 'on', news: [['Retail Sales m/m', 'Medium', 300], ['CPI m/m', 'High', 1500]], nq: 'fresh', nas: 'fresh', spx: 'smt' }, SCENARIOS[key] || SCENARIOS.long);
        const last15 = Math.floor(now / M15) * M15, last5 = Math.floor(now / M5) * M5;
        let b15 = path(20380, longLegs15(s), last15, M15), b5 = path(20320, longLegs5(s), last5, M5);
        let spx15 = scale(b15, 0.29), spx5 = scale(b5, 0.29);
        if (s.spx === 'smt') { spx15 = noConfirmLow(spx15, 16, 32); spx5 = noConfirmLow(spx5, 24, 48); }
        const sign = s.dir === 'SHORT' ? -1 : 1;
        if (sign < 0) {
            b15 = mirror(b15, 20200); b5 = mirror(b5, 20200);
            spx15 = mirror(spx15, 20200 * 0.29); spx5 = mirror(spx5, 20200 * 0.29);
        }
        const report = new Date(now - 4 * 86400000).toISOString().slice(0, 10);
        const cot = s.cot === null ? { status: 'DATA_UNAVAILABLE', source: null, errors: ['SIMULATED: MarketBulls & CFTC unavailable'], simulated: true } : {
            reportDate: report, largeSpecLong: sign > 0 ? 98250 : 41200, largeSpecShort: sign > 0 ? 57000 : 59600, largeSpecNet: sign > 0 ? 41250 : -18400,
            weeklyChange: sign > 0 ? 6120 : -5300, cotIndex6m: sign > 0 ? 84 : 18, cotIndex36m: sign > 0 ? 78 : 22,
            commercials: { long: 120400, short: 158900, net: sign > 0 ? -38500 : 16200 }, smallTraders: { long: 30100, short: 32850, net: sign > 0 ? -2750 : 2200 },
            source: LABEL, fetchedAt: new Date(now).toISOString(), status: OK, simulated: true,
        };
        return {
            simulated: true,
            label: s.label,
            cot,
            seasonality: s.seas === null ? { status: 'DATA_UNAVAILABLE', source: null, errors: ['SIMULATED: seasonality unavailable'], simulated: true } : seasonality(sign, now),
            vix: s.vix === null ? { status: 'DATA_UNAVAILABLE', value: null, source: null, simulated: true } : { status: OK, value: sign > 0 ? 14.2 : 19.6, source: LABEL, simulated: true },
            market: {
                simulated: true,
                series: {
                    NQ: series('NQ', b15, b5, s.nq),
                    NAS100: series('NAS100', shift(b15, -45), shift(b5, -45), s.nas),
                    SPX: series('SPX', spx15, spx5, s.spx === 'off' ? 'off' : 'fresh'),
                },
            },
            news: { status: OK, events: s.news.map((e) => ({ title: e[0], country: 'USD', impact: e[1], time: isoIn(now, e[2]) })), source: LABEL, simulated: true },
        };
    }

    /** Simulated in-session clock so demo scenarios are testable at any hour. */
    const SESSION = Object.freeze({ marketOpen: true, killZone: 'NY AM KZ (SIMULATED)', inKillZone: true, endsIn: 45, next: 'NY PM KZ', nextIn: 225, simulated: true });

    const api = { SCENARIOS, scenario, SESSION };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TheebDemo = api;
})(typeof self !== 'undefined' ? self : this);
