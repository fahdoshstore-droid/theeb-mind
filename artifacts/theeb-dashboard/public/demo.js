/* ═══════════════════════════════════════════════════════════════
   THEEB MIND — DEMO / SIMULATED scenarios
   ⚠ Synthetic data for testing the decision pipeline. NEVER LIVE.
   Every payload carries `simulated: true` and the UI shows a
   permanent DEMO / SIMULATED banner while it is active.
═══════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    // Bars from waypoints: [price, barsToReach]. Optional {sweep} bars.
    function path(start, legs, t0, stepMs) {
        const bars = [];
        let prev = start, t = t0;
        for (const leg of legs) {
            if (leg.bar) { // explicit bar {o,h,l,c} relative to nothing (absolute)
                bars.push({ t: t, o: leg.bar.o, h: leg.bar.h, l: leg.bar.l, c: leg.bar.c });
                prev = leg.bar.c; t += stepMs; continue;
            }
            const [target, n] = leg;
            for (let j = 1; j <= n; j++) {
                const c = prev + (target - prev) / (n - j + 1);
                const w = 2 + (bars.length % 3);
                bars.push({ t: t, o: prev, h: Math.max(prev, c) + w, l: Math.min(prev, c) - w, c: c });
                prev = c; t += stepMs;
            }
        }
        return bars.map((b) => ({ t: b.t, o: +b.o.toFixed(2), h: +b.h.toFixed(2), l: +b.l.toFixed(2), c: +b.c.toFixed(2) }));
    }

    function mirror(bars, axis) {
        return bars.map((b) => ({ t: b.t, o: +(2 * axis - b.o).toFixed(2), h: +(2 * axis - b.l).toFixed(2), l: +(2 * axis - b.h).toFixed(2), c: +(2 * axis - b.c).toFixed(2) }));
    }

    // Long setup: older external high (draw on liquidity) → pullback structure →
    // sell-side raid → displacement (FVG) + BOS → retrace toward discount.
    function longBars15(now) {
        const step = 15 * 60000;
        const legs = [
            [20420, 4], [20460, 3], [20300, 8], [20340, 4], [20180, 8], [20250, 5], [20110, 6], [20210, 5], [20135, 5],
            { bar: { o: 20135, h: 20140, l: 20090, c: 20128 } }, // SSL raid of the 20107 low
            [20175, 2], [20265, 2], [20330, 2], [20345, 2], [20260, 3], [20196, 3],
        ];
        const n = legs.reduce((a, l) => a + (l.bar ? 1 : l[1]), 0);
        return path(20380, legs, now - n * step, step);
    }
    function longBars5(now) {
        const step = 5 * 60000;
        const legs = [
            [20300, 6], [20330, 5], [20250, 8], [20280, 5], [20200, 8], [20230, 4], [20140, 6],
            { bar: { o: 20140, h: 20144, l: 20092, c: 20131 } },
            [20200, 2], [20290, 3], [20296, 2], [20240, 3], [20195, 3],
        ];
        const n = legs.reduce((a, l) => a + (l.bar ? 1 : l[1]), 0);
        return path(20320, legs, now - n * step, step);
    }

    function isoIn(now, minutes) { return new Date(now + minutes * 60000).toISOString(); }

    const SCENARIOS = {
        long: { label: 'LONG candidate', dir: 'LONG', cotIndex: 78, cotNet: 41250, cotChange: 6120, seas: 1, vix: 14.2, news: [['Retail Sales m/m', 'Medium', 300], ['CPI m/m', 'High', 1500]] },
        short: { label: 'SHORT candidate', dir: 'SHORT', cotIndex: 22, cotNet: -18400, cotChange: -5300, seas: -1, vix: 19.6, news: [['Unemployment Claims', 'Medium', 400]] },
        news: { label: 'NO TRADE — News high impact', dir: 'LONG', cotIndex: 78, cotNet: 41250, cotChange: 6120, seas: 1, vix: 16.1, news: [['CPI m/m', 'High', 18], ['Core CPI m/m', 'High', 18]] },
        tril: { label: 'NO TRADE — TRIL fail (context conflict)', dir: 'LONG', cotIndex: 24, cotNet: -15200, cotChange: -2100, seas: -1, vix: 17.3, news: [] },
        caution: { label: 'LONG + News caution', dir: 'LONG', cotIndex: 71, cotNet: 30100, cotChange: 2200, seas: 1, vix: 27.4, news: [['FOMC Member Speaks', 'Medium', 75], ['Fed Chair Powell Speaks', 'High', 95]] },
    };

    function seasonality(sign, monthName) {
        const w = (avg, wr, n) => ({ avg: sign * avg, winRate: sign > 0 ? wr : 1 - wr, n });
        return { month: monthName, y10: w(1.9, 0.7, 10), y5: w(2.4, 0.8, 5), y2: w(1.1, 1, 2), simulated: true };
    }

    /** Returns the same shapes the live server returns, flagged simulated. */
    function scenario(key, now) {
        const s = SCENARIOS[key] || SCENARIOS.long;
        let b15 = longBars15(now), b5 = longBars5(now);
        if (s.dir === 'SHORT') { b15 = mirror(b15, 20200); b5 = mirror(b5, 20200); }
        const report = new Date(now - 4 * 86400000).toISOString().slice(0, 10);
        const month = new Date(now).toLocaleString('en-US', { month: 'long', timeZone: 'America/New_York' });
        return {
            simulated: true,
            label: s.label,
            cot: { net: s.cotNet, change: s.cotChange, index: s.cotIndex, reportDate: report, market: 'NASDAQ MINI (SIMULATED)', simulated: true },
            seasonality: seasonality(s.seas, month),
            vix: { value: s.vix, simulated: true },
            bars15: b15,
            bars5: b5,
            news: { events: s.news.map((e) => ({ title: e[0], country: 'USD', impact: e[1], time: isoIn(now, e[2]) })), simulated: true },
        };
    }

    /** Simulated in-session clock so demo scenarios are testable at any hour. */
    const SESSION = Object.freeze({ marketOpen: true, killZone: 'NY AM KZ (SIMULATED)', inKillZone: true, endsIn: 45, next: 'NY PM KZ', nextIn: 225, simulated: true });

    const api = { SCENARIOS, scenario, SESSION };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TheebDemo = api;
})(typeof self !== 'undefined' ? self : this);
