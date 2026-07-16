import { CONFIG } from '../../config/constants.js';

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
  description: string;      // Arabic description of the violation
  threshold: number | readonly number[];
  severity: 'warning' | 'block';
  evaluate: (ctx: RuleContext) => boolean; // true = rule violated
}

// ── Registry ──────────────────────────────────────────

export const RULE_REGISTRY: RuleDefinition[] = [
  {
    id: 'max_trades',
    name: 'حد الصفقات اليومي',
    nameEn: 'Daily Trade Limit',
    description: `تجاوزت الحد الأقصى (${CONFIG.MAX_TRADES} صفقات) لهذا اليوم`,
    threshold: CONFIG.MAX_TRADES,
    severity: 'block',
    evaluate: (ctx) => ctx.tradesTaken >= CONFIG.MAX_TRADES,
  },
  {
    id: 'min_rrr',
    name: 'نسبة المخاطرة/العائد',
    nameEn: 'Minimum RRR',
    description: `نسبة المخاطرة/العائد أقل من ${CONFIG.MIN_RRR}:1 المطلوبة`,
    threshold: CONFIG.MIN_RRR,
    severity: 'block',
    evaluate: (ctx) => ctx.rrr > 0 && ctx.rrr < CONFIG.MIN_RRR,
  },
  {
    id: 'daily_loss_limit',
    name: 'حد الخسارة اليومية',
    nameEn: 'Daily Loss Limit',
    description: `وصلت إلى حد الخسارة اليومية (${CONFIG.DAILY_LOSS_LIMIT}$)`,
    threshold: CONFIG.DAILY_LOSS_LIMIT,
    severity: 'block',
    evaluate: (ctx) => ctx.dailyPnl <= -CONFIG.DAILY_LOSS_LIMIT,
  },
  {
    id: 'max_risk_per_trade',
    name: 'حد المخاطرة في الصفقة',
    nameEn: 'Max Risk Per Trade',
    description: `المخاطرة (${CONFIG.MAX_RISK_PER_TRADE}$) تتجاوز الحد الأقصى المسموح`,
    threshold: CONFIG.MAX_RISK_PER_TRADE,
    severity: 'warning',
    evaluate: (ctx) => ctx.riskAmount > 0 && ctx.riskAmount > CONFIG.MAX_RISK_PER_TRADE,
  },
  {
    id: 'no_trade_day',
    name: 'يوم حظر التداول',
    nameEn: 'No-Trade Day',
    description: 'هذا يوم محظور للتداول وفق الدستور',
    threshold: CONFIG.NO_TRADE_DAYS as unknown as number,
    severity: 'block',
    evaluate: (ctx) => (CONFIG.NO_TRADE_DAYS as readonly number[]).includes(ctx.dayOfWeek),
  },
  {
    id: 'consec_losses',
    name: 'سلسلة الخسائر المتتالية',
    nameEn: 'Consecutive Loss Limit',
    description: `تجاوزت حد الخسائر المتتالية (${CONFIG.CONSEC_LOSS_LIMIT})`,
    threshold: CONFIG.CONSEC_LOSS_LIMIT,
    severity: 'block',
    evaluate: (ctx) => ctx.consecLosses >= CONFIG.CONSEC_LOSS_LIMIT,
  },
];
