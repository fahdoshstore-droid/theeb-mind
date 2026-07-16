// ============================================
// THEEB MIND — Trade Frequency Counter
// ============================================
// Standalone module for trade frequency analysis.
// Called by Safety Score engine and available
// independently for real-time monitoring.
// ============================================

import { db } from '../../db/db.js';
import { CONFIG } from '../../config/constants.js';
import { getCurrentKillzone } from '../../config/killzones.js';

// ── Types ──────────────────────────────────────────────

export interface TradeFrequencyResult {
  tradeCountToday: number;
  tradeCountThisSession: number;   // last 4 hours
  isPreMarket: boolean;
  isOvertrading: boolean;           // > CONFIG.MAX_TRADES
  isAggressiveOvertrading: boolean; // > 15
  penaltyPoints: number;
  timingScore: number;              // 0–100, drops if pre-market
  flags: string[];
  explanation: string;
}

// ── Pre-market detection ───────────────────────────────

const PRE_MARKET_START_UTC = 0;   // midnight UTC
const PRE_MARKET_END_UTC = 12;    // noon UTC (before NY open)

function isPreMarket(): boolean {
  const hour = new Date().getUTCHours();
  return hour >= PRE_MARKET_START_UTC && hour < PRE_MARKET_END_UTC;
}

// ── Engine ────────────────────────────────────────────

export function analyzeTradeFrequency(userId: string): TradeFrequencyResult {
  const flags: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  // Count today's trades from DB
  const todayDecisions = db.raw
    .prepare(
      `SELECT id, type, outcome FROM decisions
       WHERE user_id = ? AND date(created_at) = ?
       ORDER BY created_at DESC`,
    )
    .all(userId, today) as { id: string; type: string; outcome: string | null }[];

  const tradeCountToday = todayDecisions.filter(
    (d) => d.type === 'long' || d.type === 'short',
  ).length;

  // Count this session (last 4 hours)
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const sessionDecisions = db.raw
    .prepare(
      `SELECT id FROM decisions
       WHERE user_id = ? AND created_at >= ?
       AND type IN ('long', 'short')`,
    )
    .all(userId, fourHoursAgo) as { id: string }[];

  const tradeCountThisSession = sessionDecisions.length;

  // ── Pre-market check ──────────────────────────────────
  const preMarket = isPreMarket();
  let timingScore = 100;

  if (preMarket) {
    timingScore = 30; // aggressive drop
    flags.push('تداول قبل افتتاح السوق — التوقيت مخفض إلى 30%');
  }

  // Also check killzone
  const killzone = getCurrentKillzone();
  if (!killzone.isActive) {
    timingScore = Math.min(timingScore, 40);
    flags.push('خارج نافذة نشاط السوق — التوقيت مخفض');
  }

  // ── Overtrading detection ─────────────────────────────
  let penaltyPoints = 0;
  const isOvertrading = tradeCountToday > CONFIG.MAX_TRADES;
  const isAggressiveOvertrading = tradeCountToday > 15;

  if (isAggressiveOvertrading) {
    const excess = tradeCountToday - 15;
    penaltyPoints = Math.min(excess * 5, 60);
    flags.push(
      `تداول مفرط جداً: ${tradeCountToday} صفقة اليوم (>15) — عقوبة ${penaltyPoints} نقطة`,
    );
  } else if (isOvertrading) {
    const excess = tradeCountToday - CONFIG.MAX_TRADES;
    penaltyPoints = excess * 8;
    flags.push(
      `تجاوزت الحد اليومي (${CONFIG.MAX_TRADES}): ${tradeCountToday} صفقة — عقوبة ${penaltyPoints} نقطة`,
    );
  }

  // ── Explanation ───────────────────────────────────────
  const explanation = [
    `تحليل تردد التداول:`,
    `• صفقات اليوم: ${tradeCountToday} (الحد: ${CONFIG.MAX_TRADES})`,
    `• صفقات الجلسة (4 ساعات): ${tradeCountThisSession}`,
    `• التوقيت: ${preMarket ? 'قبل افتتاح السوق ⚠️' : killzone.isActive ? 'ضمن نافذة النشاط ✓' : 'خارج نافذة النشاط ⚠️'}`,
    `• عقوبة التردد: ${penaltyPoints} نقطة`,
    `• درجة التوقيت: ${timingScore}/100`,
    flags.length > 0 ? `\nتحذيرات:\n${flags.map((f) => `⚠️ ${f}`).join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    tradeCountToday,
    tradeCountThisSession,
    isPreMarket: preMarket,
    isOvertrading,
    isAggressiveOvertrading,
    penaltyPoints,
    timingScore,
    flags,
    explanation,
  };
}
