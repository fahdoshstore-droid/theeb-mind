// ============================================
// THEEB MIND — Unified Decision Quality Engine
// ============================================
// Single composite score (0–100) and grade
// for every decision. Calls all 4 sub-engines
// internally; AHA penalty applied on top.
// ============================================

import { calculateConfluence } from '../scoring/confluence.engine.js';
import { calculateSafetyScore } from '../scoring/safety-score.js';
import { calculateQualityScore } from '../scoring/quality-score.js';
import { computeJournalSafetyScore } from '../scoring/journal-safety-score.js';
import { CONFIG } from '../../config/constants.js';
import type { Grade } from '../../shared/types.js';
import type { ConfluenceInput } from '../scoring/confluence.engine.js';

// ── Input / Output types ───────────────────────────────

export interface UnifiedQualityInput {
  // Confluence factors (ICT)
  marketStructure: boolean;
  fairValueGap: boolean;
  orderBlock: boolean;
  liquiditySweep: boolean;
  killzoneActive: boolean;
  immediateRebalance: boolean;

  // Psychology
  gatePercentage: number;   // 0–100
  gateVerdict: 'pass' | 'fail' | 'warning';
  behavioralLock: boolean;
  psychPhase: string;

  // Risk
  rrr: number;
  rrrPass: boolean;
  riskAmount?: number;
  dailyLossTotal?: number;

  // Behavior
  tradeCountToday: number;
  isPreMarket: boolean;
  consecutiveLosses: number;
  isNoTradeDay: boolean;

  // Journal safety (optional — enriches the journal-based layer)
  journalSafety?: {
    emotionalState: string;
    contractSize: string;
    accountSize: number;
    marketScore: number;
    trilScore: number;
  };

  // AHA penalty (0–100, optional)
  ahaSimilarityPercent?: number;

  // Alignment score (derived from decision type and grade)
  alignmentScore: number;
}

export interface UnifiedQualityBreakdown {
  confluence:  { score: number; normalized: number; weight: number };
  psychology:  { score: number; normalized: number; weight: number };
  quality:     { score: number; normalized: number; weight: number };
  safety:      { score: number; normalized: number; weight: number };
  ahaPenalty:  number;
}

export interface UnifiedQualityResult {
  composite_score: number;        // 0–100 final composite
  grade: Grade;
  confidence: number;             // 0–1: how many sub-engines had real inputs
  breakdown: UnifiedQualityBreakdown;
  verdict: 'EXECUTE' | 'REVIEW' | 'REJECT';
  flags: string[];
  explanation: string;
}

// ── Weights ───────────────────────────────────────────

const WEIGHTS = CONFIG.QUALITY_WEIGHTS;

// ── Engine ────────────────────────────────────────────

export function computeUnifiedQuality(input: UnifiedQualityInput): UnifiedQualityResult {
  const allFlags: string[] = [];

  // ── 1. Confluence layer ───────────────────────────────
  const confluenceInput: ConfluenceInput = {
    marketStructure:   input.marketStructure,
    fairValueGap:      input.fairValueGap,
    orderBlock:        input.orderBlock,
    liquiditySweep:    input.liquiditySweep,
    killzoneActive:    input.killzoneActive,
    immediateRebalance: input.immediateRebalance,
  };
  const confluenceResult = calculateConfluence(confluenceInput);
  const confluenceNorm = (confluenceResult.score / confluenceResult.maxScore) * 100;

  // ── 2. Psychology layer ───────────────────────────────
  // Psychology is normalized directly from gate percentage
  let psychNorm = input.gatePercentage;
  if (input.behavioralLock) {
    psychNorm = 0;
    allFlags.push('قفل سلوكي — درجة النفسية صفر');
  }
  if (input.gateVerdict === 'fail') {
    psychNorm = Math.min(psychNorm, 30);
    allFlags.push('البوابة النفسية: فشل');
  } else if (input.gateVerdict === 'warning') {
    allFlags.push('البوابة النفسية: تحذير');
  }

  // ── 3. Quality sub-engine layer ───────────────────────
  const qualityResult = calculateQualityScore({
    confluenceScore: confluenceResult.score,
    gatePercentage:  input.gatePercentage,
    rrr:             input.rrr,
    killzoneActive:  input.killzoneActive,
    alignmentScore:  input.alignmentScore,
  });
  const qualityNorm = qualityResult.totalScore; // already 0–100

  // ── 4. Safety layer ───────────────────────────────────
  const safetyResult = calculateSafetyScore({
    confluence: {
      score:     confluenceResult.score,
      maxScore:  confluenceResult.maxScore,
      grade:     confluenceResult.grade,
      breakdown: confluenceResult.breakdown,
    },
    psychology: {
      percentage:    input.gatePercentage,
      verdict:       input.gateVerdict,
      behavioralLock: input.behavioralLock,
      phase:         input.psychPhase,
    },
    risk: {
      rrr:            input.rrr,
      rrrPass:        input.rrrPass,
      riskAmount:     input.riskAmount,
      dailyLossTotal: input.dailyLossTotal,
    },
    behavior: {
      tradeCountToday:  input.tradeCountToday,
      isPreMarket:      input.isPreMarket,
      consecutiveLosses: input.consecutiveLosses,
      isNoTradeDay:     input.isNoTradeDay,
    },
  });
  const safetyNorm = safetyResult.safetyScore; // already 0–100
  allFlags.push(...safetyResult.flags);

  // Journal safety adjustment (optional — modifies safety layer)
  let journalAdjust = 0;
  if (input.journalSafety) {
    const journalResult = computeJournalSafetyScore({
      emotionalState: input.journalSafety.emotionalState,
      tradeCount:     input.tradeCountToday,
      contractSize:   input.journalSafety.contractSize,
      riskAmount:     input.riskAmount ?? 0,
      accountSize:    input.journalSafety.accountSize,
      marketScore:    input.journalSafety.marketScore,
      trilScore:      input.journalSafety.trilScore,
    });
    allFlags.push(...journalResult.flags);
    // Blend journal safety score to soften/reinforce the safety layer
    const blended = (safetyNorm + journalResult.safetyScore) / 2;
    journalAdjust = blended - safetyNorm;
  }

  const safetyFinal = Math.max(0, Math.min(100, safetyNorm + journalAdjust));

  // ── 5. Weighted composite ─────────────────────────────
  let composite =
    confluenceNorm * WEIGHTS.confluence +
    psychNorm      * WEIGHTS.psychology +
    qualityNorm    * WEIGHTS.quality +
    safetyFinal    * WEIGHTS.safety;

  // ── 6. AHA penalty (up to -20 pts) ────────────────────
  let ahaPenalty = 0;
  if (input.ahaSimilarityPercent != null && input.ahaSimilarityPercent > 0) {
    ahaPenalty = Math.min(20, input.ahaSimilarityPercent * 0.20);
    composite -= ahaPenalty;
    if (ahaPenalty >= 5) {
      allFlags.push(`AHA Moment: تشابه ${input.ahaSimilarityPercent}% مع أنماط خاسرة — عقوبة ${ahaPenalty.toFixed(0)} نقطة`);
    }
  }

  composite = Math.round(Math.max(0, Math.min(100, composite)));

  // ── 7. Grade and verdict ──────────────────────────────
  const grade = toGrade(composite);
  const verdict = toVerdict(composite);

  // ── 8. Confidence (0–1): fraction of sub-engines with real inputs ─
  let realInputs = 2; // confluence + quality always real
  if (input.gatePercentage > 0) realInputs++;
  if (input.journalSafety) realInputs++;
  const confidence = realInputs / 4;

  const breakdown: UnifiedQualityBreakdown = {
    confluence:  { score: confluenceResult.score,  normalized: Math.round(confluenceNorm), weight: WEIGHTS.confluence },
    psychology:  { score: input.gatePercentage,     normalized: Math.round(psychNorm),     weight: WEIGHTS.psychology },
    quality:     { score: qualityResult.totalScore, normalized: Math.round(qualityNorm),   weight: WEIGHTS.quality },
    safety:      { score: safetyResult.safetyScore, normalized: Math.round(safetyFinal),   weight: WEIGHTS.safety },
    ahaPenalty:  Math.round(ahaPenalty),
  };

  const explanation = buildExplanation(composite, grade, verdict, breakdown, allFlags);

  return {
    composite_score: composite,
    grade,
    confidence,
    breakdown,
    verdict,
    flags: [...new Set(allFlags)], // deduplicate
    explanation,
  };
}

// ── Helpers ────────────────────────────────────────────

function toGrade(score: number): Grade {
  if (score >= 90) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  return 'C';
}

function toVerdict(score: number): 'EXECUTE' | 'REVIEW' | 'REJECT' {
  if (score >= 75) return 'EXECUTE';
  if (score >= 55) return 'REVIEW';
  return 'REJECT';
}

function buildExplanation(
  score: number,
  grade: Grade,
  verdict: string,
  bd: UnifiedQualityBreakdown,
  flags: string[],
): string {
  const gradeLabels: Record<Grade, string> = { 'A+': 'ممتاز', A: 'جيد جداً', B: 'مقبول', C: 'ضعيف' };
  const verdictLabels: Record<string, string> = { EXECUTE: 'تنفيذ', REVIEW: 'مراجعة', REJECT: 'رفض' };

  const lines = [
    `جودة القرار الموحدة: ${score}/100 — ${grade} (${gradeLabels[grade]}) | القرار: ${verdictLabels[verdict] ?? verdict}`,
    '',
    'تفصيل المكونات:',
    `• التوافق   (${(bd.confluence.weight * 100).toFixed(0)}%): ${bd.confluence.normalized}/100`,
    `• النفسية   (${(bd.psychology.weight  * 100).toFixed(0)}%): ${bd.psychology.normalized}/100`,
    `• الجودة    (${(bd.quality.weight     * 100).toFixed(0)}%): ${bd.quality.normalized}/100`,
    `• الأمان    (${(bd.safety.weight      * 100).toFixed(0)}%): ${bd.safety.normalized}/100`,
  ];

  if (bd.ahaPenalty > 0) {
    lines.push(`• عقوبة AHA: -${bd.ahaPenalty} نقطة`);
  }

  if (flags.length > 0) {
    lines.push('', 'تحذيرات:');
    for (const f of flags.slice(0, 6)) {
      lines.push(`⚠️ ${f}`);
    }
    if (flags.length > 6) lines.push(`... و${flags.length - 6} تحذيرات أخرى`);
  }

  return lines.join('\n');
}
