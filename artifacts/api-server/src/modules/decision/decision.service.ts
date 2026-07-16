import type { DecisionType, AnalysisResult, QualityScoreResult } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';
import { analyzeChartWithVision } from './claude-vision.js';
import { calculateConfluence } from '../scoring/confluence.engine.js';
import { calculateQualityScore } from '../scoring/quality-score.js';
import { calculateSafetyScore } from '../scoring/safety-score.js';
import { analyzeTradeFrequency } from '../scoring/trade-frequency.js';
import { detectAHAMoment } from '../scoring/aha-moment.js';
import { evaluateGate } from '../psychology/psychology.service.js';
import { GATE_QUESTIONS } from '../psychology/gate-questions.js';
import { generateMessage } from '../coaching/coaching.service.js';
import { getCurrentKillzone } from '../../config/killzones.js';
import { CONFIG } from '../../config/constants.js';
import { db } from '../../db/db.js';
import type { FallbackRequest } from '../../shared/validators.js';
import type { ConfluenceInput } from '../scoring/confluence.engine.js';
import type { QualityInput } from '../scoring/quality-score.js';
import { createFingerprint } from '../memory/memory.service.js';
import { computeUnifiedQuality } from '../quality/quality.engine.js';

export interface AnalyzeInput {
  userId: string;
  imageBase64: string;
  instrument: string;
  timeframe: string;
  riskAmount?: number;
}

export interface FallbackAnalyzeInput {
  userId: string;
  instrument: string;
  timeframe: string;
  marketStructure: boolean;
  fairValueGap: boolean;
  orderBlock: boolean;
  liquiditySweep: boolean;
  immediateRebalance: boolean;
  killzoneActive: boolean;
  riskAmount?: number;
}

export async function analyze(input: AnalyzeInput): Promise<AnalysisResult> {
  const decisionId = uuidv4();
  const killzone = getCurrentKillzone();

  let visionResult;
  try {
    visionResult = await analyzeChartWithVision(
      input.imageBase64,
      input.instrument,
      input.timeframe
    );
  } catch {
    throw new Error('فشل تحليل الشارت — حاول الأسئلة اليدوية بدلاً من ذلك');
  }

  const confluenceInput: ConfluenceInput = {
    marketStructure: visionResult.marketStructure,
    fairValueGap: visionResult.fairValueGap,
    orderBlock: visionResult.orderBlock,
    liquiditySweep: visionResult.liquiditySweep,
    killzoneActive: killzone.isActive,
    immediateRebalance: visionResult.immediateRebalance,
  };

  const confluence = calculateConfluence(confluenceInput);

  const alignmentScore = calculateAlignmentScore(visionResult.type, confluence);

  const qualityInput: QualityInput = {
    confluenceScore: confluence.score,
    gatePercentage: 70,
    rrr: visionResult.rrr,
    killzoneActive: killzone.isActive,
    alignmentScore,
  };

  const quality = calculateQualityScore(qualityInput);
  const rrrPass = visionResult.rrr >= CONFIG.MIN_RRR;

  // ── V1: Trade Frequency ───────────────────────────────
  const freq = analyzeTradeFrequency(input.userId);

  // ── V1: Safety Score (4-layer dynamic averaging) ──────
  const safety = calculateSafetyScore({
    confluence: {
      score: confluence.score,
      maxScore: CONFIG.MAX_CONFLUENCE,
      grade: confluence.grade,
      breakdown: confluence.breakdown,
    },
    psychology: {
      percentage: 70,
      verdict: 'warning',
      behavioralLock: false,
      phase: 'cautious',
    },
    risk: {
      rrr: visionResult.rrr,
      rrrPass,
      riskAmount: input.riskAmount,
    },
    behavior: {
      tradeCountToday: freq.tradeCountToday,
      isPreMarket: freq.isPreMarket,
      consecutiveLosses: 0,
      isNoTradeDay: isDayBlocked(),
    },
  });

  // ── V1: AHA Moment ────────────────────────────────────
  const aha = detectAHAMoment({
    userId: input.userId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    decisionType: visionResult.type,
    confluenceScore: confluence.score,
    confluenceGrade: confluence.grade,
    killzone: killzone.key,
    riskAmount: input.riskAmount,
  });

  // ── Unified Quality Engine ────────────────────────────
  const unifiedQuality = computeUnifiedQuality({
    marketStructure:   visionResult.marketStructure,
    fairValueGap:      visionResult.fairValueGap,
    orderBlock:        visionResult.orderBlock,
    liquiditySweep:    visionResult.liquiditySweep,
    killzoneActive:    killzone.isActive,
    immediateRebalance: visionResult.immediateRebalance,
    gatePercentage:    70,
    gateVerdict:       'warning',
    behavioralLock:    false,
    psychPhase:        'cautious',
    rrr:               visionResult.rrr,
    rrrPass,
    riskAmount:        input.riskAmount,
    tradeCountToday:   freq.tradeCountToday,
    isPreMarket:       freq.isPreMarket,
    consecutiveLosses: 0,
    isNoTradeDay:      isDayBlocked(),
    alignmentScore,
    ahaSimilarityPercent: aha.similarityPercent,
  });

  const coachingMessage = generateMessage(unifiedQuality.grade, confluence.grade, input.instrument);

  const result: AnalysisResult = {
    decisionId,
    type: visionResult.type,
    instrument: input.instrument,
    timeframe: input.timeframe,
    confluence: {
      confluenceScore: confluence.score,
      confluenceGrade: confluence.grade,
      confluenceBreakdown: confluence.breakdown,
      confluenceExplanation: confluence.explanation,
      qualityScore: unifiedQuality.composite_score,
      qualityGrade: unifiedQuality.grade,
      qualityExplanation: unifiedQuality.explanation,
      rrr: visionResult.rrr,
      rrrPass,
    },
    psychology: {
      phase: 'pending',
      score: 0,
      maxScore: 0,
      percentage: 0,
      verdict: 'warning',
      answers: [],
      behavioralLock: false,
      lockReason: null,
    },
    quality,
    coachingMessage,
    verification: null,
    killzone: killzone.key ? { key: killzone.key, label: killzone.label!, start: CONFIG.KILLZONES[killzone.key].start, end: CONFIG.KILLZONES[killzone.key].end } : null,
    dayBlocked: isDayBlocked(),
    newsBlackout: false,
    timestamp: new Date().toISOString(),
    // ── V1 fields ──
    safetyScore: safety.safetyScore,
    safetyGrade: safety.grade,
    safetyExplanation: safety.explanation,
    tradeFrequency: {
      tradeCountToday: freq.tradeCountToday,
      isPreMarket: freq.isPreMarket,
      isOvertrading: freq.isOvertrading,
      isAggressiveOvertrading: freq.isAggressiveOvertrading,
      penaltyPoints: freq.penaltyPoints,
      timingScore: freq.timingScore,
    },
    ahaMoment: {
      similarityPercent: aha.similarityPercent,
      hook: aha.hook,
    },
    unifiedQuality: {
      composite_score: unifiedQuality.composite_score,
      grade:           unifiedQuality.grade,
      verdict:         unifiedQuality.verdict,
      breakdown:       unifiedQuality.breakdown,
      flags:           unifiedQuality.flags,
    },
  };

  // Use unified composite score for the decisions table
  db.stmt('insertDecision').run(
    decisionId,
    input.userId,
    visionResult.type,
    null,
    input.timeframe,
    input.instrument,
    JSON.stringify(visionResult),
    JSON.stringify(confluence),
    null,
    JSON.stringify({ rrr: visionResult.rrr, riskAmount: input.riskAmount ?? null }),
    JSON.stringify({ coachingMessage }),
    unifiedQuality.composite_score,   // ← unified composite score
    unifiedQuality.grade,             // ← unified grade
    killzone.key,
    result.dayBlocked ? 1 : 0,
    0,
    1
  );

  // Persist unified quality evaluation
  db.raw.prepare(
    `INSERT INTO quality_evaluations (id, user_id, decision_id, composite_score, grade, confidence, breakdown_json, flags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    input.userId,
    decisionId,
    unifiedQuality.composite_score,
    unifiedQuality.grade,
    unifiedQuality.confidence,
    JSON.stringify(unifiedQuality.breakdown),
    JSON.stringify(unifiedQuality.flags),
  );

  // ── Memory Engine: fingerprint this decision ──────────
  createFingerprint({
    userId: input.userId,
    decisionId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    killzone: killzone.key ?? null,
    grade: unifiedQuality.grade,
    qualityScore: unifiedQuality.composite_score,
    riskAmount: input.riskAmount ?? 0,
  });

  return result;
}

export function analyzeFallback(input: FallbackAnalyzeInput): AnalysisResult {
  const decisionId = uuidv4();
  const killzone = getCurrentKillzone();

  const confluenceInput: ConfluenceInput = {
    marketStructure: input.marketStructure,
    fairValueGap: input.fairValueGap,
    orderBlock: input.orderBlock,
    liquiditySweep: input.liquiditySweep,
    killzoneActive: input.killzoneActive,
    immediateRebalance: input.immediateRebalance,
  };

  const confluence = calculateConfluence(confluenceInput);

  const decisionType: DecisionType = confluence.score >= CONFIG.MIN_CONFLUENCE ? 'long' : 'no_trade';

  const alignmentScore = calculateAlignmentScore(decisionType, confluence);

  const qualityInput: QualityInput = {
    confluenceScore: confluence.score,
    gatePercentage: 70,
    rrr: CONFIG.MIN_RRR,
    killzoneActive: killzone.isActive,
    alignmentScore,
  };

  const quality = calculateQualityScore(qualityInput);
  const rrrPass = true; // fallback uses MIN_RRR

  // ── V1: Trade Frequency ───────────────────────────────
  const freq = analyzeTradeFrequency(input.userId);

  // ── V1: Safety Score ──────────────────────────────────
  const safety = calculateSafetyScore({
    confluence: {
      score: confluence.score,
      maxScore: CONFIG.MAX_CONFLUENCE,
      grade: confluence.grade,
      breakdown: confluence.breakdown,
    },
    psychology: {
      percentage: 70,
      verdict: 'warning',
      behavioralLock: false,
      phase: 'cautious',
    },
    risk: {
      rrr: CONFIG.MIN_RRR,
      rrrPass,
      riskAmount: input.riskAmount,
    },
    behavior: {
      tradeCountToday: freq.tradeCountToday,
      isPreMarket: freq.isPreMarket,
      consecutiveLosses: 0,
      isNoTradeDay: isDayBlocked(),
    },
  });

  // ── V1: AHA Moment ────────────────────────────────────
  const aha = detectAHAMoment({
    userId: input.userId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    decisionType,
    confluenceScore: confluence.score,
    confluenceGrade: confluence.grade,
    killzone: killzone.key,
    riskAmount: input.riskAmount,
  });

  // ── Unified Quality Engine ────────────────────────────
  const unifiedQuality = computeUnifiedQuality({
    marketStructure:   input.marketStructure,
    fairValueGap:      input.fairValueGap,
    orderBlock:        input.orderBlock,
    liquiditySweep:    input.liquiditySweep,
    killzoneActive:    input.killzoneActive,
    immediateRebalance: input.immediateRebalance,
    gatePercentage:    70,
    gateVerdict:       'warning',
    behavioralLock:    false,
    psychPhase:        'cautious',
    rrr:               CONFIG.MIN_RRR,
    rrrPass:           true,
    riskAmount:        input.riskAmount,
    tradeCountToday:   freq.tradeCountToday,
    isPreMarket:       freq.isPreMarket,
    consecutiveLosses: 0,
    isNoTradeDay:      isDayBlocked(),
    alignmentScore,
    ahaSimilarityPercent: aha.similarityPercent,
  });

  const coachingMessage = generateMessage(unifiedQuality.grade, confluence.grade, input.instrument);

  const result: AnalysisResult = {
    decisionId,
    type: decisionType,
    instrument: input.instrument,
    timeframe: input.timeframe,
    confluence: {
      confluenceScore: confluence.score,
      confluenceGrade: confluence.grade,
      confluenceBreakdown: confluence.breakdown,
      confluenceExplanation: confluence.explanation,
      qualityScore: unifiedQuality.composite_score,
      qualityGrade: unifiedQuality.grade,
      qualityExplanation: unifiedQuality.explanation,
      rrr: CONFIG.MIN_RRR,
      rrrPass: true,
    },
    psychology: {
      phase: 'pending',
      score: 0,
      maxScore: 0,
      percentage: 0,
      verdict: 'warning',
      answers: [],
      behavioralLock: false,
      lockReason: null,
    },
    quality,
    coachingMessage,
    verification: null,
    killzone: killzone.key ? { key: killzone.key, label: killzone.label!, start: CONFIG.KILLZONES[killzone.key].start, end: CONFIG.KILLZONES[killzone.key].end } : null,
    dayBlocked: isDayBlocked(),
    newsBlackout: false,
    timestamp: new Date().toISOString(),
    // ── V1 fields ──
    safetyScore: safety.safetyScore,
    safetyGrade: safety.grade,
    safetyExplanation: safety.explanation,
    tradeFrequency: {
      tradeCountToday: freq.tradeCountToday,
      isPreMarket: freq.isPreMarket,
      isOvertrading: freq.isOvertrading,
      isAggressiveOvertrading: freq.isAggressiveOvertrading,
      penaltyPoints: freq.penaltyPoints,
      timingScore: freq.timingScore,
    },
    ahaMoment: {
      similarityPercent: aha.similarityPercent,
      hook: aha.hook,
    },
    unifiedQuality: {
      composite_score: unifiedQuality.composite_score,
      grade:           unifiedQuality.grade,
      verdict:         unifiedQuality.verdict,
      breakdown:       unifiedQuality.breakdown,
      flags:           unifiedQuality.flags,
    },
  };

  // Use unified composite score for the decisions table
  db.stmt('insertDecision').run(
    decisionId,
    input.userId,
    decisionType,
    null,
    input.timeframe,
    input.instrument,
    JSON.stringify({ manual: true, ...confluenceInput }),
    JSON.stringify(confluence),
    null,
    JSON.stringify({ rrr: CONFIG.MIN_RRR, riskAmount: input.riskAmount ?? null }),
    JSON.stringify({ coachingMessage }),
    unifiedQuality.composite_score,   // ← unified composite score
    unifiedQuality.grade,             // ← unified grade
    killzone.key,
    result.dayBlocked ? 1 : 0,
    0,
    1
  );

  // Persist unified quality evaluation (import uuidv4 already at top)
  db.raw.prepare(
    `INSERT INTO quality_evaluations (id, user_id, decision_id, composite_score, grade, confidence, breakdown_json, flags_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    input.userId,
    decisionId,
    unifiedQuality.composite_score,
    unifiedQuality.grade,
    unifiedQuality.confidence,
    JSON.stringify(unifiedQuality.breakdown),
    JSON.stringify(unifiedQuality.flags),
  );

  // ── Memory Engine: fingerprint this decision ──────────
  createFingerprint({
    userId: input.userId,
    decisionId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    killzone: killzone.key ?? null,
    grade: unifiedQuality.grade,
    qualityScore: unifiedQuality.composite_score,
    riskAmount: input.riskAmount ?? 0,
  });

  return result;
}

function calculateAlignmentScore(decisionType: DecisionType, confluence: { score: number; grade: string }): number {
  if (decisionType === 'no_trade') return 50;
  if (confluence.grade === 'A+' || confluence.grade === 'A') return 90;
  if (confluence.grade === 'B') return 65;
  return 30;
}

function isDayBlocked(): boolean {
  const dayOfWeek = new Date().getDay();
  return CONFIG.NO_TRADE_DAYS.includes(dayOfWeek as any);
}