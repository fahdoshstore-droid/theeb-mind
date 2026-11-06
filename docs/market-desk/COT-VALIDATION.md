# Legacy COT — validation procedure

MarketBulls is the primary source. CFTC is the independent validation source.
The app never shows unverified values as verified, and never shows fallback values.

## States

| State | When | What the API returns |
|---|---|---|
| `VERIFIED` | Both sources returned the MarketBulls report week and every field both publish is identical | Groups, net change (if the previous week is also verified), verified history |
| `MISMATCH` | Both returned the week, at least one shared field differs | No verified groups. Both sides under `sources.*.unverifiedLatest`, every difference in `validation.differences` |
| `DATA_UNAVAILABLE` | Either source failed, the week is missing from CFTC, or no field can be compared | No position values at all. `reason` says why |

`reason` values: `PRIMARY_UNAVAILABLE`, `VALIDATION_UNAVAILABLE`, `BOTH_UNAVAILABLE`,
`VALIDATION_WEEK_NOT_FOUND`, `NO_COMPARABLE_FIELDS`, `VALUES_DIFFER`.

## Current rule: provisional

`PROVISIONAL_EXACT_MATCH` — no tolerance. It was chosen because it invents nothing, not because exact
equality is known to be right. It must be reviewed against real responses.

## Why real responses may differ

These are possibilities to check, not assumptions built into the code:

1. **Contract.** The CFTC query uses `209742` (E-mini Nasdaq-100, CME). MarketBulls' "Nasdaq-100" page may
   use a different or consolidated contract.
2. **Report type.** The CFTC dataset is Legacy **Futures Only** (`6dca-aqww`). MarketBulls may publish
   Futures-and-Options Combined.
3. **Timing.** MarketBulls may publish a week before or after the CFTC dataset updates
   (→ `VALIDATION_WEEK_NOT_FOUND` for a while on release day).
4. **Page format.** The MarketBulls parser was ported from the unmerged dashboard branch and has only been
   tested on a synthetic page. Header wording on the live page may not match (→ `PRIMARY_UNAVAILABLE` with a
   "no complete Legacy table" error).
5. **Net definition.** If MarketBulls' net includes spreading positions, it will differ from long − short.

## How to record observations

Where `market-bulls.com` and `publicreporting.cftc.gov` are reachable:

```bash
cd artifacts/api-server
node --import tsx ../../docs/market-desk/verify/cot-legacy-observe.mts cot-report-$(date +%F).json
```

The report lists, per MarketBulls week, whether CFTC has it and every field-level difference
(`primary`, `validation`, `delta`). A running server also keeps the last 100 comparisons at
`GET /api/market/cot/legacy/observations`.

Collect several weekly reports, then propose a rule (e.g. which contract and report type to match, and
whether any difference is acceptable) with the observed numbers attached. Until then, any difference
stays `MISMATCH`.
