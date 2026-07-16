import type { ConfluenceBreakdown, Grade } from '../../shared/types.js';
import { CONFIG } from '../../config/constants.js';

export interface ConfluenceInput {
  marketStructure: boolean;
  fairValueGap: boolean;
  orderBlock: boolean;
  liquiditySweep: boolean;
  killzoneActive: boolean;
  immediateRebalance: boolean;
}

export interface ConfluenceResult {
  score: number;
  maxScore: number;
  breakdown: ConfluenceBreakdown;
  grade: Grade;
  explanation: string;
}

export function calculateConfluence(input: ConfluenceInput): ConfluenceResult {
  const breakdown: ConfluenceBreakdown = {
    marketStructure: input.marketStructure,
    fairValueGap: input.fairValueGap,
    orderBlock: input.orderBlock,
    liquiditySweep: input.liquiditySweep,
    killzoneActive: input.killzoneActive,
    immediateRebalance: input.immediateRebalance,
  };

  let score = 0;
  const factors: string[] = [];

  if (input.marketStructure) {
    score += 1;
    factors.push('بنية السوق متوافقة (+1)');
  }
  if (input.fairValueGap) {
    score += 1;
    factors.push('فجوة القيمة العادلة ظاهرة (+1)');
  }
  if (input.orderBlock) {
    score += 1;
    factors.push('كتلة الأوامر مؤكدة (+1)');
  }
  if (input.liquiditySweep) {
    score += 2;
    factors.push('كسر السيولة — إشارة قوية (+2)');
  }
  if (input.killzoneActive) {
    score += 1;
    factors.push('ضمن منطقة القتل (+1)');
  }
  if (input.immediateRebalance) {
    score += 1;
    factors.push('إعادة توازن فورية (+1)');
  }

  const grade = getConfluenceGrade(score);

  const explanation = score === 0
    ? 'لم يتم العثور على أي عوامل توافق — لا تتداول'
    : `مستوى التوافق: ${score}/${CONFIG.MAX_CONFLUENCE}\nالعوامل:\n${factors.map(f => `• ${f}`).join('\n')}`;

  return {
    score,
    maxScore: CONFIG.MAX_CONFLUENCE,
    breakdown,
    grade,
    explanation,
  };
}

function getConfluenceGrade(score: number): Grade {
  if (score >= 6) return 'A+';
  if (score >= 4) return 'A';
  if (score >= 3) return 'B';
  return 'C';
}