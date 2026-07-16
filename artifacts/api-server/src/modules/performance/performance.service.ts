import { db } from '../../db/db.js';

// ── Types ──────────────────────────────────────────────

export interface PerformanceSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRrr: number;
  avgQualityScore: number;
  totalPnl: number;
  bestGradePct: number;
  totalTradingDays: number;
}

export interface EquityPoint {
  date: string;
  pnl: number;
  cumulative: number;
  tradeIndex: number;
}

export interface DrawdownResult {
  maxDrawdown: number;
  currentDrawdown: number;
  maxDrawdownDate: string | null;
  peakPnl: number;
  recoveryFactor: number;
}

export interface InstrumentStat {
  instrument: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgPnl: number;
  avgQuality: number;
}

export interface PsychCorrelation {
  matrix: Record<string, Record<string, number>>;
  verdicts: string[];
  outcomes: string[];
}

export interface KillzoneStat {
  killzone: string;
  wins: number;
  losses: number;
  breakevens: number;
  total: number;
}

export interface QualityTrendPoint {
  date: string;
  avgScore: number;
  count: number;
}

// ── Helpers ────────────────────────────────────────────

function safeJsonParse(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Service functions ──────────────────────────────────

export function getSummary(userId: string): PerformanceSummary {
  const row = db.raw.prepare(`
    SELECT
      COUNT(*)                                                        AS total_trades,
      SUM(CASE WHEN outcome = 'win'       THEN 1 ELSE 0 END)         AS wins,
      SUM(CASE WHEN outcome = 'loss'      THEN 1 ELSE 0 END)         AS losses,
      SUM(CASE WHEN outcome = 'breakeven' THEN 1 ELSE 0 END)         AS breakevens,
      AVG(CAST(quality_score AS REAL))                               AS avg_quality,
      SUM(COALESCE(outcome_pnl, 0))                                  AS total_pnl,
      COUNT(DISTINCT date(created_at))                               AS trading_days,
      SUM(CASE WHEN grade IN ('A+','A')   THEN 1 ELSE 0 END)         AS high_grade_count
    FROM decisions
    WHERE user_id = ?
  `).get(userId) as any;

  const total = row?.total_trades ?? 0;
  const wins  = row?.wins ?? 0;

  // Compute avg RRR from risk_json across all decisions
  const allRiskRows = db.raw.prepare(
    `SELECT risk_json FROM decisions WHERE user_id = ? AND risk_json IS NOT NULL`
  ).all(userId) as { risk_json: string }[];

  const rrrValues = allRiskRows
    .map(r => safeJsonParse(r.risk_json)?.rrr as number | undefined)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  const avgRrr = rrrValues.length > 0
    ? rrrValues.reduce((s, v) => s + v, 0) / rrrValues.length
    : 0;

  return {
    totalTrades:     total,
    wins,
    losses:          row?.losses ?? 0,
    breakevens:      row?.breakevens ?? 0,
    winRate:         total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
    avgRrr:          Math.round(avgRrr * 10) / 10,
    avgQualityScore: Math.round((row?.avg_quality ?? 0) * 10) / 10,
    totalPnl:        Math.round((row?.total_pnl ?? 0) * 100) / 100,
    bestGradePct:    total > 0 ? Math.round(((row?.high_grade_count ?? 0) / total) * 1000) / 10 : 0,
    totalTradingDays: row?.trading_days ?? 0,
  };
}

export function getEquityCurve(userId: string): EquityPoint[] {
  const rows = db.raw.prepare(`
    SELECT created_at, COALESCE(outcome_pnl, 0) AS pnl
    FROM decisions
    WHERE user_id = ? AND outcome IS NOT NULL
    ORDER BY created_at ASC
  `).all(userId) as { created_at: string; pnl: number }[];

  let cumulative = 0;
  return rows.map((r, i) => {
    cumulative += Number(r.pnl);
    return {
      date:       r.created_at.split('T')[0],
      pnl:        Math.round(Number(r.pnl) * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
      tradeIndex: i + 1,
    };
  });
}

export function getDrawdown(userId: string): DrawdownResult {
  const curve = getEquityCurve(userId);

  if (curve.length === 0) {
    return { maxDrawdown: 0, currentDrawdown: 0, maxDrawdownDate: null, peakPnl: 0, recoveryFactor: 0 };
  }

  let peak           = curve[0].cumulative;
  let maxDrawdown    = 0;
  let maxDrawdownDate: string | null = null;

  for (const pt of curve) {
    if (pt.cumulative > peak) peak = pt.cumulative;
    const dd = peak - pt.cumulative;
    if (dd > maxDrawdown) {
      maxDrawdown     = dd;
      maxDrawdownDate = pt.date;
    }
  }

  const last            = curve[curve.length - 1].cumulative;
  const peakPnl         = Math.max(...curve.map(p => p.cumulative));
  const currentDrawdown = peakPnl > last ? peakPnl - last : 0;
  const recoveryFactor  = maxDrawdown > 0 ? Math.round((last / maxDrawdown) * 100) / 100 : 0;

  return {
    maxDrawdown:    Math.round(maxDrawdown * 100) / 100,
    currentDrawdown: Math.round(currentDrawdown * 100) / 100,
    maxDrawdownDate,
    peakPnl:        Math.round(peakPnl * 100) / 100,
    recoveryFactor,
  };
}

export function getInstrumentBreakdown(userId: string): InstrumentStat[] {
  const rows = db.raw.prepare(`
    SELECT
      instrument,
      COUNT(*)                                              AS trades,
      SUM(CASE WHEN outcome = 'win'  THEN 1 ELSE 0 END)   AS wins,
      SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END)   AS losses,
      AVG(COALESCE(outcome_pnl, 0))                       AS avg_pnl,
      AVG(CAST(quality_score AS REAL))                    AS avg_quality
    FROM decisions
    WHERE user_id = ? AND instrument IS NOT NULL
    GROUP BY instrument
    ORDER BY trades DESC
  `).all(userId) as any[];

  return rows.map(r => ({
    instrument: r.instrument as string,
    trades:     Number(r.trades),
    wins:       Number(r.wins),
    losses:     Number(r.losses),
    winRate:    r.trades > 0 ? Math.round((r.wins / r.trades) * 1000) / 10 : 0,
    avgPnl:     Math.round(Number(r.avg_pnl) * 100) / 100,
    avgQuality: Math.round(Number(r.avg_quality) * 10) / 10,
  }));
}

export function getPsychCorrelation(userId: string): PsychCorrelation {
  const VERDICTS = ['pass', 'warning', 'fail'];
  const OUTCOMES = ['win', 'loss', 'breakeven'];

  // Init matrix
  const matrix: Record<string, Record<string, number>> = {};
  for (const v of VERDICTS) {
    matrix[v] = { win: 0, loss: 0, breakeven: 0 };
  }

  const rows = db.raw.prepare(`
    SELECT psychology_json, outcome
    FROM decisions
    WHERE user_id = ? AND outcome IS NOT NULL AND psychology_json IS NOT NULL
  `).all(userId) as { psychology_json: string; outcome: string }[];

  for (const r of rows) {
    const psych = safeJsonParse(r.psychology_json);
    const verdict = (psych?.verdict ?? 'warning') as string;
    const outcome = r.outcome;
    const safeVerdict = VERDICTS.includes(verdict) ? verdict : 'warning';
    const safeOutcome = OUTCOMES.includes(outcome)  ? outcome : null;
    if (safeOutcome && matrix[safeVerdict]) {
      matrix[safeVerdict][safeOutcome] = (matrix[safeVerdict][safeOutcome] ?? 0) + 1;
    }
  }

  return { matrix, verdicts: VERDICTS, outcomes: OUTCOMES };
}

export function getQualityTrend(userId: string): QualityTrendPoint[] {
  const rows = db.raw.prepare(`
    SELECT
      date(created_at)                     AS day,
      ROUND(AVG(CAST(quality_score AS REAL)), 1) AS avg_score,
      COUNT(*)                             AS cnt
    FROM decisions
    WHERE user_id = ?
      AND quality_score IS NOT NULL
      AND date(created_at) >= date('now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `).all(userId) as { day: string; avg_score: number; cnt: number }[];

  return rows.map(r => ({
    date:     r.day,
    avgScore: r.avg_score ?? 0,
    count:    Number(r.cnt),
  }));
}

export function getTimeAnalysis(userId: string): KillzoneStat[] {
  const KILLZONES = ['asian', 'london', 'nyAM', 'nyLunch', 'nyPM'];

  const rows = db.raw.prepare(`
    SELECT
      killzone,
      SUM(CASE WHEN outcome = 'win'       THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN outcome = 'loss'      THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN outcome = 'breakeven' THEN 1 ELSE 0 END) AS breakevens,
      COUNT(*) AS total
    FROM decisions
    WHERE user_id = ? AND killzone IS NOT NULL AND outcome IS NOT NULL
    GROUP BY killzone
  `).all(userId) as any[];

  // Ensure all killzones appear even with zero data
  const map = new Map<string, KillzoneStat>(
    KILLZONES.map(k => [k, { killzone: k, wins: 0, losses: 0, breakevens: 0, total: 0 }])
  );

  for (const r of rows) {
    if (map.has(r.killzone)) {
      map.set(r.killzone, {
        killzone:   r.killzone,
        wins:       Number(r.wins),
        losses:     Number(r.losses),
        breakevens: Number(r.breakevens),
        total:      Number(r.total),
      });
    }
  }

  return Array.from(map.values());
}
