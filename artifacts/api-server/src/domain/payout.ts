// ═══════════════════════════════════════════════════════════════
// Funded Account & Payout Planner. Firm rules are user-configured (with source URL + check date);
// nothing about any specific firm is hard-coded. Unknown rules → UNKNOWN checks, never assumed PASS.
// ═══════════════════════════════════════════════════════════════
import { round2 } from './pnl.js';
import { zonedParts, NY_TZ } from './ny-time.js';

export type Phase = 'challenge' | 'funded_pre_payout' | 'funded_post_payout' | 'personal' | 'demo';
export type DrawdownModel = 'static' | 'trailing_eod' | 'trailing_intraday' | 'unknown';

export interface FirmRules {
  accountSize?: number | null;
  drawdownModel?: DrawdownModel | null;
  maxDrawdownUsd?: number | null;
  trailingStopsAtStart?: boolean | null;     // trailing floor locks at starting balance once reached (if the firm says so)
  dailyLossLimitUsd?: number | null;
  profitTargetUsd?: number | null;
  consistencyMaxDayPct?: number | null;      // largest winning day ≤ X % of total profit
  minProfitableDays?: number | null;
  minProfitPerDayUsd?: number | null;        // what counts as a "profitable day"
  minPayoutUsd?: number | null;
  maxPayoutPctOfProfit?: number | null;
  minBufferAboveFloorUsd?: number | null;    // balance that must remain above the floor after a payout
}

/** Phase risk ideas from the user-provided video summary. Suggestions, not firm rules. */
export const VIDEO_PHASE_SUGGESTIONS = {
  source: 'Video “My Simple Prop Firm Payout Strategy Explained (Step by Step)” — summary provided by the user; example for a 50k account. Strategy suggestion only, not a firm rule.',
  phases: {
    challenge: { riskPerTradeUsd: { min: 500, max: 500 }, focus: 'pass the challenge' },
    funded_pre_payout: { riskPerTradeUsd: { min: 250, max: 350 }, focus: 'build a buffer, reach the first payout' },
    funded_post_payout: { riskPerTradeUsd: { min: 150, max: 250 }, focus: 'preserve the account' },
  } as Record<string, { riskPerTradeUsd: { min: number; max: number }; focus: string }>,
};

export interface DayPnl { date: string; net: number }

export function dailyPnl(trades: { exitTime: string | null; netPnl: number | null; status: string }[]): DayPnl[] {
  const m = new Map<string, number>();
  for (const t of trades) {
    if (t.status !== 'closed' || t.netPnl == null || !t.exitTime) continue;
    const d = zonedParts(Date.parse(t.exitTime), NY_TZ).date;
    m.set(d, round2((m.get(d) ?? 0) + t.netPnl));
  }
  return [...m.entries()].map(([date, net]) => ({ date, net })).sort((a, b) => a.date.localeCompare(b.date));
}

export interface PlannerCheck { key: string; label: string; status: 'pass' | 'fail' | 'unknown'; detail: string }

export interface PlannerResult {
  phase: Phase;
  equity: { value: number | null; source: string };
  floor: { value: number | null; model: DrawdownModel; detail: string };
  buffer: { value: number | null; detail: string };
  days: { total: number; profitable: number | null; largestDay: DayPnl | null; totalProfit: number };
  checks: PlannerCheck[];
  eligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'UNKNOWN';
  eligibleAmount: { value: number | null; detail: string };
  payouts: { submitted: number; approved: number; received: number; rejected: number };
  riskSuggestion: { min: number; max: number; source: string; note: string } | null;
  warnings: string[];
}

export interface PayoutRecord { kind: 'submitted' | 'approved' | 'received' | 'rejected'; amount: number; date: string }

export function planAccount(input: {
  phase: Phase; startingBalance: number | null; rules: FirmRules; trades: { exitTime: string | null; netPnl: number | null; status: string }[];
  equityOverride?: { value: number; asOf: string } | null; payouts: PayoutRecord[];
}): PlannerResult {
  const r = input.rules, warnings: string[] = [];
  const days = dailyPnl(input.trades);
  const realized = round2(days.reduce((s, d) => s + d.net, 0));
  const paidOut = round2(input.payouts.filter((p) => p.kind === 'received').reduce((s, p) => s + p.amount, 0));
  let equity: number | null = null, equitySource = '';
  if (input.equityOverride) { equity = input.equityOverride.value; equitySource = `entered by you (as of ${input.equityOverride.asOf})`; }
  else if (input.startingBalance != null) {
    equity = round2(input.startingBalance + realized - paidOut);
    equitySource = 'estimated: starting balance + realized net P&L from the ledger − payouts received (excludes open P&L, resets and fees not in the ledger)';
  } else equitySource = 'unknown: no starting balance or equity entry';

  // drawdown floor
  const model = r.drawdownModel ?? 'unknown';
  let floor: number | null = null, floorDetail = '';
  const start = input.startingBalance;
  if (r.maxDrawdownUsd == null || start == null || model === 'unknown') floorDetail = 'drawdown rule not configured — floor unknown';
  else if (model === 'static') { floor = round2(start - r.maxDrawdownUsd); floorDetail = `static: starting balance − ${r.maxDrawdownUsd}`; }
  else if (model === 'trailing_eod') {
    let bal = start, peak = start;
    for (const d of days) { bal = round2(bal + d.net); peak = Math.max(peak, bal); }
    floor = round2(peak - r.maxDrawdownUsd);
    if (r.trailingStopsAtStart && floor > start) floor = start;
    floorDetail = `trailing end-of-day: highest EOD balance from the ledger (${round2(peak)}) − ${r.maxDrawdownUsd}${r.trailingStopsAtStart ? ', locked at starting balance per your rule' : ''}`;
    if (input.payouts.length) warnings.push('trailing floor computed from ledger days only; payouts may change the firm\'s floor — verify on the firm dashboard');
  } else floorDetail = 'intraday trailing drawdown needs intraday peak equity, which closed-trade data cannot provide — floor unknown';
  const buffer = equity != null && floor != null ? round2(equity - floor) : null;

  // checks
  const checks: PlannerCheck[] = [];
  const profitDays = r.minProfitPerDayUsd != null ? days.filter((d) => d.net >= r.minProfitPerDayUsd!).length : null;
  const totalProfit = round2(start != null && equity != null ? equity + paidOut - start : realized);
  const largest = days.length ? days.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  if (r.minProfitableDays != null) {
    if (profitDays == null) checks.push({ key: 'profitable_days', label: `≥ ${r.minProfitableDays} profitable days`, status: 'unknown', detail: 'minimum profit per day not configured' });
    else checks.push({ key: 'profitable_days', label: `≥ ${r.minProfitableDays} profitable days (≥ $${r.minProfitPerDayUsd})`, status: profitDays >= r.minProfitableDays ? 'pass' : 'fail', detail: `${profitDays} qualifying days` });
  }
  if (r.consistencyMaxDayPct != null) {
    if (!largest || totalProfit <= 0) checks.push({ key: 'consistency', label: `largest day ≤ ${r.consistencyMaxDayPct}% of profit`, status: 'unknown', detail: 'no positive total profit yet' });
    else {
      const p = Math.round((largest.net / totalProfit) * 10000) / 100;
      checks.push({ key: 'consistency', label: `largest day ≤ ${r.consistencyMaxDayPct}% of profit`, status: p <= r.consistencyMaxDayPct ? 'pass' : 'fail', detail: `largest day ${largest.date} = $${largest.net} (${p}% of $${totalProfit})` });
    }
  }
  if (r.minBufferAboveFloorUsd != null) {
    checks.push(buffer == null ? { key: 'buffer', label: `buffer ≥ $${r.minBufferAboveFloorUsd}`, status: 'unknown', detail: 'floor or equity unknown' }
      : { key: 'buffer', label: `buffer ≥ $${r.minBufferAboveFloorUsd}`, status: buffer >= r.minBufferAboveFloorUsd ? 'pass' : 'fail', detail: `buffer $${buffer}` });
  }
  if (input.phase === 'challenge') checks.push({ key: 'phase', label: 'account is funded', status: 'fail', detail: 'challenge accounts are not payout-eligible' });
  if (buffer != null && buffer <= 0) checks.push({ key: 'floor_breached', label: 'equity above drawdown floor', status: 'fail', detail: `equity ${equity} ≤ floor ${floor}` });

  let eligibleAmount: number | null = null, eligibleDetail = '';
  if (r.maxPayoutPctOfProfit != null && totalProfit > 0) {
    eligibleAmount = round2((totalProfit - paidOut) * r.maxPayoutPctOfProfit / 100);
    eligibleDetail = `${r.maxPayoutPctOfProfit}% of profit not yet paid out`;
    if (r.minBufferAboveFloorUsd != null && buffer != null) {
      const cap = round2(buffer - r.minBufferAboveFloorUsd);
      if (cap < eligibleAmount) { eligibleAmount = Math.max(0, cap); eligibleDetail += `, capped so the buffer stays ≥ $${r.minBufferAboveFloorUsd}`; }
    }
    if (r.minPayoutUsd != null) checks.push({ key: 'min_payout', label: `payout ≥ $${r.minPayoutUsd}`, status: eligibleAmount >= r.minPayoutUsd ? 'pass' : 'fail', detail: `eligible amount $${eligibleAmount}` });
  } else eligibleDetail = r.maxPayoutPctOfProfit == null ? 'payout split/limit not configured' : 'no profit to pay out';

  if (!checks.length) warnings.push('no payout rules configured for this firm profile — eligibility cannot be assessed');
  const eligibility = !checks.length || checks.some((c) => c.status === 'unknown') ? (checks.some((c) => c.status === 'fail') ? 'NOT_ELIGIBLE' : 'UNKNOWN')
    : checks.every((c) => c.status === 'pass') ? 'ELIGIBLE' : 'NOT_ELIGIBLE';

  const sug = VIDEO_PHASE_SUGGESTIONS.phases[input.phase];
  const scale = r.accountSize && r.accountSize !== 50000 ? r.accountSize / 50000 : 1;
  const sum = (k: PayoutRecord['kind']) => round2(input.payouts.filter((p) => p.kind === k).reduce((s, p) => s + p.amount, 0));
  return {
    phase: input.phase,
    equity: { value: equity, source: equitySource },
    floor: { value: floor, model, detail: floorDetail },
    buffer: { value: buffer, detail: buffer == null ? 'unknown' : 'equity − drawdown floor' },
    days: { total: days.length, profitable: profitDays, largestDay: largest, totalProfit },
    checks, eligibility,
    eligibleAmount: { value: eligibility === 'ELIGIBLE' ? eligibleAmount : eligibility === 'UNKNOWN' ? null : 0, detail: eligibleDetail },
    payouts: { submitted: sum('submitted'), approved: sum('approved'), received: sum('received'), rejected: sum('rejected') },
    riskSuggestion: sug ? {
      min: round2(sug.riskPerTradeUsd.min * scale), max: round2(sug.riskPerTradeUsd.max * scale), source: VIDEO_PHASE_SUGGESTIONS.source,
      note: `${sug.focus}${scale !== 1 ? ` (scaled linearly from the 50k example to ${r.accountSize} — your assumption to confirm)` : ''}. This does not change your risk profile.`,
    } : null,
    warnings,
  };
}
