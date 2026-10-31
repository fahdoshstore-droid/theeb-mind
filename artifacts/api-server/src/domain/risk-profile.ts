// Personal risk/rules profile: versioned rules with status, source and effective date.
// Seeds are shown to the user to confirm; historical values are kept as separate, inactive versions.
import { computeRisk, round2, type RiskInput, type RiskResult } from './pnl.js';
import type { SessionKey } from './tril.js';

export type RuleStatus = 'active' | 'observation' | 'historical' | 'disabled';

export const RULE_KEYS = {
  max_trade_risk_usd: { label: 'Max risk per trade ($)', kind: 'number' },
  min_rrr: { label: 'Minimum RRR', kind: 'number' },
  daily_loss_limit_usd: { label: 'Daily loss limit ($)', kind: 'number' },
  enabled_sessions: { label: 'Enabled NY sessions', kind: 'sessions' },
  trading_weekdays: { label: 'Trading weekdays (0=Sun…6=Sat)', kind: 'weekdays' },
  no_trade_weekdays: { label: 'No-trade weekdays (0=Sun…6=Sat)', kind: 'weekdays' },
  max_trades_per_day: { label: 'Max trades per day', kind: 'number' },
  stop_after_consecutive_losses: { label: 'Stop after N consecutive losses', kind: 'number' },
} as const;
export type RuleKey = keyof typeof RULE_KEYS;

export interface RuleSeed { key: RuleKey; value: unknown; status: RuleStatus; source: string; effectiveFrom: string | null; note?: string }

const PROMPT = 'Build prompt 2026-10-31 §5 — latest personal settings (please confirm)';
const LEGACY = 'Legacy app constants (api-server/src/config/constants.ts) — not applied';

export const RULE_SEEDS: RuleSeed[] = [
  { key: 'max_trade_risk_usd', value: 500, status: 'active', source: PROMPT, effectiveFrom: null },
  { key: 'min_rrr', value: 2.0, status: 'active', source: PROMPT, effectiveFrom: null, note: 'older setting was 2.5' },
  { key: 'min_rrr', value: 2.5, status: 'historical', source: LEGACY, effectiveFrom: null },
  { key: 'daily_loss_limit_usd', value: 1000, status: 'active', source: PROMPT, effectiveFrom: null, note: 'older setting was $600' },
  { key: 'daily_loss_limit_usd', value: 600, status: 'historical', source: LEGACY, effectiveFrom: null },
  { key: 'enabled_sessions', value: ['ny_am'], status: 'active', source: 'Older personal setting (NY AM only). The TRIL source describes AM and PM — choose which you trade.', effectiveFrom: null },
  { key: 'trading_weekdays', value: [1, 2, 4], status: 'historical', source: 'Previously recorded trading days Mon/Tue/Thu (build prompt §5)', effectiveFrom: null },
  { key: 'no_trade_weekdays', value: [3, 5], status: 'historical', source: LEGACY, effectiveFrom: null },
  { key: 'max_trades_per_day', value: 2, status: 'historical', source: LEGACY + '. You stated you do not follow a fixed daily trade count; frequency is tracked analytically only.', effectiveFrom: null },
  { key: 'stop_after_consecutive_losses', value: 2, status: 'historical', source: LEGACY, effectiveFrom: null },
];

export function validateRuleValue(key: RuleKey, value: unknown): string | null {
  const kind = RULE_KEYS[key].kind;
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value) && value > 0 ? null : 'must be a positive number';
  if (kind === 'weekdays') return Array.isArray(value) && value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ? null : 'must be a list of weekday numbers 0–6';
  if (kind === 'sessions') return Array.isArray(value) && value.every((s) => s === 'ny_am' || s === 'ny_pm') ? null : 'must be a list of ny_am / ny_pm';
  return 'unknown rule';
}

export interface ActiveRules {
  maxTradeRiskUsd: number | null; minRrr: number | null; dailyLossLimitUsd: number | null;
  enabledSessions: SessionKey[]; sessionsConfirmed: boolean;
  confirmed: Partial<Record<RuleKey, boolean>>;
  sources: Partial<Record<RuleKey, string>>;
}

export interface RiskCheckResult {
  risk: RiskResult;
  checks: { key: string; label: string; status: 'ok' | 'exceeds' | 'below' | 'reached' | 'unknown' | 'info'; detail: string; ruleSource?: string; unconfirmed?: boolean }[];
  maxContractsByRisk: number | null;
  dailyLossRemaining: number | null;
  tradesToday: number;
}

/** Pre-trade risk check against the ACTIVE profile. Trade count is informational only — it never blocks. */
export function checkRisk(input: RiskInput, rules: ActiveRules, today: { realizedNet: number | null; trades: number }): RiskCheckResult {
  const risk = computeRisk(input);
  const checks: RiskCheckResult['checks'] = [];
  const un = (k: RuleKey) => rules.confirmed[k] === false;
  if (rules.maxTradeRiskUsd == null) checks.push({ key: 'max_risk', label: 'Max risk per trade', status: 'unknown', detail: 'no active rule' });
  else if (risk.totalRiskUsd != null) checks.push({ key: 'max_risk', label: 'Max risk per trade', status: risk.totalRiskUsd > rules.maxTradeRiskUsd ? 'exceeds' : 'ok',
    detail: `$${risk.totalRiskUsd} vs limit $${rules.maxTradeRiskUsd}`, ruleSource: rules.sources.max_trade_risk_usd, unconfirmed: un('max_trade_risk_usd') });
  if (rules.minRrr == null) checks.push({ key: 'min_rrr', label: 'Minimum RRR', status: 'unknown', detail: 'no active rule' });
  else if (risk.rrr == null) checks.push({ key: 'min_rrr', label: 'Minimum RRR', status: 'unknown', detail: 'target not provided — RRR not computed', ruleSource: rules.sources.min_rrr });
  else checks.push({ key: 'min_rrr', label: 'Minimum RRR', status: risk.rrr < rules.minRrr ? 'below' : 'ok', detail: `${risk.rrr} vs minimum ${rules.minRrr}`, ruleSource: rules.sources.min_rrr, unconfirmed: un('min_rrr') });
  let remaining: number | null = null;
  if (rules.dailyLossLimitUsd == null) checks.push({ key: 'daily_loss', label: 'Daily loss limit', status: 'unknown', detail: 'no active rule' });
  else if (today.realizedNet == null) checks.push({ key: 'daily_loss', label: 'Daily loss limit', status: 'unknown', detail: "today's realized P&L unknown", ruleSource: rules.sources.daily_loss_limit_usd });
  else {
    remaining = round2(rules.dailyLossLimitUsd + Math.min(0, today.realizedNet));
    const st = remaining <= 0 ? 'reached' : risk.totalRiskUsd != null && risk.totalRiskUsd > remaining ? 'exceeds' : 'ok';
    checks.push({ key: 'daily_loss', label: 'Daily loss limit', status: st, detail: `today ${today.realizedNet >= 0 ? '+' : ''}${today.realizedNet}; remaining before limit $${remaining}${st === 'exceeds' ? ' — this trade risks more than what remains' : ''}`,
      ruleSource: rules.sources.daily_loss_limit_usd, unconfirmed: un('daily_loss_limit_usd') });
  }
  checks.push({ key: 'trade_count', label: 'Trades today', status: 'info', detail: `${today.trades} so far — tracked for analysis only; no count limit is enforced` });
  const per = risk.riskPerContract != null && input.quantity > 0 ? risk.riskPerContract + (risk.feesUsd ?? 0) / input.quantity + (risk.slippageUsd ?? 0) / input.quantity : null;
  const budget = rules.maxTradeRiskUsd != null ? Math.min(rules.maxTradeRiskUsd, remaining ?? Infinity) : null;
  return { risk, checks, maxContractsByRisk: per && budget != null && per > 0 ? Math.max(0, Math.floor(budget / per)) : null, dailyLossRemaining: remaining, tradesToday: today.trades };
}
