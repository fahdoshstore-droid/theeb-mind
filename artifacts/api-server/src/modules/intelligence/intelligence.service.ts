// ============================================
// THEEB MIND — Trade Intelligence Service
// ============================================
// Pattern analysis, AHA aggregation, trends,
// and instrument heatmap — all computed on demand
// with a 15-minute cache layer.
// ============================================

import { db } from '../../db/db.js';
import { detectAHAMoment } from '../scoring/aha-moment.js';
import type { AHAMomentResult } from '../scoring/aha-moment.js';

// ── Raw DB row shapes ────────────────────────────────────

interface DecisionRow {
  id: string;
  user_id: string;
  type: string;
  instrument: string;
  timeframe: string;
  scoring_json: string | null;
  risk_json: string | null;
  killzone: string | null;
  quality_score: number;
  grade: string;
  outcome: string | null;
  created_at: string;
}

interface MemoryFpRow {
  instrument: string;
  timeframe: string;
  outcome: string | null;
}

interface FailurePatternRow {
  pattern_key: string;
  hit_count: number;
  last_seen: string;
}

// ── Public types ─────────────────────────────────────────

export interface SignatureAggregate {
  type: string;
  typeAr: string;
  hitCount: number;
  totalChecked: number;
  avgLossRate: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface HeatmapCell {
  instrument: string;
  timeframe: string;
  winRate: number;
  totalTrades: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface TopPattern {
  patternKey: string;
  hitCount: number;
  instrument: string;
  timeframe: string;
  killzone: string;
  grade: string;
}

export interface PatternSummary {
  signatures: SignatureAggregate[];
  dangerZones: SignatureAggregate[];   // top 3 active (hitCount > 0)
  heatmap: HeatmapCell[];
  topFailurePatterns: TopPattern[];
  computedAt: string;
}

export interface TrendPoint {
  decisionId: string;
  score: number;
  grade: string;
  createdAt: string;
  instrument: string;
}

export interface TrendSummary {
  qualityTrend: TrendPoint[];
  gradeDistribution: Record<string, number>;
  bestInstrument: string | null;
  worstInstrument: string | null;
  averageScore: number;
  computedAt: string;
}

export interface TradeFingerprint {
  decisionId: string;
  ahaResult: AHAMomentResult;
  decision: {
    instrument: string;
    timeframe: string;
    grade: string;
    createdAt: string;
    type: string;
  };
}

// ── Cache helpers ────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getCached<T>(userId: string, cacheKey: string): T | null {
  const row = db.raw
    .prepare(
      `SELECT data_json, computed_at FROM trade_intelligence_cache
       WHERE user_id = ? AND cache_key = ?`,
    )
    .get(userId, cacheKey) as { data_json: string; computed_at: string } | undefined;

  if (!row) return null;

  const age = Date.now() - new Date(row.computed_at).getTime();
  if (age > CACHE_TTL_MS) return null;

  try {
    return JSON.parse(row.data_json) as T;
  } catch {
    return null;
  }
}

function setCache(userId: string, cacheKey: string, data: unknown): void {
  const json = JSON.stringify(data);
  db.raw
    .prepare(
      `INSERT INTO trade_intelligence_cache (user_id, cache_key, data_json, computed_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, cache_key) DO UPDATE SET
         data_json = excluded.data_json,
         computed_at = excluded.computed_at`,
    )
    .run(userId, cacheKey, json);
}

export function invalidateCacheForUser(userId: string): void {
  db.raw
    .prepare(`DELETE FROM trade_intelligence_cache WHERE user_id = ?`)
    .run(userId);
}

// ── Helper: parse decision row into AHAMomentInput fields ─

function parseDecisionRow(row: DecisionRow) {
  let confluenceGrade = row.grade;
  let riskAmount: number | undefined;

  if (row.scoring_json) {
    try {
      const s = JSON.parse(row.scoring_json) as { grade?: string };
      if (s.grade) confluenceGrade = s.grade;
    } catch { /* ignore */ }
  }

  if (row.risk_json) {
    try {
      const r = JSON.parse(row.risk_json) as { riskAmount?: number };
      riskAmount = r.riskAmount ?? undefined;
    } catch { /* ignore */ }
  }

  return { confluenceGrade, riskAmount };
}

// ── getPatternSummary ────────────────────────────────────

export function getPatternSummary(userId: string): PatternSummary {
  const cached = getCached<PatternSummary>(userId, 'patterns');
  if (cached) return cached;

  // Last 20 decisions
  const decisions = db.raw
    .prepare(
      `SELECT id, user_id, type, instrument, timeframe, scoring_json, risk_json,
              killzone, quality_score, grade, outcome, created_at
       FROM decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
    .all(userId) as DecisionRow[];

  // Aggregate signatures across all decisions
  const sigMap: Record<string, {
    type: string; typeAr: string;
    hitCount: number; totalChecked: number; lossRateSum: number;
  }> = {};

  for (const d of decisions) {
    const { confluenceGrade, riskAmount } = parseDecisionRow(d);

    const aha = detectAHAMoment({
      userId,
      instrument: d.instrument,
      timeframe: d.timeframe,
      decisionType: (d.type as 'long' | 'short' | 'no_trade'),
      confluenceScore: d.quality_score,
      confluenceGrade,
      killzone: d.killzone,
      riskAmount,
    });

    for (const sig of aha.signatures) {
      if (!sigMap[sig.type]) {
        sigMap[sig.type] = { type: sig.type, typeAr: sig.typeAr, hitCount: 0, totalChecked: 0, lossRateSum: 0 };
      }
      sigMap[sig.type].totalChecked++;
      if (sig.matched) sigMap[sig.type].hitCount++;
      sigMap[sig.type].lossRateSum += sig.lossRate;
    }
  }

  const signatures: SignatureAggregate[] = Object.values(sigMap).map((s) => {
    const avgLossRate = s.totalChecked > 0 ? s.lossRateSum / s.totalChecked : 0;
    const riskLevel = s.hitCount >= 5 ? 'high' : s.hitCount >= 2 ? 'medium' : 'low';
    return {
      type: s.type,
      typeAr: s.typeAr,
      hitCount: s.hitCount,
      totalChecked: s.totalChecked,
      avgLossRate: Math.round(avgLossRate * 100) / 100,
      riskLevel,
    };
  });

  // Danger zones: top 3 matched signatures sorted by hitCount
  const dangerZones = [...signatures]
    .filter((s) => s.hitCount > 0)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 3);

  // Instrument heatmap from memory_fingerprints
  const fpRows = db.raw
    .prepare(
      `SELECT instrument, timeframe, outcome FROM memory_fingerprints WHERE user_id = ?`,
    )
    .all(userId) as MemoryFpRow[];

  const heatMapRaw: Record<string, { wins: number; total: number }> = {};
  for (const fp of fpRows) {
    const key = `${fp.instrument}::${fp.timeframe}`;
    if (!heatMapRaw[key]) heatMapRaw[key] = { wins: 0, total: 0 };
    heatMapRaw[key].total++;
    if (fp.outcome === 'win') heatMapRaw[key].wins++;
  }

  const heatmap: HeatmapCell[] = Object.entries(heatMapRaw).map(([key, v]) => {
    const [instrument, timeframe] = key.split('::');
    const winRate = v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0;
    const riskLevel: 'high' | 'medium' | 'low' = winRate < 35 ? 'high' : winRate < 55 ? 'medium' : 'low';
    return { instrument, timeframe, winRate, totalTrades: v.total, riskLevel };
  }).sort((a, b) => a.winRate - b.winRate);

  // Top failure patterns
  const fpPatterns = db.raw
    .prepare(
      `SELECT pattern_key, hit_count, last_seen FROM failure_patterns
       WHERE user_id = ? ORDER BY hit_count DESC LIMIT 10`,
    )
    .all(userId) as FailurePatternRow[];

  const topFailurePatterns: TopPattern[] = fpPatterns.map((p) => {
    // Parse pattern_key: "{instrument}:{timeframe}:{killzone}:{grade}"
    // Instrument can contain `:`, so parse right-to-left
    const parts = p.pattern_key.split(':');
    const grade = parts.pop() ?? '';
    const killzone = parts.pop() ?? '';
    const timeframe = parts.pop() ?? '';
    const instrument = parts.join(':');
    return {
      patternKey: p.pattern_key,
      hitCount: p.hit_count,
      instrument,
      timeframe,
      killzone,
      grade,
    };
  });

  const result: PatternSummary = {
    signatures,
    dangerZones,
    heatmap,
    topFailurePatterns,
    computedAt: new Date().toISOString(),
  };

  setCache(userId, 'patterns', result);
  return result;
}

// ── getTrends ────────────────────────────────────────────

export function getTrends(userId: string): TrendSummary {
  const cached = getCached<TrendSummary>(userId, 'trends');
  if (cached) return cached;

  const decisions = db.raw
    .prepare(
      `SELECT id, instrument, quality_score, grade, created_at, outcome
       FROM decisions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    )
    .all(userId) as Pick<DecisionRow, 'id' | 'instrument' | 'quality_score' | 'grade' | 'created_at' | 'outcome'>[];

  const qualityTrend: TrendPoint[] = decisions.map((d) => ({
    decisionId: d.id,
    score: d.quality_score,
    grade: d.grade,
    createdAt: d.created_at,
    instrument: d.instrument,
  })).reverse(); // oldest→newest for charting

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  for (const d of decisions) {
    gradeDistribution[d.grade] = (gradeDistribution[d.grade] ?? 0) + 1;
  }

  // Instrument win rates (only decided trades)
  const instrMap: Record<string, { wins: number; total: number }> = {};
  for (const d of decisions) {
    if (!d.outcome) continue;
    if (!instrMap[d.instrument]) instrMap[d.instrument] = { wins: 0, total: 0 };
    instrMap[d.instrument].total++;
    if (d.outcome === 'win') instrMap[d.instrument].wins++;
  }

  let bestInstrument: string | null = null;
  let bestRate = -1;
  let worstInstrument: string | null = null;
  let worstRate = 101;

  for (const [instr, v] of Object.entries(instrMap)) {
    if (v.total < 3) continue;
    const rate = v.wins / v.total;
    if (rate > bestRate) { bestRate = rate; bestInstrument = instr; }
    if (rate < worstRate) { worstRate = rate; worstInstrument = instr; }
  }

  const averageScore = decisions.length > 0
    ? Math.round(decisions.reduce((s, d) => s + d.quality_score, 0) / decisions.length)
    : 0;

  const result: TrendSummary = {
    qualityTrend,
    gradeDistribution,
    bestInstrument,
    worstInstrument,
    averageScore,
    computedAt: new Date().toISOString(),
  };

  setCache(userId, 'trends', result);
  return result;
}

// ── getTradeFingerprint ──────────────────────────────────

export function getTradeFingerprint(decisionId: string, userId: string): TradeFingerprint | null {
  const row = db.raw
    .prepare(
      `SELECT id, user_id, type, instrument, timeframe, scoring_json, risk_json,
              killzone, quality_score, grade, created_at
       FROM decisions WHERE id = ? AND user_id = ?`,
    )
    .get(decisionId, userId) as DecisionRow | undefined;

  if (!row) return null;

  const { confluenceGrade, riskAmount } = parseDecisionRow(row);

  const ahaResult = detectAHAMoment({
    userId,
    instrument: row.instrument,
    timeframe: row.timeframe,
    decisionType: (row.type as 'long' | 'short' | 'no_trade'),
    confluenceScore: row.quality_score,
    confluenceGrade,
    killzone: row.killzone,
    riskAmount,
  });

  return {
    decisionId,
    ahaResult,
    decision: {
      instrument: row.instrument,
      timeframe: row.timeframe,
      grade: row.grade,
      createdAt: row.created_at,
      type: row.type,
    },
  };
}
