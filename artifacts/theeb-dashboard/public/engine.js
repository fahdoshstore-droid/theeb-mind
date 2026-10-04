/* ═══════════════════════════════════════════════════════════════
   THEEB MIND — Decision Engine (deterministic, no LLM)
   READ → ANALYZE → FILTER → VALIDATE → DECIDE

   Pure functions only. Runs in the browser (window.TheebEngine)
   and in Node (module.exports) so the same rules are unit-tested.
   Nothing here invents data: missing input → UNAVAILABLE / N/A.
═══════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';

    // ── Rules (from the existing project: 2 trades/day, 1% / $500, RRR ≥ 2.5, $600 daily loss)
    const DEFAULT_RULES = Object.freeze({
        balance: 50000,
        riskPct: 1,
        maxRiskUsd: 500,
        maxTradesPerDay: 2,
        minRRR: 2.5,
        dailyLossLimit: 600,
        consecLossLimit: 2,
        requireKillZone: true,
    });

    // CME contract specs: NQ = $20/pt, MNQ = $2/pt, tick 0.25
    const INSTRUMENTS = Object.freeze({
        NQ: { pointValue: 20, tick: 0.25, label: 'E-mini Nasdaq-100' },
        MNQ: { pointValue: 2, tick: 0.25, label: 'Micro E-mini Nasdaq-100' },
    });

    const BULL = 'BULLISH', BEAR = 'BEARISH', NEUTRAL = 'NEUTRAL', UNAVAILABLE = 'UNAVAILABLE';
    const PASS = 'PASS', FAIL = 'FAIL', UNCLEAR = 'UNCLEAR';

    const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
    const dirOf = (bias) => (bias === BULL ? 'LONG' : bias === BEAR ? 'SHORT' : null);
    const biasOf = (dir) => (dir === 'LONG' ? BULL : dir === 'SHORT' ? BEAR : null);
    const roundTick = (p, tick) => Math.round(p / tick) * tick;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // ═══════════════════════════════════════════════════════════
    // 1. MARKET CONTEXT — COT + Seasonality + VIX
    //    Input schemas come from the server adapters (MarketBulls / fallbacks).
    //    status !== 'OK' → UNAVAILABLE. It is never turned into NEUTRAL.
    // ═══════════════════════════════════════════════════════════

    /** cot: { status, reportDate, largeSpecNet, weeklyChange, cotIndex6m, cotIndex36m, ... } */
    function analyzeCOT(cot, now) {
        if (!cot || cot.status !== 'OK' || !isNum(cot.largeSpecNet)) return { status: UNAVAILABLE, bias: null, note: 'COT data unavailable' };
        const ageDays = cot.reportDate ? (now - Date.parse(cot.reportDate + 'T00:00:00Z')) / 86400000 : Infinity;
        if (!(ageDays <= 21)) return { status: UNAVAILABLE, bias: null, note: 'COT report stale (' + (cot.reportDate || '?') + ')' };
        let bias, basis;
        const idx = isNum(cot.cotIndex36m) ? cot.cotIndex36m : isNum(cot.cotIndex6m) ? cot.cotIndex6m : null;
        if (idx !== null) {
            bias = idx >= 60 ? BULL : idx <= 40 ? BEAR : NEUTRAL;
            basis = (isNum(cot.cotIndex36m) ? 'COT Index 36M ' : 'COT Index 6M ') + Math.round(idx);
        } else if (isNum(cot.weeklyChange)) {
            const net = cot.largeSpecNet;
            bias = net > 0 && cot.weeklyChange > 0 ? BULL : net < 0 && cot.weeklyChange < 0 ? BEAR : NEUTRAL;
            basis = 'net + weekly change';
        } else {
            bias = NEUTRAL;
            basis = 'net only';
        }
        return { status: 'OK', bias, basis };
    }

    /** seas: { status, y10, y5, y2: {averageChange, seasonalBias}|null, currentMonth } */
    function analyzeSeasonality(seas) {
        const windows = {};
        let avail = 0, bull = 0, bear = 0;
        for (const k of ['y10', 'y5', 'y2']) {
            const w = seas && seas.status === 'OK' ? seas[k] : null;
            if (!w || !isNum(w.averageChange) || ![BULL, BEAR, NEUTRAL].includes(w.seasonalBias)) { windows[k] = null; continue; }
            avail++;
            if (w.seasonalBias === BULL) bull++;
            if (w.seasonalBias === BEAR) bear++;
            windows[k] = w;
        }
        if (avail < 2) return { status: UNAVAILABLE, bias: null, windows, note: 'Seasonality data unavailable' };
        const bias = bull >= 2 ? BULL : bear >= 2 ? BEAR : NEUTRAL;
        return { status: 'OK', bias, windows, bullCount: bull, bearCount: bear, month: seas.currentMonth };
    }

    /** vix: { status, value } — volatility state only, never a direction */
    function analyzeVIX(vix) {
        if (!vix || vix.status !== 'OK' || !isNum(vix.value)) return { status: UNAVAILABLE, state: null, note: 'VIX unavailable' };
        const state = vix.value < 15 ? 'LOW' : vix.value <= 25 ? 'NORMAL' : 'HIGH';
        return { status: 'OK', state, value: vix.value };
    }

    /** COT weighs 2, seasonality 1. VIX never changes direction. */
    function buildContext(cotA, seasA, vixA) {
        const hasCot = cotA.status === 'OK', hasSeas = seasA.status === 'OK';
        const pts = (b, w) => (b === BULL ? w : b === BEAR ? -w : 0);
        let bias, partial = false;
        if (!hasCot && !hasSeas) {
            bias = UNAVAILABLE;
        } else if (hasCot && hasSeas) {
            const score = pts(cotA.bias, 2) + pts(seasA.bias, 1);
            bias = score >= 2 ? BULL : score <= -2 ? BEAR : NEUTRAL;
        } else {
            partial = true;
            bias = hasCot ? cotA.bias : seasA.bias;
        }
        return { bias, partial, cot: cotA, seasonality: seasA, vix: vixA };
    }
    // ═══════════════════════════════════════════════════════════
    // 2. MARKET STRUCTURE — 15m (trend/structure/liquidity), 5m (entry)
    //    ICT / SMC: fractal swings, BOS/MSS, sweeps, FVG, premium/discount
    // ═══════════════════════════════════════════════════════════

    function cleanBars(bars) {
        if (!Array.isArray(bars)) return [];
        return bars.filter((b) => b && isNum(b.o) && isNum(b.h) && isNum(b.l) && isNum(b.c) && b.h >= b.l);
    }

    /** Fractal swings: k bars on each side. Returns [{i, price, type:'H'|'L'}] */
    function findSwings(bars, k) {
        k = k || 2;
        const out = [];
        for (let i = k; i < bars.length - k; i++) {
            let isH = true, isL = true;
            for (let j = 1; j <= k; j++) {
                if (!(bars[i].h > bars[i - j].h && bars[i].h >= bars[i + j].h)) isH = false;
                if (!(bars[i].l < bars[i - j].l && bars[i].l <= bars[i + j].l)) isL = false;
            }
            if (isH) out.push({ i, price: bars[i].h, type: 'H' });
            if (isL) out.push({ i, price: bars[i].l, type: 'L' });
        }
        return out;
    }

    /** Close-based breaks of the latest confirmed swing (confirmation = i + k). */
    function structureBreaks(bars, swings, k) {
        const events = [];
        let activeH = null, activeL = null, si = 0, lastDir = null;
        const sorted = swings.slice().sort((a, b) => a.i - b.i);
        for (let t = 0; t < bars.length; t++) {
            while (si < sorted.length && sorted[si].i + k <= t) {
                const s = sorted[si++];
                if (s.type === 'H') activeH = s; else activeL = s;
            }
            if (activeH && bars[t].c > activeH.price) {
                events.push({ t, dir: 'UP', level: activeH.price, kind: lastDir === 'DOWN' ? 'MSS' : 'BOS' });
                lastDir = 'UP'; activeH = null;
            } else if (activeL && bars[t].c < activeL.price) {
                events.push({ t, dir: 'DOWN', level: activeL.price, kind: lastDir === 'UP' ? 'MSS' : 'BOS' });
                lastDir = 'DOWN'; activeL = null;
            }
        }
        return events;
    }

    /** Liquidity raids: wick through a prior swing, close back inside (same bar or within 2 bars). */
    function findRaids(bars, swings, lookback) {
        const raids = [];
        const start = Math.max(0, bars.length - lookback);
        for (let t = start; t < bars.length; t++) {
            for (const s of swings) {
                if (s.i >= t - 1) continue; // swing must exist before the raid bar
                // swing must not have been taken earlier (between s.i and t)
                let takenBefore = false;
                for (let u = s.i + 1; u < t; u++) {
                    if ((s.type === 'H' && bars[u].h > s.price) || (s.type === 'L' && bars[u].l < s.price)) { takenBefore = true; break; }
                }
                if (takenBefore) continue;
                const back = (u) => (s.type === 'H' ? bars[u].c < s.price : bars[u].c > s.price);
                if (s.type === 'H' && bars[t].h > s.price) {
                    let ok = back(t);
                    for (let u = t + 1; !ok && u <= Math.min(t + 2, bars.length - 1); u++) ok = back(u);
                    if (ok) raids.push({ t, side: 'BSL', level: s.price, extreme: bars[t].h });
                } else if (s.type === 'L' && bars[t].l < s.price) {
                    let ok = back(t);
                    for (let u = t + 1; !ok && u <= Math.min(t + 2, bars.length - 1); u++) ok = back(u);
                    if (ok) raids.push({ t, side: 'SSL', level: s.price, extreme: bars[t].l });
                }
            }
        }
        return raids;
    }

    /** Fair value gaps in the last `lookback` bars, with mitigation status. */
    function findFVGs(bars, lookback) {
        const out = [];
        const start = Math.max(2, bars.length - lookback);
        for (let i = start; i < bars.length; i++) {
            if (bars[i].l > bars[i - 2].h) {
                const lo = bars[i - 2].h, hi = bars[i].l;
                let filled = false, touched = false;
                for (let u = i + 1; u < bars.length; u++) {
                    if (bars[u].l <= lo) filled = true;
                    if (bars[u].l <= hi) touched = true;
                }
                out.push({ i, dir: 'UP', lo, hi, filled, touched });
            } else if (bars[i].h < bars[i - 2].l) {
                const lo = bars[i].h, hi = bars[i - 2].l;
                let filled = false, touched = false;
                for (let u = i + 1; u < bars.length; u++) {
                    if (bars[u].h >= hi) filled = true;
                    if (bars[u].h >= lo) touched = true;
                }
                out.push({ i, dir: 'DOWN', lo, hi, filled, touched });
            }
        }
        return out;
    }

    function analyzeStructure(rawBars) {
        const bars = cleanBars(rawBars);
        if (bars.length < 30) return { status: UNAVAILABLE, bias: null, note: 'Structure data unavailable' };
        const k = 2;
        const swings = findSwings(bars, k);
        const highs = swings.filter((s) => s.type === 'H');
        const lows = swings.filter((s) => s.type === 'L');
        const price = bars[bars.length - 1].c;

        let trend = 'RANGE';
        if (highs.length >= 2 && lows.length >= 2) {
            const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
            const hl = lows[lows.length - 1].price > lows[lows.length - 2].price;
            if (hh && hl) trend = BULL;
            else if (!hh && !hl) trend = BEAR;
        }

        const events = structureBreaks(bars, swings, k);
        const last = events[events.length - 1] || null;
        let bias;
        if (last) bias = last.dir === 'UP' ? BULL : BEAR;
        else bias = trend === 'RANGE' ? NEUTRAL : trend;
        const structureLabel = last ? last.kind + (last.dir === 'UP' ? ' ↑' : ' ↓') + ' @ ' + last.level.toFixed(2) : 'No break';

        // Untaken liquidity pools relative to current price
        const untaken = (s) => {
            for (let u = s.i + 1; u < bars.length; u++) {
                if ((s.type === 'H' && bars[u].h > s.price) || (s.type === 'L' && bars[u].l < s.price)) return false;
            }
            return true;
        };
        const bsl = highs.filter((s) => s.price > price && untaken(s)).sort((a, b) => a.price - b.price);
        const ssl = lows.filter((s) => s.price < price && untaken(s)).sort((a, b) => b.price - a.price);
        const raids = findRaids(bars, swings, 16);

        // Dealing range = most recent swing high & swing low
        let range = null;
        if (highs.length && lows.length) {
            const hi = highs[highs.length - 1].price, lo = lows[lows.length - 1].price;
            if (hi > lo) range = { hi, lo, eq: (hi + lo) / 2 };
        }
        const fvgs = findFVGs(bars, 24);

        return {
            status: 'OK', bias, trend, structureLabel, lastBreak: last, price,
            liquidity: { bsl: bsl.map((s) => s.price), ssl: ssl.map((s) => s.price) },
            raids, range, fvgs, lastLow: lows.length ? lows[lows.length - 1].price : null,
            lastHigh: highs.length ? highs[highs.length - 1].price : null,
            asOf: bars[bars.length - 1].t || null,
        };
    }

    function analyzeEntry(rawBars, direction) {
        const bars = cleanBars(rawBars);
        if (bars.length < 30) return { status: UNAVAILABLE, entryState: 'DATA UNAVAILABLE', confirmation: UNAVAILABLE };
        const price = bars[bars.length - 1].c;
        const k = 2;
        const swings = findSwings(bars, k);
        const events = structureBreaks(bars, swings, k);
        const recent = events.filter((e) => e.t >= bars.length - 36);
        const raids = findRaids(bars, swings, 36);
        const fvgs = findFVGs(bars, 36);
        if (!direction) {
            return { status: 'OK', entryState: 'NO DIRECTION', confirmation: 'NOT CONFIRMED', price, raids, fvgs, events: recent };
        }
        const want = direction === 'LONG' ? 'UP' : 'DOWN';
        const lastRecent = recent[recent.length - 1];
        const confirmed = !!lastRecent && lastRecent.dir === want;
        const fvg = fvgs.filter((f) => f.dir === want && !f.filled).pop() || null;
        let entryState;
        if (!confirmed) entryState = 'WAITING FOR CONFIRMATION';
        else if (!fvg) entryState = 'CONFIRMED — NO FVG';
        else if (price >= fvg.lo && price <= fvg.hi) entryState = 'IN ENTRY ZONE';
        else if ((want === 'UP' && price > fvg.hi) || (want === 'DOWN' && price < fvg.lo)) entryState = 'WAITING FOR RETRACE';
        else entryState = 'ZONE INVALIDATED';
        return {
            status: 'OK', entryState, confirmation: confirmed ? 'CONFIRMED' : 'NOT CONFIRMED',
            confirmEvent: confirmed ? lastRecent : null, fvg, price, raids, fvgs, events: recent,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 2b. DATA FRESHNESS + SOURCE SELECTION (NQ → NAS100 proxy)
    // ═══════════════════════════════════════════════════════════

    // LAST_AVAILABLE = market closed, bars from the last session: usable for ENGINE VALIDATION only, never live
    const USABLE = ['FRESH', 'DELAYED', 'LAST_AVAILABLE'];
    const FRESH_RANK = { FRESH: 0, DELAYED: 1, LAST_AVAILABLE: 2, STALE: 3, UNAVAILABLE: 4 };
    const worstOf = (...s) => s.filter(Boolean).sort((a, b) => FRESH_RANK[b] - FRESH_RANK[a])[0] || 'UNAVAILABLE';

    /**
     * FRESH    last bar closed ≤ 2 min ago (or is still forming), real-time provider
     * DELAYED  ≤ 20 min behind, or the provider is a delayed feed
     * STALE    older — shown, never used
     */
    // ── Timeframes: configurable, never assumed ─────────────────
    const TIMEFRAMES = Object.freeze({ '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60 });
    const tfMinutes = (tf) => (TIMEFRAMES[tf] || null);

    /**
     * Deterministic OHLCV aggregation of finer bars into a higher timeframe:
     * open = first, high = max, low = min, close = last, volume = sum. No interpolation:
     * empty buckets are skipped, buckets keep their real bar count, and a bucket that spans
     * a contract change is flagged (roll) instead of being silently merged.
     */
    function resampleBars(bars, fromTf, toTf) {
        const fm = tfMinutes(fromTf), tm = tfMinutes(toTf);
        if (!fm || !tm || tm < fm || tm % fm !== 0) throw new Error('Cannot resample ' + fromTf + ' → ' + toTf);
        const src = cleanBars(bars).slice().sort((a, b) => a.t - b.t);
        if (tm === fm) return src.map((b) => Object.assign({}, b));
        const ms = tm * 60000, out = [];
        let cur = null;
        for (const b of src) {
            const start = Math.floor(b.t / ms) * ms;
            if (!cur || cur.t !== start) {
                cur = { t: start, o: b.o, h: b.h, l: b.l, c: b.c, n: 1 };
                if (isNum(b.v)) cur.v = b.v;
                if (b.contract) cur.contract = b.contract;
                out.push(cur);
                continue;
            }
            cur.h = Math.max(cur.h, b.h);
            cur.l = Math.min(cur.l, b.l);
            cur.c = b.c;
            cur.n++;
            if (isNum(b.v)) cur.v = (cur.v || 0) + b.v;
            if (b.contract && cur.contract && b.contract !== cur.contract) { cur.roll = true; cur.contract = b.contract; }
        }
        const expected = tm / fm;
        for (const o of out) o.complete = o.n === expected;
        return out;
    }

    /** Splits a continuous series at contract changes (front-month roll). */
    function splitAtRolls(bars) {
        const segs = [];
        let cur = [];
        for (const b of bars || []) {
            if (cur.length && b.contract && cur[cur.length - 1].contract && b.contract !== cur[cur.length - 1].contract) { segs.push(cur); cur = []; }
            cur.push(b);
        }
        if (cur.length) segs.push(cur);
        return segs;
    }

    /** Bars of one timeframe from a series ({ barsByTf }), restricted to the current contract after a roll. */
    function barsFor(s, tf) {
        if (!s || !tf || !s.barsByTf || !Array.isArray(s.barsByTf[tf])) return { bars: null, rolled: false };
        const segs = splitAtRolls(s.barsByTf[tf]);
        const last = segs[segs.length - 1] || [];
        return { bars: last, rolled: segs.length > 1, contract: last.length ? last[last.length - 1].contract || null : null };
    }

    /** Most recent moment the CME schedule closed (null while open). 15-minute resolution — CME closes on the hour. */
    function lastSessionClose(now) {
        if (getSession(now).marketOpen) return null;
        const step = 15 * 60000;
        let t = Math.floor(now / step) * step;
        for (let i = 0; i < 4 * 24 * 4; i++, t -= step) if (getSession(t - 1).marketOpen) return t;
        return null;
    }

    /**
     * FRESH           market open, last bar ≤ 2 min late, real-time provider
     * DELAYED         market open, ≤ 20 min late or a delayed feed
     * LAST_AVAILABLE  market CLOSED, bars reach the last session close (validation only, never "live")
     * STALE           older — shown, never used
     */
    function computeFreshness(bars, tfMin, now, delayedProvider, market) {
        const b = cleanBars(bars);
        if (b.length < 30) return { state: 'UNAVAILABLE', lastBarAt: null, lagMin: null };
        const last = b[b.length - 1].t;
        if (!isNum(last)) return { state: 'UNAVAILABLE', lastBarAt: null, lagMin: null };
        if (market && market.marketOpen === false) {
            const close = market.lastClose;
            const ok = isNum(close) && last + tfMin * 60000 >= close - 2 * 15 * 60000;
            return { state: ok ? 'LAST_AVAILABLE' : 'STALE', lastBarAt: last, lagMin: null };
        }
        const lagMin = (now - last) / 60000 - tfMin; // minutes since the last bar should have closed
        let state = lagMin <= 2 ? 'FRESH' : lagMin <= 20 ? 'DELAYED' : 'STALE';
        if (delayedProvider && state === 'FRESH') state = 'DELAYED';
        return { state, lastBarAt: last, lagMin: Math.max(0, Math.round(lagMin)) };
    }

    /**
     * Freshness per timeframe. With no timeframe selected, the series' base timeframe is described
     * (availability / lineage only — no analysis runs on it).
     */
    function describeSeries(s, now, market, tf) {
        const t = tf || {};
        if (!s || s.status !== 'OK') return { ok: false, fStruct: { state: 'UNAVAILABLE' }, fExec: { state: 'UNAVAILABLE' }, errors: (s && s.errors) || [], provider: s && s.provider, symbol: s && s.symbol, structTf: t.structure || null, execTf: t.execution || null };
        const structTf = t.structure || s.baseTf || null, execTf = t.execution || null;
        const st = barsFor(s, structTf), ex = barsFor(s, execTf);
        const bStruct = cleanBars(st.bars);
        const baseBars = barsFor(s, s.baseTf).bars || [];
        return {
            ok: true, symbol: s.symbol, provider: s.provider, delayed: !!s.delayed, fetchedAt: s.fetchedAt || null,
            structTf, execTf, contract: st.contract || (baseBars.length ? baseBars[baseBars.length - 1].contract || null : null),
            rolled: st.rolled || ex.rolled, baseTf: s.baseTf || null, availableTfs: Object.keys(s.barsByTf || {}),
            barsStruct: st.bars, barsExec: ex.bars,
            fStruct: structTf ? computeFreshness(st.bars, tfMinutes(structTf), now, s.delayed, market) : { state: 'UNAVAILABLE' },
            fExec: execTf ? computeFreshness(ex.bars, tfMinutes(execTf), now, s.delayed, market) : { state: 'UNAVAILABLE' },
            lastPrice: bStruct.length ? bStruct[bStruct.length - 1].c : null,
            errors: s.errors || [],
        };
    }

    /** OPEN / CLOSED / UNKNOWN — schedule first, then data evidence (holidays, halts, dead feeds). */
    function computeMarketStatus(session, source) {
        if (!session || session.marketOpen === false) return { status: 'CLOSED', detail: session && session.simulated ? 'SIMULATED session' : 'CME Globex closed (schedule)' };
        if (source && source.status === 'OK' && (source.freshness === 'FRESH' || source.freshness === 'DELAYED')) {
            return { status: 'OPEN', detail: session.simulated ? 'SIMULATED session' : 'Schedule open, data current' };
        }
        return { status: 'UNKNOWN', detail: source && source.status === 'OK' ? 'Schedule open but data ' + source.freshness + ' — holiday / halt / feed issue?' : 'Schedule open but no usable market data' };
    }

    /**
     * Picks ONE series for structure/price: NQ when fresh; NAS100 as a labelled proxy when NQ is
     * delayed/stale/unavailable and NAS100 is fresh; otherwise the best usable one; else UNAVAILABLE.
     * Structure and execution timeframes always come from the same series; a stale execution
     * timeframe is dropped, never mixed silently.
     */
    function selectMarketSource(market, now, mkt, tf) {
        const series = (market && market.series) || {};
        const nq = describeSeries(series.NQ, now, mkt, tf), nas = describeSeries(series.NAS100, now, mkt, tf);
        const candidates = { NQ: nq, NAS100: nas };
        let role = null;
        if (nq.fStruct.state === 'FRESH') role = 'NQ';
        else if (nas.fStruct.state === 'FRESH') role = 'NAS100_PROXY';
        else if (nq.fStruct.state === 'LAST_AVAILABLE') role = 'NQ';
        else if (nas.fStruct.state === 'LAST_AVAILABLE') role = 'NAS100_PROXY';
        else if (nq.fStruct.state === 'DELAYED') role = 'NQ';
        else if (nas.fStruct.state === 'DELAYED') role = 'NAS100_PROXY';
        if (!role) {
            return { status: UNAVAILABLE, role: null, label: 'NQ & NAS100 UNAVAILABLE', freshness: worstOf(nq.fStruct.state, nas.fStruct.state) === 'STALE' ? 'STALE' : 'UNAVAILABLE', candidates, barsStruct: null, barsExec: null, notes: ['NQ: ' + nq.fStruct.state, 'NAS100: ' + nas.fStruct.state] };
        }
        const pick = role === 'NQ' ? nq : nas;
        const notes = [];
        if (pick.rolled) notes.push('Contract roll in window — only ' + (pick.contract || 'current contract') + ' bars used');
        if (role === 'NAS100_PROXY') notes.push('NQ ' + nq.fStruct.state + ' — using NAS100 as proxy (not NQ prices)');
        const useExec = USABLE.includes(pick.fExec.state);
        if (pick.execTf && !useExec) notes.push(pick.execTf + ' ' + pick.fExec.state + ' — not used');
        else if (pick.execTf && pick.fExec.state !== pick.fStruct.state) notes.push(pick.structTf + ' ' + pick.fStruct.state + ' / ' + pick.execTf + ' ' + pick.fExec.state);
        const freshness = worstOf(pick.fStruct.state, useExec ? pick.fExec.state : null);
        return {
            status: 'OK', role, symbol: pick.symbol, provider: pick.provider, lastPrice: pick.lastPrice, fetchedAt: pick.fetchedAt,
            label: role === 'NQ' ? 'NQ ' + (pick.symbol || '') : 'NAS100 PROXY ' + (pick.symbol || ''),
            freshness, fStruct: pick.fStruct, fExec: pick.fExec, candidates, notes, contract: pick.contract,
            structTf: pick.structTf, execTf: pick.execTf,
            barsStruct: pick.barsStruct, barsExec: useExec ? pick.barsExec : null,
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 2c. SMT — NQ/NAS100 vs S&P 500 divergence (confluence only)
    // ═══════════════════════════════════════════════════════════

    /**
     * Divergence on aligned bars: the recent window (R bars) versus the reference window (W bars before it).
     * One index takes the reference low and the other does not → bullish SMT; same on highs → bearish.
     */
    function smtOnTimeframe(aBars, bBars, R, W, nameA) {
        const A = nameA || 'NQ';
        const a = cleanBars(aBars), b = cleanBars(bBars);
        if (a.length < R + W || b.length < R + W) return { state: UNCLEAR, detail: 'Not enough bars' };
        const bm = new Map(b.map((x) => [x.t, x]));
        const tail = a.slice(-(R + W));
        const pairs = tail.filter((x) => bm.has(x.t)).map((x) => [x, bm.get(x.t)]);
        if (pairs.length < 0.8 * (R + W)) return { state: UNCLEAR, detail: A + ' / S&P timestamps misaligned' };
        const ref = pairs.slice(0, pairs.length - R), rec = pairs.slice(pairs.length - R);
        const ext = (arr, i, f, fn) => fn(...arr.map((p) => p[i][f]));
        const lowA = ext(rec, 0, 'l', Math.min) < ext(ref, 0, 'l', Math.min);
        const lowB = ext(rec, 1, 'l', Math.min) < ext(ref, 1, 'l', Math.min);
        const highA = ext(rec, 0, 'h', Math.max) > ext(ref, 0, 'h', Math.max);
        const highB = ext(rec, 1, 'h', Math.max) > ext(ref, 1, 'h', Math.max);
        const bull = lowA !== lowB, bear = highA !== highB;
        if (bull && bear) return { state: UNCLEAR, detail: 'Conflicting divergences on highs and lows' };
        if (bull) return { state: BULL, detail: lowA ? A + ' took the low, S&P did not confirm' : 'S&P took the low, ' + A + ' did not confirm' };
        if (bear) return { state: BEAR, detail: highA ? A + ' took the high, S&P did not confirm' : 'S&P took the high, ' + A + ' did not confirm' };
        return { state: 'NONE', detail: (lowA ? 'Both took the low' : highA ? 'Both took the high' : 'No liquidity taken') + ' — no divergence' };
    }

    function computeSMT(source, spxSeries, now, mkt, tf) {
        const base = { confluence: UNCLEAR, tf: null, confirmedExec: false, spxFreshness: 'UNAVAILABLE' };
        if (!source || source.status !== 'OK') return Object.assign(base, { detail: 'NQ / NAS100 data unavailable' });
        const spx = describeSeries(spxSeries, now, mkt, tf && tf.structure ? tf : null);
        base.spxFreshness = spx.fStruct.state;
        base.spxSymbol = spx.symbol || null;
        if (!tf || !tf.structure) return Object.assign(base, { detail: 'No timeframe selected — SMT not evaluated' });
        if (!USABLE.includes(spx.fStruct.state)) return Object.assign(base, { detail: 'S&P 500 data ' + spx.fStruct.state });
        if (Math.abs(spx.fStruct.lastBarAt - source.fStruct.lastBarAt) > tfMinutes(tf.structure) * 60000) return Object.assign(base, { detail: 'S&P and ' + (source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ') + ' last bars differ by > 1 bar — not compared' });
        const nameA = source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ';
        const mStruct = smtOnTimeframe(source.barsStruct, spx.barsStruct, 16, 32, nameA);
        const useExec = source.barsExec && USABLE.includes(spx.fExec.state);
        const mExec = useExec ? smtOnTimeframe(source.barsExec, spx.barsExec, 24, 48, nameA) : { state: UNCLEAR, detail: (tf.execution || 'execution timeframe') + ' unavailable' };
        const conf = (s) => (s === BULL ? 'BULLISH_CONFLUENCE' : s === BEAR ? 'BEARISH_CONFLUENCE' : s);
        if (mStruct.state === BULL || mStruct.state === BEAR) {
            return Object.assign(base, { confluence: conf(mStruct.state), tf: tf.structure, level: 'structure', confirmedExec: mExec.state === mStruct.state, detail: mStruct.detail + (mExec.state === mStruct.state ? ' · ' + tf.execution + ' confirms' : ''), mStruct, mExec });
        }
        if (mStruct.state === 'NONE' && (mExec.state === BULL || mExec.state === BEAR)) {
            return Object.assign(base, { confluence: conf(mExec.state), tf: tf.execution, level: 'execution', detail: tf.execution + ': ' + mExec.detail, mStruct, mExec });
        }
        return Object.assign(base, { confluence: mStruct.state === 'NONE' ? 'NONE' : UNCLEAR, tf: tf.structure, level: 'structure', detail: mStruct.detail, mStruct, mExec });
    }
    // ═══════════════════════════════════════════════════════════
    // 3. TRIL — Trend · Raid · Imbalance · Location
    // ═══════════════════════════════════════════════════════════

    function computeTRIL(input) {
        const { direction, context, sStruct, eExec, plannedEntry, overrides } = input;
        const TS = (input.tf && input.tf.structure) || 'structure', TE = (input.tf && input.tf.execution) || 'execution';
        const ov = overrides || {};
        const items = {};
        const set = (key, auto, why) => {
            if (ov[key] && [PASS, FAIL, UNCLEAR].includes(ov[key])) items[key] = { status: ov[key], source: 'MANUAL', why: 'Manual override' };
            else items[key] = { status: auto, source: 'AUTO', why };
        };
        const ctxBias = context && context.bias;
        const sStructOk = sStruct && sStruct.status === 'OK';

        // T — 15m structure aligned with the market context
        if (!direction || !sStructOk) set('trend', UNCLEAR, 'No ' + TS + ' direction');
        else if (ctxBias !== BULL && ctxBias !== BEAR) set('trend', UNCLEAR, 'Context ' + (ctxBias || 'n/a') + ' — no HTF trend');
        else if (biasOf(direction) === ctxBias) set('trend', PASS, TS + ' ' + sStruct.bias + ' = context ' + ctxBias);
        else set('trend', FAIL, TS + ' ' + sStruct.bias + ' vs context ' + ctxBias);

        // R — opposing liquidity raided (SSL for longs, BSL for shorts) on 15m or 5m
        if (!direction || !sStructOk) set('raid', UNCLEAR, 'No data');
        else {
            const side = direction === 'LONG' ? 'SSL' : 'BSL';
            const all = (sStruct.raids || []).concat(eExec && eExec.status === 'OK' ? eExec.raids || [] : []);
            const hit = all.filter((r) => r.side === side);
            if (hit.length) set('raid', PASS, side + ' swept @ ' + hit[hit.length - 1].level.toFixed(2));
            else set('raid', FAIL, 'No ' + side + ' sweep in lookback');
        }

        // I — unmitigated FVG in trade direction (5m, else 15m)
        if (!direction || !sStructOk) set('imbalance', UNCLEAR, 'No data');
        else {
            const want = direction === 'LONG' ? 'UP' : 'DOWN';
            const fExec = eExec && eExec.status === 'OK' ? (eExec.fvgs || []).filter((f) => f.dir === want && !f.filled) : [];
            const fStruct = (sStruct.fvgs || []).filter((f) => f.dir === want && !f.filled);
            const f = fExec[fExec.length - 1] || fStruct[fStruct.length - 1];
            if (f) set('imbalance', PASS, (fExec.length ? TE : TS) + ' FVG ' + f.lo.toFixed(2) + '–' + f.hi.toFixed(2));
            else set('imbalance', FAIL, 'No open FVG in direction');
        }

        // L — planned entry in discount (long) / premium (short) of the 15m dealing range
        if (!direction || !sStructOk || !sStruct.range || !isNum(plannedEntry)) set('location', UNCLEAR, 'No dealing range');
        else {
            const r = sStruct.range;
            const pos = (plannedEntry - r.lo) / (r.hi - r.lo);
            const pct = Math.round(pos * 100);
            const good = direction === 'LONG' ? pos <= 0.45 : pos >= 0.55;
            const bad = direction === 'LONG' ? pos > 0.55 : pos < 0.45;
            const zone = pos < 0.45 ? 'discount' : pos > 0.55 ? 'premium' : 'equilibrium';
            set('location', good ? PASS : bad ? FAIL : UNCLEAR, 'Entry in ' + zone + ' (' + pct + '% of range)');
        }

        const st = Object.values(items).map((x) => x.status);
        const status = st.includes(FAIL) ? FAIL : st.every((s) => s === PASS) ? PASS : UNCLEAR;
        return { status, ready: status === PASS ? 'READY' : 'NOT READY', items, passCount: st.filter((s) => s === PASS).length };
    }

    // ═══════════════════════════════════════════════════════════
    // 4. NEWS — filter only (never a direction)
    // ═══════════════════════════════════════════════════════════

    const HIGH_KEYWORDS = /\b(CPI|Core CPI|Non-Farm|Nonfarm|NFP|FOMC|Federal Funds Rate|Fed Chair|Powell|PCE|GDP|Unemployment Rate|Employment Situation|Average Hourly Earnings)\b/i;
    const MEDIUM_KEYWORDS = /\b(Fed|FOMC Member|Speaks|PPI|Retail Sales|ISM|JOLTS|Unemployment Claims|Jobless|ADP|Consumer Sentiment|Durable Goods)\b/i;

    function classifyEventImpact(ev) {
        const t = String(ev.title || '');
        const raw = String(ev.impact || '').toUpperCase();
        if (HIGH_KEYWORDS.test(t) || raw === 'HIGH') return 'HIGH';
        if (MEDIUM_KEYWORDS.test(t) || raw === 'MEDIUM') return 'MEDIUM';
        if (raw === 'HOLIDAY') return 'HOLIDAY';
        return 'LOW';
    }

    function fmtMinutes(m) {
        const a = Math.abs(Math.round(m));
        const s = a >= 1440 ? Math.floor(a / 1440) + 'd ' + Math.floor((a % 1440) / 60) + 'h'
            : a >= 60 ? Math.floor(a / 60) + 'h ' + (a % 60) + 'm' : a + 'm';
        return m < 0 ? s + ' ago' : s;
    }

    /**
     * Blackout: HIGH event from 30 min before to 15 min after → HIGH IMPACT (restriction).
     * CAUTION: HIGH within 2h, or MEDIUM from 15 min before to 10 min after.
     */
    function analyzeNews(feed, now, opts) {
        const o = Object.assign({ preMin: 30, postMin: 15, cautionMin: 120, medPre: 15, medPost: 10 }, opts || {});
        if (!feed || feed.status === 'DATA_UNAVAILABLE' || !Array.isArray(feed.events)) {
            return { status: UNAVAILABLE, event: null, impact: null, timeToEvent: null, tradingRestriction: false, note: 'News feed unavailable — check the calendar manually' };
        }
        const evs = feed.events
            .filter((e) => e && (e.country === 'USD' || e.country === 'US') && e.time && !isNaN(Date.parse(e.time)))
            .map((e) => {
                const impact = classifyEventImpact(e);
                const minutes = (Date.parse(e.time) - now) / 60000;
                return { title: e.title, time: e.time, impact, minutes };
            })
            .filter((e) => e.impact === 'HIGH' || e.impact === 'MEDIUM')
            .sort((a, b) => a.minutes - b.minutes);

        let status = 'CLEAR', trigger = null;
        const blackout = evs.find((e) => e.impact === 'HIGH' && e.minutes <= o.preMin && e.minutes >= -o.postMin);
        if (blackout) { status = 'HIGH IMPACT'; trigger = blackout; }
        else {
            const c1 = evs.find((e) => e.impact === 'HIGH' && e.minutes > o.preMin && e.minutes <= o.cautionMin);
            const c2 = evs.find((e) => e.impact === 'MEDIUM' && e.minutes <= o.medPre && e.minutes >= -o.medPost);
            const c = c1 || c2;
            if (c) { status = 'CAUTION'; trigger = c; }
        }
        const upcoming = evs.filter((e) => e.minutes >= -o.postMin);
        const next = trigger || upcoming.find((e) => e.impact === 'HIGH') || upcoming[0] || null;
        return {
            status,
            event: next ? next.title : null,
            impact: next ? next.impact : null,
            time: next ? next.time : null,
            minutes: next ? Math.round(next.minutes) : null,
            timeToEvent: next ? fmtMinutes(next.minutes) : null,
            tradingRestriction: status === 'HIGH IMPACT',
            upcoming: upcoming.slice(0, 6),
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 5. SESSION (ICT kill zones, New York time) + TRADING STATE
    // ═══════════════════════════════════════════════════════════

    const KILL_ZONES = [
        { name: 'London KZ', start: 2 * 60, end: 5 * 60 },
        { name: 'NY AM KZ', start: 7 * 60, end: 10 * 60 },
        { name: 'NY PM KZ', start: 13 * 60 + 30, end: 16 * 60 },
    ];

    function nyParts(now) {
        const f = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York', hour12: false, weekday: 'short',
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        });
        const p = {};
        for (const x of f.formatToParts(new Date(now))) p[x.type] = x.value;
        const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
        const hour = parseInt(p.hour, 10) % 24;
        return { wd, minutes: hour * 60 + parseInt(p.minute, 10), date: p.year + '-' + p.month + '-' + p.day };
    }

    function getSession(now) {
        const { wd, minutes } = nyParts(now);
        // CME Globex equity futures: Sun 18:00 → Fri 17:00 ET, daily halt 17:00–18:00
        const marketOpen = !(wd === 6 || (wd === 0 && minutes < 18 * 60) || (wd === 5 && minutes >= 17 * 60) || (minutes >= 17 * 60 && minutes < 18 * 60));
        const active = KILL_ZONES.find((z) => minutes >= z.start && minutes < z.end) || null;
        let next = KILL_ZONES.find((z) => z.start > minutes);
        let nextIn = next ? next.start - minutes : null;
        if (!next) { next = KILL_ZONES[0]; nextIn = 24 * 60 - minutes + next.start; }
        return {
            marketOpen,
            killZone: active ? active.name : null,
            inKillZone: !!active && marketOpen,
            endsIn: active ? active.end - minutes : null,
            next: next.name, nextIn,
            nyMinutes: minutes,
        };
    }

    function tradePnl(t, pointValueFor) {
        if (isNum(t.pnlUsd)) return t.pnlUsd;
        if (isNum(t.exitPrice) && isNum(t.entryPrice)) {
            const d = t.direction === 'SHORT' ? -1 : 1;
            return (t.exitPrice - t.entryPrice) * d * pointValueFor(t.symbol);
        }
        return null; // open / unknown
    }

    function computeTradingState(input) {
        const { trades, now, session, userReady } = input;
        const rules = Object.assign({}, DEFAULT_RULES, input.rules || {});
        const today = nyParts(now).date;
        const pv = (sym) => (INSTRUMENTS[sym] ? INSTRUMENTS[sym].pointValue : 0);
        const todays = (trades || []).filter((t) => {
            const ts = t.createdAt || t.dateTime;
            return ts && !isNaN(Date.parse(ts)) && nyParts(Date.parse(ts)).date === today;
        }).sort((a, b) => Date.parse(a.createdAt || a.dateTime) - Date.parse(b.createdAt || b.dateTime));
        let pnl = 0, streak = 0;
        for (const t of todays) {
            const p = tradePnl(t, pv);
            if (p === null) continue;
            pnl += p;
            streak = p < 0 ? streak + 1 : 0;
        }
        const reasons = [];
        if (session && !session.marketOpen) reasons.push('Market closed');
        else if (rules.requireKillZone && session && !session.inKillZone) reasons.push('Outside session');
        if (todays.length >= rules.maxTradesPerDay) reasons.push('Max trades reached (' + todays.length + '/' + rules.maxTradesPerDay + ')');
        if (streak >= rules.consecLossLimit) reasons.push(streak === 2 ? 'Two consecutive losses' : streak + ' consecutive losses');
        if (-pnl >= rules.dailyLossLimit) reasons.push('Daily loss limit reached');
        if (userReady === false) reasons.push('User not ready');
        return {
            status: reasons.length ? 'NOT READY' : 'READY',
            reasons, tradesToday: todays.length, pnlToday: pnl, lossStreak: streak,
            remainingLoss: Math.max(0, rules.dailyLossLimit + Math.min(0, pnl)),
        };
    }

    // ═══════════════════════════════════════════════════════════
    // 6. RISK — deterministic position sizing
    // ═══════════════════════════════════════════════════════════

    /** Structure-based plan: entry at FVG CE (else last price), SL beyond the raid / swing, TP at opposing liquidity. */
    function suggestLevels(direction, sStruct, eExec, instrument, minRRR) {
        if (!direction || !sStruct || sStruct.status !== 'OK') return null;
        const tick = (INSTRUMENTS[instrument] || INSTRUMENTS.NQ).tick;
        const want = direction === 'LONG' ? 'UP' : 'DOWN';
        const side = direction === 'LONG' ? 'SSL' : 'BSL';
        const fvg = (eExec && eExec.fvg) || (sStruct.fvgs || []).filter((f) => f.dir === want && !f.filled).pop() || null;
        const price = eExec && eExec.status === 'OK' ? eExec.price : sStruct.price;
        let entry = fvg ? (fvg.lo + fvg.hi) / 2 : price;
        const allRaids = (sStruct.raids || []).concat(eExec && eExec.status === 'OK' ? eExec.raids || [] : []).filter((r) => r.side === side);
        // Stop anchors on the latest raid whose extreme sits beyond the entry (the sweep that started the move)
        const beyond = allRaids.filter((r) => (direction === 'LONG' ? r.extreme < entry : r.extreme > entry));
        const raid = beyond[beyond.length - 1];
        const buffer = 2 * tick;
        let sl;
        if (direction === 'LONG') {
            sl = raid ? raid.extreme : sStruct.lastLow;
            if (!isNum(sl) || sl >= entry) return { entry: roundTick(entry, tick), sl: null, tp: null, basis: 'No valid stop below entry' };
            sl -= buffer;
        } else {
            sl = raid ? raid.extreme : sStruct.lastHigh;
            if (!isNum(sl) || sl <= entry) return { entry: roundTick(entry, tick), sl: null, tp: null, basis: 'No valid stop above entry' };
            sl += buffer;
        }
        const stop = Math.abs(entry - sl);
        const pools = direction === 'LONG'
            ? (sStruct.liquidity.bsl || []).filter((p) => p > entry).sort((a, b) => a - b)
            : (sStruct.liquidity.ssl || []).filter((p) => p < entry).sort((a, b) => b - a);
        let tp = pools.find((p) => Math.abs(p - entry) / stop >= minRRR - 1e-9);
        let tpBasis = 'liquidity meeting min RRR';
        if (!isNum(tp)) { tp = pools[0]; tpBasis = 'nearest liquidity (below min RRR)'; }
        if (!isNum(tp)) return { entry: roundTick(entry, tick), sl: roundTick(sl, tick), tp: null, basis: 'No opposing liquidity target' };
        return {
            entry: roundTick(entry, tick), sl: roundTick(sl, tick), tp: roundTick(tp, tick),
            basis: (fvg ? 'FVG CE entry' : 'Market entry') + ' · SL ' + (raid ? 'beyond raid' : 'beyond swing') + ' · TP ' + tpBasis,
        };
    }

    function computeRisk(input) {
        const { direction, entry, sl, tp, instrument } = input;
        const rules = Object.assign({}, DEFAULT_RULES, input.rules || {});
        const spec = INSTRUMENTS[instrument] || INSTRUMENTS.NQ;
        const res = { status: 'N/A', entry, sl, tp, rrr: null, contracts: 0, riskUsd: 0, rewardUsd: 0, reasons: [], pointValue: spec.pointValue };
        if (!direction) { res.reasons.push('No direction'); return res; }
        if (![entry, sl, tp].every(isNum)) { res.status = FAIL; res.reasons.push('Entry / SL / TP missing'); return res; }
        const okSide = direction === 'LONG' ? sl < entry && tp > entry : sl > entry && tp < entry;
        if (!okSide) { res.status = FAIL; res.reasons.push('SL / TP on wrong side for ' + direction); return res; }
        const stopPts = Math.abs(entry - sl), tgtPts = Math.abs(tp - entry);
        res.stopPts = stopPts; res.targetPts = tgtPts;
        res.rrr = tgtPts / stopPts;
        const budget = Math.min(rules.balance * rules.riskPct / 100, rules.maxRiskUsd);
        const allowance = isNum(input.remainingLoss) ? Math.min(budget, input.remainingLoss) : budget;
        res.riskBudget = allowance;
        res.contracts = Math.floor(allowance / (stopPts * spec.pointValue) + 1e-9);
        res.riskUsd = res.contracts * stopPts * spec.pointValue;
        res.rewardUsd = res.contracts * tgtPts * spec.pointValue;
        if (res.rrr < rules.minRRR - 1e-9) res.reasons.push('RRR 1:' + res.rrr.toFixed(2) + ' < 1:' + rules.minRRR);
        if (res.contracts < 1) res.reasons.push('Stop too wide for $' + Math.round(allowance) + ' risk');
        if (res.riskUsd > rules.maxRiskUsd + 1e-9) res.reasons.push('Risk above $' + rules.maxRiskUsd);
        res.status = res.reasons.length ? FAIL : PASS;
        return res;
    }

    // ═══════════════════════════════════════════════════════════
    // 7. CONFIDENCE SCORE — evidence alignment (0–95), NOT a win probability
    // ═══════════════════════════════════════════════════════════

    function computeConfidence(d) {
        const { direction, context, sStruct, eExec, tril, news, smt, source } = d;
        // essential inputs missing → N/A, never a made-up number
        if (!direction || !sStruct || sStruct.status !== 'OK' || context.bias === UNAVAILABLE) return { value: null, label: 'N/A', parts: [] };
        const want = biasOf(direction);
        const parts = [];
        let score = 0;
        const add = (k, v) => { if (v) { parts.push({ k, v }); score += v; } };
        const cot = context.cot, seas = context.seasonality;
        if (cot.status === 'OK') add('COT', cot.bias === want ? 20 : cot.bias === NEUTRAL ? 0 : -20);
        if (seas.status === 'OK') {
            const al = want === BULL ? seas.bullCount : seas.bearCount;
            const opp = want === BULL ? seas.bearCount : seas.bullCount;
            add('Seasonality', Math.round(((al - opp) / 3) * 10));
        }
        add('Structure', sStruct.bias === want ? 20 : sStruct.bias === NEUTRAL ? 0 : -20);
        if (eExec && eExec.status === 'OK') add('Execution confirmation', eExec.confirmation === 'CONFIRMED' ? 10 : 0);
        add('TRIL ' + tril.passCount + '/4', tril.passCount * 7.5);
        const smtDir = smt.confluence === 'BULLISH_CONFLUENCE' ? BULL : smt.confluence === 'BEARISH_CONFLUENCE' ? BEAR : null;
        if (smtDir) add('SMT ' + smt.tf, smtDir === want ? (smt.level === 'structure' ? 8 + (smt.confirmedExec ? 2 : 0) : 4) : -8);
        if (context.vix.status === 'OK' && context.vix.state === 'HIGH') add('VIX HIGH', -10);
        if (news.status === 'CAUTION' || news.status === UNAVAILABLE) add('News ' + news.status, -10);
        if (context.partial) add('Partial context', -5);
        if (source && source.freshness === 'DELAYED') add('Delayed data', -5);
        if (source && source.role === 'NAS100_PROXY') add('NAS100 proxy', -5);
        // max evidence = 100 points → scaled to a 0–95 ceiling so deductions always stay visible
        const value = Math.round(clamp(score, 0, 100) * 0.95);
        const label = value >= 75 ? 'HIGH' : value >= 55 ? 'MODERATE' : 'LOW';
        return { value, label, parts };
    }

    // ═══════════════════════════════════════════════════════════
    // 8. DECISION ENGINE
    //    Context = COT/Seas (context) · Structure + TRIL (setup) · SMT (confluence only)
    //    News (filter) · Risk (permission) · Trading state · Data freshness
    // ═══════════════════════════════════════════════════════════

    function decide(d) {
        const { context, sStruct, eExec, tril, news, risk, tradingState, source, smt } = d;
        const marketStatus = d.marketStatus || { status: 'OPEN' };
        const tf = d.timeframes || { status: 'NOT_SELECTED' };
        const TS = tf.structure || 'structure';
        const reasons = [];
        if (marketStatus.status === 'CLOSED') reasons.push({ code: 'MARKET CLOSED', detail: source && source.status === 'OK' ? 'Last available data — analysis is engine validation only, not a live trade' : 'No live trade while the market is closed' });
        // UNKNOWN with no usable data is reported as DATA UNAVAILABLE below (the precise cause)
        else if (marketStatus.status === 'UNKNOWN' && source && source.status === 'OK') reasons.push({ code: 'MARKET STATUS UNKNOWN', detail: marketStatus.detail });
        const structDir = sStruct && sStruct.status === 'OK' ? dirOf(sStruct.bias) : null;
        const ctxDir = dirOf(context.bias);
        const direction = structDir;

        let bias = 'NEUTRAL', biasNote = '';
        if (structDir && ctxDir && structDir !== ctxDir) { bias = 'NEUTRAL'; biasNote = 'Structure vs context conflict'; }
        else if (structDir) bias = structDir + ' BIAS';
        else if (ctxDir) { bias = ctxDir + ' BIAS'; biasNote = 'Context only'; }

        if (!source || source.status !== 'OK') reasons.push({ code: 'DATA UNAVAILABLE', detail: 'NQ & NAS100 market data unavailable or stale' });
        // Timeframes are selected by evidence (Edge validation), never assumed
        if (!tf.structure) reasons.push({ code: 'NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE', detail: tf.detail || 'No timeframe configuration passed validation' });
        else if (!['VALIDATED', 'SIMULATED'].includes(tf.status)) reasons.push({ code: 'TIMEFRAME NOT VALIDATED — INSUFFICIENT EVIDENCE', detail: (tf.label || TS) + ': ' + (tf.detail || tf.status) });
        else if (!sStruct || sStruct.status !== 'OK') reasons.push({ code: 'DATA UNAVAILABLE', detail: TS + ' price data insufficient' });
        const stateReasons = tradingState.reasons.filter((r) => !(r === 'Market closed' && marketStatus.status === 'CLOSED'));
        if (stateReasons.length) reasons.push({ code: 'TRADING STATE: NOT READY', detail: stateReasons.join(' · ') });
        if (news.status === 'HIGH IMPACT') reasons.push({ code: 'NEWS HIGH IMPACT', detail: news.event + ' (' + news.timeToEvent + ')' });
        if (sStruct && sStruct.status === 'OK' && !structDir) reasons.push({ code: 'STRUCTURE UNCLEAR', detail: TS + ' ' + sStruct.trend + ', no break' });
        if (context.bias === UNAVAILABLE) reasons.push({ code: 'DATA UNAVAILABLE', detail: 'COT & seasonality unavailable' });
        else if (context.bias === NEUTRAL) reasons.push({ code: 'CONTEXT UNCLEAR', detail: 'Context NEUTRAL' });
        else if (structDir && ctxDir !== structDir) reasons.push({ code: 'CONTEXT CONFLICT', detail: 'Context ' + context.bias + ' vs ' + TS + ' ' + sStruct.bias });
        if (structDir) {
            if (tril.status === FAIL) reasons.push({ code: 'TRIL FAIL', detail: failList(tril) });
            else if (tril.status === UNCLEAR) reasons.push({ code: 'TRIL UNCLEAR', detail: failList(tril, UNCLEAR) });
            if (risk.status !== PASS) reasons.push({ code: 'RISK FAIL', detail: risk.reasons.join(' · ') || 'No valid plan' });
        }

        const evidence = computeConfidence(Object.assign({}, d, { direction: direction || ctxDir }));
        // A closed / unknown market gets no live confidence; the evidence score is kept for engine validation
        const confidence = marketStatus.status === 'OPEN' ? evidence : { value: null, label: 'N/A', parts: evidence.parts, validationScore: evidence.value };
        const candidate = reasons.length === 0 && !!direction;
        const decision = candidate ? direction : 'NO TRADE';
        const warnings = [];
        if (source && source.status === 'OK') {
            if (source.freshness === 'LAST_AVAILABLE') warnings.push('MARKET CLOSED — LAST AVAILABLE DATA (bar ' + new Date(source.fStruct.lastBarAt).toISOString().slice(0, 16).replace('T', ' ') + ' UTC), not live');
            if (source.freshness === 'DELAYED') warnings.push('DELAYED DATA — ' + (source.fStruct.lagMin || 0) + ' min behind');
            if (source.role === 'NAS100_PROXY') warnings.push('DATA SOURCE: NAS100 PROXY — levels are NAS100 prices, not NQ');
            source.notes.filter((n) => /not used/.test(n)).forEach((n) => warnings.push(n));
        }
        if (news.status === 'CAUTION') warnings.push('News caution: ' + news.event + ' in ' + news.timeToEvent);
        if (news.status === UNAVAILABLE) warnings.push(news.note);
        if (context.vix.status === 'OK' && context.vix.state === 'HIGH') warnings.push('VIX HIGH (' + context.vix.value.toFixed(1) + ') — volatility elevated');
        if (context.partial) warnings.push('Context built from partial data');
        const smtDir = smt.confluence === 'BULLISH_CONFLUENCE' ? 'LONG' : smt.confluence === 'BEARISH_CONFLUENCE' ? 'SHORT' : null;
        if (direction && smtDir && smtDir !== direction) warnings.push('SMT against the setup (' + smt.confluence + ')');

        let why;
        if (candidate) {
            why = 'Context ' + context.bias + ' · ' + TS + ' ' + sStruct.structureLabel + ' · TRIL ' + tril.passCount + '/4 · SMT ' + smt.confluence +
                ' · News ' + news.status + ' · RRR 1:' + risk.rrr.toFixed(2) + ' · ' + risk.contracts + ' ct · Data ' + source.freshness + (source.role === 'NAS100_PROXY' ? ' (NAS100 proxy)' : '') + ' · TF ' + tf.label + ' (' + tf.status + ')';
        } else {
            why = reasons.map((r) => r.code + (r.detail ? ' — ' + r.detail : '')).join(' | ');
        }
        return { decision, candidate, direction: direction || null, bias, biasNote, confidence, reasons, warnings, why };
    }

    function failList(tril, which) {
        const names = { trend: 'Trend', raid: 'Raid', imbalance: 'Imbalance', location: 'Location' };
        return Object.keys(tril.items).filter((k) => tril.items[k].status === (which || FAIL))
            .map((k) => names[k] + ': ' + tril.items[k].why).join(' · ');
    }

    // ═══════════════════════════════════════════════════════════
    // 9. FULL PIPELINE + AGENT OUTPUTS (structured)
    // ═══════════════════════════════════════════════════════════

    /**
     * data: { cot, seasonality, vix, market: { series: { NQ, NAS100, SPX } }, news }
     * user: { instrument, rules, trades, userReady, trilOverrides, structureOverride, levels, sessionOverride(DEMO only) }
     */
    /**
     * user.timeframes = { structure, execution, status: VALIDATED | INSUFFICIENT | NOT_RUN | SIMULATED, detail, evidence }
     * Absent / invalid → NOT_SELECTED (no analysis timeframe, decision NO TRADE).
     */
    function normalizeTimeframes(t) {
        if (!t || !tfMinutes(t.structure)) return { structure: null, execution: null, status: 'NOT_SELECTED', label: 'NOT SELECTED', detail: (t && t.detail) || 'No timeframe configuration passed validation' };
        const execution = tfMinutes(t.execution) && tfMinutes(t.execution) <= tfMinutes(t.structure) ? t.execution : null;
        return { structure: t.structure, execution, status: t.status || 'NOT_RUN', detail: t.detail || null, evidence: t.evidence || null,
            label: t.structure + (execution && execution !== t.structure ? ' → ' + execution : '') };
    }

    function runPipeline(data, user, now) {
        user = user || {};
        const rules = Object.assign({}, DEFAULT_RULES, user.rules || {});
        const instrument = INSTRUMENTS[user.instrument] ? user.instrument : 'MNQ';

        const context = buildContext(analyzeCOT(data.cot, now), analyzeSeasonality(data.seasonality), analyzeVIX(data.vix));
        const session = user.sessionOverride || getSession(now); // sessionOverride: DEMO / SIMULATED only
        const mkt = { marketOpen: session.marketOpen !== false, lastClose: session.marketOpen === false ? (isNum(session.lastClose) ? session.lastClose : lastSessionClose(now)) : null };
        const tf = normalizeTimeframes(user.timeframes || data.timeframes); // config travels with the data (server: validation file, demo: SIMULATED)
        const source = selectMarketSource(data.market, now, mkt, tf.structure ? tf : null);
        const marketStatus = computeMarketStatus(session, source);
        let sStruct = !tf.structure ? { status: UNAVAILABLE, bias: null, note: 'NO TIMEFRAME SELECTED' }
            : source.status === 'OK' ? analyzeStructure(source.barsStruct) : { status: UNAVAILABLE, bias: null, note: 'No usable market data' };
        if (user.structureOverride && [BULL, BEAR, NEUTRAL].includes(user.structureOverride) && sStruct.status === 'OK') {
            sStruct = Object.assign({}, sStruct, { bias: user.structureOverride, structureLabel: sStruct.structureLabel + ' (manual: ' + user.structureOverride + ')', manual: true });
        }
        const direction = sStruct.status === 'OK' ? dirOf(sStruct.bias) : null;
        const eExec = analyzeEntry(source.status === 'OK' && tf.execution ? source.barsExec : null, direction);
        const smt = computeSMT(source, data.market && data.market.series ? data.market.series.SPX : null, now, mkt, tf.structure ? tf : null);
        const tradingState = computeTradingState({ trades: user.trades, now, session, userReady: user.userReady, rules });
        const news = analyzeNews(data.news, now);

        const auto = suggestLevels(direction, sStruct, eExec, instrument, rules.minRRR);
        const lv = user.levels && [user.levels.entry, user.levels.sl, user.levels.tp].some(isNum) ? user.levels : null;
        const levels = {
            entry: lv && isNum(lv.entry) ? lv.entry : auto ? auto.entry : null,
            sl: lv && isNum(lv.sl) ? lv.sl : auto ? auto.sl : null,
            tp: lv && isNum(lv.tp) ? lv.tp : auto ? auto.tp : null,
            source: lv ? 'MANUAL' : auto ? 'AUTO' : 'NONE',
            basis: auto ? auto.basis : null,
            priceBasis: source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ',
        };
        const tril = computeTRIL({ direction, context, sStruct, eExec, tf, plannedEntry: levels.entry, overrides: user.trilOverrides });
        const risk = computeRisk({ direction, entry: levels.entry, sl: levels.sl, tp: levels.tp, instrument, rules, remainingLoss: tradingState.remainingLoss });
        const decision = decide({ context, sStruct, eExec, tril, news, risk, tradingState, source, smt, marketStatus, timeframes: tf });

        const analystAgent = {
            agent: 'THEEB Market Analyst',
            context: context.bias,
            structure: sStruct.status === 'OK' ? sStruct.bias : UNAVAILABLE,
            tril: tril.status,
            smt: smt.confluence,
            bias: decision.direction || (decision.bias.indexOf('LONG') === 0 ? 'LONG' : decision.bias.indexOf('SHORT') === 0 ? 'SHORT' : 'NEUTRAL'),
            confidence: decision.confidence.value,
            dataSource: source.status === 'OK' ? source.label : UNAVAILABLE,
            freshness: source.freshness,
            marketStatus: marketStatus.status,
            timeframes: tf.structure ? { structure: tf.structure, execution: tf.execution, validation: tf.status } : 'NOT SELECTED',
            reason: decision.why,
        };
        const newsAgent = {
            agent: 'THEEB News Agent',
            status: news.status,
            event: news.event,
            impact: news.impact,
            timeToEvent: news.timeToEvent,
            tradingRestriction: news.tradingRestriction,
        };
        return { instrument, rules, marketStatus, mkt, timeframes: tf, context, source, sStruct, eExec, smt, session, tradingState, news, levels, tril, risk, decision, agents: { analyst: analystAgent, news: newsAgent } };
    }

    const api = {
        DEFAULT_RULES, INSTRUMENTS, KILL_ZONES,
        analyzeCOT, analyzeSeasonality, analyzeVIX, buildContext,
        findSwings, structureBreaks, findRaids, findFVGs, analyzeStructure, analyzeEntry,
        TIMEFRAMES, tfMinutes, resampleBars, splitAtRolls, barsFor, normalizeTimeframes,
        computeFreshness, selectMarketSource, computeMarketStatus, lastSessionClose, describeSeries, smtOnTimeframe, computeSMT,
        computeTRIL, classifyEventImpact, analyzeNews, fmtMinutes,
        getSession, nyParts, computeTradingState, suggestLevels, computeRisk,
        computeConfidence, decide, runPipeline,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TheebEngine = api;
})(typeof self !== 'undefined' ? self : this);
