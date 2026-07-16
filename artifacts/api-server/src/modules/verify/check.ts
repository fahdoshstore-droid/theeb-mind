import type { Claim } from '../../shared/types.js';
import { CONFIG } from '../../config/constants.js';

export interface CheckResult {
  claim: Claim;
  verified: boolean;
  reason: string;
}

const SUSPICIOUS_WORDS = [
  'مضمون', 'بنسبة 100%', 'لن تخسر', 'ربح سريع', 'فرصة ذهبية',
  'لا تفوت', 'سرية', 'داخلية', 'أكيد',
];

const CREDIBLE_INDICATORS = [
  'قد', 'يحتمل', 'احتمال', 'وفقاً لـ', 'البيانات تظهر',
  'التاريخ يشير', 'مستويات دعم', 'مقاومة',
];

export function checkClaims(claims: Claim[]): CheckResult[] {
  return claims.map((claim) => {
    const lower = claim.text.toLowerCase();
    let score = claim.confidence;

    for (const word of SUSPICIOUS_WORDS) {
      if (lower.includes(word)) {
        score -= 25;
        break;
      }
    }

    for (const indicator of CREDIBLE_INDICATORS) {
      if (lower.includes(indicator)) {
        score += 10;
        break;
      }
    }

    if (claim.category === 'manipulation') {
      score -= 30;
    }

    if (claim.category === 'fundamental') {
      score += 10;
    }

    score = Math.min(100, Math.max(0, score));

    let verified: boolean;
    let reason: string;

    if (score >= CONFIG.VERIFY_THRESHOLDS.credible) {
      verified = true;
      reason = `ادعاء موثوق (درجة ${score}) — يحتوي على مؤشرات مصداقية`;
    } else if (score >= CONFIG.VERIFY_THRESHOLDS.suspicious) {
      verified = false;
      reason = `ادعاء مشبوه (درجة ${score}) — يحتاج مراجعة إضافية`;
    } else {
      verified = false;
      reason = `ادعاء مرفوض (درجة ${score}) — يحتوي على علامات تلاعب`;
    }

    return { claim, verified, reason };
  });
}