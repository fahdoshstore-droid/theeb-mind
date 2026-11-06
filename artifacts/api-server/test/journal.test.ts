// Regression tests for the Journal module.
// Exercises the pure helper `detectBehavioralPatterns` (no DB) and the
// DB-backed `calculateAnalytics` (via an in-memory better-sqlite3 DB).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The db singleton is constructed at import time from env.DB_PATH, so the
// DB path must be set before the module graph is loaded.
const dir = mkdtempSync(path.join(tmpdir(), 'theeb-journal-'));
process.env.DB_PATH = path.join(dir, 'journal.db');

const { db } = await import('../src/db/db.js');
const { detectBehavioralPatterns } = await import('../src/modules/journal/patterns.js');
const { calculateAnalytics } = await import('../src/modules/journal/analytics.js');
const { recordOutcome, getDecisionsByUser } = await import('../src/modules/journal/journal.service.js');

before(() => db.init());
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function insertDecision(overrides: Record<string, unknown> = {}) {
  const userId = (overrides.user_id as string) ?? 'u1';
  db.raw.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(userId, `${userId}-name`);
  const id = (overrides.id as string) ?? `d-${Math.random().toString(36).slice(2)}`;
  const created_at = (overrides.created_at as string) ?? new Date().toISOString();
  db.raw
    .prepare(
      `INSERT INTO decisions (id, user_id, type, timeframe, instrument, quality_score, grade, outcome, outcome_pnl, killzone, created_at)
       VALUES (@id, @user_id, @type, @timeframe, @instrument, @quality_score, @grade, @outcome, @outcome_pnl, @killzone, @created_at)`,
    )
    .run({
      id,
      user_id: (overrides.user_id as string) ?? 'u1',
      type: (overrides.type as string) ?? 'long',
      timeframe: (overrides.timeframe as string) ?? '15m',
      instrument: (overrides.instrument as string) ?? 'NQ',
      quality_score: (overrides.quality_score as number) ?? 3,
      grade: (overrides.grade as string) ?? 'B',
      outcome: (overrides.outcome as string) ?? null,
      outcome_pnl: (overrides.outcome_pnl as number) ?? null,
      killzone: (overrides.killzone as string) ?? null,
      created_at,
    });
  return id;
}

describe('detectBehavioralPatterns (pure)', () => {
  const base = (partial: Record<string, unknown> = {}) => ({
    id: '1',
    user_id: 'u1',
    type: 'long',
    created_at: '2024-01-01T10:00:00.000Z',
    quality_score: 3,
    grade: 'B',
    outcome: null,
    outcome_pnl: null,
    killzone: null,
    day_blocked: 0,
    news_blackout: 0,
    ...partial,
  });

  test('empty input yields no patterns', () => {
    assert.deepEqual(detectBehavioralPatterns([]), []);
  });

  test('single decision yields no patterns (needs >= 2)', () => {
    assert.deepEqual(detectBehavioralPatterns([base()]), []);
  });

  test('three consecutive losses → high-severity loss_streak', () => {
    const rows = [
      base({ outcome: 'loss' }),
      base({ id: '2', outcome: 'loss' }),
      base({ id: '3', outcome: 'loss' }),
    ];
    const patterns = detectBehavioralPatterns(rows);
    const loss = patterns.find((p) => p.type === 'loss_streak');
    assert.ok(loss, 'expected a loss_streak pattern');
    assert.equal(loss!.severity, 'high');
    assert.ok(loss!.recommendation.length > 0);
  });

  test('two consecutive losses → medium-severity loss_streak', () => {
    const rows = [base({ outcome: 'loss' }), base({ id: '2', outcome: 'loss' })];
    const patterns = detectBehavioralPatterns(rows);
    const loss = patterns.find((p) => p.type === 'loss_streak');
    assert.ok(loss);
    assert.equal(loss!.severity, 'medium');
  });

  test('two losses within 30 minutes → revenge_trading', () => {
    const rows = [
      base({ outcome: 'loss', created_at: '2024-01-01T10:05:00.000Z' }),
      base({ id: '2', outcome: 'loss', created_at: '2024-01-01T10:00:00.000Z' }),
    ];
    const patterns = detectBehavioralPatterns(rows);
    assert.ok(patterns.some((p) => p.type === 'revenge_trading'));
  });

  test('majority C grades → emotional_trading', () => {
    const rows = [
      base({ grade: 'C' }),
      base({ id: '2', grade: 'C' }),
      base({ id: '3', grade: 'B' }),
    ];
    const patterns = detectBehavioralPatterns(rows);
    assert.ok(patterns.some((p) => p.type === 'emotional_trading'));
  });

  test('pattern objects expose the documented contract shape', () => {
    const rows = [base({ outcome: 'loss' }), base({ id: '2', outcome: 'loss' })];
    for (const p of detectBehavioralPatterns(rows)) {
      assert.ok(['loss_streak', 'overtrading', 'revenge_trading', 'emotional_trading', 'low_quality'].includes(p.type));
      assert.ok(['high', 'medium', 'low'].includes(p.severity));
      assert.equal(typeof p.description, 'string');
      assert.equal(typeof p.recommendation, 'string');
    }
  });
});

describe('calculateAnalytics (DB-backed)', () => {
  test('no decisions → zeros and null bestKillzone', () => {
    const a = calculateAnalytics('u-none', '30d');
    assert.equal(a.totalTrades, 0);
    assert.equal(a.winRate, 0);
    assert.equal(a.avgConfluence, 0);
    assert.equal(a.totalPnl, 0);
    assert.equal(a.bestKillzone, null);
    assert.equal(a.recentPattern, null);
    assert.deepEqual(a.gradeDistribution, {});
    // numeric fields are numbers
    for (const k of ['totalTrades', 'winRate', 'avgConfluence', 'totalPnl'] as const) {
      assert.equal(typeof a[k], 'number');
    }
  });

  test('aggregates wins, winRate, pnl, grades over seeded decisions', () => {
    insertDecision({ id: 'j1', user_id: 'u2', outcome: 'win', outcome_pnl: 100, grade: 'A', quality_score: 5, killzone: 'nyAM', created_at: new Date().toISOString() });
    insertDecision({ id: 'j2', user_id: 'u2', outcome: 'loss', outcome_pnl: -50, grade: 'B', quality_score: 3, killzone: 'nyAM', created_at: new Date().toISOString() });
    insertDecision({ id: 'j3', user_id: 'u2', outcome: 'win', outcome_pnl: 60, grade: 'C', quality_score: 2, killzone: 'nyAM', created_at: new Date().toISOString() });

    const a = calculateAnalytics('u2', '30d');
    assert.equal(a.totalTrades, 3);
    assert.equal(a.winRate, 66.7);
    assert.equal(a.totalPnl, 110);
    assert.deepEqual(a.gradeDistribution, { A: 1, B: 1, C: 1 });
    assert.equal(typeof a.avgConfluence, 'number');
  });

  test('bestKillzone requires >= 3 trades in a zone', () => {
    const a = calculateAnalytics('u2', '30d');
    assert.equal(a.bestKillzone, 'nyAM');
  });

  test('unknown period falls back to "all" (startDate 2000-01-01)', () => {
    // contract: invalid period yields the default branch rather than a crash
    const a = calculateAnalytics('u2', 'not-a-period');
    assert.equal(a.totalTrades, 3);
  });

  test('recent losses of 3+ produce a loss-streak recentPattern', () => {
    const now = new Date().toISOString();
    insertDecision({ id: 'j4', user_id: 'u3', outcome: 'loss', grade: 'B', created_at: now });
    insertDecision({ id: 'j5', user_id: 'u3', outcome: 'loss', grade: 'B', created_at: now });
    insertDecision({ id: 'j6', user_id: 'u3', outcome: 'loss', grade: 'B', created_at: now });
    const a = calculateAnalytics('u3', '30d');
    assert.equal(a.recentPattern, 'سلسلة خسائر — يُنصح بالتوقف والمراجعة');
  });
});

describe('recordOutcome (DB-backed)', () => {
  test('throws when the decision does not exist', () => {
    assert.throws(() => recordOutcome({ decisionId: 'nope', userId: 'u1', outcome: 'win' }), /الصفقة غير موجودة/);
  });

  test('throws when the decision belongs to another user', () => {
    insertDecision({ id: 'ro1', user_id: 'u-owner', outcome: null });
    assert.throws(
      () => recordOutcome({ decisionId: 'ro1', userId: 'u-intruder', outcome: 'win' }),
      /غير مصرح/,
    );
  });

  test('updates outcome, pnl and notes for the owner', () => {
    insertDecision({ id: 'ro2', user_id: 'u-owner' });
    recordOutcome({ decisionId: 'ro2', userId: 'u-owner', outcome: 'win', pnl: 150, notes: 'nice' });
    const row = db.raw.prepare('SELECT outcome, outcome_pnl, outcome_notes FROM decisions WHERE id = ?').get('ro2') as any;
    assert.equal(row.outcome, 'win');
    assert.equal(row.outcome_pnl, 150);
    assert.equal(row.outcome_notes, 'nice');
  });
});

describe('getDecisionsByUser (DB-backed)', () => {
  test('returns the decisions owned by the user', () => {
    insertDecision({ id: 'g1', user_id: 'u-list' });
    insertDecision({ id: 'g2', user_id: 'u-list' });
    const rows = getDecisionsByUser('u-list') as any[];
    assert.equal(rows.length, 2);
    for (const r of rows) assert.equal(r.user_id, 'u-list');
  });

  test('returns an empty array for a user with no decisions', () => {
    assert.deepEqual(getDecisionsByUser('u-empty-list'), []);
  });
});
