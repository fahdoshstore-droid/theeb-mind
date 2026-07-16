// DB returns snake_case column names — define the raw row shape explicitly
interface DbDecisionRow {
  id: string;
  user_id: string;
  type: string;
  created_at: string;
  quality_score: number;
  grade: string;
  outcome: string | null;
  outcome_pnl: number | null;
  killzone: string | null;
  day_blocked: number;
  news_blackout: number;
}

export interface BehavioralPattern {
  type: 'loss_streak' | 'overtrading' | 'revenge_trading' | 'emotional_trading' | 'low_quality';
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export function detectBehavioralPatterns(decisions: DbDecisionRow[]): BehavioralPattern[] {
  const patterns: BehavioralPattern[] = [];

  if (decisions.length < 2) return patterns;

  // Loss streak detection
  let lossStreak = 0;
  for (const d of decisions) {
    if (d.outcome === 'loss') lossStreak++;
    else break;
  }
  if (lossStreak >= 3) {
    patterns.push({
      type: 'loss_streak',
      severity: 'high',
      description: `سلسلة خسائر: ${lossStreak} خسائر متتالية`,
      recommendation: 'توقف عن التداول فوراً ومراجعة خطتك. عد فقط عندما تكون نفسيتك مستقرة.',
    });
  } else if (lossStreak === 2) {
    patterns.push({
      type: 'loss_streak',
      severity: 'medium',
      description: `خسيرتان متتاليتان`,
      recommendation: 'حذاري من التداول الانتقامي. خذ استراحة قبل الدخول مرة أخرى.',
    });
  }

  // Overtrading detection — use created_at (snake_case from DB)
  const today = new Date().toISOString().split('T')[0];
  const todayTrades = decisions.filter((d) => d.created_at?.startsWith(today));
  if (todayTrades.length >= 3) {
    patterns.push({
      type: 'overtrading',
      severity: 'high',
      description: `تداولات ${todayTrades.length} اليوم — تجاوزت الحد`,
      recommendation: 'توقفت عن التداول اليوم. التداول الزائد يقلل الجودة.',
    });
  } else if (todayTrades.length === 2) {
    patterns.push({
      type: 'overtrading',
      severity: 'low',
      description: `تداولتان اليوم — وصلت الحد`,
      recommendation: 'لا تفتح صفقة ثالثة اليوم.',
    });
  }

  // Revenge trading detection — use created_at (snake_case from DB)
  const recent = decisions.slice(0, 3);
  if (recent.length >= 2 && recent[0].outcome === 'loss' && recent[1]?.outcome === 'loss') {
    const timeDiff =
      new Date(recent[0].created_at).getTime() - new Date(recent[1].created_at).getTime();
    if (timeDiff < 30 * 60 * 1000) {
      patterns.push({
        type: 'revenge_trading',
        severity: 'high',
        description: 'دخول سريع بعد خسارة — علامة تداول انتقامي',
        recommendation: 'أوقف التداول الآن. التداول الانتقامي يدمر الحسابات.',
      });
    }
  }

  // Emotional trading detection
  const lowGradeTrades = decisions.filter((d) => d.grade === 'C').length;
  const totalGraded = decisions.filter((d) => d.grade).length;
  if (totalGraded > 0 && lowGradeTrades / totalGraded > 0.5) {
    patterns.push({
      type: 'emotional_trading',
      severity: 'medium',
      description: `${Math.round((lowGradeTrades / totalGraded) * 100)}% من صفقاتك درجة C`,
      recommendation: 'أغلب صفقاتك ذات جودة منخفضة. راجع معايير الدخول ولا تدخل إلا عند التوافق القوي.',
    });
  }

  // Low quality streak
  const recentGrades = decisions.slice(0, 5).map((d) => d.grade);
  if (recentGrades.filter((g) => g === 'C').length >= 3) {
    patterns.push({
      type: 'low_quality',
      severity: 'medium',
      description: 'جودة الصفقات منخفضة مؤخراً',
      recommendation: 'ركز على جودة الإشارات بدل الكمية. انتظر درجة A أو أعلى.',
    });
  }

  return patterns;
}
