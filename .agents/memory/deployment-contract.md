---
name: Deployment build/run contract
description: Why prod publish silently served stale code, and the checks to run before telling the user to publish
---

# Deployment build/run contract (api-server)

**Rule:** The artifact's production `run` command must execute exactly what the production `build` command produces, and the startup health-check path must exist in the *current* source — verify all three together before any publish.

**Why:** A refactor switched the build from an esbuild bundle (`dist/index.mjs`) to plain `tsc` (`dist/server.js`), but production config still ran the old git-ignored bundle. Since deployments snapshot the workspace, publish would have silently served a days-old bundle; and the configured health probe (`/api/healthz`) only existed inside that old bundle, so a clean build would have failed the startup check.

**How to apply:** Before suggesting Publish after backend changes: (1) run the production build locally, (2) run the exact production `run` command from repo root with the production env (`NODE_ENV`, `PORT`, `DB_PATH`) and curl the health path + one real endpoint, (3) remember SQLite `DB_PATH` defaults to cwd-relative — production pins it to /tmp (autoscale = ephemeral per instance, reseeds on cold start; fine for demo). Staleness probe for "did the user publish?": curl a prod endpoint that only exists in the newest code.
