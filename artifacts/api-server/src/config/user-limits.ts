// Per-user limits for the legacy decision/scoring modules, read from the user's ACTIVE rules profile.
// Replaces the hard-coded MAX_TRADES / MIN_RRR / DAILY_LOSS_LIMIT / NO_TRADE_DAYS / CONSEC_LOSS_LIMIT
// constants. A rule that is not active (historical / observation / disabled) is null and is not enforced.
import { db } from '../db/db.js';
import { activeRules, ensureSeeded } from '../modules/ledger/profile.service.js';

export interface UserLimits {
  minRrr: number | null;
  dailyLossLimitUsd: number | null;
  maxRiskPerTradeUsd: number | null;
  maxTradesPerDay: number | null;          // null unless the user activated it — trade count never blocks by default
  noTradeWeekdays: number[] | null;
  consecutiveLossLimit: number | null;
}

export function getUserLimits(userId: string): UserLimits {
  ensureSeeded(userId);
  const a = activeRules(userId);
  const active = (key: string): unknown => {
    const r = db.raw.prepare("SELECT value_json FROM risk_rules WHERE user_id = ? AND rule_key = ? AND status = 'active'").get(userId, key) as { value_json: string } | undefined;
    return r ? JSON.parse(r.value_json) : null;
  };
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  return {
    minRrr: a.minRrr, dailyLossLimitUsd: a.dailyLossLimitUsd, maxRiskPerTradeUsd: a.maxTradeRiskUsd,
    maxTradesPerDay: n(active('max_trades_per_day')),
    noTradeWeekdays: Array.isArray(active('no_trade_weekdays')) ? (active('no_trade_weekdays') as number[]) : null,
    consecutiveLossLimit: n(active('stop_after_consecutive_losses')),
  };
}
