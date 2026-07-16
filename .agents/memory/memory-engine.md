---
name: Memory Engine — pattern key design
description: Durable design decisions for the memory_fingerprints / failure_patterns system
---

## Pattern key encoding
Format: `"{instrument}:{timeframe}:{killzone}:{grade}"` using `:` as delimiter.

**Why this matters:** Instrument values already contain `:` (e.g. `OANDA:NAS100USD`). Always parse by popping the last 3 tokens from the right — timeframe, killzone, grade are all guaranteed colon-free; rejoin any remaining parts as the instrument. Never split and index positionally from the left.

**How to apply:** Whenever reading a `pattern_key` from the DB in UI code or service code, use `parts = key.split(':'); grade = parts.pop(); killzone = parts.pop(); timeframe = parts.pop(); instrument = parts.join(':')`.

## SQL "last N rows" aggregation
To count matching rows within the N most-recent rows, wrap in a subquery: `SELECT COUNT(*) FROM (SELECT ... ORDER BY created_at DESC LIMIT N) WHERE condition`. A bare `COUNT(*) ... LIMIT N` counts all matching rows, not the last N.

**Why:** SQLite (and standard SQL) applies `LIMIT` after `WHERE` + aggregation, so `COUNT(*) LIMIT 10` still returns the full count with a row-count cap of 1, not "count within last 10 rows".
