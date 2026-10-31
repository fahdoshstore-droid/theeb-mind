import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { startServer, Client } from './helpers.js';
import { db } from '../src/db/db.js';

let base = '', server: any;
let alice: Client, bob: Client, anon: Client;

const CSV = [
  'Trade ID,Account,Symbol,Side,Qty,Entry Time,Exit Time,Entry Price,Exit Price,Commission,Net P&L,Stop Loss,Notes',
  'T1,Elite 50K,NQH5,Long,1,2025-01-15 09:45:00,2025-01-15 10:05:00,21000,21010,4.50,195.50,20990,',
  'T2,Elite 50K,MNQH5,Short,3,2025-01-15 10:20:00,2025-01-15 10:31:00,21020,21030,2.22,-62.22,21035,',
  'T3,Elite 50K,NQH5,Long,2,2025-01-16 09:52:00,2025-01-16 10:15:00,21100,21095,9.00,-209.00,,=HYPERLINK("http://evil")',
  'T3,Elite 50K,NQH5,Long,2,2025-01-16 09:52:00,2025-01-16 10:15:00,21100,21095,9.00,-209.00,,dup row in file',
  'T4,Elite 50K,NQH5,Sideways,1,2025-01-16 11:00:00,2025-01-16 11:05:00,21100,21105,4.50,20.50,,',
  'T5,TopstepX,MNQH5,Long,1,2025-01-17 09:40:00,2025-01-17 09:50:00,21000,21040,0.74,79.26,20980,',
].join('\n');
const importReq = { content: CSV, filename: 'tz-sample.csv', kind: 'trades', preset: 'tradezella_like', timezone: 'America/New_York' };

before(async () => {
  process.env.ALLOW_REGISTRATION = 'false';
  ({ base, server } = await startServer());
  alice = new Client(base); bob = new Client(base); anon = new Client(base);
});
after(() => { server.close(); });

test('no built-in dev key: X-Api-Key user-1_devkey is rejected; no session → 401', async () => {
  const r = await anon.get('/api/ledger/trades', { headers: { 'X-Api-Key': 'user-1_devkey' } });
  assert.equal(r.status, 401);
  assert.equal((await anon.get('/api/journal/user-1')).status, 401);
  assert.equal((await anon.get('/api/ledger/accounts')).status, 401);
});

test('bootstrap: first registration creates owner; registration then closes', async () => {
  const st = await anon.get('/api/auth/status');
  assert.equal(st.json.data.bootstrapRequired, true);
  assert.equal((await alice.post('/api/auth/register', { username: 'alice', password: 'short' })).status, 400);
  const r = await alice.post('/api/auth/register', { username: 'alice', password: 'correct horse battery' });
  assert.equal(r.status, 201);
  assert.match(r.headers.get('set-cookie')!, /HttpOnly; SameSite=Strict; Path=\/api/);
  assert.equal((await bob.post('/api/auth/register', { username: 'bob', password: 'another long password' })).status, 403);
  process.env.ALLOW_REGISTRATION = 'true';
  assert.equal((await bob.post('/api/auth/register', { username: 'bob', password: 'another long password' })).status, 201);
  process.env.ALLOW_REGISTRATION = 'false';
});

test('session cookie is stored hashed, not in plain text', () => {
  const token = decodeURIComponent(alice.cookie.split('=')[1]);
  const rows = db.raw.prepare('SELECT token_hash FROM auth_sessions').all() as { token_hash: string }[];
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.token_hash !== token && r.token_hash.length === 64));
  const cred = db.raw.prepare('SELECT password_hash FROM auth_credentials').get() as { password_hash: string };
  assert.ok(cred.password_hash.startsWith('scrypt$') && !cred.password_hash.includes('correct horse'));
});

test('login: wrong password 401, throttled after 5 failures, correct login works', async () => {
  const c = new Client(base);
  for (let i = 0; i < 5; i++) assert.equal((await c.post('/api/auth/login', { username: 'bob', password: 'nope-nope-nope' })).status, 401);
  assert.equal((await c.post('/api/auth/login', { username: 'bob', password: 'another long password' })).status, 429);
  const d = new Client(base);
  assert.equal((await d.post('/api/auth/login', { username: 'alice', password: 'correct horse battery' })).status, 200);
  assert.equal((await d.get('/api/ledger/accounts')).status, 200);
  assert.equal((await d.post('/api/auth/logout')).status, 200);
  assert.equal((await d.get('/api/ledger/accounts')).status, 401);
});

test('CSRF: state-changing request without X-Requested-With is refused', async () => {
  const r = await alice.post('/api/ledger/accounts', { name: 'x' }, { csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, 'CSRF_HEADER_REQUIRED');
});

let batchId = '', t1 = '', sha = '';
test('import preview: mapping, per-row errors, in-file duplicates, new accounts — no writes', async () => {
  const r = await alice.post('/api/ledger/imports/preview', importReq);
  assert.equal(r.status, 200, r.text);
  const p = r.json.data;
  sha = p.fileSha256;
  assert.equal(p.summary.rows, 6); assert.equal(p.summary.errors, 1); assert.equal(p.summary.duplicatesInFile, 1); assert.equal(p.summary.new, 4);
  assert.equal(p.preset.verified, false);
  assert.deepEqual(p.accounts.map((a: any) => [a.name, a.exists]), [['Elite 50K', false], ['TopstepX', false]]);
  assert.ok(p.rows.find((x: any) => x.rowIndex === 5).errors[0].includes('side'));
  assert.equal(p.summary.netPnlOfNewRows, round(195.5 - 62.22 - 209 + 79.26));
  assert.equal((db.raw.prepare('SELECT COUNT(*) c FROM trades').get() as any).c, 0);
});
const round = (n: number) => Math.round(n * 100) / 100;

test('import commit: stale preview refused; commit stores batch, raw rows, trades; totals reconcile', async () => {
  assert.equal((await alice.post('/api/ledger/imports/commit', { ...importReq, duplicatePolicy: 'skip', expectedSha256: 'a'.repeat(64) })).status, 400);
  const r = await alice.post('/api/ledger/imports/commit', { ...importReq, duplicatePolicy: 'skip', expectedSha256: sha });
  assert.equal(r.status, 201, r.text);
  const c = r.json.data; batchId = c.batchId;
  assert.deepEqual([c.rows, c.imported, c.duplicates, c.errors], [6, 4, 1, 1]);
  assert.equal(c.importedNetTotal, round(195.5 - 62.22 - 209 + 79.26));
  const b = (await alice.get(`/api/ledger/imports/${batchId}`)).json.data;
  assert.equal(b.rows.length, 6);
  assert.deepEqual(b.rows.map((x: any) => x.outcome), ['imported', 'imported', 'imported', 'duplicate_in_file', 'error', 'imported']);
  assert.equal(b.rows[0].raw['Net P&L'], '195.50');
  const src = await alice.get(`/api/ledger/imports/${batchId}/source`);
  assert.equal(src.text, CSV);
  const trades = (await alice.get('/api/ledger/trades')).json.data;
  assert.equal(trades.length, 4);
  t1 = trades.find((t: any) => t.externalId === 'T1').id;
  const an = (await alice.get('/api/ledger/analytics')).json.data;
  assert.equal(an.metrics.find((m: any) => m.key === 'net_pnl').value, c.importedNetTotal);
});

test('re-import: same file → duplicates skipped (no double counting); sameFileImportedBefore reported', async () => {
  const p = (await alice.post('/api/ledger/imports/preview', importReq)).json.data;
  assert.equal(p.sameFileImportedBefore.length, 1);
  assert.equal(p.summary.duplicatesExisting, 4); assert.equal(p.summary.new, 0);
  const c = (await alice.post('/api/ledger/imports/commit', { ...importReq, duplicatePolicy: 'skip', expectedSha256: p.fileSha256 })).json.data;
  assert.equal(c.imported, 0); assert.equal(c.duplicates, 5);
  assert.equal((await alice.get('/api/ledger/trades')).json.data.length, 4);
});

test('re-import policy update: imported fields refresh, user notes/tags survive, audit keeps old values', async () => {
  await alice.patch(`/api/ledger/trades/${t1}`, { userNotes: 'waited for the IFVG retest', setup: 'TRIL AM' });
  await alice.put(`/api/ledger/trades/${t1}/tags`, { tags: ['A+', 'patience'] });
  const changed = CSV.replace('T1,Elite 50K,NQH5,Long,1,2025-01-15 09:45:00,2025-01-15 10:05:00,21000,21010,4.50,195.50', 'T1,Elite 50K,NQH5,Long,1,2025-01-15 09:45:00,2025-01-15 10:05:00,21000,21010,4.80,195.20');
  const req = { ...importReq, content: changed };
  const p = (await alice.post('/api/ledger/imports/preview', req)).json.data;
  const c = (await alice.post('/api/ledger/imports/commit', { ...req, duplicatePolicy: 'update', expectedSha256: p.fileSha256 })).json.data;
  assert.equal(c.updated, 4);
  const d = (await alice.get(`/api/ledger/trades/${t1}`)).json.data;
  assert.equal(d.trade.netPnl, 195.2); assert.equal(d.trade.fees, 4.8);
  assert.equal(d.trade.userNotes, 'waited for the IFVG retest'); assert.equal(d.trade.setup, 'TRIL AM');
  assert.deepEqual(d.trade.tags.sort(), ['A+', 'patience']);
  assert.ok(d.history.some((h: any) => h.type === 'ledger.trade.reimport_update' && h.data.before.net_pnl === 195.5));
  assert.equal(d.rawRows.length, 3); // original, skipped duplicate, update — all raw rows preserved
});

test('re-import policy distinct imports deliberately as separate trades', async () => {
  const one = CSV.split('\n').slice(0, 2).join('\n');
  const p = (await alice.post('/api/ledger/imports/preview', { ...importReq, content: one })).json.data;
  const c = (await alice.post('/api/ledger/imports/commit', { ...importReq, content: one, duplicatePolicy: 'distinct', expectedSha256: p.fileSha256 })).json.data;
  assert.equal(c.imported, 1);
  assert.equal((await alice.get('/api/ledger/trades')).json.data.length, 5);
});

test('IDOR: bob cannot read, modify, tag, attach to, export or reconcile alice\'s data', async () => {
  assert.equal((await bob.get(`/api/ledger/trades/${t1}`)).status, 404);
  assert.equal((await bob.patch(`/api/ledger/trades/${t1}`, { userNotes: 'pwned' })).status, 404);
  assert.equal((await bob.put(`/api/ledger/trades/${t1}/tags`, { tags: ['x'] })).status, 404);
  assert.equal((await bob.get(`/api/ledger/imports/${batchId}`)).status, 404);
  assert.equal((await bob.get(`/api/ledger/imports/${batchId}/source`)).status, 404);
  assert.equal((await bob.get('/api/ledger/trades')).json.data.length, 0);
  const accA = (await alice.get('/api/ledger/accounts')).json.data[0].id;
  assert.equal((await bob.get(`/api/ledger/planner/${accA}`)).status, 404);
  assert.equal((await bob.post(`/api/ledger/planner/${accA}/payouts`, { kind: 'received', amount: 100, date: '2025-02-01' })).status, 404);
  assert.equal((await bob.post('/api/ledger/trades', { accountId: accA, symbol: 'NQ', side: 'long', quantity: 1, entryTime: '2025-01-15T15:00:00Z', entryPrice: 1 })).status, 404);
  assert.equal((await bob.post('/api/ledger/tril', { phase: 'post_trade', tradeId: t1, evidence: {} })).status, 404);
  assert.equal((await bob.post('/api/ledger/behavior/feedback', { pattern: 'x', tradeId: t1, verdict: 'rejected' })).status, 404);
  const exp = (await bob.get('/api/ledger/export')).json;
  assert.equal(exp.trades.length, 0); assert.equal(exp.rawRows.length, 0);
  // bob's commit into an account named like alice's creates his own account, never touches hers
  const p = (await bob.post('/api/ledger/imports/preview', importReq)).json.data;
  assert.equal(p.summary.duplicatesExisting, 0);
  assert.ok(p.accounts.every((a: any) => !a.exists));
  // legacy routes: path userId of another user is refused
  const aliceId = (await alice.get('/api/auth/status')).json.data.user.id;
  assert.equal((await bob.get(`/api/journal/${aliceId}`)).status, 403);
  const d = (await alice.get(`/api/ledger/trades/${t1}`)).json.data;
  assert.equal(d.trade.userNotes, 'waited for the IFVG retest');
});

test('attachments: magic bytes checked, owner-only retrieval, nosniff', async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]).toString('base64');
  assert.equal((await alice.post(`/api/ledger/trades/${t1}/attachments`, { mime: 'image/png', dataBase64: Buffer.from('<svg onload=alert(1)>').toString('base64') })).status, 400);
  assert.equal((await alice.post(`/api/ledger/trades/${t1}/attachments`, { mime: 'image/svg+xml', dataBase64: png })).status, 400);
  const a = await alice.post(`/api/ledger/trades/${t1}/attachments`, { mime: 'image/png', dataBase64: png, caption: '1m entry' });
  assert.equal(a.status, 201);
  const g = await alice.get(`/api/ledger/attachments/${a.json.data.id}`);
  assert.equal(g.status, 200); assert.equal(g.headers.get('content-type'), 'image/png'); assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await bob.get(`/api/ledger/attachments/${a.json.data.id}`)).status, 404);
});

test('CSV export neutralises formula injection from imported notes', async () => {
  const r = await alice.get('/api/ledger/export?format=csv');
  assert.equal(r.status, 200);
  assert.ok(r.text.includes(`"'=HYPERLINK(""http://evil"")"`), r.text.slice(0, 400));
  assert.ok(!/,=HYPERLINK/.test(r.text));
});

test('import limits: oversize file, bad time zone, unknown mapping column', async () => {
  assert.equal((await alice.post('/api/ledger/imports/preview', { ...importReq, timezone: 'Mars/Olympus' })).json.error.message.includes('time zone'), true);
  assert.equal((await alice.post('/api/ledger/imports/preview', { ...importReq, mapping: { symbol: 'Nope' } })).status, 400);
  const big = 'a,b\n' + 'x,y\n'.repeat(1_400_000);
  const r = await alice.post('/api/ledger/imports/preview', { ...importReq, content: big });
  assert.equal(r.status, 400); assert.equal(r.json.error.code, 'FILE_TOO_LARGE');
});

test('rules profile: seeded values need confirmation; historical kept; edits versioned with history; no trade-count blocking', async () => {
  const r = (await alice.get('/api/ledger/rules')).json.data;
  const k = Object.fromEntries(r.rules.map((x: any) => [x.key, x]));
  assert.equal(k.max_trade_risk_usd.active.value, 500); assert.equal(k.min_rrr.active.value, 2); assert.equal(k.daily_loss_limit_usd.active.value, 1000);
  assert.equal(k.min_rrr.needsConfirmation, true);
  assert.ok(k.min_rrr.conflicts.some((c: any) => c.value === 2.5 && c.status === 'historical'));
  assert.ok(k.daily_loss_limit_usd.conflicts.some((c: any) => c.value === 600));
  assert.equal(k.max_trades_per_day.active, null); assert.equal(r.enforcesTradeCount, false);
  const set = await alice.put('/api/ledger/rules/min_rrr', { value: 2.2, reason: 'testing' });
  assert.equal(set.status, 200); assert.equal(set.json.data.version, 2);
  assert.equal((await alice.put('/api/ledger/rules/min_rrr', { value: -1 })).status, 400);
  const h = (await alice.get('/api/ledger/rules/history')).json.data;
  assert.ok(h.some((x: any) => x.rule_key === 'min_rrr' && x.action === 'set' && x.old === 2 && x.new.value === 2.2));
  // legacy rule engine reads the same profile: no daily trade limit, RRR 2.2, $1,000
  const cfg = (await alice.get('/api/rules/config')).json.data;
  const byId = Object.fromEntries(cfg.map((x: any) => [x.id, x]));
  assert.equal(byId.max_trades.active, false); assert.equal(byId.no_trade_day.active, false); assert.equal(byId.min_rrr.threshold, 2.2); assert.equal(byId.daily_loss_limit.threshold, 1000);
  const ev = (await alice.post('/api/rules/evaluate', { tradesTaken: 7, riskAmount: 100, rrr: 3, dailyPnl: 0, consecLosses: 0, dayOfWeek: 3 })).json.data;
  assert.equal(ev.blocked, false, JSON.stringify(ev));
  // bob's profile is independent
  const kb = Object.fromEntries((await bob.get('/api/ledger/rules')).json.data.rules.map((x: any) => [x.key, x]));
  assert.equal(kb.min_rrr.active.value, 2);
});

test('risk check uses the active profile and never blocks on trade count', async () => {
  const r = (await alice.post('/api/ledger/risk/check', { symbol: 'MNQH5', side: 'long', entryPrice: 21000, stopPrice: 20950, targetPrice: 21120, quantity: 4 })).json.data;
  assert.equal(r.risk.riskUsd, 400); assert.equal(r.risk.rrr, 2.4);
  const by = Object.fromEntries(r.checks.map((c: any) => [c.key, c]));
  assert.equal(by.max_risk.status, 'ok'); assert.equal(by.min_rrr.status, 'ok'); assert.equal(by.trade_count.status, 'info');
  assert.ok(r.rulesUnconfirmed.includes('max_trade_risk_usd'));
});

test('TRIL records: insufficient evidence; pre-trade lock prevents hindsight edits; retrospective flag', async () => {
  const pre = await alice.post('/api/ledger/tril', { phase: 'pre_trade', instrument: 'NQ', direction: 'long', decisionTime: '2025-01-15T14:50:00Z', analysisText: 'HTF bullish, waiting for raid of Asia low', evidence: {} });
  assert.equal(pre.status, 201, pre.text);
  assert.equal(pre.json.data.overall, 'INSUFFICIENT_EVIDENCE');
  const id = pre.json.data.id;
  const upd = await alice.put(`/api/ledger/tril/${id}`, { phase: 'pre_trade', decisionTime: '2025-01-15T14:50:00Z', evidence: { raid: { liquiditySwept: { state: 'yes', source: 'screenshot' } } } });
  assert.equal(upd.status, 200);
  const lock = await alice.post(`/api/ledger/tril/${id}/lock`, { tradeId: t1 });
  assert.equal(lock.json.data.tradeId, t1);
  assert.equal(lock.json.data.retrospective, true); // recorded now, trade entered in Jan 2025
  assert.equal((await alice.put(`/api/ledger/tril/${id}`, { phase: 'pre_trade', evidence: {} })).json.error.code, 'LOCKED');
  assert.equal((await bob.get(`/api/ledger/tril/${id}`)).status, 404);
});

test('snapshots: TradeZella report stored as reported_snapshot (no fake trades); discrepancies listed', async () => {
  const before = (await alice.get('/api/ledger/trades')).json.data.length;
  const s = await alice.post('/api/ledger/snapshots', { template: 'tradezella_515' });
  assert.equal(s.status, 201, s.text);
  const d = s.json.data;
  assert.equal(d.kind, 'reported_snapshot'); assert.equal(d.metrics.trades, 515);
  assert.equal(d.internalChecks.find((c: any) => c.key === 'avg_x_count').status, 'mismatch');
  assert.equal(d.vsLedger.find((c: any) => c.key === 'trades').status, 'mismatch');
  assert.equal((await alice.get('/api/ledger/trades')).json.data.length, before);
  assert.equal((await alice.post('/api/ledger/snapshots', { template: 'tradezella_515' })).status, 400);
  const alpha = (await alice.post('/api/ledger/snapshots', { template: 'alpha_futures_103' })).json.data;
  assert.equal(alpha.dataset, 'alpha_futures_103');
  assert.equal((await bob.get(`/api/ledger/snapshots/${d.id}`)).status, 404);
});

test('DEMO data is labelled, isolated in a DEMO account, excluded from real analytics by default', async () => {
  const realNet = (await alice.get('/api/ledger/analytics')).json.data.metrics.find((m: any) => m.key === 'net_pnl').value;
  const s = (await alice.post('/api/ledger/demo/seed')).json.data;
  assert.equal(s.created, 40);
  assert.equal((await alice.get('/api/ledger/analytics')).json.data.metrics.find((m: any) => m.key === 'net_pnl').value, realNet);
  const demo = (await alice.get(`/api/ledger/analytics?accountIds=${s.accountId}`)).json.data;
  assert.ok(demo.notices.some((n: any) => n.code === 'demo'));
  // real imports cannot target the DEMO account
  const r = await alice.post('/api/ledger/imports/preview', { ...importReq, content: CSV.replace(/Elite 50K|TopstepX/g, 'DEMO — sample data (not real trades)') });
  assert.equal(r.json.error?.code, 'DEMO_MIX');
  assert.equal((await alice.del('/api/ledger/demo')).json.data.deletedAccounts, 1);
});

test('fills import: grouped into positions, fills linked, re-import of fills skipped', async () => {
  const fills = ['Fill ID,Account,Symbol,Side,Qty,Price,Time,Commission',
    'F1,Fills Acct,MNQH5,Buy,2,21000,2025-02-03T14:35:00Z,0.74',
    'F2,Fills Acct,MNQH5,Buy,1,20990,2025-02-03T14:36:00Z,0.37',
    'F3,Fills Acct,MNQH5,Sell,3,21010,2025-02-03T14:50:00Z,1.11'].join('\n');
  const req = { content: fills, kind: 'fills', preset: 'generic_fills', timezone: 'UTC', filename: 'fills.csv' };
  const p = (await alice.post('/api/ledger/imports/preview', req)).json.data;
  assert.equal(p.summary.positions, 1);
  assert.equal(p.positions[0].grossPnl, 80); assert.equal(p.positions[0].netPnl, 77.78); // 40 pts × $2
  const c = (await alice.post('/api/ledger/imports/commit', { ...req, duplicatePolicy: 'skip', expectedSha256: p.fileSha256 })).json.data;
  assert.equal(c.imported, 1);
  const tid = (await alice.get('/api/ledger/trades?symbol=MNQ')).json.data.find((t: any) => t.origin === 'import_fills').id;
  const d = (await alice.get(`/api/ledger/trades/${tid}`)).json.data;
  assert.equal(d.fills.length, 3); assert.equal(d.trade.netSource, 'recomputed');
  const p2 = (await alice.post('/api/ledger/imports/preview', req)).json.data;
  assert.equal(p2.summary.duplicatesExisting, 3); assert.equal(p2.summary.positions, 0);
  const beh = (await alice.get('/api/ledger/behavior')).json.data;
  assert.ok(beh.findings.find((f: any) => f.pattern === 'add_to_loser')?.evidence.some((e: any) => e.tradeId === tid));
});

test('planner: firm rules are user-configured with https source; payout stages kept separate', async () => {
  assert.equal((await alice.post('/api/ledger/firms', { name: 'X', sourceUrl: 'http://insecure', rules: {} })).status, 400);
  const f = (await alice.post('/api/ledger/firms', { name: 'My Firm 50K', sourceUrl: 'https://example.com/rules', sourceCheckedAt: '2026-10-31', rules: { drawdownModel: 'static', maxDrawdownUsd: 2000 } })).json.data;
  const acc = (await alice.post('/api/ledger/accounts', { name: 'Funded #1', firmProfileId: f.id, phase: 'funded_pre_payout', startingBalance: 50000 })).json.data;
  await alice.post(`/api/ledger/planner/${acc.id}/payouts`, { kind: 'submitted', amount: 500, date: '2025-03-01' });
  const pl = (await alice.get(`/api/ledger/planner/${acc.id}`)).json.data;
  assert.equal(pl.plan.floor.value, 48000); assert.equal(pl.plan.payouts.submitted, 500); assert.equal(pl.plan.payouts.received, 0);
  assert.equal(pl.plan.eligibility, 'UNKNOWN');
  assert.ok(pl.plan.riskSuggestion.note.includes('does not change your risk profile'));
});

test('validation errors return a structured 400 without stack traces', async () => {
  const r = await alice.post('/api/ledger/trades', { symbol: 'NQ' });
  assert.equal(r.status, 400); assert.equal(r.json.error.code, 'VALIDATION_ERROR'); assert.equal(r.json.error.stack, undefined);
});

test('frontend source contains no API keys or hard-coded user ids', () => {
  const root = join(import.meta.dirname, '../../theeb-mind/src');
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && files.push(p); } };
  walk(root);
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!s.includes('devkey'), `${f} contains a dev key`);
    assert.ok(!/X-Api-Key/i.test(s), `${f} sends an API key header`);
    assert.ok(!/sk-ant-|ANTHROPIC_API_KEY/.test(s), `${f} references an AI key`);
    assert.ok(!/const USER_ID = 'user-1'/.test(s), `${f} hard-codes USER_ID`);
  }
});
