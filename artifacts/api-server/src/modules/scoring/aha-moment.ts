// ============================================
// THEEB MIND — AHA Moment Engine (v2)
// ============================================
// Detects historical failure signatures using
// the memory_fingerprints and failure_patterns
// tables instead of raw decisions scans.
// ============================================

import { db } from '../../db/db.js';

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
  lossRate: number; // 0–1
}

export interface AHAMomentResult {
  similarityPercent: number;
  signatures: FailureSignature[];
  hook: string;
  explanation: string;
}

// ── Engine ────────────────────────────────────────────

export function detectAHAMoment(input: AHAMomentInput): AHAMomentResult {
  const signatures: FailureSignature[] = [];

  // ── Signature 1: Size escalation after loss ───────────
  // Still needs raw decisions data for risk_json comparison
  const recentLoss = db.raw
    .prepare(
      `SELECT d.risk_json, d.outcome_at
       FROM decisions d
       WHERE d.user_id = ? AND d.outcome = 'loss'
       ORDER BY d.created_at DESC LIMIT 1`,
    )
    .get(input.userId) as { risk_json: string | null; outcome_at: string | null } | undefined;

  signatures.push(detectSizeEscalation(input, recentLoss));

  // ── Signature 2: Same setup repeat (memory_fingerprints) ─
  signatures.push(detectSameSetupRepeat(input));

  // ── Signature 3: Bad killzone (memory_fingerprints) ──────
  signatures.push(detectBadKillzone(input));

  // ── Signature 4: Low grade pattern (memory_fingerprints) ─
  signatures.push(detectLowGradePattern(input));

  // ── Signature 5: Revenge timing (decisions) ───────────
  signatures.push(detectRevengeTiming(input));

  // ── Compute aggregate similarity ──────────────────────
  const matchedSignatures = signatures.filter((s) => s.matched);
  let similarityPercent = 0;

  if (matchedSignatures.length > 0) {
    const totalWeight = matchedSignatures.reduce((sum, s) => sum + s.weight, 0);
    const weightedLossRate =
      matchedSignatures.reduce((sum, s) => sum + s.lossRate * s.weight, 0) / totalWeight;
    similarityPercent = Math.round(weightedLossRate * 100);
  }

  // ── Boost similarity using failure_patterns hit count ─
  const patternKey = `${input.instrument}:${input.timeframe}:${input.killzone ?? 'none'}:${input.confluenceGrade}`;
  const fp = db.raw
    .prepare(`SELECT hit_count FROM failure_patterns WHERE user_id = ? AND pattern_key = ?`)
    .get(input.userId, patternKey) as { hit_count: number } | undefined;

  if (fp && fp.hit_count >= 3) {
    // Up to +15 pts boost for heavily repeated failure patterns
    const boost = Math.min(15, fp.hit_count * 2);
    similarityPercent = Math.min(100, similarityPercent + boost);
  }

  const hook = buildHook(similarityPercent, matchedSignatures, input);
  const explanation = buildExplanation(similarityPercent, signatures, input);

  return { similarityPercent, signatures, hook, explanation };
}

// ── Signature Detectors ────────────────────────────────

function detectSizeEscalation(
  input: AHAMomentInput,
  recentLoss: { risk_json: string | null; outcome_at: string | null } | undefined,
): FailureSignature {
  let lastRiskAmount = 0;
  const hasRecentLoss = recentLoss != null;

  if (recentLoss?.risk_json) {
    try {
      lastRiskAmount = (JSON.parse(recentLoss.risk_json) as { riskAmount?: number }).riskAmount ?? 0;
    } catch { /* ignore */ }
  }

  const currentRisk = input.riskAmount ?? 0;
  const isEscalating = hasRecentLoss && currentRisk > lastRiskAmount && lastRiskAmount > 0;

  // Count escalation instances from memory_fingerprints
  const escalationCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND outcome = 'loss' AND risk_amount > 0`,
      )
      .get(input.userId) as { c: number }
  ).c;

  const lossCount = (
    db.raw
      .prepare(`SELECT COUNT(*) as c FROM memory_fingerprints WHERE user_id = ? AND outcome = 'loss'`)
      .get(input.userId) as { c: number }
  ).c;

  const lossRate = lossCount > 0 ? Math.min(1, escalationCount / lossCount) : 0;

  return {
    type: 'size_escalation',
    typeAr: 'زيادة الحجم بعد خسارة',
    matched: isEscalating,
    weight: 0.30,
    evidence: isEscalating
      ? `آخر خسارة بمخاطرة ${lastRiskAmount} — المخاطرة الحالية ${currentRisk} (زيادة)`
      : hasRecentLoss
        ? 'آخر صفقة خاسرة لكن المخاطرة لم تزد'
        : 'لا توجد خسارة سابقة للمقارنة',
    pastOccurrences: escalationCount,
    lossRate,
  };
}

function detectSameSetupRepeat(input: AHAMomentInput): FailureSignature {
  // Query memory_fingerprints for same instrument + timeframe
  const lossCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND instrument = ? AND timeframe = ? AND outcome = 'loss'`,
      )
      .get(input.userId, input.instrument, input.timeframe) as { c: number }
  ).c;

  const totalCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND instrument = ? AND timeframe = ?`,
      )
      .get(input.userId, input.instrument, input.timeframe) as { c: number }
  ).c;

  // Check failure_patterns for this exact setup (instrument + timeframe + killzone + grade)
  const patternKey = `${input.instrument}:${input.timeframe}:${input.killzone ?? 'none'}:${input.confluenceGrade}`;
  const failurePattern = db.raw
    .prepare(`SELECT hit_count FROM failure_patterns WHERE user_id = ? AND pattern_key = ?`)
    .get(input.userId, patternKey) as { hit_count: number } | undefined;

  const matched = lossCount >= 2;
  const baseRate = totalCount > 0 ? lossCount / totalCount : 0;
  // Pattern boost: if this exact pattern key has been recorded as a failure
  const patternBoost = failurePattern ? Math.min(0.2, failurePattern.hit_count * 0.02) : 0;
  const lossRate = Math.min(1, baseRate + patternBoost);

  return {
    type: 'same_setup_repeat',
    typeAr: 'تكرار نفس الإعداد الخاسر',
    matched,
    weight: 0.25,
    evidence: matched
      ? `${input.instrument} ${input.timeframe}: ${lossCount} خسائر من ${totalCount} محاولة${failurePattern ? ` (نمط مسجل: ${failurePattern.hit_count} مرة)` : ''}`
      : lossCount === 1
        ? `${input.instrument} ${input.timeframe}: خسارة واحدة سابقة فقط`
        : `لا توجد خسائر سابقة على ${input.instrument} ${input.timeframe}`,
    pastOccurrences: lossCount,
    lossRate,
  };
}

function detectBadKillzone(input: AHAMomentInput): FailureSignature {
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

  // Query memory_fingerprints for killzone performance
  const zoneLossCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND killzone = ? AND outcome = 'loss'`,
      )
      .get(input.userId, input.killzone) as { c: number }
  ).c;

  const zoneTotalCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND killzone = ?`,
      )
      .get(input.userId, input.killzone) as { c: number }
  ).c;

  const matched = zoneLossCount >= 3 && zoneTotalCount >= 5;
  const lossRate = zoneTotalCount > 0 ? zoneLossCount / zoneTotalCount : 0;

  const killzoneLabels: Record<string, string> = {
    asian:   'الآسيوية',
    london:  'اللندنية',
    nyAM:    'نيويورك صباحاً',
    nyLunch: 'نيويورك غداء',
    nyPM:    'نيويورك مساءً',
  };

  return {
    type: 'bad_killzone',
    typeAr: 'نافذة نشاط خاسرة',
    matched,
    weight: 0.20,
    evidence: matched
      ? `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: ${zoneLossCount} خسائر من ${zoneTotalCount} صفقة`
      : zoneTotalCount < 5
        ? `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: بيانات غير كافية (${zoneTotalCount} صفقة)`
        : `نافذة ${killzoneLabels[input.killzone] ?? input.killzone}: نسبة خسائر مقبولة`,
    pastOccurrences: zoneLossCount,
    lossRate,
  };
}

function detectLowGradePattern(input: AHAMomentInput): FailureSignature {
  // Count C-grade losses among the 10 most-recent losses from memory_fingerprints
  const cGradeLossCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM (
           SELECT grade FROM memory_fingerprints
           WHERE user_id = ? AND outcome = 'loss'
           ORDER BY created_at DESC LIMIT 10
         ) WHERE grade = 'C'`,
      )
      .get(input.userId) as { c: number }
  ).c;

  const recentLossCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM (
           SELECT id FROM memory_fingerprints
           WHERE user_id = ? AND outcome = 'loss'
           ORDER BY created_at DESC LIMIT 10
         )`,
      )
      .get(input.userId) as { c: number }
  ).c;

  const isCurrentLowGrade = input.confluenceGrade === 'C';
  const hasLowGradeHistory = cGradeLossCount >= 3;
  const matched = isCurrentLowGrade && hasLowGradeHistory;
  const lossRate = recentLossCount > 0 ? cGradeLossCount / recentLossCount : 0;

  return {
    type: 'low_grade_pattern',
    typeAr: 'نمط درجات منخفضة',
    matched,
    weight: 0.15,
    evidence: matched
      ? `${cGradeLossCount} من آخر 10 خسائر بدرجة C — والصفقة الحالية أيضاً C`
      : isCurrentLowGrade
        ? 'الصفقة الحالية بدرجة C لكن التاريخ لا يظهر نمطاً'
        : 'درجة الصفقة الحالية مقبولة',
    pastOccurrences: cGradeLossCount,
    lossRate,
  };
}

function detectRevengeTiming(input: AHAMomentInput): FailureSignature {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const recentLossCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM decisions
         WHERE user_id = ? AND outcome = 'loss'
           AND (outcome_at >= ? OR created_at >= ?)`,
      )
      .get(input.userId, thirtyMinAgo, thirtyMinAgo) as { c: number }
  ).c;

  const matched = recentLossCount > 0;

  // Count total revenge instances from memory_fingerprints proxy
  const totalRevengeCount = (
    db.raw
      .prepare(
        `SELECT COUNT(*) as c FROM memory_fingerprints
         WHERE user_id = ? AND outcome = 'loss'`,
      )
      .get(input.userId) as { c: number }
  ).c;

  const lossRate = totalRevengeCount > 0 ? Math.min(1, recentLossCount / Math.max(totalRevengeCount, 20)) : 0;

  return {
    type: 'revenge_timing',
    typeAr: 'توقيت انتقامي',
    matched,
    weight: 0.10,
    evidence: matched
      ? `خسارة خلال آخر 30 دقيقة — دخول سريع بعد خسارة`
      : 'لا توجد خسارة حديثة — التوقيت طبيعي',
    pastOccurrences: recentLossCount,
    lossRate,
  };
}

// ── Hook & Explanation Builders ────────────────────────

function buildHook(
  similarityPercent: number,
  matchedSignatures: FailureSignature[],
  _input: AHAMomentInput,
): string {
  if (similarityPercent === 0) {
    return 'هذا القرار لا يشبه أي نمط خاسر سابق — تابع بحذر.';
  }

  const sigDescriptions = matchedSignatures.map((s) => s.typeAr).join('، ');
  return `هذا القرار يشبه ${similarityPercent}% من صفقاتك الخاسرة السابقة. الأنماط المكتشفة: ${sigDescriptions}. ${
    similarityPercent >= 70
      ? 'يُنصح بشدة بعدم الدخول.'
      : similarityPercent >= 40
        ? 'يُنصح بالمراجعة قبل الدخول.'
        : 'تأكد من وعيك بهذه الأنماط.'
  }`;
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
    lines.push(`${icon} ${sig.typeAr} (وزن ${(sig.weight * 100).toFixed(0)}%): ${sig.evidence}`);
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
