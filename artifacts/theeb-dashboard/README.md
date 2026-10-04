# THEEB MIND — Trading Decision Intelligence Dashboard

Dashboard واحد لـ **NQ / MNQ**:

```
COT + Seasonality + VIX            → MARKET CONTEXT   (context)
NQ (or NAS100 proxy) 15m + 5m      → MARKET STRUCTURE (ICT / SMC)
Trend · Raid · Imbalance · Location → TRIL            (setup)
NQ vs S&P 500                       → SMT             (confluence only)
News (filter) · Risk (permission) · Trading State · Data Freshness
                         ↓
                  DECISION ENGINE (deterministic)
                         ↓
   LONG · SHORT · NO TRADE  + Bias · Confidence Score · Why · Data Source · Freshness
```

The output is a **Trade Candidate** only. No broker and no order execution: you decide.
**Confidence Score** (0–95) measures how well the current evidence agrees. It is **not** a win probability.

## Run

```bash
pnpm install --filter @workspace/theeb-dashboard
cp artifacts/theeb-dashboard/.env.example artifacts/theeb-dashboard/.env   # set TradingView MCP + optional AI key
pnpm --filter @workspace/theeb-dashboard start        # http://localhost:5173
```

- **LIVE** (default): server data only. A failed source shows **DATA UNAVAILABLE** and is never replaced by demo data or shown as NEUTRAL.
- **DEMO** (button, or `?demo=<scenario>`): 13 simulated scenarios under a permanent striped banner. Demo and live data are kept in separate slots.

## Data sources

| Input | Primary | Fallback (labelled in the UI) |
|---|---|---|
| COT (Large Spec long/short/net, weekly Δ, COT Index 6M/36M, commercials, small traders) | MarketBulls `cot-report-nasdaq-100` | CFTC Legacy COT (E-mini Nasdaq-100) |
| Seasonality (10Y / 5Y / 2Y, current month/day, avg change, bias) | MarketBulls `seasonal-tendencies-nasdaq-100` | Yahoo `^NDX` monthly returns |
| NQ futures OHLC | **Databento** CME GLBX.MDP3 `ohlcv-1m`, `NQ.c.0` (contract per bar) → TradingView MCP → Yahoo `NQ=F` (DELAYED) → CSV file (`NQ_CSV_PATH`, historical) | each labelled in Data Lineage |
| NAS100 / S&P 500 bars | TradingView MCP | Yahoo (always marked DELAYED) |
| VIX | TradingView MCP | Yahoo `^VIX` |
| Economic calendar | ForexFactory weekly export | none (shown as DATA UNAVAILABLE) |

The MarketBulls adapter parses the page's tables and embedded chart series and validates every field. If the format is not recognised, it throws and the fallback is used, labelled as such.

### Timeframes: selected by evidence, never assumed
Nothing is hard-wired to 15m/5m. The supported timeframes are 1m, 5m, 15m, 30m, and 1h. Higher timeframes are built from the finest real bars by deterministic aggregation (open = first, high = max, low = min, close = last, volume = sum). Empty buckets are skipped, never interpolated, and buckets spanning a contract roll are flagged. Analysis only uses bars of the current contract.

`validate:timeframes` replays the live engine (Structure → TRIL R/I/L → Risk) over real NQ history for 12 configurations: 5 single-timeframe and 7 structure→execution pairs. Trades are simulated on the finest bars (limit fill, SL before TP in the same bar, 48h max hold). For each configuration it reports:
- n, win rate, Wilson 95% CI
- expectancy (R), profit factor, 95% lower bound of expectancy
- 4-period stability, recent performance, yearly distribution

A configuration is **eligible** only with n ≥ 30, expectancy LB95 > 0, PF ≥ 1.2, positive in ≥ 3/4 periods, and positive recent expectancy. Among eligible configurations, the one with the highest LB95 is selected; win rate alone never selects. Without a report, or without an eligible configuration, the result is **NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE** and the decision is NO TRADE. T (Trend) is the weekly context layer and is not timeframe-dependent, so the replay evaluates R / I / L.

```bash
pnpm --filter @workspace/theeb-dashboard validate:timeframes -- --csv nq_1m.csv --tz America/Chicago
DATABENTO_API_KEY=... pnpm --filter @workspace/theeb-dashboard validate:timeframes -- --databento --days 180
```

### Market status
`OPEN` · `CLOSED` · `UNKNOWN`: the CME Globex schedule (New York time) first, then data evidence. If the schedule says open but no current data arrives, the status is UNKNOWN (holiday, halt, or feed issue).
When the market is not OPEN, the decision is always **NO TRADE** (`MARKET CLOSED` / `MARKET STATUS UNKNOWN`). The last session's bars are labelled **LAST AVAILABLE** and are analysed for engine validation only, with no live confidence.

### Freshness and source selection
`FRESH` (last bar ≤ 2 min late) · `DELAYED` (≤ 20 min, or a delayed feed) · `LAST AVAILABLE` (market closed, last session) · `STALE` (shown, never used) · `UNAVAILABLE`.

1. NQ is FRESH → use NQ.
2. NQ is delayed, stale or unavailable, and NAS100 is FRESH → **NAS100 PROXY**. It is labelled everywhere, and levels are marked as NAS100 prices.
3. Otherwise, use the best DELAYED series and lower confidence.
4. Neither is usable → **NO TRADE**.

15m and 5m always come from the same series. A stale 5m is dropped, with a visible note.

## Agents (2)

1. **THEEB Market Analyst**: deterministic analysis →
   `{context, structure, tril, smt, bias, confidence, dataSource, freshness, reason}`.
   Optional AI layer: reads a chart screenshot and returns a structured TRIL reading. It runs only when `ANTHROPIC_API_KEY` is set on the server, and the reading is applied to TRIL only when you click *Apply*.
2. **THEEB News Agent**: `{status: CLEAR|CAUTION|HIGH IMPACT|UNAVAILABLE, event, impact, timeToEvent, tradingRestriction}`. It never gives a direction.

## Decision rules

NO TRADE when any core gate fails: `DATA UNAVAILABLE` · `TRADING STATE: NOT READY` · `NEWS HIGH IMPACT` (30 min before → 15 min after) · `STRUCTURE UNCLEAR` · `CONTEXT UNCLEAR / CONFLICT` · `TRIL FAIL / UNCLEAR` · `RISK FAIL`.

- Context = COT (weight 2) + Seasonality (weight 1). VIX only lowers confidence.
- SMT: one index takes a recent high/low and the other does not. It moves confidence by +4 to +10 or −8 and never creates or blocks a trade.
- Confidence is N/A when price data or context is missing. Deductions: DELAYED −5, NAS100 proxy −5, news CAUTION −10, VIX HIGH −10, partial context −5.
- Rules: 2 trades/day · 1% / max $500 · min RRR 1:2.5 · daily loss $600 · stop after 2 consecutive losses · NQ $20/pt, MNQ $2/pt.

## Tests

```bash
pnpm --filter @workspace/theeb-dashboard test       # engine, adapters, real stdio MCP round-trip, server, security
PLAYWRIGHT_MODULE=$(npm root -g)/playwright pnpm --filter @workspace/theeb-dashboard test:e2e   # browser: all scenarios + LIVE via MCP
# REAL sources (no mocks): records every source failure and checks the invariants
TRADINGVIEW_MCP_COMMAND=... REPORT_PATH=live-report.json pnpm --filter @workspace/theeb-dashboard test:live
```

The TradingView MCP server must expose an **OHLC-history tool** (symbol + timeframe → bars). Example: `tradingview-mcp-server` 0.8.1 (PyPI) has 37 tools but none that returns 15m/5m bars, so the adapter reports that clearly and does not misuse a scanner tool.
