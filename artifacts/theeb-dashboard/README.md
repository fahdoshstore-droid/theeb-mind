# THEEB MIND — Trading Decision Intelligence Dashboard

Dashboard واحد لـ **NQ / MNQ**:

```
COT + Seasonality + VIX  →  MARKET CONTEXT
15m Structure + 5m Entry →  MARKET STRUCTURE
Trend · Raid · Imbalance · Location → TRIL
News (filter only) · Risk (deterministic) · Trading State
                     ↓
              DECISION ENGINE
                     ↓
        LONG  ·  SHORT  ·  NO TRADE   (+ Bias · Confidence · Why)
```

The system outputs a **Trade Candidate** only. No broker, no order execution: you decide.
Confidence = how well the current evidence agrees (0–95). It is **not** a probability of profit.

## Run

```bash
pnpm install --filter @workspace/theeb-dashboard
cp artifacts/theeb-dashboard/.env.example artifacts/theeb-dashboard/.env   # optional
pnpm --filter @workspace/theeb-dashboard start        # http://localhost:5173
```

- `?demo=long|short|news|tril|caution` (or the **DEMO** button) loads **simulated** scenarios. A striped banner shows while demo mode is on.
- Without network access, every source shows **DATA UNAVAILABLE** and the decision is **NO TRADE**.

## Files

| Path | Role |
|---|---|
| `public/index.html` | The single dashboard (UI only, no secrets) |
| `public/engine.js` | Deterministic decision engine: context, structure (ICT/SMC), TRIL, news filter, risk, trading state, confidence, decision. Shared by the browser and the tests |
| `public/demo.js` | DEMO / SIMULATED scenarios (synthetic, flagged `simulated: true`) |
| `server.mjs` | Static server + read-only data API + AI proxy |
| `lib/sources.mjs` | Data adapters (cache; on failure `ok:false`, never fallback numbers) |
| `lib/chart-reader.mjs` | Optional AI chart reading (key stays on the server) |

## Data sources (free, no API key)

| Input | Source |
|---|---|
| COT: Large Spec (non-commercial) net, weekly Δ, 3Y COT Index | CFTC Public Reporting, Legacy futures, E-mini Nasdaq-100 (`209742`) |
| Seasonality: current month 10Y / 5Y / 2Y | Yahoo Finance `^NDX` monthly closes |
| VIX | Yahoo Finance `^VIX` |
| NQ 15m / 5m bars (delayed) | Yahoo Finance `NQ=F` (used for both NQ and MNQ) |
| Economic calendar | ForexFactory weekly export (USD events) |

## Agents (2)

1. **THEEB Market Analyst**: deterministic analysis → `{context, structure, tril, bias, confidence, reason}`.
   Optional AI layer: reads an uploaded chart screenshot and returns a structured TRIL reading. It runs only when `ANTHROPIC_API_KEY` is set on the server, and the reading is applied to TRIL only after you click *Apply*.
2. **THEEB News Agent**: `{status: LOW|CAUTION|HIGH IMPACT, event, impact, time_to_event, trading_restriction}`. It never gives a direction.

## Rules (from the existing project)

Max 2 trades/day · risk 1% / max $500 · min RRR 1:2.5 · daily loss $600 · stop after 2 consecutive losses.
Contract specs: NQ $20/pt, MNQ $2/pt. Kill zones (New York time): London 02:00–05:00, NY AM 07:00–10:00, NY PM 13:30–16:00.

### Decision rules
- NO TRADE if any core gate fails: `DATA UNAVAILABLE`, `TRADING STATE: NOT READY`, `NEWS HIGH IMPACT` (30 min before → 15 min after a high-impact USD event), `STRUCTURE UNCLEAR`, `CONTEXT UNCLEAR / CONFLICT`, `TRIL FAIL / UNCLEAR`, `RISK FAIL`.
- Context = COT (weight 2) + Seasonality (weight 1). VIX only changes confidence, never the direction.
- News CAUTION keeps the candidate, adds a warning, and lowers confidence by 10.

## Tests

```bash
pnpm --filter @workspace/theeb-dashboard test       # engine + parsers + server (node:test)
PLAYWRIGHT_MODULE=$(npm root -g)/playwright pnpm --filter @workspace/theeb-dashboard test:e2e   # browser
```
