// Regression tests for the Performance module (all DB-backed).
// Uses an in-memory better-sqlite3 DB; asserts contract shapes and key
// numeric behaviors on both empty and seeded data.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'theeb-performance-'));
process.env.DB_PATH = path.join(dir, 'performance.db');

const { db } = await import('../src/db/db.js');
const {
  getSummary,
  getEquityCurve,
  getDrawdown,
  getInstrumentBreakdown,
  getPsychCorrelation,
  getTimeAnalysis,
  getQualityTrend,
} = await import('../src/modules/performance/performance.service.js');

before(() => db.init());
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function seedUser(id = 'u1') {
  db.raw.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(id, `${id}-name`);
}

function seedDecision(userId: string, fields: Record<string, unknown> = {}) {
  const id = (fields.id as string) ?? `p-${Math.random().toString(36).slice(2)}`;
  db.raw
    .prepare(
      `INSERT INTO decisions (id, user_id, type, timeframe, instrument, quality_score, grade, outcome, outcome_pnl, killzone, risk_json, psychology_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      (fields.outcome_pnl as number) ?? null,
      (fields.killzone as string) ?? null,
      (fields.risk_json as string) ?? null,
      (fields.psychology_json as string) ?? null,
      (fields.created_at as string) ?? new Date().toISOString(),
    );
  return id;
}

describe('getSummary', () => {
  test('empty user → all-zero numeric summary', () => {
    const s = getSummary('u-none');
    assert.deepEqual(s, {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      avgRrr: 0,
      avgQualityScore: 0,
      totalPnl: 0,
      bestGradePct: 0,
      totalTradingDays: 0,
    });
  });

  test('computes wins/losses/winRate/pnl/avgRrr over seeded data', () => {
    seedUser('u1');
    seedDecision('u1', { id: 'p1', outcome: 'win', outcome_pnl: 200, quality_score: 5, grade: 'A', risk_json: JSON.stringify({ rrr: 3 }), created_at: '2024-05-01T10:00:00.000Z' });
    seedDecision('u1', { id: 'p2', outcome: 'loss', outcome_pnl: -100, quality_score: 3, grade: 'B', risk_json: JSON.stringify({ rrr: 2 }), created_at: '2024-05-02T10:00:00.000Z' });
    seedDecision('u1', { id: 'p3', outcome: 'breakeven', outcome_pnl: 0, quality_score: 2, grade: 'C', risk_json: JSON.stringify({ rrr: 0 }), created_at: '2024-05-03T10:00:00.000Z' });

    const s = getSummary('u1');
    assert.equal(s.totalTrades, 3);
    assert.equal(s.wins, 1);
    assert.equal(s.losses, 1);
    assert.equal(s.breakevens, 1);
    assert.equal(s.winRate, 33.3);
    assert.equal(s.totalPnl, 100);
    assert.equal(s.avgRrr, 2.5); // (3 + 2) / 2
    assert.equal(s.avgQualityScore, 3.3); // (5+3+2)/3 rounded to 1dp
    assert.equal(s.bestGradePct, 33.3); // 1 A out of 3
    assert.equal(s.totalTradingDays, 3);
  });
});

describe('getEquityCurve', () => {
  test('empty user → empty curve', () => {
    assert.deepEqual(getEquityCurve('u-none'), []);
  });

  test('cumulative pnl and tradeIndex follow insertion order', () => {
    seedUser('u2');
    seedDecision('u2', { id: 'e1', outcome: 'win', outcome_pnl: 100, created_at: '2024-06-01T10:00:00.000Z' });
    seedDecision('u2', { id: 'e2', outcome: 'loss', outcome_pnl: -40, created_at: '2024-06-02T10:00:00.000Z' });

    const curve = getEquityCurve('u2');
    assert.equal(curve.length, 2);
    assert.equal(curve[0].pnl, 100);
    assert.equal(curve[0].cumulative, 100);
    assert.equal(curve[0].tradeIndex, 1);
    assert.equal(curve[1].pnl, -40);
    assert.equal(curve[1].cumulative, 60);
    assert.equal(curve[1].tradeIndex, 2);
    assert.equal(curve[1].date, '2024-06-02');
  });
});

describe('getDrawdown', () => {
  test('empty → zeroed drawdown with null date', () => {
    assert.deepEqual(getDrawdown('u-none'), {
      maxDrawdown: 0,
      currentDrawdown: 0,
      maxDrawdownDate: null,
      peakPnl: 0,
      recoveryFactor: 0,
    });
  });

  test('detects max drawdown from a peak', () => {
    seedUser('u3');
    seedDecision('u3', { id: 'dd1', outcome: 'win', outcome_pnl: 300, created_at: '2024-07-01T10:00:00.000Z' });
    seedDecision('u3', { id: 'dd2', outcome: 'loss', outcome_pnl: -100, created_at: '2024-07-02T10:00:00.000Z' });
    seedDecision('u3', { id: 'dd3', outcome: 'loss', outcome_pnl: -150, created_at: '2024-07-03T10:00:00.000Z' });

    const d = getDrawdown('u3');
    assert.equal(d.peakPnl, 300);
    assert.equal(d.maxDrawdown, 250);
    assert.equal(d.maxDrawdownDate, '2024-07-03');
    assert.equal(d.currentDrawdown, 250);
  });
});

describe('getInstrumentBreakdown', () => {
  test('empty user → empty array', () => {
    assert.deepEqual(getInstrumentBreakdown('u-none'), []);
  });

  test('groups by instrument and computes winRate/avgPnl', () => {
    seedUser('u4');
    seedDecision('u4', { id: 'i1', instrument: 'NQ', outcome: 'win', outcome_pnl: 100, quality_score: 4 });
    seedDecision('u4', { id: 'i2', instrument: 'NQ', outcome: 'loss', outcome_pnl: -50, quality_score: 2 });
    seedDecision('u4', { id: 'i3', instrument: 'ES', outcome: 'win', outcome_pnl: 60, quality_score: 5 });

    const rows = getInstrumentBreakdown('u4');
    // ordered by trades desc → NQ (2) before ES (1)
    assert.equal(rows.length, 2);
    const nq = rows.find((r) => r.instrument === 'NQ')!;
    assert.equal(nq.trades, 2);
    assert.equal(nq.wins, 1);
    assert.equal(nq.losses, 1);
    assert.equal(nq.winRate, 50);
    assert.equal(nq.avgPnl, 25);
    assert.equal(nq.avgQuality, 3);
  });
});

describe('getPsychCorrelation', () => {
  test('empty → zeroed 3x3 matrix with canonical axes', () => {
    const c = getPsychCorrelation('u-none');
    assert.deepEqual(c.verdicts, ['pass', 'warning', 'fail']);
    assert.deepEqual(c.outcomes, ['win', 'loss', 'breakeven']);
    for (const v of c.verdicts) {
      assert.deepEqual(c.matrix[v], { win: 0, loss: 0, breakeven: 0 });
    }
  });

  test('tallies a pass verdict into the matrix', () => {
    seedUser('u5');
    seedDecision('u5', { id: 'pc1', outcome: 'win', psychology_json: JSON.stringify({ verdict: 'pass' }) });
    const c = getPsychCorrelation('u5');
    assert.equal(c.matrix.pass.win, 1);
  });
});

describe('getTimeAnalysis', () => {
  test('empty → all five killzones present with zero stats', () => {
    const rows = getTimeAnalysis('u-none');
    assert.deepEqual(
      rows.map((r) => r.killzone).sort(),
      ['asian', 'london', 'nyAM', 'nyLunch', 'nyPM'].sort(),
    );
    for (const r of rows) {
      assert.equal(r.wins, 0);
      assert.equal(r.losses, 0);
      assert.equal(r.breakevens, 0);
      assert.equal(r.total, 0);
    }
  });

  test('tallies wins/losses for a populated killzone', () => {
    seedUser('u6');
    seedDecision('u6', { id: 't1', outcome: 'win', killzone: 'nyAM' });
    seedDecision('u6', { id: 't2', outcome: 'loss', killzone: 'nyAM' });
    const rows = getTimeAnalysis('u6');
    const nyAM = rows.find((r) => r.killzone === 'nyAM')!;
    assert.equal(nyAM.wins, 1);
    assert.equal(nyAM.losses, 1);
    assert.equal(nyAM.total, 2);
  });
});

describe('getQualityTrend', () => {
  test('empty user → empty array', () => {
    assert.deepEqual(getQualityTrend('u-none'), []);
  });

  test('buckets quality scores by day', () => {
    seedUser('u7');
    seedDecision('u7', { id: 'q1', quality_score: 4, created_at: new Date().toISOString() });
    seedDecision('u7', { id: 'q2', quality_score: 2, created_at: new Date().toISOString() });
    const rows = getQualityTrend('u7');
    assert.ok(rows.length >= 1);
    const today = new Date().toISOString().split('T')[0];
    const todayRow = rows.find((r) => r.date === today);
    assert.ok(todayRow, 'expected a bucket for today');
    assert.equal(todayRow.count, 2);
    assert.equal(typeof todayRow.avgScore, 'number');
  });
});
