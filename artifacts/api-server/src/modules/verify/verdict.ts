import type { Credibility, VerificationResult } from '../../shared/types.js';
import { CONFIG } from '../../config/constants.js';
import { formatCredibility } from '../../shared/formatters.js';

export interface VerdictInput {
  totalScore: number;
  verifiedClaims: number;
  rejectedClaims: number;
  manipulationFlags: string[];
  claimsCount: number;
}

export function generateVerdict(input: VerdictInput): VerificationResult {
  const { totalScore, verifiedClaims, rejectedClaims, manipulationFlags, claimsCount } = input;

  let credibility: Credibility;
  let verdict: string;
  let explanation: string;

  if (totalScore >= CONFIG.VERIFY_THRESHOLDS.credible) {
    credibility = 'credible';
    verdict = `المحتوى موثوق — ${verifiedClaims} من ${claimsCount} ادعاءات مؤكدة`;
    explanation = buildCredibleExplanation(verifiedClaims, rejectedClaims, claimsCount, manipulationFlags);
  } else if (totalScore >= CONFIG.VERIFY_THRESHOLDS.suspicious) {
    credibility = 'suspicious';
    verdict = `المحتوى مشبوه — يحتاج مراجعة إضافية`;
    explanation = buildSuspiciousExplanation(verifiedClaims, rejectedClaims, claimsCount, manipulationFlags);
  } else {
    credibility = 'rejected';
    verdict = `المحتوى مرفوض — علامات تلاعب واضحة`;
    explanation = buildRejectedExplanation(verifiedClaims, rejectedClaims, claimsCount, manipulationFlags);
  }

  return {
    credibility,
    credibilityScore: totalScore,
    claimsCount,
    verifiedClaims,
    rejectedClaims,
    manipulationFlags,
    verdict,
    explanation,
  };
}

function buildCredibleExplanation(verified: number, rejected: number, total: number, flags: string[]): string {
  const lines = [
    `✅ المحتوى موثوق (${formatCredibility('credible')})`,
    `• الادعاءات المؤكدة: ${verified} من ${total}`,
    `• الادعاءات المرفوضة: ${rejected}`,
  ];
  if (flags.length > 0) {
    lines.push(`• علامات تحذيرية طفيفة: ${flags.join('، ')}`);
  }
  return lines.join('\n');
}

function buildSuspiciousExplanation(verified: number, rejected: number, total: number, flags: string[]): string {
  const lines = [
    `⚠️ المحتوى مشبوه (${formatCredibility('suspicious')})`,
    `• الادعاءات المؤكدة: ${verified} من ${total}`,
    `• الادعاءات المرفوضة: ${rejected}`,
  ];
  if (flags.length > 0) {
    lines.push(`• أنماط تلاعب محتملة: ${flags.join('، ')}`);
  }
  lines.push('• التوصية: تحقق من المصادر قبل اتخاذ أي قرار تداول');
  return lines.join('\n');
}

function buildRejectedExplanation(verified: number, rejected: number, total: number, flags: string[]): string {
  const lines = [
    `❌ المحتوى مرفوض (${formatCredibility('rejected')})`,
    `• نسبة الادعاءات المرفوضة عالية: ${rejected} من ${total}`,
  ];
  if (flags.length > 0) {
    lines.push(`• أنماط تلاعب مكتشفة: ${flags.join('، ')}`);
  }
  lines.push('• التوصية: لا تتداول بناءً على هذا المحتوى');
  return lines.join('\n');
}