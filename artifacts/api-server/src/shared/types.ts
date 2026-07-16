export type DecisionType = 'long' | 'short' | 'no_trade';
export type Outcome = 'win' | 'loss' | 'breakeven' | 'cancelled' | null;
export type Grade = 'A+' | 'A' | 'B' | 'C';
export type Credibility = 'credible' | 'suspicious' | 'rejected';

export interface Killzone {
  key: string;
  label: string;
  start: number;
  end: number;
}

export interface ConfluenceBreakdown {
  marketStructure: boolean;
  fairValueGap: boolean;
  orderBlock: boolean;
  liquiditySweep: boolean;
  killzoneActive: boolean;
  immediateRebalance: boolean;
}

export interface ScoringResult {
  confluenceScore: number;
  confluenceGrade: Grade;
  confluenceBreakdown: ConfluenceBreakdown;
  confluenceExplanation: string;
  qualityScore: number;
  qualityGrade: Grade;
  qualityExplanation: string;
  rrr: number;
  rrrPass: boolean;
}

export interface PsychologySnapshot {
  phase: string;
  score: number;
  maxScore: number;
  percentage: number;
  verdict: 'pass' | 'fail' | 'warning';
  answers: GateAnswer[];
  behavioralLock: boolean;
  lockReason: string | null;
}

export interface GateAnswer {
  questionId: number;
  question: string;
  selectedOption: number;
  score: number;
  isBlocker: boolean;
}

export interface GateVerdict {
  pass: boolean;
  score: number;
  maxScore: number;
  percentage: number;
  phase: string;
  blockers: number[];
  behavioralLock: boolean;
  lockReason: string | null;
}

export interface Claim {
  text: string;
  category: 'price_action' | 'pattern' | 'fundamental' | 'sentiment' | 'manipulation';
  confidence: number;
}

export interface VerificationResult {
  credibility: Credibility;
  credibilityScore: number;
  claimsCount: number;
  verifiedClaims: number;
  rejectedClaims: number;
  manipulationFlags: string[];
  verdict: string;
  explanation: string;
  claims?: Claim[];
}

export interface QualityScoreResult {
  totalScore: number;
  grade: Grade;
  components: {
    confluence: { weight: number; raw: number; weighted: number };
    gate: { weight: number; raw: number; weighted: number };
    rrr: { weight: number; raw: number; weighted: number };
    timing: { weight: number; raw: number; weighted: number };
    alignment: { weight: number; raw: number; weighted: number };
  };
  explanation: string;
}

export interface AnalysisResult {
  decisionId: string;
  type: DecisionType;
  instrument: string;
  timeframe: string;
  confluence: ScoringResult;
  psychology: PsychologySnapshot;
  quality: QualityScoreResult;
  coachingMessage: string;
  verification: VerificationResult | null;
  killzone: Killzone | null;
  dayBlocked: boolean;
  newsBlackout: boolean;
  timestamp: string;
  safetyScore?: number;
  safetyGrade?: Grade;
  safetyExplanation?: string;
  tradeFrequency?: {
    tradeCountToday: number;
    isPreMarket: boolean;
    isOvertrading: boolean;
    isAggressiveOvertrading: boolean;
    penaltyPoints: number;
    timingScore: number;
  };
  ahaMoment?: {
    similarityPercent: number;
    hook: string;
  };
}

export interface Decision {
  id: string;
  userId: string;
  type: DecisionType;
  createdAt: string;
  imageHash: string | null;
  timeframe: string;
  instrument: string;
  analysisJson: string | null;
  scoringJson: string | null;
  psychologyJson: string | null;
  riskJson: string | null;
  coachingJson: string | null;
  qualityScore: number;
  grade: Grade;
  outcome: Outcome;
  outcomePnl: number | null;
  outcomeNotes: string | null;
  outcomeAt: string | null;
  killzone: string | null;
  dayBlocked: boolean;
  newsBlackout: boolean;
  version: number;
}

export interface JournalEntry {
  id?: string;
  decisionId: string;
  userId: string;
  notes: string;
  emotions: string[];
  lessons: string[];
  createdAt?: string;
}

export interface AuditEvent {
  id?: string;
  userId: string;
  eventType: string;
  eventData: string;
  createdAt?: string;
}