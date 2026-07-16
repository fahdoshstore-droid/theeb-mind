import { db } from '../../db/db.js';
import type { JournalAnalytics } from './journal.types.js';

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

export function calculateAnalytics(userId: string, period: string): JournalAnalytics {
  const now = new Date();
  let startDate: string;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      break;
    default:
      startDate = '2000-01-01T00:00:00.000Z';
  }

  const decisions = db.stmt('getDecisionsByUserDateRange').all(
    userId,
    startDate,
    now.toISOString()
  ) as DbDecisionRow[];

  const totalTrades = decisions.length;
  const wins = decisions.filter((d) => d.outcome === 'win').length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Use snake_case column names from the raw DB row
  const avgConfluence =
    totalTrades > 0
      ? decisions.reduce((sum, d) => sum + (d.quality_score ?? 0), 0) / totalTrades
      : 0;

  const totalPnl = decisions.reduce((sum, d) => sum + (d.outcome_pnl ?? 0), 0);

  // Best killzone
  const killzoneWins: Record<string, { wins: number; total: number }> = {};
  for (const d of decisions) {
    if (d.killzone) {
      if (!killzoneWins[d.killzone]) {
        killzoneWins[d.killzone] = { wins: 0, total: 0 };
      }
      killzoneWins[d.killzone].total++;
      if (d.outcome === 'win') killzoneWins[d.killzone].wins++;
    }
  }

  let bestKillzone: string | null = null;
  let bestKillzoneRate = -1;
  for (const [zone, stats] of Object.entries(killzoneWins)) {
    const rate = stats.total > 0 ? stats.wins / stats.total : 0;
    if (rate > bestKillzoneRate && stats.total >= 3) {
      bestKillzoneRate = rate;
      bestKillzone = zone;
    }
  }

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  for (const d of decisions) {
    gradeDistribution[d.grade] = (gradeDistribution[d.grade] || 0) + 1;
  }

  // Recent pattern detection
  const recentPattern = detectRecentPattern(decisions);

  return {
    totalTrades,
    winRate: Math.round(winRate * 10) / 10,
    avgConfluence: Math.round(avgConfluence * 10) / 10,
    bestKillzone,
    totalPnl: Math.round(totalPnl * 100) / 100,
    gradeDistribution,
    recentPattern,
  };
}

function detectRecentPattern(decisions: DbDecisionRow[]): string | null {
  if (decisions.length < 3) return null;

  const recent = decisions.slice(0, 5);
  const recentOutcomes = recent.map((d) => d.outcome);

  const recentLosses = recentOutcomes.filter((o) => o === 'loss').length;
  if (recentLosses >= 3) return 'سلسلة خسائر — يُنصح بالتوقف والمراجعة';

  const recentWins = recentOutcomes.filter((o) => o === 'win').length;
  if (recentWins >= 4) return 'سلسلة أرباح — احذر من الثقة المفرطة';

  const lowGrades = recent.filter((d) => d.grade === 'C').length;
  if (lowGrades >= 3) return 'جودتك في انخفاض — راجع معايير الدخول';

  return null;
}
