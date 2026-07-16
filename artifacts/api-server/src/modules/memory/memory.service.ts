// ============================================
// THEEB MIND — Memory Engine Service
// ============================================
// Fingerprints every trade, accumulates failure
// patterns, and powers AHA moment detection
// with real historical data.
// ============================================

import { db } from '../../db/db.js';

// ── Types ──────────────────────────────────────────────

export interface FingerprintInput {
  userId: string;
  decisionId: string;
  instrument: string;
  timeframe: string;
  killzone: string | null;
  grade: string;
  qualityScore: number;
  riskAmount: number;
}

export interface MemoryFingerprint {
  id: number;
  user_id: string;
  decision_id: string;
  instrument: string;
  timeframe: string;
  killzone: string | null;
  grade: string;
  quality_score: number;
  risk_amount: number;
  setup_tags_json: string;
  outcome: string | null;
  signatures_json: string;
  created_at: string;
}

export interface FailurePattern {
  id: number;
  user_id: string;
  pattern_key: string;
  hit_count: number;
  last_seen: string;
  notes: string | null;
  total_trades?: number;
}

export interface MemoryContext {
  sameSetupCount: number;
  sameSetupLosses: number;
  sameSetupWins: number;
  lossRate: number;
  failurePattern: FailurePattern | null;
  patternKey: string;
  recentFingerprints: MemoryFingerprint[];
}

// ── Pattern key helper ─────────────────────────────────

export function buildPatternKey(
  instrument: string,
  timeframe: string,
  killzone: string | null,
  grade: string,
): string {
  return `${instrument}:${timeframe}:${killzone ?? 'none'}:${grade}`;
}

// ── Core functions ─────────────────────────────────────

/**
 * Writes a fingerprint for a newly created decision.
 * Called synchronously after insertDecision in decision.service.ts.
 */
export function createFingerprint(input: FingerprintInput): void {
  const patternKey = buildPatternKey(input.instrument, input.timeframe, input.killzone, input.grade);

  db.raw
    .prepare(
      `INSERT OR IGNORE INTO memory_fingerprints
       (user_id, decision_id, instrument, timeframe, killzone, grade,
        quality_score, risk_amount, setup_tags_json, signatures_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.decisionId,
      input.instrument,
      input.timeframe,
      input.killzone ?? null,
      input.grade,
      input.qualityScore,
      input.riskAmount,
      JSON.stringify([patternKey]),
      JSON.stringify({}),
    );
}

/**
 * Updates the fingerprint outcome and increments failure pattern counters.
 * Called in recordOutcome when outcome is win or loss.
 */
export function updateFailurePatterns(
  userId: string,
  decisionId: string,
  outcome: string,
): void {
  if (outcome !== 'win' && outcome !== 'loss') return;

  // Update outcome on the fingerprint row
  db.raw
    .prepare(`UPDATE memory_fingerprints SET outcome = ? WHERE decision_id = ? AND user_id = ?`)
    .run(outcome, decisionId, userId);

  // Increment failure pattern counter only on losses
  if (outcome === 'loss') {
    const fp = db.raw
      .prepare(`SELECT instrument, timeframe, killzone, grade FROM memory_fingerprints WHERE decision_id = ? AND user_id = ?`)
      .get(decisionId, userId) as Pick<MemoryFingerprint, 'instrument' | 'timeframe' | 'killzone' | 'grade'> | undefined;

    if (fp) {
      const patternKey = buildPatternKey(fp.instrument, fp.timeframe, fp.killzone, fp.grade);
      db.raw
        .prepare(
          `INSERT INTO failure_patterns (user_id, pattern_key, hit_count, last_seen)
           VALUES (?, ?, 1, datetime('now'))
           ON CONFLICT(user_id, pattern_key) DO UPDATE SET
             hit_count = hit_count + 1,
             last_seen = datetime('now')`,
        )
        .run(userId, patternKey);
    }
  }
}

/**
 * Returns the memory context for a given setup.
 * Used by AHA moment detection and the frontend panel.
 */
export function getMemoryContext(
  userId: string,
  instrument: string,
  timeframe: string,
  killzone: string | null,
  grade: string,
): MemoryContext {
  const patternKey = buildPatternKey(instrument, timeframe, killzone, grade);

  const sameSetup = db.raw
    .prepare(
      `SELECT outcome FROM memory_fingerprints
       WHERE user_id = ? AND instrument = ? AND timeframe = ?
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all(userId, instrument, timeframe) as { outcome: string | null }[];

  const losses = sameSetup.filter((r) => r.outcome === 'loss').length;
  const wins = sameSetup.filter((r) => r.outcome === 'win').length;
  const total = sameSetup.length;

  const failurePattern = db.raw
    .prepare(`SELECT * FROM failure_patterns WHERE user_id = ? AND pattern_key = ?`)
    .get(userId, patternKey) as FailurePattern | undefined ?? null;

  const recentFingerprints = db.raw
    .prepare(
      `SELECT * FROM memory_fingerprints
       WHERE user_id = ? AND instrument = ? AND timeframe = ?
       ORDER BY created_at DESC LIMIT 10`,
    )
    .all(userId, instrument, timeframe) as MemoryFingerprint[];

  return {
    sameSetupCount: total,
    sameSetupLosses: losses,
    sameSetupWins: wins,
    lossRate: total > 0 ? losses / total : 0,
    failurePattern,
    patternKey,
    recentFingerprints,
  };
}

/**
 * Returns the failure pattern leaderboard (most-hit patterns first).
 */
export function getFailurePatterns(userId: string, limit = 10): FailurePattern[] {
  return db.raw
    .prepare(
      `SELECT fp.*,
         (SELECT COUNT(*) FROM memory_fingerprints mf
          WHERE mf.user_id = fp.user_id
            AND mf.instrument || ':' || mf.timeframe || ':' || COALESCE(mf.killzone,'none') || ':' || mf.grade = fp.pattern_key
         ) AS total_trades
       FROM failure_patterns fp
       WHERE fp.user_id = ?
       ORDER BY fp.hit_count DESC
       LIMIT ?`,
    )
    .all(userId, limit) as FailurePattern[];
}

/**
 * One-time backfill: fingerprints all existing decisions for a user.
 * Safe to call multiple times — skips if fingerprints already exist.
 */
export function backfillFingerprints(userId: string): number {
  const existingCount = (
    db.raw
      .prepare(`SELECT COUNT(*) as c FROM memory_fingerprints WHERE user_id = ?`)
      .get(userId) as { c: number }
  ).c;

  if (existingCount > 0) return 0;

  const decisions = db.raw
    .prepare(
      `SELECT id, instrument, timeframe, killzone, grade, quality_score, risk_json, outcome
       FROM decisions WHERE user_id = ? ORDER BY created_at ASC`,
    )
    .all(userId) as {
    id: string;
    instrument: string;
    timeframe: string;
    killzone: string | null;
    grade: string;
    quality_score: number;
    risk_json: string | null;
    outcome: string | null;
  }[];

  let inserted = 0;
  for (const d of decisions) {
    try {
      let riskAmount = 0;
      if (d.risk_json) {
        try {
          riskAmount = (JSON.parse(d.risk_json) as { riskAmount?: number }).riskAmount ?? 0;
        } catch { /* ignore */ }
      }

      createFingerprint({
        userId,
        decisionId: d.id,
        instrument: d.instrument,
        timeframe: d.timeframe,
        killzone: d.killzone,
        grade: d.grade,
        qualityScore: d.quality_score,
        riskAmount,
      });

      // Backfill outcome and failure patterns if known
      if (d.outcome === 'loss' || d.outcome === 'win') {
        updateFailurePatterns(userId, d.id, d.outcome);
      }

      inserted++;
    } catch { /* ignore malformed rows */ }
  }

  return inserted;
}
