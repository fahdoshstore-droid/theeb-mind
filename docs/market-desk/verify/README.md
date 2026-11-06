# Market Desk — verification scripts

Browser and regression checks used to verify this change. They need Playwright
(`require('playwright')`) and two built stacks: `main` and this branch.

```bash
# 1. build each tree's frontend
PORT=20645 BASE_PATH=/ pnpm --filter @workspace/theeb-mind run build

# 2. for each tree: API server (offline, fresh DB) + static proxy
cd artifacts/api-server
PORT=41002 DB_PATH=/tmp/branch.db HTTPS_PROXY=http://127.0.0.1:9 https_proxy=http://127.0.0.1:9 NO_PROXY=127.0.0.1 \
  node --import tsx --import ../../docs/market-desk/verify/offline-fetch.mjs src/server.ts &
node ../../docs/market-desk/verify/proxy.mjs ../theeb-mind/dist/public 42002 41002 &
#    (same for the main tree on 41001 / 42001)

# 3. API regression: seeds identical data into both, compares every read endpoint
node docs/market-desk/verify/regress.mjs http://127.0.0.1:42001 http://127.0.0.1:42002

# 4. pixel comparison of untouched pages (frozen clock)
node docs/market-desk/verify/visual.cjs ./shots

# 5. Desk and /analyze browser checks
(cd artifacts/api-server && node --import tsx ../../docs/market-desk/verify/mkpayloads.mts ../../out)
node docs/market-desk/verify/e2e.cjs ./out
```

Results from the run on 2026-11-06:

* `regress.mjs`: 24 of 25 endpoints identical. The one difference is `/api/market/cot`: `main` returned the
  hard-coded fallback rows, the branch returns `[]` (intended).
* `visual.cjs`: Journal, Patterns, Performance and Verify identical. Occasional sub-0.1 % pixel noise
  (font anti-aliasing) also appears when comparing `main` with itself.
* `e2e.cjs`: 31 of 31 checks passed.
