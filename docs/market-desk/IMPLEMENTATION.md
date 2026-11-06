# Market Desk — implementation notes

Branch: `claude/wonderful-cray-agm4cy`, built on `main` @ `0ae66ff`.
Status: implemented and verified locally. **Not deployed.**

## Scope

| Area | What changed |
|---|---|
| `/market` | Replaced by the Market Desk (`MarketDesk.tsx`). The old `MarketIntelligence.tsx` is still on disk, unused, for rollback. |
| COT | New `GET /api/market/cot/legacy`: Legacy COT for NASDAQ-100, MarketBulls primary, CFTC validation, states `VERIFIED` / `MISMATCH` / `DATA_UNAVAILABLE`. Hard-coded fallback rows removed from `/api/market/cot`. |
| TRIL | Four factors only: Time, Raid, Inversion, Liquidity. Time = Mon/Tue/Thu 09:30–12:10 `America/New_York` (DST through the IANA zone). R / I / L are manual marks, stored on the device. |
| `/analyze` | The six-factor TRIL block and the SAFE / CAUTION / DO NOT TRADE verdict were replaced by the TRIL panel. The legacy quality score stays, is labelled "LEGACY QUALITY SCORE · NOT TRIL", and is driven only by the scoring API (the local six-factor fallback was removed). The hard-coded `NQ 18,642.25 +0.62%` in the top bar was removed. |
| IPDA | Text only: `IPDA — METHODOLOGY PENDING`. No calculations, levels, midpoints or chart lines. |
| Out of phase | TradingView MCP (NQ OHLC, US02Y, US10Y, calendar, news) and MarketBulls seasonality: shown as UNAVAILABLE with their integration stage. US30Y: NOT APPROVED. DXY / VIX: NO SOURCE. |

Not changed: Journal, Patterns (`/intelligence`), Verify, Performance, the side rail, all scoring engines
(`modules/scoring/*`, `modules/quality/*`), `config/killzones.ts`, decision, coaching, memory, auth,
`db/schema.sql`, `lib/api-spec/openapi.yaml`.

## Files

### API server
| File | Change |
|---|---|
| `src/modules/market/cot-legacy.types.ts` | new — response types, provisional rule constant |
| `src/modules/market/html-tables.ts` | new — reviewed port of the table helpers from the unmerged dashboard branch |
| `src/modules/market/marketbulls-cot.ts` | new — strict Legacy parser (rejects TFF / Disaggregated categories) |
| `src/modules/market/cftc-legacy.ts` | new — CFTC Legacy Futures-only query (dataset `6dca-aqww`, contract `209742`) |
| `src/modules/market/cot-legacy.service.ts` | new — fetch, compare, cache, observation log |
| `src/modules/market/market.routes.ts` | edit — adds `/cot/legacy` and `/cot/legacy/observations`; existing handlers untouched |
| `src/modules/market/cot.service.ts` | edit — `FALLBACK_COT` deleted, failure returns `[]`; test-only extractor seam |
| `package.json` | edit — `test` script |
| `test/*.test.ts`, `test/fixtures/*`, `test/support/*` | new |

### Frontend
| File | Change |
|---|---|
| `src/pages/MarketDesk.tsx` | new |
| `src/components/desk/desk.css` | new — all rules scoped under `.desk` |
| `src/components/desk/TrilPanel.tsx` | new — shared by the Desk and `/analyze` |
| `src/components/desk/CotLegacyPanel.tsx`, `StateChip.tsx` | new |
| `src/lib/tril-time.ts`, `src/lib/tril-marks.ts`, `src/lib/sources.ts` | new — self-contained logic |
| `src/lib/api.ts`, `src/lib/types.ts` | edit — `getCotLegacy()` and its types added; nothing removed |
| `src/App.tsx` | edit — `/market` → `MarketDesk` |
| `src/components/shared/Layout.tsx` | edit — HUD station name for `/market` only |
| `src/pages/AnalyzeChart.tsx` | edit — see Scope |
| `package.json` | edit — `test`, `test:tz` scripts |
| `test/*.test.ts` | new |

## API compatibility

* All existing routes, the `X-Api-Key` auth and the `{ success, data | error }` wrapper are unchanged.
* `GET /api/market/cot`: same path, same `CotRow[]` shape, same TFF / Disaggregated mapping.
  **One behaviour change:** when the CFTC download fails it now returns `[]` instead of hard-coded rows
  labelled `reportDate: 'fallback'`. Its only in-app consumer was the old `/market` page.
* New, additive: `GET /api/market/cot/legacy` and `GET /api/market/cot/legacy/observations`.
  `/cot/legacy` always answers HTTP 200 with `data.status`; HTTP 500 only for unexpected server faults.
  When `status` is `DATA_UNAVAILABLE`, `groups`, `history` and `netChange` are `null`.
* No database schema change. COT results are cached in memory (6 h, as before); `DATA_UNAVAILABLE` is never cached.
* TRIL marks are stored in the browser under `localStorage['theeb-tril-marks-v1']`; nothing is sent to the server.

## Validation rule

`PROVISIONAL_EXACT_MATCH`: every field that both sources publish for the report week must be identical.
No tolerance is applied. This is a provisional rule, not a permanent one — see `COT-VALIDATION.md`
for how to record real differences before a rule is proposed.

## Tests

| Command | Covers |
|---|---|
| `pnpm --filter @workspace/api-server test` | 26 tests: MarketBulls / CFTC parsers, every validation state, no-fallback guarantee, caching, observation log, and route tests against the real server process with the network forced offline (auth, `/cot` contract, `/cot/legacy` shape) |
| `pnpm --filter @workspace/theeb-mind test` | 50 tests: TRIL Time boundaries, all weekdays, EDT/EST, DST transitions 2026 and 2027, countdowns; marks CRUD, validation, corrupted / blocked storage |
| `pnpm --filter @workspace/theeb-mind test:tz` | TRIL Time suite under five host time zones |
| `pnpm run typecheck`, builds | Whole workspace |
| `docs/market-desk/verify/*` | Browser and regression checks (see `verify/README.md`) |

Before this change `main` had no automated test suites; typecheck and build were the only checks.

## Rollback

Nothing is migrated, so rollback is a code revert:

1. Whole change: revert the commit(s) on this branch (or don't merge it).
2. Desk only: in `src/App.tsx` point `/market` back to `MarketIntelligence` (file still present).
3. `/analyze` only: revert `src/pages/AnalyzeChart.tsx` to `main`.
4. Old COT fallback: revert `src/modules/market/cot.service.ts` to `main` (not recommended — it shows fabricated values).
5. New endpoints are additive; leaving them in place affects nothing else.
6. Device-local marks live under their own key and can be cleared with `localStorage.removeItem('theeb-tril-marks-v1')`.

## Known limits

* MarketBulls and CFTC were **not reachable** from the build environment (egress proxy refused both hosts),
  so the parsers are tested on synthetic fixtures only. The first real run must be checked with
  `verify/cot-legacy-observe.mts` before the COT panel is relied on.
* The TradingView widget is display only. TRIL marks are records, not chart overlays.
* The `/analyze` top bar still shows the seeded DXY / VIX / US10Y snapshot values (pre-existing, outside this scope).
* The rail label for `/market` still reads "السياق الكلي"; only the HUD station name changed, to keep the shell untouched.
