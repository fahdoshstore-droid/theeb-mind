// ============================================
// THEEB MIND — Decision Safety Score Engine
// ============================================
// Dynamically averages inputs from 4 intelligence
// layers: Confluence, Psychology, Risk, Behavior.
// Weights redistribute when a layer has no data.
// ============================================

import type {
  ConfluenceBreakdown,
  PsychologySnapshot,
  QualityScoreResult,
  Grade,
} from '../../shared/types.js';
import { CONFIG } from '../../config/constants.js';

// ── Layer Inputs ──────────────────────────────────────

export interface SafetyLayerInputs {
  confluence: {
    score: number;        // 0–7 raw confluence
    maxScore: number;     // 7
    grade: string;        // A+, A, B, C
    breakdown: ConfluenceBreakdown;
  };
  psychology: {
    percentage: number;   // 0–100 gate score
    verdict: string;      // pass, fail, warning
    behavioralLock: boolean;
    phase: string;
  };
  risk: {
    rrr: number;          // risk-reward ratio
    rrrPass: boolean;
    riskAmount?: number;  // optional: dollar risk
    dailyLossTotal?: number; // optional: today's total loss
  };
  behavior: {
    tradeCountToday: number;
    isPreMarket: boolean;
    consecutiveLosses: number;
    isNoTradeDay: boolean;
  };
}

export interface SafetyScoreResult {
  safetyScore: number;          // 0–100
  grade: Grade;
  layerScores: {
    confluence: { raw: number; normalized: number; weight: number; active: boolean };
    psychology: { raw: number; normalized: number; weight: number; active: boolean };
    risk: { raw: number; normalized: number; weight: number; active: boolean };
    behavior: { raw: number; normalized: number; weight: number; active: boolean };
  };
  flags: string[];
  explanation: string;
}

// ── Default weights ───────────────────────────────────

const DEFAULT_WEIGHTS = {
  confluence: 0.30,
  psychology: 0.25,
  risk: 0.20,
  behavior: 0.25,
} as const;

// ── Engine ────────────────────────────────────────────

export function calculateSafetyScore(inputs: SafetyLayerInputs): SafetyScoreResult {
  const flags: string[] = [];
  const layers: SafetyScoreResult['layerScores'] = {
    confluence: { active: true, raw: 0, normalized: 0, weight: DEFAULT_WEIGHTS.confluence as number },
    psychology: { active: true, raw: 0, normalized: 0, weight: DEFAULT_WEIGHTS.psychology as number },
    risk: { active: true, raw: 0, normalized: 0, weight: DEFAULT_WEIGHTS.risk as number },
    behavior: { active: true, raw: 0, normalized: 0, weight: DEFAULT_WEIGHTS.behavior as number },
  };

  // ── Layer 1: Confluence (ICT factors) ────────────────
  layers.confluence.raw = inputs.confluence.score;
  layers.confluence.normalized = (inputs.confluence.score / inputs.confluence.maxScore) * 100;

  if (inputs.confluence.score < CONFIG.MIN_CONFLUENCE) {
    flags.push(`توافق ضعيف (${inputs.confluence.score}/${inputs.confluence.maxScore}) — لا تتداول`);
  }

  // ── Layer 2: Psychology (gate) ───────────────────────
  layers.psychology.raw = inputs.psychology.percentage;
  layers.psychology.normalized = inputs.psychology.percentage;

  if (inputs.psychology.behavioralLock) {
    layers.psychology.normalized = 0;
    flags.push('قفل سلوكي مفعل — درجة النفسية صفر');
  }
  if (inputs.psychology.verdict === 'fail') {
    flags.push('البوابة النفسية: فشل — لا تتداول');
  } else if (inputs.psychology.verdict === 'warning') {
    flags.push('البوابة النفسية: تحذير — مراجعة مطلوبة');
  }

  // ── Layer 3: Risk ────────────────────────────────────
  const rrrNormalized = Math.min((inputs.risk.rrr / CONFIG.MIN_RRR) * 100, 100);
  layers.risk.raw = inputs.risk.rrr;
  layers.risk.normalized = rrrNormalized;

  if (!inputs.risk.rrrPass) {
    layers.risk.normalized = Math.min(layers.risk.normalized, 30);
    flags.push(`نسبة المخاطرة للعائد غير كافية (${inputs.risk.rrr.toFixed(1)} < ${CONFIG.MIN_RRR})`);
  }

  // Daily loss penalty
  if (inputs.risk.dailyLossTotal != null && inputs.risk.dailyLossTotal >= CONFIG.DAILY_LOSS_LIMIT) {
    layers.risk.normalized = 0;
    flags.push(`تجاوزت حد الخسارة اليومي (${CONFIG.DAILY_LOSS_LIMIT}) — مخاطرة صفر`);
  }

  // ── Layer 4: Behavior ────────────────────────────────
  let behaviorScore = 100;

  // Trade frequency penalty
  if (inputs.behavior.tradeCountToday > 15) {
    const excess = inputs.behavior.tradeCountToday - 15;
    const penalty = Math.min(excess * 5, 60); // 5 points per excess trade, max 60 penalty
    behaviorScore -= penalty;
    flags.push(`تداول مفرط: ${inputs.behavior.tradeCountToday} صفقة اليوم — عقوبة ${penalty} نقطة`);
  } else if (inputs.behavior.tradeCountToday > CONFIG.MAX_TRADES) {
    const excess = inputs.behavior.tradeCountToday - CONFIG.MAX_TRADES;
    const penalty = excess * 8;
    behaviorScore -= penalty;
    flags.push(`تجاوزت الحد اليومي (${CONFIG.MAX_TRADES}): ${inputs.behavior.tradeCountToday} صفقة — عقوبة ${penalty} نقطة`);
  }

  // Pre-market penalty
  if (inputs.behavior.isPreMarket) {
    behaviorScore -= 25;
    flags.push('تداول قبل افتتاح السوق — عقوبة توقيت 25 نقطة');
  }

  // Consecutive loss penalty
  if (inputs.behavior.consecutiveLosses >= 2) {
    const penalty = inputs.behavior.consecutiveLosses * 15;
    behaviorScore -= penalty;
    flags.push(`${inputs.behavior.consecutiveLosses} خسائر متتالية — عقوبة ${penalty} نقطة`);
  }

  // No-trade day
  if (inputs.behavior.isNoTradeDay) {
    behaviorScore = Math.min(behaviorScore, 20);
    flags.push('يوم ممنوع التداول — درجة السلوك مخفضة');
  }

  layers.behavior.raw = behaviorScore;
  layers.behavior.normalized = Math.max(0, Math.min(100, behaviorScore));

  // ── Dynamic weight redistribution ────────────────────
  const activeLayers = Object.entries(layers).filter(([, l]) => l.active);
  const totalWeight = activeLayers.reduce((sum, [, l]) => sum + l.weight, 0);

  // Redistribute: if total weight < 1, scale all active weights proportionally
  if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.001) {
    const scale = 1 / totalWeight;
    for (const [, layer] of activeLayers) {
      layer.weight = layer.weight * scale;
    }
  }

  // ── Compute final safety score ───────────────────────
  let safetyScore = 0;
  for (const [, layer] of activeLayers) {
    safetyScore += layer.normalized * layer.weight;
  }
  safetyScore = Math.round(Math.max(0, Math.min(100, safetyScore)));

  // ── Grade ────────────────────────────────────────────
  const grade = safetyToGrade(safetyScore);

  // ── Explanation ─────────────────────────────────────
  const explanation = buildExplanation(safetyScore, grade, layers, flags);

  return {
    safetyScore,
    grade,
    layerScores: layers,
    flags,
    explanation,
  };
}

// ── Helpers ────────────────────────────────────────────

function safetyToGrade(score: number): Grade {
  if (score >= 85) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}

function buildExplanation(
  score: number,
  grade: Grade,
  layers: SafetyScoreResult['layerScores'],
  flags: string[],
): string {
  const gradeLabels: Record<Grade, string> = {
    'A+': 'ممتاز',
    'A': 'جيد جداً',
    'B': 'مقبول',
    'C': 'ضعيف',
  };

  const lines = [
    `درجة أمان القرار: ${score}/100 — ${grade} (${gradeLabels[grade]})`,
    '',
    'تفصيل الطبقات:',
    `• التوافق (${(layers.confluence.weight * 100).toFixed(0)}%): ${layers.confluence.normalized.toFixed(1)}`,
    `• النفسية (${(layers.psychology.weight * 100).toFixed(0)}%): ${layers.psychology.normalized.toFixed(1)}`,
    `• المخاطرة (${(layers.risk.weight * 100).toFixed(0)}%): ${layers.risk.normalized.toFixed(1)}`,
    `• السلوك (${(layers.behavior.weight * 100).toFixed(0)}%): ${layers.behavior.normalized.toFixed(1)}`,
  ];

  if (flags.length > 0) {
    lines.push('');
    lines.push('تحذيرات:');
    for (const flag of flags) {
      lines.push(`⚠️ ${flag}`);
    }
  }

  return lines.join('\n');
}
