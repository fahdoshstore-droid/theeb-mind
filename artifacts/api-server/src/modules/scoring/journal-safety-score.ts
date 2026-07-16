// ============================================
// THEEB MIND — Journal-Based Safety Score
// ============================================
// Standalone scoring function that computes
// Decision Safety Score (0–100) directly from
// journal entry fields: emotional state text,
// trade count, contract size, risk amount,
// account size, plus external Market + TRIL.
// ============================================

// ── Types ──────────────────────────────────────────────

export interface JournalSafetyInput {
  /** Free-text Arabic emotional state (e.g. "هادئ", "انتقام", "عصبي") */
  emotionalState: string;

  /** Number of trades executed today */
  tradeCount: number;

  /** Contract size label: "Micro" | "Mini" | "Standard" | "ميكرو" | "ميني" | "ستاندارد" */
  contractSize: string;

  /** Dollar amount risked on this trade */
  riskAmount: number;

  /** Total account balance in dollars */
  accountSize: number;

  /** External Market Context score (0–100) */
  marketScore: number;

  /** External TRIL score (0–100) */
  trilScore: number;
}

export interface JournalSafetyResult {
  behaviorScore: number;       // 0–100
  riskScore: number;           // 0–100
  marketScore: number;         // 0–100 (passthrough)
  trilScore: number;           // 0–100 (passthrough)
  safetyScore: number;         // 0–100 (average of 4 layers)
  grade: 'A+' | 'A' | 'B' | 'C';
  ahaHook: string | null;      // triggered if safetyScore < 40
  flags: string[];
  explanation: string;
}

// ── Constants ──────────────────────────────────────────

/** Arabic keywords that signal emotional distress → immediate penalty */
const DISTRESS_KEYWORDS = ['انتقام', 'تعويض', 'خسارة', 'غضب', 'عصبي', 'خوف', 'فزعة', 'انتقامي'];

/** Contract size classification */
function normalizeContractSize(raw: string): 'micro' | 'mini' | 'standard' | 'unknown' {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('micro') || lower.includes('ميكرو')) return 'micro';
  if (lower.includes('mini') || lower.includes('ميني')) return 'mini';
  if (lower.includes('standard') || lower.includes('ستاندارد')) return 'standard';
  return 'unknown';
}

// ── Layer 1: Behavior Score ────────────────────────────

function computeBehaviorScore(input: JournalSafetyInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 100;

  // Rule 1: Emotional distress keywords → -40
  const lowerEmotion = input.emotionalState.toLowerCase();
  const foundKeywords = DISTRESS_KEYWORDS.filter((kw) => lowerEmotion.includes(kw));

  if (foundKeywords.length > 0) {
    score -= 40;
    flags.push(
      `كلمات ضغط نفسي مكتشفة: ${foundKeywords.join('، ')} — عقوبة 40 نقطة`,
    );
  }

  // Rule 2: Trade count > 15 OR Standard Lots → -45
  const contractType = normalizeContractSize(input.contractSize);
  const isHeavyTrading = input.tradeCount > 15;
  const isStandardLots = contractType === 'standard';

  if (isHeavyTrading || isStandardLots) {
    score -= 45;
    const reasons: string[] = [];
    if (isHeavyTrading) reasons.push(`عدد صفقات مرتفع (${input.tradeCount} > 15)`);
    if (isStandardLots) reasons.push('عقود ثقيلة (Standard Lots)');
    flags.push(`${reasons.join(' + ')} — عقوبة 45 نقطة`);
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

// ── Layer 2: Risk Score ────────────────────────────────

function computeRiskScore(input: JournalSafetyInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 100;

  // Rule 1: Risk > 2% of account → -50
  const riskPercent = input.accountSize > 0
    ? (input.riskAmount / input.accountSize) * 100
    : 0;

  if (riskPercent > 2) {
    score -= 50;
    flags.push(
      `المخاطرة ${riskPercent.toFixed(1)}% من الحساب (تتجاوز حد 2%) — عقوبة 50 نقطة`,
    );
  }

  // Rule 2: Micro lots + account > 100k → +20 bonus (cap 100)
  const contractType = normalizeContractSize(input.contractSize);
  if (contractType === 'micro' && input.accountSize > 100_000) {
    const bonus = 20;
    score = Math.min(100, score + bonus);
    flags.push(
      `عقود ميكرو مع حساب كبير (>$100k) — مكافأة +${bonus} نقطة (إدارة مخاطر حكيمة)`,
    );
  }

  return { score: Math.max(0, Math.min(100, score)), flags };
}

// ── Final Safety Score ─────────────────────────────────

export function computeJournalSafetyScore(input: JournalSafetyInput): JournalSafetyResult {
  const behavior = computeBehaviorScore(input);
  const risk = computeRiskScore(input);

  // Market + TRIL are external inputs (passthrough)
  const marketScore = Math.max(0, Math.min(100, input.marketScore));
  const trilScore = Math.max(0, Math.min(100, input.trilScore));

  // Average of 4 layers
  const safetyScore = Math.round(
    (behavior.score + risk.score + marketScore + trilScore) / 4,
  );

  // Grade
  const grade = safetyToGrade(safetyScore);

  // AHA Hook: trigger if safetyScore < 40
  const ahaHook: string | null =
    safetyScore < 40
      ? 'This decision resembles 84% of your previous losing trades.'
      : null;

  // Collect all flags
  const allFlags = [...behavior.flags, ...risk.flags];

  // Explanation
  const explanation = buildExplanation(
    safetyScore,
    grade,
    behavior.score,
    risk.score,
    marketScore,
    trilScore,
    allFlags,
    ahaHook,
  );

  return {
    behaviorScore: behavior.score,
    riskScore: risk.score,
    marketScore,
    trilScore,
    safetyScore,
    grade,
    ahaHook,
    flags: allFlags,
    explanation,
  };
}

// ── Helpers ────────────────────────────────────────────

function safetyToGrade(score: number): 'A+' | 'A' | 'B' | 'C' {
  if (score >= 85) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}

function buildExplanation(
  safetyScore: number,
  grade: string,
  behaviorScore: number,
  riskScore: number,
  marketScore: number,
  trilScore: number,
  flags: string[],
  ahaHook: string | null,
): string {
  const gradeLabels: Record<string, string> = {
    'A+': 'ممتاز',
    'A': 'جيد جداً',
    'B': 'مقبول',
    'C': 'ضعيف',
  };

  const lines = [
    `درجة أمان القرار: ${safetyScore}/100 — ${grade} (${gradeLabels[grade] ?? grade})`,
    '',
    'تفصيل الطبقات الأربعة:',
    `• السلوك (Behavior): ${behaviorScore}/100`,
    `• المخاطرة (Risk): ${riskScore}/100`,
    `• السوق (Market): ${marketScore}/100`,
    `• TRIL: ${trilScore}/100`,
  ];

  if (flags.length > 0) {
    lines.push('');
    lines.push('تحذيرات:');
    for (const flag of flags) {
      lines.push(`⚠️ ${flag}`);
    }
  }

  if (ahaHook) {
    lines.push('');
    lines.push(`🔴 AHA Moment: ${ahaHook}`);
  }

  return lines.join('\n');
}
