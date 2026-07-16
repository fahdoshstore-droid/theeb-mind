import type { Grade, QualityScoreResult } from '../../shared/types.js';
import { CONFIG } from '../../config/constants.js';

export interface QualityInput {
  confluenceScore: number;
  gatePercentage: number;
  rrr: number;
  killzoneActive: boolean;
  alignmentScore: number;
}

export function calculateQualityScore(input: QualityInput): QualityScoreResult {
  const { confluenceScore, gatePercentage, rrr, killzoneActive, alignmentScore } = input;
  const weights = CONFIG.SCORING_WEIGHTS;

  const confluenceNormalized = (confluenceScore / CONFIG.MAX_CONFLUENCE) * 100;
  const rrrNormalized = Math.min((rrr / CONFIG.MIN_RRR) * 100, 100);
  const timingScore = killzoneActive ? 100 : 30;

  const confluenceWeighted = (confluenceNormalized / 100) * weights.confluence * 100;
  const gateWeighted = (gatePercentage / 100) * weights.gate * 100;
  const rrrWeighted = (rrrNormalized / 100) * weights.rrr * 100;
  const timingWeighted = (timingScore / 100) * weights.timing * 100;
  const alignmentWeighted = (alignmentScore / 100) * weights.alignment * 100;

  const totalScore = Math.round(
    confluenceWeighted + gateWeighted + rrrWeighted + timingWeighted + alignmentWeighted
  );

  const grade = getGrade(totalScore);

  const explanation = [
    `التقييم الشامل: ${totalScore}/100 — درجة ${grade}`,
    `• التوافق: ${confluenceScore}/${CONFIG.MAX_CONFLUENCE} → ${confluenceNormalized.toFixed(0)}% × وزن ${(weights.confluence * 100).toFixed(0)}% = ${confluenceWeighted.toFixed(1)}`,
    `• البوابة النفسية: ${gatePercentage.toFixed(0)}% × وزن ${(weights.gate * 100).toFixed(0)}% = ${gateWeighted.toFixed(1)}`,
    `• نسبة المخاطرة للعائد: ${rrr.toFixed(1)} → ${rrrNormalized.toFixed(0)}% × وزن ${(weights.rrr * 100).toFixed(0)}% = ${rrrWeighted.toFixed(1)}`,
    `• التوقيت: ${killzoneActive ? 'ضمن منطقة القتل' : 'خارج منطقة القتل'} → ${timingScore}% × وزن ${(weights.timing * 100).toFixed(0)}% = ${timingWeighted.toFixed(1)}`,
    `• التوافق الاستراتيجي: ${alignmentScore}% × وزن ${(weights.alignment * 100).toFixed(0)}% = ${alignmentWeighted.toFixed(1)}`,
  ].join('\n');

  return {
    totalScore,
    grade,
    components: {
      confluence: { weight: weights.confluence, raw: confluenceNormalized, weighted: confluenceWeighted },
      gate: { weight: weights.gate, raw: gatePercentage, weighted: gateWeighted },
      rrr: { weight: weights.rrr, raw: rrrNormalized, weighted: rrrWeighted },
      timing: { weight: weights.timing, raw: timingScore, weighted: timingWeighted },
      alignment: { weight: weights.alignment, raw: alignmentScore, weighted: alignmentWeighted },
    },
    explanation,
  };
}

function getGrade(score: number): Grade {
  if (score >= 85) return 'A+';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  return 'C';
}