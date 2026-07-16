// ============================================
// THEEB MIND — AHA Moment Engine
// ============================================
// Detects historical failure signatures by
// comparing the current trade setup against
// the user's past losing trades.
// Returns a strict JSON hook with similarity %.
// ============================================

import { db } from '../../db/db.js';
import { CONFIG } from '../../config/constants.js';

// ── Types ──────────────────────────────────────────────

export interface AHAMomentInput {
  userId: string;
  instrument: string;
  timeframe: string;
  decisionType: 'long' | 'short' | 'no_trade';
  confluenceScore: number;
  confluenceGrade: string;
  killzone: string | null;
  riskAmount?: number;
}

export interface FailureSignature {
  type: string;
  typeAr: string;
  matched: boolean;
  weight: number;
  evidence: string;
  pastOccurrences: number;
  lossRate: number; // 0–1: what % of past trades with this signature lost
}

export interface AHAMomentResult {
  similarityPercent: number;
  signatures: FailureSignature[];
  hook: string; // strict JSON hook for frontend
  explanation: string;
}

// ── Signature definitions ──────────────────────────────

const SIGNATURE_DEFS = [
  {
    type: 'size_escalation',
    typeAr: 'زيادة الحجم بعد خسارة',
    weight: 0.30,
  },
  {
    type: 'same_setup_repeat',
    typeAr: 'تكرار نفس الإعداد الخاسر',
    weight: 0.25,
  },
  {
    type: 'bad_killzone',
    typeAr: 'نافذة نشاط خاسرة',
    weight: 0.20,
  },
  {
    type: 'low_grade_pattern',
    typeAr: 'نمط درجات منخفضة',
    weight: 0.15,
  },
  {
    type: 'revenge_timing',
    typeAr: 'توقيت انتقامي',
    weight: 0.10,
  },
] as const;

// ── Engine ────────────────────────────────────────────

export function detectAHAMoment(input: AHAMomentInput): AHAMomentResult {
  const signatures: FailureSignature[] = [];

  // ── Fetch historical losing trades ────────────────────
  const pastLosses = db.raw
    .prepare(
      `SELECT id, instrument, timeframe, type, killzone, grade, quality_score,
              outcome_pnl, created_at, outcome_at, analysis_json
       FROM decisions
       WHERE user_id = ? AND outcome = 'loss'
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all(input.userId) as any[];

  const allPastTrades = db.raw
    .prepare(
      `SELECT id, instrument, timeframe, type, killzone, grade, outcome
       FROM decisions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all(input.userId) as any[];

  // ── Signature 1: Size escalation after loss ──────────
  const sizeEscalation = detectSizeEscalation(input, pastLosses);
  signatures.push(sizeEscalation);

  // ── Signature 2: Same setup repeat ────────────────────
  const sameSetup = detectSameSetupRepeat(input, pastLosses, allPastTrades);
  signatures.push(sameSetup);

  // ── Signature 3: Bad killzone ─────────────────────────
  const badKillzone = detectBadKillzone(input, pastLosses, allPastTrades);
  signatures.push(badKillzone);

  // ── Signature 4: Low grade pattern ────────────────────
  const lowGrade = detectLowGradePattern(input, pastLosses);
  signatures.push(lowGrade);

  // ── Signature 5: Revenge timing ──────────────────────
  const revengeTiming = detectRevengeTiming(input, pastLosses);
  signatures.push(revengeTiming);

  // ── Compute aggregate similarity ──────────────────────
  const matchedSignatures = signatures.filter((s) => s.matched);
  let similarityPercent = 0;

  if (matchedSignatures.length > 0) {
    const totalWeight = matchedSignatures.reduce((sum, s) => sum + s.weight, 0);
    // Weighted average of loss rates, scaled to 0–100
    const weightedLossRate =
      matchedSignatures.reduce((sum, s) => sum + s.lossRate * s.weight, 0) / totalWeight;
    similarityPercent = Math.round(weightedLossRate * 100);
  }

  // ── Build hook ────────────────────────────────────────
  const hook = buildHook(similarityPercent, matchedSignatures, input);

  // ── Build explanation ─────────────────────────────────
  const explanation = buildExplanation(similarityPercent, signatures, input);

  return {
    similarityPercent,
    signatures,
    hook,
    explanation,
  };
}

// ── Signature Detectors ────────────────────────────────

function detectSizeEscalation(
  input: AHAMomentInput,
  pastLosses: any[],
): FailureSignature {
  // Check: was the last trade a loss, and is current risk higher?
  const lastLoss = pastLosses[0];
  const hasRecentLoss = lastLoss != null;

  // Parse risk from analysis_json if available
  let lastRiskAmount = 0;
  if (lastLoss?.analysis_json) {
    try {
      const parsed = JSON.parse(lastLoss.analysis_json);
      lastRiskAmount = parsed.riskAmount ?? parsed.stopLoss ?? 0;
    } catch {
      // ignore
    }
  }

  const currentRisk = input.riskAmount ?? 0;
  const isEscalating = hasRecentLoss && currentRisk > lastRiskAmount && lastRiskAmount > 0;

  // Compute loss rate for size escalation pattern
  const escalationTrades = pastLosses.filter((t, i) => {
    if (i === 0) return false;
    const prev = pastLosses[i - 1];
    return prev?.outcome === 'loss';
  }).length;

  const lossRate = pastLosses.length > 0
    ? Math.min(1, escalationTrades / Math.min(pastLosses.length, 10))
    : 0;

  return {
    type: 'size_escalation',
    typeAr: 'زيادة الحجم بعد خسارة',
    matched: isEscalating,
    weight: 0.30,
    evidence: isEscalating
      ? `آخر خسارة بمخاطرة ${lastRiskAmount} — المخاطرة الحالية ${currentRisk} (زيادة)`
      : hasRecentLoss
        ? `آخر صفقة خاسرة لكن المخاطرة لم تزد`
        : 'لا توجد خسارة سابقة للمقارنة',
    pastOccurrences: escalationTrades,
    lossRate,
  };
}

function detectSameSetupRepeat(
  input: AHAMomentInput,
  pastLosses: any[],
  allPastTrades: any[],
): FailureSignature {
  // Check: same instrument + timeframe combo that lost before
  const sameSetupLosses = pastLosses.filter(
    (t) => t.instrument === input.instrument && t.timeframe === input.timeframe,
  );

  const sameSetupTotal = allPastTrades.filter(
    (t) => t.instrument === input.instrument && t.timeframe === input.timeframe,
  );

  const matched = sameSetupLosses.length >= 2;
  const lossRate = sameSetupTotal.length > 0
    ? sameSetupLosses.length / sameSetupTotal.length
    : 0;

  return {
    type: 'same_setup_repeat',
    typeAr: 'تكرار نفس الإعداد الخاسر',
    matched,
    weight: 0.25,
    evidence: matched
      ? `${input.instrument} ${input.timeframe}: ${sameSetupLosses.length} خسائر من ${sameSetupTotal.length} محاولة`
      : sameSetupLosses.length === 1
        ? `${input.instrument} ${input.timeframe}: خسارة واحدة سابقة فقط`
        : `لا توجد خسائر سابقة على ${input.instrument} ${input.timeframe}`,
    pastOccurrences: sameSetupLosses.length,
    lossRate,
  };
}

function detectBadKillzone(
  input: AHAMomentInput,
  pastLosses: any[],
  allPastTrades: any[],
): FailureSignature {
  if (!input.killzone) {
    return {
      type: 'bad_killzone',
      typeAr: 'نافذة نشاط خاسرة',
      matched: false,
      weight: 0.20,
      evidence: 'لا توجد نافذة نشاط محددة',
      pastOccurrences: 0,
      lossRate: 0,
    };
  }

  const zoneLosses = pastLosses.filter((t) => t.killzone === input.killzone);
  const zoneTotal = allPastTrades.filter((t) => t.killzone === input.killzone);

  const matched = zoneLosses.length >= 3 && zoneTotal.length >= 5;
  const lossRate = zoneTotal.length > 0 ? zoneLosses.length / zoneTotal.length : 0;

  const killzoneLabels: Record<string, string> = {
    asian: 'الآسيوية',
    london: 'اللندنية',
    nyAM: 'نيويورك صباحاً',
    nyLunch: 'نيويورك غداء',
    nyPM: 'نيويورك مساءً',
  };

  return {
    type: 'bad_killzone',
    typeAr: 'نافذة نشاط خاسرة',
    matched,
    weight: 0.20,
    evidence: matched
      ? `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: ${zoneLosses.length} خسائر من ${zoneTotal.length} صفقة`
      : zoneTotal.length < 5
        ? `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: بيانات غير كافية (${zoneTotal.length} صفقة)`
        : `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: نسبة خسائر مقبولة`,
    pastOccurrences: zoneLosses.length,
    lossRate,
  };
}

function detectLowGradePattern(
  input: AHAMomentInput,
  pastLosses: any[],
): FailureSignature {
  const recentLosses = pastLosses.slice(0, 10);
  const lowGradeLosses = recentLosses.filter((t) => t.grade === 'C');

  const isCurrentLowGrade = input.confluenceGrade === 'C';
  const hasLowGradeHistory = lowGradeLosses.length >= 3;

  const matched = isCurrentLowGrade && hasLowGradeHistory;
  const lossRate = recentLosses.length > 0
    ? lowGradeLosses.length / recentLosses.length
    : 0;

  return {
    type: 'low_grade_pattern',
    typeAr: 'نمط درجات منخفضة',
    matched,
    weight: 0.15,
    evidence: matched
      ? `${lowGradeLosses.length} من آخر 10 خسائر بدرجة C — والصفقة الحالية أيضاً C`
      : isCurrentLowGrade
        ? 'الصفقة الحالية بدرجة C لكن التاريخ لا يظهر نمطاً'
        : 'درجة الصفقة الحالية مقبولة',
    pastOccurrences: lowGradeLosses.length,
    lossRate,
  };
}

function detectRevengeTiming(
  input: AHAMomentInput,
  pastLosses: any[],
): FailureSignature {
  // Check: was there a loss in the last 30 minutes?
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const recentLosses = pastLosses.filter((t) => {
    if (!t.outcome_at && !t.created_at) return false;
    const time = t.outcome_at ?? t.created_at;
    return time >= thirtyMinAgo;
  });

  const matched = recentLosses.length > 0;

  // Count all revenge-pattern trades in history
  const revengeTrades = pastLosses.filter((t, i) => {
    if (i === 0) return false;
    const prev = pastLosses[i - 1];
    if (!prev?.outcome_at || !t.created_at) return false;
    const diff =
      new Date(t.created_at).getTime() - new Date(prev.outcome_at).getTime();
    return diff < 30 * 60 * 1000;
  }).length;

  const lossRate = pastLosses.length > 0
    ? Math.min(1, revengeTrades / Math.min(pastLosses.length, 20))
    : 0;

  return {
    type: 'revenge_timing',
    typeAr: 'توقيت انتقامي',
    matched,
    weight: 0.10,
    evidence: matched
      ? `خسارة خلال آخر 30 دقيقة — دخول سريع بعد خسارة`
      : 'لا توجد خسارة حديثة — التوقيت طبيعي',
    pastOccurrences: revengeTrades,
    lossRate,
  };
}

// ── Hook Builder ───────────────────────────────────────

function buildHook(
  similarityPercent: number,
  matchedSignatures: FailureSignature[],
  input: AHAMomentInput,
): string {
  if (similarityPercent === 0) {
    return `هذا القرار لا يشبه أي نمط خاسر سابق — تابع بحذر.`;
  }

  const sigDescriptions = matchedSignatures
    .map((s) => s.typeAr)
    .join('، ');

  return `هذا القرار يشبه ${similarityPercent}% من صفقاتك الخاسرة السابقة. الأنماط المكتشفة: ${sigDescriptions}. ${similarityPercent >= 70 ? 'يُنصح بشدة بعدم الدخول.' : similarityPercent >= 40 ? 'يُنصح بالمراجعة قبل الدخول.' : 'تأكد من وعيك بهذه الأنماط.'}`;
}

function buildExplanation(
  similarityPercent: number,
  signatures: FailureSignature[],
  input: AHAMomentInput,
): string {
  const lines = [
    `تحليل AHA Moment — ${input.instrument} ${input.timeframe}`,
    `نسبة التشابه مع الخسائر السابقة: ${similarityPercent}%`,
    '',
    'التوقيعات:',
  ];

  for (const sig of signatures) {
    const icon = sig.matched ? '🔴' : '🟢';
    lines.push(
      `${icon} ${sig.typeAr} (وزن ${(sig.weight * 100).toFixed(0)}%): ${sig.evidence}`,
    );
    if (sig.matched) {
      lines.push(`   ↳ معدل الخسارة التاريخي: ${(sig.lossRate * 100).toFixed(0)}% (${sig.pastOccurrences} حالة)`);
    }
  }

  if (similarityPercent >= 70) {
    lines.push('');
    lines.push('⚠️ تحذير: تشابه عالي جداً مع أنماط خاسرة — فكر مرتين قبل الدخول.');
  }

  return lines.join('\n');
}
