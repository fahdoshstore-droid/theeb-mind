// ============================================
// DHEEB MINDSET — TypeScript Type Definitions
// ============================================

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'NO_TRADE';
export type GateVerdict = 'GO' | 'CAUTION' | 'STOP';
export type KillzoneStatus = 'active' | 'inactive' | 'avoid';
export type MarketBias = 'bullish' | 'bearish' | 'neutral';
export type Outcome = 'win' | 'loss' | 'breakeven';
export type CredibilityLevel = 'موثوق' | 'يحتاج تحقق' | 'مضلل';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type Instrument = 'MNQ' | 'NQ' | 'ES' | 'Gold' | 'Oil' | 'Other';

export interface ConfluenceFactor {
  name: string;
  nameAr: string;
  present: boolean;
  weight: number;
  detail?: string;
}

export interface ScoringResult {
  grade: Grade;
  score: number;
  maxScore: number;
  confidence: number;
  confluence: ConfluenceFactor[];
  warnings: string[];
  gateVerdict: GateVerdict;
}

export interface AnalysisResult {
  decisionId: string;
  analysis: {
    marketBias: MarketBias;
    marketBiasAr: string;
    keyLevels: number[];
    narrative: string;
  };
  scoring: ScoringResult;
  coaching: {
    message: string;
    suggestions: string[];
  };
  killzone: {
    name: string;
    nameAr: string;
    status: KillzoneStatus;
  };
  timestamp: string;
}

export interface Claim {
  text: string;
  score: number;
  category: string;
  categoryAr: string;
  verified: boolean;
}

export interface ManipulationPattern {
  type: string;
  typeAr: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface VerificationResult {
  credibilityLevel: CredibilityLevel;
  trustScore: number;
  claims: Claim[];
  manipulationPatterns: ManipulationPattern[];
  summary: string;
  verdict: {
    title: string;
    explanation: string;
  };
}

export interface Decision {
  id: string;
  userId: string;
  type: 'chart_analysis' | 'content_verification';
  instrument?: string;
  timeframe?: Timeframe;
  scoring: ScoringResult;
  outcome?: Outcome;
  pnl?: number;
  createdAt: string;
}

export interface JournalEntry {
  decisions: Decision[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsResult {
  totalDecisions: number;
  winRate: number;
  averageConfluence: number;
  bestKillzone: string;
  bestKillzoneAr: string;
  gradeDistribution: Record<Grade, number>;
  improvementTimeline: Array<{
    date: string;
    averageScore: number;
  }>;
}

export interface PsychologyState {
  userId: string;
  emotionalState: string;
  emotionalStateAr: string;
  confidence: number;
  riskTolerance: 'low' | 'medium' | 'high';
  recentCheckin: string;
  recommendations: string[];
}

export interface GateQuestion {
  id: string;
  question: string;
  questionAr: string;
  category: string;
  options: Array<{
    value: string;
    label: string;
    labelAr: string;
  }>;
}

export interface GateAnswer {
  questionId: string;
  answer: string;
}

export interface GateResult {
  verdict: GateVerdict;
  score: number;
  message: string;
  messageAr: string;
  details: string[];
}

export interface ManualAnalysisRequest {
  instrument: Instrument;
  timeframe: Timeframe;
  answers: Record<string, string>;
}

// ── Performance Intelligence ───────────────────────────

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

export interface QualityTrendPoint {
  date: string;
  avgScore: number;
  count: number;
}

export interface KillzoneStat {
  killzone: string;
  wins: number;
  losses: number;
  breakevens: number;
  total: number;
}

// ── Rule Enforcement Engine ────────────────────────────

export interface RuleContext {
  tradesTaken: number;
  riskAmount: number;
  rrr: number;
  dailyPnl: number;
  consecLosses: number;
  dayOfWeek: number;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'block';
  description: string;
}

export interface RuleEvaluateResult {
  violations: RuleViolation[];
  blocked: boolean;
  warnings: string[];
}

export interface RuleViolationRecord {
  id: number;
  user_id: string;
  rule_id: string;
  rule_name: string;
  severity: 'warning' | 'block';
  context_json: string;
  created_at: string;
  /** Total number of times this rule has been violated by this user (all time) */
  totalOccurrences: number;
}

export interface RuleConfig {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  threshold: number | number[];
  severity: 'warning' | 'block';
}

// ── Memory Engine ──────────────────────────────────────

export interface FailurePattern {
  id: number;
  user_id: string;
  pattern_key: string;
  hit_count: number;
  last_seen: string;
  notes: string | null;
  total_trades: number;
}

export interface MemoryContext {
  sameSetupCount: number;
  sameSetupLosses: number;
  sameSetupWins: number;
  lossRate: number;
  failurePattern: FailurePattern | null;
  patternKey: string;
}

// ── Unified Decision Quality Engine ───────────────────

export interface UnifiedQualityBreakdown {
  confluence:  { score: number; normalized: number; weight: number };
  psychology:  { score: number; normalized: number; weight: number };
  quality:     { score: number; normalized: number; weight: number };
  safety:      { score: number; normalized: number; weight: number };
  ahaPenalty:  number;
}

export interface UnifiedQualityResult {
  composite_score: number;
  grade: 'A+' | 'A' | 'B' | 'C';
  confidence: number;
  breakdown: UnifiedQualityBreakdown;
  verdict: 'EXECUTE' | 'REVIEW' | 'REJECT';
  flags: string[];
  explanation: string;
}

export interface QualityEvaluation {
  id: string;
  user_id: string;
  decision_id: string | null;
  composite_score: number;
  grade: 'A+' | 'A' | 'B' | 'C';
  confidence: number;
  breakdown_json: string;
  flags_json: string;
  created_at: string;
}

// ── Trade Intelligence Module ──────────────────────────

export interface SignatureAggregate {
  type: string;
  typeAr: string;
  hitCount: number;
  totalChecked: number;
  avgLossRate: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface HeatmapCell {
  instrument: string;
  timeframe: string;
  winRate: number;
  totalTrades: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface TopPattern {
  patternKey: string;
  hitCount: number;
  instrument: string;
  timeframe: string;
  killzone: string;
  grade: string;
}

export interface PatternSummary {
  signatures: SignatureAggregate[];
  dangerZones: SignatureAggregate[];
  heatmap: HeatmapCell[];
  topFailurePatterns: TopPattern[];
  computedAt: string;
}

export interface TrendPoint {
  decisionId: string;
  score: number;
  grade: string;
  createdAt: string;
  instrument: string;
}

export interface TrendSummary {
  qualityTrend: TrendPoint[];
  gradeDistribution: Record<string, number>;
  bestInstrument: string | null;
  worstInstrument: string | null;
  averageScore: number;
  computedAt: string;
}

export interface FailureSignature {
  type: string;
  typeAr: string;
  matched: boolean;
  weight: number;
  evidence: string;
  pastOccurrences: number;
  lossRate: number;
}

export interface AHAMomentResult {
  similarityPercent: number;
  signatures: FailureSignature[];
  hook: string;
  explanation: string;
}

// ── Market Intelligence ───────────────────────────────────────────────────────

export interface MarketSnapshot {
  id: string;
  instrument: string;
  metric: string;
  value: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  note?: string;
  createdAt: string;
}

/** Live price tick from free public APIs (Binance + ECB via backend) */
export interface LiveTick {
  symbol: string;
  labelAr: string;
  price: number;
  changePct: number | null;
  direction: 'bullish' | 'bearish' | 'neutral';
  source: 'Binance' | 'ECB' | 'CoinGecko';
  updatedAt: string;
}

export interface EconomicEvent {
  id: string;
  title: string;
  titleAr?: string;
  impact: 'high' | 'medium' | 'low';
  eventDate: string;
  currency: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

export interface WeeklyBias {
  id: string;
  userId: string;
  instrument: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  weekKey: string;
  notes?: string;
}

export interface MacroNarrative {
  id: string;
  userId: string;
  narrativeText: string;
  weekKey: string;
  createdAt: string;
}

export interface MarketOverview {
  snapshots: MarketSnapshot[];
  events: EconomicEvent[];
  weekBias: WeeklyBias[];
  narrative: MacroNarrative | null;
  weekKey: string;
}

export interface TradeFingerprint {
  decisionId: string;
  ahaResult: AHAMomentResult;
  decision: {
    instrument: string;
    timeframe: string;
    grade: string;
    createdAt: string;
    type: string;
  };
}