export interface JournalEntry {
  id: string;
  decisionId: string;
  userId: string;
  notes: string;
  emotions: string[];
  lessons: string[];
  createdAt: string;
}

export interface JournalAnalytics {
  totalTrades: number;
  winRate: number;
  avgConfluence: number;
  bestKillzone: string | null;
  totalPnl: number;
  gradeDistribution: Record<string, number>;
  recentPattern: string | null;
}

export interface OutcomeInput {
  decisionId: string;
  userId: string;         // Required to verify decision ownership before update
  outcome: 'win' | 'loss' | 'breakeven' | 'cancelled';
  pnl?: number;
  notes?: string;
}