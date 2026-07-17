---
name: Live market data & seeded snapshots
description: Free keyless price sources chosen for the demo, and the seed-drift trap when live data sits next to static seeds
---

# Live market data & seeded snapshots

**Free keyless sources (chosen for demo reliability):** Binance public REST for crypto + PAXG (tokenized gold ≈ spot gold price), CoinGecko free tier as automatic crypto/gold fallback, Frankfurter (ECB) for FX reference rates. No API keys, so nothing to configure at publish time.

**Why:** Hackathon demo must not depend on sign-ups or secrets; indices like DXY/VIX/NAS have no reliable keyless source, so those remain user-maintained snapshots.

**Seed-drift trap:** The market module seeds static snapshot values (DXY, VIX, US10Y, GOLD, NAS) into SQLite. Once live prices render on the same page, stale seeds become glaring (gold seed showed 2380 vs live ~3987). When touching live data or re-seeding, sync seed values to current reality — and remember prod gets a fresh DB from seeds, so fix seeds in code, not just via dev-DB updates.

**Verified in production:** Binance IS geo-blocked from the production deployment region (all crypto/gold ticks come from the CoinGecko fallback there; EURUSD from ECB works fine). Dev workspace can reach Binance, so dev and prod legitimately show different `source` values — not a bug. Any future source change must keep the CoinGecko path working, since production depends on it entirely for crypto/gold.
