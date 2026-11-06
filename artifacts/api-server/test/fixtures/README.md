# Test fixtures

These files are **synthetic**. They imitate the *shape* of the MarketBulls COT page
and the CFTC Legacy dataset so the parsers and the validation states can be tested.
They are not market data and must never be served by the app.

The MarketBulls page renders its COT report client-side, so the MarketBulls
fixtures reproduce the page's two embedded JSON blobs rather than the empty
Legacy `<table>`:

- `marketbulls-legacy-synthetic.html` — `var data` (net-only weekly history) +
  `lcot_data` (latest report's long/short), three weeks.
- `marketbulls-live-blob-synthetic.html` — the real live key names and the real
  2026-10-27 values from `https://market-bulls.com/cot-report-nasdaq-100/`,
  trimmed to two history rows.
- `marketbulls-tff-synthetic.html` — Disaggregated / TFF net keys only (no Legacy
  net positions); the parser must throw rather than map them to Non-commercial.

Replace or extend them with recorded real responses once the hosts are reachable
(see `docs/market-desk/COT-VALIDATION.md`).
