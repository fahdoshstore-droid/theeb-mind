// ============================================
// DHEEB MINDSET — API Client (Real Backend)
// ============================================
import type {
  AnalysisResult,
  VerificationResult,
  JournalEntry,
  AnalyticsResult,
  PsychologyState,
  GateResult,
  GateAnswer,
  Outcome,
  Timeframe,
  Instrument,
  ManualAnalysisRequest,
  Decision,
  PerformanceSummary,
  EquityPoint,
  DrawdownResult,
  InstrumentStat,
  PsychCorrelation,
  KillzoneStat,
} from './types';

import {
  adaptAnalysisResult,
  adaptVerificationResult,
  adaptJournal,
  adaptAnalytics,
  adaptPsychologyState,
  adaptGateResult,
} from './adapters';

// ── Demo Mode Flag ──
export const USE_DEMO_MODE = false;

// ── Constants ──
const API_BASE = '/api';
const USER_ID = 'user-1';

// ── Helpers ──

/** Unwrap backend { success, data } envelope */
async function requestUnwrapped<T>(url: string, options?: RequestInit): Promise<T> {
  const merged: RequestInit = {
    ...options,
    headers: {
      'X-Api-Key': 'user-1_devkey',
      ...(options?.headers as Record<string, string> | undefined),
    },
  };
  const res = await fetch(`${API_BASE}${url}`, merged);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`خطأ في الخادم (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'فشل الطلب');
  }
  return json.data as T;
}

/** Convert a File to base64 string (strips data: prefix) */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

// ── Natural progress simulation (fast start, slow middle, fast end) ──
export function createProgressSimulator(
  onProgress: (pct: number) => void,
  duration = 2000,
): { start: () => void; cancel: () => void } {
  let rafId = 0;
  let startTime = 0;

  function start() {
    startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const linearPct = Math.min(elapsed / duration, 1);
      let pct: number;
      if (linearPct < 0.3) {
        pct = (linearPct / 0.3) * 45;
      } else if (linearPct < 0.7) {
        pct = 45 + ((linearPct - 0.3) / 0.4) * 30;
      } else {
        pct = 75 + ((linearPct - 0.7) / 0.3) * 25;
      }
      onProgress(pct);
      if (linearPct < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function cancel() {
    cancelAnimationFrame(rafId);
  }

  return { start, cancel };
}

// ── Chart Analysis ──────────────────────────────────────

export async function analyzeChart(
  image: File,
  timeframe: Timeframe,
  instrument: Instrument,
): Promise<AnalysisResult> {
  const base64 = await fileToBase64(image);
  const raw = await requestUnwrapped<any>('/decision/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      imageBase64: base64,
      instrument,
      timeframe,
    }),
  });
  return adaptAnalysisResult(raw);
}

// ── Manual / Fallback Analysis ─────────────────────────

export async function submitManualAnalysis(
  data: ManualAnalysisRequest,
): Promise<AnalysisResult> {
  // Map frontend question answers (Record<string, string>) to backend boolean fields
  // Frontend answers: { q1: 'نعم'|'لا'|'غير متأكد', q2: ..., q3: ..., q6: ... }
  // Backend expects: { marketStructure, fairValueGap, orderBlock, liquiditySweep, immediateRebalance, killzoneActive }
  const ans = data.answers ?? {};
  const toBool = (key: string): boolean => ans[key] === 'نعم';

  const raw = await requestUnwrapped<any>('/decision/fallback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      instrument: data.instrument,
      timeframe: data.timeframe,
      marketStructure: toBool('q1'),
      fairValueGap: toBool('q2'),
      orderBlock: toBool('q4'),
      liquiditySweep: toBool('q3'),
      immediateRebalance: toBool('q5'),
      killzoneActive: toBool('q6'),
    }),
  });
  return adaptAnalysisResult(raw);
}

// ── Content Verification ────────────────────────────────

export async function verifyContent(text: string): Promise<VerificationResult> {
  const raw = await requestUnwrapped<any>('/verify/content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      content: text,
    }),
  });
  return adaptVerificationResult(raw);
}

// ── Journal ─────────────────────────────────────────────

export async function getJournal(_userId: string): Promise<JournalEntry> {
  const raw = await requestUnwrapped<any>(`/journal/${_userId}`);
  return adaptJournal(raw);
}

export async function recordOutcome(
  decisionId: string,
  outcome: Outcome,
  pnl?: number,
): Promise<Decision> {
  const raw = await requestUnwrapped<any>(`/journal/${decisionId}/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome, pnl }),
  });
  // Caller (Journal.tsx) ignores return value — calls loadData() after
  return { id: raw.decisionId ?? decisionId } as Decision;
}

export async function getAnalytics(_userId: string): Promise<AnalyticsResult> {
  const raw = await requestUnwrapped<any>(`/journal/${_userId}/analytics?userId=${_userId}`);
  return adaptAnalytics(raw);
}

// ── Psychology ──────────────────────────────────────────

export async function getPsychologyState(_userId: string): Promise<PsychologyState> {
  const raw = await requestUnwrapped<any>(`/psychology/state/${_userId}`);
  return adaptPsychologyState(raw);
}

// ── Decision Gate ───────────────────────────────────────

export async function submitGate(answers: GateAnswer[]): Promise<GateResult> {
  // Map frontend GateAnswer (string questionId, string answer) to backend format
  const mapped = answers.map((a) => {
    const numId = parseInt(a.questionId.replace(/^q/, ''), 10);
    const optionIdx =
      a.answer === 'نعم' ? 0 : a.answer === 'لا' ? 1 : 2;
    return { questionId: numId, selectedOption: optionIdx };
  });

  const raw = await requestUnwrapped<any>('/psychology/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: USER_ID,
      answers: mapped,
    }),
  });
  return adaptGateResult(raw);
}

// ── Performance Intelligence ─────────────────────────────

export async function getPerformanceSummary(userId: string): Promise<PerformanceSummary> {
  return requestUnwrapped<PerformanceSummary>(`/performance/summary/${userId}`);
}

export async function getEquityCurve(userId: string): Promise<EquityPoint[]> {
  return requestUnwrapped<EquityPoint[]>(`/performance/equity/${userId}`);
}

export async function getDrawdown(userId: string): Promise<DrawdownResult> {
  return requestUnwrapped<DrawdownResult>(`/performance/drawdown/${userId}`);
}

export async function getInstrumentBreakdown(userId: string): Promise<InstrumentStat[]> {
  return requestUnwrapped<InstrumentStat[]>(`/performance/instruments/${userId}`);
}

export async function getPsychCorrelation(userId: string): Promise<PsychCorrelation> {
  return requestUnwrapped<PsychCorrelation>(`/performance/psychology-correlation/${userId}`);
}

export async function getQualityTrend(userId: string): Promise<import('./types').QualityTrendPoint[]> {
  return requestUnwrapped<import('./types').QualityTrendPoint[]>(`/performance/quality-trend/${userId}`);
}

export async function getTimeAnalysis(userId: string): Promise<KillzoneStat[]> {
  return requestUnwrapped<KillzoneStat[]>(`/performance/time-analysis/${userId}`);
}

// ── Rule Enforcement Engine ──────────────────────────

export async function evaluateRules(context: {
  tradesTaken: number;
  riskAmount: number;
  rrr: number;
  dailyPnl: number;
  consecLosses: number;
  dayOfWeek: number;
}): Promise<import('./types').RuleEvaluateResult> {
  return requestUnwrapped<import('./types').RuleEvaluateResult>('/rules/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });
}

export async function getRuleViolations(userId: string, limit = 50): Promise<import('./types').RuleViolationRecord[]> {
  return requestUnwrapped<import('./types').RuleViolationRecord[]>(`/rules/violations/${userId}?limit=${limit}`);
}

export async function getRuleConfig(): Promise<import('./types').RuleConfig[]> {
  return requestUnwrapped<import('./types').RuleConfig[]>('/rules/config');
}

// ── Unified Decision Quality Engine ───────────────────

export async function evaluateQuality(
  input: {
    marketStructure: boolean; fairValueGap: boolean; orderBlock: boolean;
    liquiditySweep: boolean; killzoneActive: boolean; immediateRebalance: boolean;
    gatePercentage: number; gateVerdict: 'pass' | 'fail' | 'warning';
    behavioralLock: boolean; psychPhase: string;
    rrr: number; rrrPass: boolean; riskAmount?: number;
    tradeCountToday: number; isPreMarket: boolean; consecutiveLosses: number; isNoTradeDay: boolean;
    alignmentScore: number; ahaSimilarityPercent?: number;
  },
): Promise<import('./types').UnifiedQualityResult> {
  return requestUnwrapped<import('./types').UnifiedQualityResult>('/quality/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function getQualityHistory(userId: string, limit = 100): Promise<import('./types').QualityEvaluation[]> {
  return requestUnwrapped<import('./types').QualityEvaluation[]>(`/quality/history/${userId}?limit=${limit}`);
}

// ── Memory Engine ─────────────────────────────────────

export async function getFailurePatterns(userId: string, limit = 10): Promise<import('./types').FailurePattern[]> {
  return requestUnwrapped<import('./types').FailurePattern[]>(`/memory/patterns/${userId}?limit=${limit}`);
}

export async function getMemoryContext(
  userId: string,
  params: { instrument: string; timeframe: string; killzone?: string; grade?: string },
): Promise<import('./types').MemoryContext> {
  const qs = new URLSearchParams({ instrument: params.instrument, timeframe: params.timeframe });
  if (params.killzone) qs.set('killzone', params.killzone);
  if (params.grade) qs.set('grade', params.grade);
  return requestUnwrapped<import('./types').MemoryContext>(`/memory/context/${userId}?${qs.toString()}`);
}

export async function backfillMemory(userId: string): Promise<{ inserted: number }> {
  return requestUnwrapped<{ inserted: number }>(`/memory/backfill/${userId}`, { method: 'POST' });
}

// ── Trade Intelligence Module ──────────────────────────

export async function getIntelligencePatterns(userId: string): Promise<import('./types').PatternSummary> {
  return requestUnwrapped<import('./types').PatternSummary>(`/intelligence/patterns/${userId}`);
}

export async function getIntelligenceTrends(userId: string): Promise<import('./types').TrendSummary> {
  return requestUnwrapped<import('./types').TrendSummary>(`/intelligence/trends/${userId}`);
}

export async function getTradeFingerprint(decisionId: string, userId: string): Promise<import('./types').TradeFingerprint> {
  return requestUnwrapped<import('./types').TradeFingerprint>(`/intelligence/fingerprint/${decisionId}?userId=${userId}`);
}

// ── Market Intelligence Module ─────────────────────────

/** Returns latest snapshot per instrument */
export async function getMarketSnapshots(): Promise<import('./types').MarketSnapshot[]> {
  return requestUnwrapped<import('./types').MarketSnapshot[]>('/market/snapshots');
}

export async function getLiveMarket(): Promise<import('./types').LiveTick[]> {
  return requestUnwrapped<import('./types').LiveTick[]>('/market/live');
}

export async function updateMarketSnapshot(payload: {
  instrument: string; metric: string; value: number;
  direction: 'bullish' | 'bearish' | 'neutral'; note?: string;
}): Promise<import('./types').MarketSnapshot> {
  return requestUnwrapped<import('./types').MarketSnapshot>('/market/snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getEconomicEvents(): Promise<import('./types').EconomicEvent[]> {
  return requestUnwrapped<import('./types').EconomicEvent[]>('/market/events');
}

/** Returns this week's bias entries for the user */
export async function getWeeklyBias(userId: string): Promise<import('./types').WeeklyBias[]> {
  return requestUnwrapped<import('./types').WeeklyBias[]>(`/market/bias/${userId}`);
}

export async function setWeeklyBias(
  userId: string,
  payload: { instrument: string; bias: 'bullish' | 'bearish' | 'neutral'; notes?: string }
): Promise<void> {
  await requestUnwrapped<unknown>(`/market/bias/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Returns this week's macro narrative, or null if not set */
export async function getMacroNarrative(userId: string): Promise<import('./types').MacroNarrative | null> {
  return requestUnwrapped<import('./types').MacroNarrative | null>(`/market/narrative/${userId}`);
}

export async function setMacroNarrative(userId: string, narrativeText: string): Promise<import('./types').MacroNarrative> {
  return requestUnwrapped<import('./types').MacroNarrative>(`/market/narrative/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ narrativeText }),
  });
}

// ── COT Data (real CFTC) ───────────────────────────────────

export interface CotRow {
  instrument: string;
  netLong: number;
  change: number;
  bias: 'bullish' | 'bearish' | 'neutral';
  reportDate: string;
}

export async function getCotData(): Promise<CotRow[]> {
  return requestUnwrapped<CotRow[]>('/market/cot');
}

// ── Re-export demo data for sample text ──
export { DEMO_MISLEADING_TEXT } from './demo-data';
