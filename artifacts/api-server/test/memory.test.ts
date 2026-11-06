// Regression tests for the Memory (Patterns) module.
// Covers the pure `buildPatternKey` helper and the DB-backed fingerprint /
// failure-pattern lifecycle against an in-memory better-sqlite3 DB.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'theeb-memory-'));
process.env.DB_PATH = path.join(dir, 'memory.db');

const { db } = await import('../src/db/db.js');
const {
  buildPatternKey,
  createFingerprint,
  updateFailurePatterns,
  getMemoryContext,
  getFailurePatterns,
  backfillFingerprints,
} = await import('../src/modules/memory/memory.service.js');

before(() => db.init());
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function seedUser(id = 'u1') {
  db.raw.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(id, `${id}-name`);
}

function seedDecision(id: string, userId = 'u1', fields: Record<string, unknown> = {}) {
  db.raw
    .prepare(
      `INSERT INTO decisions (id, user_id, type, timeframe, instrument, quality_score, grade, outcome, killzone, risk_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      (fields.type as string) ?? 'long',
      (fields.timeframe as string) ?? '15m',
      (fields.instrument as string) ?? 'NQ',
      (fields.quality_score as number) ?? 3,
      (fields.grade as string) ?? 'B',
      (fields.outcome as string) ?? null,
      (fields.killzone as string) ?? null,
      (fields.risk_json as string) ?? null,
    );
}

describe('buildPatternKey (pure)', () => {
  test('joins instrument:timeframe:killzone:grade', () => {
    assert.equal(buildPatternKey('NQ', '15m', 'nyAM', 'B'), 'NQ:15m:nyAM:B');
  });

  test('null killzone collapses to "none"', () => {
    assert.equal(buildPatternKey('NQ', '15m', null, 'B'), 'NQ:15m:none:B');
  });
});

describe('createFingerprint + updateFailurePatterns', () => {
  test('createFingerprint persists a fingerprint row', () => {
    seedUser('u1');
    seedDecision('d1', 'u1');
    createFingerprint({
      userId: 'u1',
      decisionId: 'd1',
      instrument: 'NQ',
      timeframe: '15m',
      killzone: 'nyAM',
      grade: 'B',
      qualityScore: 3,
      riskAmount: 100,
    });
    const row = db.raw.prepare('SELECT * FROM memory_fingerprints WHERE decision_id = ?').get('d1') as any;
    assert.ok(row);
    assert.equal(row.user_id, 'u1');
    assert.equal(row.instrument, 'NQ');
    assert.equal(row.outcome, null);
    assert.equal(row.setup_tags_json, '["NQ:15m:nyAM:B"]');
  });

  test('updateFailurePatterns is a no-op for breakeven/cancelled', () => {
    seedDecision('d2', 'u1');
    createFingerprint({ userId: 'u1', decisionId: 'd2', instrument: 'NQ', timeframe: '15m', killzone: null, grade: 'B', qualityScore: 3, riskAmount: 0 });
    updateFailurePatterns('u1', 'd2', 'breakeven');
    const fp = db.raw.prepare('SELECT outcome FROM memory_fingerprints WHERE decision_id = ?').get('d2') as any;
    assert.equal(fp.outcome, null, 'outcome must remain null for non-win/loss');
  });

  test('a loss updates outcome and increments the failure pattern counter', () => {
    seedDecision('d3', 'u1');
    createFingerprint({ userId: 'u1', decisionId: 'd3', instrument: 'NQ', timeframe: '15m', killzone: 'nyAM', grade: 'B', qualityScore: 3, riskAmount: 100 });
    updateFailurePatterns('u1', 'd3', 'loss');
    updateFailurePatterns('u1', 'd3', 'loss');

    const fp = db.raw.prepare('SELECT outcome FROM memory_fingerprints WHERE decision_id = ?').get('d3') as any;
    assert.equal(fp.outcome, 'loss');

    const pat = db.raw.prepare('SELECT * FROM failure_patterns WHERE user_id = ? AND pattern_key = ?').get('u1', 'NQ:15m:nyAM:B') as any;
    assert.ok(pat, 'failure pattern row must exist');
    assert.equal(pat.hit_count, 2);
  });

  test('a win updates outcome but does not create a failure pattern', () => {
    seedDecision('d4', 'u1');
    createFingerprint({ userId: 'u1', decisionId: 'd4', instrument: 'NQ', timeframe: '15m', killzone: 'nyAM', grade: 'A', qualityScore: 5, riskAmount: 100 });
    updateFailurePatterns('u1', 'd4', 'win');
    const fp = db.raw.prepare('SELECT outcome FROM memory_fingerprints WHERE decision_id = ?').get('d4') as any;
    assert.equal(fp.outcome, 'win');
    const pat = db.raw.prepare('SELECT * FROM failure_patterns WHERE user_id = ? AND pattern_key = ?').get('u1', 'NQ:15m:nyAM:A');
    assert.equal(pat, undefined);
  });
});

describe('getMemoryContext', () => {
  test('empty context → zeros, null failurePattern, correct patternKey', () => {
    const ctx = getMemoryContext('u-empty', 'NQ', '15m', 'nyAM', 'B');
    assert.equal(ctx.sameSetupCount, 0);
    assert.equal(ctx.sameSetupLosses, 0);
    assert.equal(ctx.sameSetupWins, 0);
    assert.equal(ctx.lossRate, 0);
    assert.equal(ctx.failurePattern, null);
    assert.equal(ctx.patternKey, 'NQ:15m:nyAM:B');
    assert.deepEqual(ctx.recentFingerprints, []);
  });

  test('counts wins/losses and computes lossRate', () => {
    seedUser('u4');
    seedDecision('d10', 'u4');
    seedDecision('d11', 'u4');
    seedDecision('d12', 'u4');
    createFingerprint({ userId: 'u4', decisionId: 'd10', instrument: 'ES', timeframe: '5m', killzone: 'london', grade: 'B', qualityScore: 3, riskAmount: 50 });
    createFingerprint({ userId: 'u4', decisionId: 'd11', instrument: 'ES', timeframe: '5m', killzone: 'london', grade: 'B', qualityScore: 3, riskAmount: 50 });
    createFingerprint({ userId: 'u4', decisionId: 'd12', instrument: 'ES', timeframe: '5m', killzone: 'london', grade: 'B', qualityScore: 3, riskAmount: 50 });
    updateFailurePatterns('u4', 'd10', 'loss');
    updateFailurePatterns('u4', 'd11', 'win');
    updateFailurePatterns('u4', 'd12', 'loss');

    const ctx = getMemoryContext('u4', 'ES', '5m', 'london', 'B');
    assert.equal(ctx.sameSetupCount, 3);
    assert.equal(ctx.sameSetupLosses, 2);
    assert.equal(ctx.sameSetupWins, 1);
    assert.equal(ctx.lossRate, 2 / 3);
    assert.ok(ctx.recentFingerprints.length === 3);
  });
});

describe('getFailurePatterns', () => {
  test('no patterns → empty array', () => {
    assert.deepEqual(getFailurePatterns('u-none'), []);
  });

  test('orders by hit_count desc and exposes total_trades', () => {
    seedUser('u5');
    seedDecision('d20', 'u5');
    seedDecision('d21', 'u5');
    createFingerprint({ userId: 'u5', decisionId: 'd20', instrument: 'GC', timeframe: '1h', killzone: null, grade: 'C', qualityScore: 1, riskAmount: 10 });
    createFingerprint({ userId: 'u5', decisionId: 'd21', instrument: 'GC', timeframe: '1h', killzone: null, grade: 'C', qualityScore: 1, riskAmount: 10 });
    updateFailurePatterns('u5', 'd20', 'loss');
    updateFailurePatterns('u5', 'd21', 'loss');

    const patterns = getFailurePatterns('u5');
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0].pattern_key, 'GC:1h:none:C');
    assert.equal(patterns[0].hit_count, 2);
    assert.equal(typeof patterns[0].total_trades, 'number');
    assert.ok(patterns[0].last_seen);
  });
});

describe('backfillFingerprints', () => {
  test('returns 0 when fingerprints already exist', () => {
    seedUser('u6');
    seedDecision('d30', 'u6');
    createFingerprint({ userId: 'u6', decisionId: 'd30', instrument: 'NQ', timeframe: '15m', killzone: null, grade: 'B', qualityScore: 3, riskAmount: 0 });
    assert.equal(backfillFingerprints('u6'), 0);
  });

  test('inserts fingerprints for a user with none', () => {
    seedUser('u7');
    seedDecision('d40', 'u7', { outcome: 'win' });
    seedDecision('d41', 'u7', { outcome: 'loss' });
    const inserted = backfillFingerprints('u7');
    assert.equal(inserted, 2);
    const fp = db.raw.prepare('SELECT outcome FROM memory_fingerprints WHERE decision_id = ?').get('d41') as any;
    assert.equal(fp.outcome, 'loss');
  });
});
