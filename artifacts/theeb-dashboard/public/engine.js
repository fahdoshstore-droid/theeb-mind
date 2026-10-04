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

    function analyzeStructure15(rawBars) {
        const bars = cleanBars(rawBars);
        if (bars.length < 30) return { status: UNAVAILABLE, bias: null, note: '15m data unavailable' };
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

    function analyzeEntry5(rawBars, direction) {
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

    const USABLE = ['FRESH', 'DELAYED'];
    const FRESH_RANK = { FRESH: 0, DELAYED: 1, STALE: 2, UNAVAILABLE: 3 };
    const worstOf = (...s) => s.filter(Boolean).sort((a, b) => FRESH_RANK[b] - FRESH_RANK[a])[0] || 'UNAVAILABLE';

    /**
     * FRESH    last bar closed ≤ 2 min ago (or is still forming), real-time provider
     * DELAYED  ≤ 20 min behind, or the provider is a delayed feed
     * STALE    older — shown, never used
     */
    function computeFreshness(bars, tfMin, now, delayedProvider) {
        const b = cleanBars(bars);
        if (b.length < 30) return { state: 'UNAVAILABLE', lastBarAt: null, lagMin: null };
        const last = b[b.length - 1].t;
        if (!isNum(last)) return { state: 'UNAVAILABLE', lastBarAt: null, lagMin: null };
        const lagMin = (now - last) / 60000 - tfMin; // minutes since the last bar should have closed
        let state = lagMin <= 2 ? 'FRESH' : lagMin <= 20 ? 'DELAYED' : 'STALE';
        if (delayedProvider && state === 'FRESH') state = 'DELAYED';
        return { state, lastBarAt: last, lagMin: Math.max(0, Math.round(lagMin)) };
    }

    function describeSeries(s, now) {
        if (!s || s.status !== 'OK') return { ok: false, f15: { state: 'UNAVAILABLE' }, f5: { state: 'UNAVAILABLE' }, errors: (s && s.errors) || [] };
        return {
            ok: true, symbol: s.symbol, provider: s.provider, delayed: !!s.delayed,
            f15: computeFreshness(s.bars15, 15, now, s.delayed),
            f5: computeFreshness(s.bars5, 5, now, s.delayed),
            errors: s.errors || [],
        };
    }

    /**
     * Picks ONE series for structure/price: NQ when fresh; NAS100 as a labelled proxy when NQ is
     * delayed/stale/unavailable and NAS100 is fresh; otherwise the best usable one; else UNAVAILABLE.
     * 15m and 5m always come from the same series; a stale 5m is dropped, never mixed silently.
     */
    function selectMarketSource(market, now) {
        const series = (market && market.series) || {};
        const nq = describeSeries(series.NQ, now), nas = describeSeries(series.NAS100, now);
        const candidates = { NQ: nq, NAS100: nas };
        let role = null;
        if (nq.f15.state === 'FRESH') role = 'NQ';
        else if (nas.f15.state === 'FRESH') role = 'NAS100_PROXY';
        else if (nq.f15.state === 'DELAYED') role = 'NQ';
        else if (nas.f15.state === 'DELAYED') role = 'NAS100_PROXY';
        if (!role) {
            return { status: UNAVAILABLE, role: null, label: 'NQ & NAS100 UNAVAILABLE', freshness: worstOf(nq.f15.state, nas.f15.state) === 'STALE' ? 'STALE' : 'UNAVAILABLE', candidates, bars15: null, bars5: null, notes: ['NQ: ' + nq.f15.state, 'NAS100: ' + nas.f15.state] };
        }
        const pick = role === 'NQ' ? nq : nas;
        const raw = role === 'NQ' ? series.NQ : series.NAS100;
        const notes = [];
        if (role === 'NAS100_PROXY') notes.push('NQ ' + nq.f15.state + ' — using NAS100 as proxy (not NQ prices)');
        const use5 = USABLE.includes(pick.f5.state);
        if (!use5) notes.push('5m ' + pick.f5.state + ' — not used');
        else if (pick.f5.state !== pick.f15.state) notes.push('15m ' + pick.f15.state + ' / 5m ' + pick.f5.state);
        const freshness = worstOf(pick.f15.state, use5 ? pick.f5.state : null);
        return {
            status: 'OK', role, symbol: pick.symbol, provider: pick.provider,
            label: role === 'NQ' ? 'NQ ' + (pick.symbol || '') : 'NAS100 PROXY ' + (pick.symbol || ''),
            freshness, f15: pick.f15, f5: pick.f5, candidates, notes,
            bars15: raw.bars15, bars5: use5 ? raw.bars5 : null,
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

    function computeSMT(source, spxSeries, now) {
        const base = { confluence: UNCLEAR, tf: null, confirmed5m: false, spxFreshness: 'UNAVAILABLE' };
        if (!source || source.status !== 'OK') return Object.assign(base, { detail: 'NQ / NAS100 data unavailable' });
        const spx = describeSeries(spxSeries, now);
        base.spxFreshness = spx.f15.state;
        base.spxSymbol = spx.symbol || null;
        if (!USABLE.includes(spx.f15.state)) return Object.assign(base, { detail: 'S&P 500 data ' + spx.f15.state });
        if (Math.abs(spx.f15.lastBarAt - source.f15.lastBarAt) > 15 * 60000) return Object.assign(base, { detail: 'S&P and ' + (source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ') + ' last bars differ by > 1 bar — not compared' });
        const nameA = source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ';
        const m15 = smtOnTimeframe(source.bars15, spxSeries.bars15, 16, 32, nameA);
        const use5 = source.bars5 && USABLE.includes(spx.f5.state);
        const m5 = use5 ? smtOnTimeframe(source.bars5, spxSeries.bars5, 24, 48, nameA) : { state: UNCLEAR, detail: '5m unavailable' };
        const conf = (s) => (s === BULL ? 'BULLISH_CONFLUENCE' : s === BEAR ? 'BEARISH_CONFLUENCE' : s);
        if (m15.state === BULL || m15.state === BEAR) {
            return Object.assign(base, { confluence: conf(m15.state), tf: '15m', confirmed5m: m5.state === m15.state, detail: m15.detail + (m5.state === m15.state ? ' · 5m confirms' : ''), m15, m5 });
        }
        if (m15.state === 'NONE' && (m5.state === BULL || m5.state === BEAR)) {
            return Object.assign(base, { confluence: conf(m5.state), tf: '5m', detail: '5m: ' + m5.detail, m15, m5 });
        }
        return Object.assign(base, { confluence: m15.state === 'NONE' ? 'NONE' : UNCLEAR, tf: '15m', detail: m15.detail, m15, m5 });
    }
    // ═══════════════════════════════════════════════════════════
    // 3. TRIL — Trend · Raid · Imbalance · Location
    // ═══════════════════════════════════════════════════════════

    function computeTRIL(input) {
        const { direction, context, s15, e5, plannedEntry, overrides } = input;
        const ov = overrides || {};
        const items = {};
        const set = (key, auto, why) => {
            if (ov[key] && [PASS, FAIL, UNCLEAR].includes(ov[key])) items[key] = { status: ov[key], source: 'MANUAL', why: 'Manual override' };
            else items[key] = { status: auto, source: 'AUTO', why };
        };
        const ctxBias = context && context.bias;
        const s15ok = s15 && s15.status === 'OK';

        // T — 15m structure aligned with the market context
        if (!direction || !s15ok) set('trend', UNCLEAR, 'No 15m direction');
        else if (ctxBias !== BULL && ctxBias !== BEAR) set('trend', UNCLEAR, 'Context ' + (ctxBias || 'n/a') + ' — no HTF trend');
        else if (biasOf(direction) === ctxBias) set('trend', PASS, '15m ' + s15.bias + ' = context ' + ctxBias);
        else set('trend', FAIL, '15m ' + s15.bias + ' vs context ' + ctxBias);

        // R — opposing liquidity raided (SSL for longs, BSL for shorts) on 15m or 5m
        if (!direction || !s15ok) set('raid', UNCLEAR, 'No data');
        else {
            const side = direction === 'LONG' ? 'SSL' : 'BSL';
            const all = (s15.raids || []).concat(e5 && e5.status === 'OK' ? e5.raids || [] : []);
            const hit = all.filter((r) => r.side === side);
            if (hit.length) set('raid', PASS, side + ' swept @ ' + hit[hit.length - 1].level.toFixed(2));
            else set('raid', FAIL, 'No ' + side + ' sweep in lookback');
        }

        // I — unmitigated FVG in trade direction (5m, else 15m)
        if (!direction || !s15ok) set('imbalance', UNCLEAR, 'No data');
        else {
            const want = direction === 'LONG' ? 'UP' : 'DOWN';
            const f5 = e5 && e5.status === 'OK' ? (e5.fvgs || []).filter((f) => f.dir === want && !f.filled) : [];
            const f15 = (s15.fvgs || []).filter((f) => f.dir === want && !f.filled);
            const f = f5[f5.length - 1] || f15[f15.length - 1];
            if (f) set('imbalance', PASS, (f5.length ? '5m' : '15m') + ' FVG ' + f.lo.toFixed(2) + '–' + f.hi.toFixed(2));
            else set('imbalance', FAIL, 'No open FVG in direction');
        }

        // L — planned entry in discount (long) / premium (short) of the 15m dealing range
        if (!direction || !s15ok || !s15.range || !isNum(plannedEntry)) set('location', UNCLEAR, 'No dealing range');
        else {
            const r = s15.range;
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
    function suggestLevels(direction, s15, e5, instrument, minRRR) {
        if (!direction || !s15 || s15.status !== 'OK') return null;
        const tick = (INSTRUMENTS[instrument] || INSTRUMENTS.NQ).tick;
        const want = direction === 'LONG' ? 'UP' : 'DOWN';
        const side = direction === 'LONG' ? 'SSL' : 'BSL';
        const fvg = (e5 && e5.fvg) || (s15.fvgs || []).filter((f) => f.dir === want && !f.filled).pop() || null;
        const price = e5 && e5.status === 'OK' ? e5.price : s15.price;
        let entry = fvg ? (fvg.lo + fvg.hi) / 2 : price;
        const allRaids = (s15.raids || []).concat(e5 && e5.status === 'OK' ? e5.raids || [] : []).filter((r) => r.side === side);
        // Stop anchors on the latest raid whose extreme sits beyond the entry (the sweep that started the move)
        const beyond = allRaids.filter((r) => (direction === 'LONG' ? r.extreme < entry : r.extreme > entry));
        const raid = beyond[beyond.length - 1];
        const buffer = 2 * tick;
        let sl;
        if (direction === 'LONG') {
            sl = raid ? raid.extreme : s15.lastLow;
            if (!isNum(sl) || sl >= entry) return { entry: roundTick(entry, tick), sl: null, tp: null, basis: 'No valid stop below entry' };
            sl -= buffer;
        } else {
            sl = raid ? raid.extreme : s15.lastHigh;
            if (!isNum(sl) || sl <= entry) return { entry: roundTick(entry, tick), sl: null, tp: null, basis: 'No valid stop above entry' };
            sl += buffer;
        }
        const stop = Math.abs(entry - sl);
        const pools = direction === 'LONG'
            ? (s15.liquidity.bsl || []).filter((p) => p > entry).sort((a, b) => a - b)
            : (s15.liquidity.ssl || []).filter((p) => p < entry).sort((a, b) => b - a);
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
        const { direction, context, s15, e5, tril, news, smt, source } = d;
        // essential inputs missing → N/A, never a made-up number
        if (!direction || !s15 || s15.status !== 'OK' || context.bias === UNAVAILABLE) return { value: null, label: 'N/A', parts: [] };
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
        add('15m structure', s15.bias === want ? 20 : s15.bias === NEUTRAL ? 0 : -20);
        if (e5 && e5.status === 'OK') add('5m confirmation', e5.confirmation === 'CONFIRMED' ? 10 : 0);
        add('TRIL ' + tril.passCount + '/4', tril.passCount * 7.5);
        const smtDir = smt.confluence === 'BULLISH_CONFLUENCE' ? BULL : smt.confluence === 'BEARISH_CONFLUENCE' ? BEAR : null;
        if (smtDir) add('SMT ' + smt.tf, smtDir === want ? (smt.tf === '15m' ? 8 + (smt.confirmed5m ? 2 : 0) : 4) : -8);
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
        const { context, s15, e5, tril, news, risk, tradingState, source, smt } = d;
        const reasons = [];
        const structDir = s15 && s15.status === 'OK' ? dirOf(s15.bias) : null;
        const ctxDir = dirOf(context.bias);
        const direction = structDir;

        let bias = 'NEUTRAL', biasNote = '';
        if (structDir && ctxDir && structDir !== ctxDir) { bias = 'NEUTRAL'; biasNote = 'Structure vs context conflict'; }
        else if (structDir) bias = structDir + ' BIAS';
        else if (ctxDir) { bias = ctxDir + ' BIAS'; biasNote = 'Context only'; }

        if (!source || source.status !== 'OK') reasons.push({ code: 'DATA UNAVAILABLE', detail: 'NQ & NAS100 market data unavailable or stale' });
        else if (!s15 || s15.status !== 'OK') reasons.push({ code: 'DATA UNAVAILABLE', detail: '15m price data insufficient' });
        if (tradingState.status !== 'READY') reasons.push({ code: 'TRADING STATE: NOT READY', detail: tradingState.reasons.join(' · ') });
        if (news.status === 'HIGH IMPACT') reasons.push({ code: 'NEWS HIGH IMPACT', detail: news.event + ' (' + news.timeToEvent + ')' });
        if (s15 && s15.status === 'OK' && !structDir) reasons.push({ code: 'STRUCTURE UNCLEAR', detail: '15m ' + s15.trend + ', no break' });
        if (context.bias === UNAVAILABLE) reasons.push({ code: 'DATA UNAVAILABLE', detail: 'COT & seasonality unavailable' });
        else if (context.bias === NEUTRAL) reasons.push({ code: 'CONTEXT UNCLEAR', detail: 'Context NEUTRAL' });
        else if (structDir && ctxDir !== structDir) reasons.push({ code: 'CONTEXT CONFLICT', detail: 'Context ' + context.bias + ' vs 15m ' + s15.bias });
        if (structDir) {
            if (tril.status === FAIL) reasons.push({ code: 'TRIL FAIL', detail: failList(tril) });
            else if (tril.status === UNCLEAR) reasons.push({ code: 'TRIL UNCLEAR', detail: failList(tril, UNCLEAR) });
            if (risk.status !== PASS) reasons.push({ code: 'RISK FAIL', detail: risk.reasons.join(' · ') || 'No valid plan' });
        }

        const confidence = computeConfidence(Object.assign({}, d, { direction: direction || ctxDir }));
        const candidate = reasons.length === 0 && !!direction;
        const decision = candidate ? direction : 'NO TRADE';
        const warnings = [];
        if (source && source.status === 'OK') {
            if (source.freshness === 'DELAYED') warnings.push('DELAYED DATA — ' + (source.f15.lagMin || 0) + ' min behind');
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
            why = 'Context ' + context.bias + ' · 15m ' + s15.structureLabel + ' · TRIL ' + tril.passCount + '/4 · SMT ' + smt.confluence +
                ' · News ' + news.status + ' · RRR 1:' + risk.rrr.toFixed(2) + ' · ' + risk.contracts + ' ct · Data ' + source.freshness + (source.role === 'NAS100_PROXY' ? ' (NAS100 proxy)' : '');
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
    function runPipeline(data, user, now) {
        user = user || {};
        const rules = Object.assign({}, DEFAULT_RULES, user.rules || {});
        const instrument = INSTRUMENTS[user.instrument] ? user.instrument : 'MNQ';

        const context = buildContext(analyzeCOT(data.cot, now), analyzeSeasonality(data.seasonality), analyzeVIX(data.vix));
        const source = selectMarketSource(data.market, now);
        let s15 = source.status === 'OK' ? analyzeStructure15(source.bars15) : { status: UNAVAILABLE, bias: null, note: 'No usable market data' };
        if (user.structureOverride && [BULL, BEAR, NEUTRAL].includes(user.structureOverride) && s15.status === 'OK') {
            s15 = Object.assign({}, s15, { bias: user.structureOverride, structureLabel: s15.structureLabel + ' (manual: ' + user.structureOverride + ')', manual: true });
        }
        const direction = s15.status === 'OK' ? dirOf(s15.bias) : null;
        const e5 = analyzeEntry5(source.status === 'OK' ? source.bars5 : null, direction);
        const smt = computeSMT(source, data.market && data.market.series ? data.market.series.SPX : null, now);
        const session = user.sessionOverride || getSession(now); // sessionOverride: DEMO / SIMULATED only
        const tradingState = computeTradingState({ trades: user.trades, now, session, userReady: user.userReady, rules });
        const news = analyzeNews(data.news, now);

        const auto = suggestLevels(direction, s15, e5, instrument, rules.minRRR);
        const lv = user.levels && [user.levels.entry, user.levels.sl, user.levels.tp].some(isNum) ? user.levels : null;
        const levels = {
            entry: lv && isNum(lv.entry) ? lv.entry : auto ? auto.entry : null,
            sl: lv && isNum(lv.sl) ? lv.sl : auto ? auto.sl : null,
            tp: lv && isNum(lv.tp) ? lv.tp : auto ? auto.tp : null,
            source: lv ? 'MANUAL' : auto ? 'AUTO' : 'NONE',
            basis: auto ? auto.basis : null,
            priceBasis: source.role === 'NAS100_PROXY' ? 'NAS100' : 'NQ',
        };
        const tril = computeTRIL({ direction, context, s15, e5, plannedEntry: levels.entry, overrides: user.trilOverrides });
        const risk = computeRisk({ direction, entry: levels.entry, sl: levels.sl, tp: levels.tp, instrument, rules, remainingLoss: tradingState.remainingLoss });
        const decision = decide({ context, s15, e5, tril, news, risk, tradingState, source, smt });

        const analystAgent = {
            agent: 'THEEB Market Analyst',
            context: context.bias,
            structure: s15.status === 'OK' ? s15.bias : UNAVAILABLE,
            tril: tril.status,
            smt: smt.confluence,
            bias: decision.direction || (decision.bias.indexOf('LONG') === 0 ? 'LONG' : decision.bias.indexOf('SHORT') === 0 ? 'SHORT' : 'NEUTRAL'),
            confidence: decision.confidence.value,
            dataSource: source.status === 'OK' ? source.label : UNAVAILABLE,
            freshness: source.freshness,
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
        return { instrument, rules, context, source, s15, e5, smt, session, tradingState, news, levels, tril, risk, decision, agents: { analyst: analystAgent, news: newsAgent } };
    }

    const api = {
        DEFAULT_RULES, INSTRUMENTS, KILL_ZONES,
        analyzeCOT, analyzeSeasonality, analyzeVIX, buildContext,
        findSwings, structureBreaks, findRaids, findFVGs, analyzeStructure15, analyzeEntry5,
        computeFreshness, selectMarketSource, smtOnTimeframe, computeSMT,
        computeTRIL, classifyEventImpact, analyzeNews, fmtMinutes,
        getSession, nyParts, computeTradingState, suggestLevels, computeRisk,
        computeConfidence, decide, runPipeline,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.TheebEngine = api;
})(typeof self !== 'undefined' ? self : this);
