# Theeb Mind (ذيب مايند)

Arabic-first (RTL) AI trading-decision audit platform: scores decision quality, tracks trader psychology, recognizes repeated patterns via a memory engine, and shows live market prices — dark UI, fully Arabic.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (Express + better-sqlite3, port 8080 via artifact env)
- `pnpm --filter @workspace/theeb-mind run dev` — frontend (React + Vite, RTL)
- `pnpm --filter @workspace/theeb-mind-pitch run dev` — hackathon slide deck
- `pnpm run typecheck` — full typecheck across all packages
- All `/api/*` routes require `X-Api-Key` header; dev demo key: `user-1_devkey`
- Health: `/health` and `/api/healthz` (deployment startup probe — must exist, no auth)

## Stack

- pnpm workspaces, TypeScript, Node.js
- API: Express + better-sqlite3 (SQLite, WAL) — schema in `artifacts/api-server/src/db/schema.sql` (copied to dist on build)
- Frontend: React + Vite, dark RTL Arabic UI
- Live market data: Binance → CoinGecko fallback + Frankfurter/ECB (no API keys)

## Where things live

- `artifacts/api-server/src/modules/` — feature modules (decision, journal, psychology, memory, quality, intelligence, market)
- `artifacts/api-server/src/modules/market/live.service.ts` — live price fetching, caching, fallbacks
- `artifacts/theeb-mind/src/` — frontend pages and components
- Production run: `node artifacts/api-server/dist/server.js` (tsc build; DB at /tmp in prod)

## User preferences

- التواصل بالعربية — المستخدم يتواصل بالعربية؛ الرد بالعربية بأسلوب مباشر وواضح
- Hackathon context: prioritize demo-readiness and visual polish
