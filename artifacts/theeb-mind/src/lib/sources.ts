// ============================================================
// Market Desk — source and integration registry
// The approved source matrix, written down once. The UI reads the
// integration stage from here and never infers it.
//
// Stages: SELECTED → AVAILABLE → CONNECTED → VERIFIED
//   AVAILABLE "reported" = reported available through Hermes, not
//   verified from the app. CONNECTED = THEEB MIND's own code calls it.
//   VERIFIED is a runtime result (e.g. COT status VERIFIED), never static.
// ============================================================

export type IntegrationStage = 'NOT_APPROVED' | 'NOT_SELECTED' | 'SELECTED' | 'AVAILABLE' | 'CONNECTED';

export interface SourceEntry {
  key: string;
  label: string;
  source: string | null;
  stage: IntegrationStage;
  availableReported?: boolean;
  note: string;
}

export const SOURCES: Record<string, SourceEntry> = {
  nqChart: { key: 'nqChart', label: 'NQ chart (display)', source: 'TradingView widget', stage: 'CONNECTED',
    note: 'Display only. The widget does not supply data to the app and cannot show TRIL marks.' },
  nqOhlc: { key: 'nqOhlc', label: 'NQ OHLC', source: 'TradingView MCP', stage: 'SELECTED', availableReported: true,
    note: 'Not connected to the app in this phase.' },
  us02y: { key: 'us02y', label: 'US02Y', source: 'TradingView MCP', stage: 'SELECTED', availableReported: true, note: 'Not connected to the app in this phase.' },
  us10y: { key: 'us10y', label: 'US10Y', source: 'TradingView MCP', stage: 'SELECTED', availableReported: true, note: 'Not connected to the app in this phase.' },
  us30y: { key: 'us30y', label: 'US30Y', source: null, stage: 'NOT_APPROVED', note: 'Not approved as a live feed until verified.' },
  cotPrimary: { key: 'cotPrimary', label: 'COT', source: 'MarketBulls', stage: 'CONNECTED', note: 'Primary source for Legacy COT (NASDAQ-100).' },
  cotValidation: { key: 'cotValidation', label: 'COT validation', source: 'CFTC', stage: 'CONNECTED', note: 'Independent validation (Legacy, futures only, contract 209742).' },
  seasonality: { key: 'seasonality', label: 'Seasonality', source: 'MarketBulls', stage: 'SELECTED', note: 'Out of this implementation phase.' },
  calendar: { key: 'calendar', label: 'Economic calendar', source: 'TradingView MCP', stage: 'SELECTED', availableReported: true, note: 'Out of this implementation phase.' },
  news: { key: 'news', label: 'News', source: 'TradingView MCP', stage: 'SELECTED', availableReported: true, note: 'Out of this implementation phase.' },
  ipda: { key: 'ipda', label: 'IPDA', source: 'Calculated from NQ history', stage: 'NOT_APPROVED', note: 'Methodology not approved.' },
  dxy: { key: 'dxy', label: 'DXY', source: null, stage: 'NOT_SELECTED', note: 'No approved source.' },
  vix: { key: 'vix', label: 'VIX', source: null, stage: 'NOT_SELECTED', note: 'No approved source.' },
  otherMarkets: { key: 'otherMarkets', label: 'BTC · ETH · XAU · EUR/USD', source: 'Binance → CoinGecko · ECB', stage: 'CONNECTED',
    note: 'Existing integration, kept as it is.' },
};

export const STAGE_LABEL: Record<IntegrationStage, string> = {
  NOT_APPROVED: 'NOT APPROVED',
  NOT_SELECTED: 'NO SOURCE',
  SELECTED: 'SELECTED',
  AVAILABLE: 'AVAILABLE',
  CONNECTED: 'CONNECTED',
};

/** Number of filled pips out of 4 (selected, available, connected, verified). */
export function stagePips(e: SourceEntry, verified = false): { filled: number; reported: boolean } {
  if (e.stage === 'NOT_APPROVED' || e.stage === 'NOT_SELECTED') return { filled: 0, reported: false };
  if (verified) return { filled: 4, reported: false };
  if (e.stage === 'CONNECTED') return { filled: 3, reported: false };
  if (e.stage === 'AVAILABLE') return { filled: 2, reported: false };
  return { filled: 1, reported: !!e.availableReported };
}
