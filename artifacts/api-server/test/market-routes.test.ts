// Route-level checks against the real server process, with all outbound
// network forced to fail. Verifies the existing /api/market/cot contract,
// auth, and the new /api/market/cot/legacy endpoint.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const PORT = 38000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const KEY = { 'X-Api-Key': 'user-1_devkey' };
let proc: ChildProcess;
let dir: string;

async function waitForHealth(ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`${BASE}/api/healthz`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('server did not start');
}

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'theeb-routes-'));
  const env = {
    ...process.env,
    PORT: String(PORT),
    DB_PATH: path.join(dir, 'test.db'),
    NODE_ENV: 'test',
    // curl (used by the existing CFTC downloader) and fetch both fail offline
    https_proxy: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9',
    http_proxy: 'http://127.0.0.1:9', HTTP_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
  };
  proc = spawn(process.execPath, ['--import', 'tsx', '--import', './test/support/offline-fetch.mjs', 'src/server.ts'], {
    cwd: root, env, stdio: 'ignore',
  });
  await waitForHealth();
});

after(() => {
  proc?.kill('SIGTERM');
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('existing /api/market/cot contract', () => {
  test('still requires the API key', async () => {
    const r = await fetch(`${BASE}/api/market/cot`);
    assert.equal(r.status, 401);
  });

  test('returns { success, data: CotRow[] } and no hard-coded rows when the source fails', async () => {
    const r = await fetch(`${BASE}/api/market/cot`, { headers: KEY });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.success, true);
    assert.ok(Array.isArray(j.data));
    assert.equal(j.data.length, 0, 'empty list instead of fallback values');
    assert.ok(!JSON.stringify(j).includes('fallback'));
  });
});

describe('new /api/market/cot/legacy', () => {
  test('requires the API key', async () => {
    const r = await fetch(`${BASE}/api/market/cot/legacy`);
    assert.equal(r.status, 401);
  });

  test('returns DATA_UNAVAILABLE with no position values when both sources fail', async () => {
    const r = await fetch(`${BASE}/api/market/cot/legacy`, { headers: KEY });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.success, true);
    const d = j.data;
    assert.equal(d.status, 'DATA_UNAVAILABLE');
    assert.equal(d.reason, 'BOTH_UNAVAILABLE');
    assert.equal(d.groups, null);
    assert.equal(d.history, null);
    assert.equal(d.netChange, null);
    assert.equal(d.instrument, 'NASDAQ-100');
    assert.equal(d.cftcContractCode, '209742');
    assert.equal(d.sources.primary.name, 'MarketBulls');
    assert.equal(d.sources.primary.status, 'UNAVAILABLE');
    assert.equal(d.sources.validation.name, 'CFTC');
    assert.equal(d.sources.validation.status, 'UNAVAILABLE');
    assert.equal(d.validation.rule, 'PROVISIONAL_EXACT_MATCH');
  });

  test('observations endpoint lists the comparison that was just made', async () => {
    const r = await fetch(`${BASE}/api/market/cot/legacy/observations`, { headers: KEY });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(Array.isArray(j.data));
    assert.ok(j.data.length >= 1);
    assert.equal(j.data[0].status, 'DATA_UNAVAILABLE');
  });
});
