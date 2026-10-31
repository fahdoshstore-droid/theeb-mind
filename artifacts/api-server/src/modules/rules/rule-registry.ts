import type { UserLimits } from '../../config/user-limits.js';

// ── Types ──────────────────────────────────────────────

export interface RuleContext {
  tradesTaken: number;    // Today's trade count (already executed)
  riskAmount: number;     // Risk in dollars for this potential trade (0 if unknown)
  rrr: number;            // Risk:reward ratio (0 if unknown)
  dailyPnl: number;       // Today's cumulative realized PnL
  consecLosses: number;   // Consecutive losses streak
  dayOfWeek: number;      // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface RuleDefinition {
  id: string;
  name: string;             // Arabic name shown in UI
  nameEn: string;           // English id-friendly name
  profileKey: string;       // rule key in the user's rules profile
  severity: 'warning' | 'block';
  /** null when the rule is not ACTIVE in the user's profile → the rule is not evaluated. */
  threshold: (l: UserLimits) => number | readonly number[] | null;
  description: (l: UserLimits) => string;
  evaluate: (ctx: RuleContext, l: UserLimits) => boolean; // true = rule violated
}

// ── Registry ──────────────────────────────────────────
// Thresholds come from the user's active rules profile (Settings), never from constants.
// The daily trade-count rule only exists if the user activates it: by default it is historical and not enforced.

export const RULE_REGISTRY: RuleDefinition[] = [
  {
    id: 'max_trades', name: 'حد الصفقات اليومي', nameEn: 'Daily Trade Limit', profileKey: 'max_trades_per_day', severity: 'block',
    threshold: (l) => l.maxTradesPerDay,
    description: (l) => `تجاوزت الحد الأقصى (${l.maxTradesPerDay} صفقات) لهذا اليوم — قاعدة فعّلتها أنت`,
    evaluate: (ctx, l) => ctx.tradesTaken >= l.maxTradesPerDay!,
  },
  {
    id: 'min_rrr', name: 'نسبة المخاطرة/العائد', nameEn: 'Minimum RRR', profileKey: 'min_rrr', severity: 'block',
    threshold: (l) => l.minRrr,
    description: (l) => `نسبة المخاطرة/العائد أقل من ${l.minRrr}:1 المطلوبة`,
    evaluate: (ctx, l) => ctx.rrr > 0 && ctx.rrr < l.minRrr!,
  },
  {
    id: 'daily_loss_limit', name: 'حد الخسارة اليومية', nameEn: 'Daily Loss Limit', profileKey: 'daily_loss_limit_usd', severity: 'block',
    threshold: (l) => l.dailyLossLimitUsd,
    description: (l) => `وصلت إلى حد الخسارة اليومية (${l.dailyLossLimitUsd}$)`,
    evaluate: (ctx, l) => ctx.dailyPnl <= -l.dailyLossLimitUsd!,
  },
  {
    id: 'max_risk_per_trade', name: 'حد المخاطرة في الصفقة', nameEn: 'Max Risk Per Trade', profileKey: 'max_trade_risk_usd', severity: 'warning',
    threshold: (l) => l.maxRiskPerTradeUsd,
    description: (l) => `المخاطرة تتجاوز الحد الأقصى المسموح (${l.maxRiskPerTradeUsd}$)`,
    evaluate: (ctx, l) => ctx.riskAmount > 0 && ctx.riskAmount > l.maxRiskPerTradeUsd!,
  },
  {
    id: 'no_trade_day', name: 'يوم حظر التداول', nameEn: 'No-Trade Day', profileKey: 'no_trade_weekdays', severity: 'block',
    threshold: (l) => l.noTradeWeekdays,
    description: () => 'هذا يوم محظور للتداول وفق ملفك الشخصي',
    evaluate: (ctx, l) => l.noTradeWeekdays!.includes(ctx.dayOfWeek),
  },
  {
    id: 'consec_losses', name: 'سلسلة الخسائر المتتالية', nameEn: 'Consecutive Loss Limit', profileKey: 'stop_after_consecutive_losses', severity: 'block',
    threshold: (l) => l.consecutiveLossLimit,
    description: (l) => `تجاوزت حد الخسائر المتتالية (${l.consecutiveLossLimit})`,
    evaluate: (ctx, l) => ctx.consecLosses >= l.consecutiveLossLimit!,
  },
];
