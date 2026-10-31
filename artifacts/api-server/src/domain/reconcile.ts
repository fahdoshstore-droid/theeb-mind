// Reconciliation: a reported snapshot (e.g. a TradeZella summary) vs the imported ledger, and
// internal consistency checks of the snapshot itself. Discrepancies are shown, never explained away.
import { round2 } from './pnl.js';
import type { LedgerTrade } from './analytics.js';

export interface ReportedMetrics {
  trades?: number; netPnl?: number; wins?: number; losses?: number; breakeven?: number; open?: number;
  winRatePct?: number; avgWin?: number; avgLoss?: number; bestTrade?: number; worstTrade?: number;
  bySymbol?: Record<string, { trades?: number; winRatePct?: number; netPnl?: number }>;
  bySide?: Record<string, { trades?: number; netPnl?: number }>;
}

export interface Check { key: string; label: string; reported: number | null; computed: number | null; diff: number | null; status: 'match' | 'mismatch' | 'not_comparable'; note?: string }

const cmp = (key: string, label: string, reported: number | undefined | null, computed: number | null, tol = 0.01, note?: string): Check => {
  if (reported == null || computed == null) return { key, label, reported: reported ?? null, computed, diff: null, status: 'not_comparable', note };
  const diff = round2(computed - reported);
  return { key, label, reported, computed, diff, status: Math.abs(diff) <= tol ? 'match' : 'mismatch', note };
};

/** Arithmetic consistency of the report with itself. */
export function snapshotInternalChecks(m: ReportedMetrics): Check[] {
  const out: Check[] = [];
  if (m.wins != null && m.losses != null) {
    const parts = m.wins + m.losses + (m.breakeven ?? 0) + (m.open ?? 0);
    out.push(cmp('count_sum', 'wins + losses + breakeven + open = trades', m.trades, parts, 0));
    out.push(cmp('win_rate', 'win rate = wins ÷ (wins + losses)', m.winRatePct, Math.round((m.wins / (m.wins + m.losses)) * 10000) / 100, 0.01));
    if (m.avgWin != null && m.avgLoss != null)
      out.push(cmp('avg_x_count', 'avg win × wins + avg loss × losses = net P&L', m.netPnl, round2(m.avgWin * m.wins + m.avgLoss * m.losses), 0.5,
        'If this mismatches, the averages and the net are not computed on the same basis (e.g. gross vs net, fees, or which trades are included). The cause is not guessed here.'));
  }
  if (m.bySide) {
    const vals = Object.values(m.bySide);
    if (vals.every((v) => v.netPnl != null)) out.push(cmp('side_net_sum', 'Σ net by side = net P&L', m.netPnl, round2(vals.reduce((s, v) => s + v.netPnl!, 0))));
    if (vals.every((v) => v.trades != null)) out.push(cmp('side_count_sum', 'Σ trades by side = trades', m.trades, vals.reduce((s, v) => s + v.trades!, 0), 0));
  }
  if (m.bySymbol) {
    const vals = Object.values(m.bySymbol);
    const nKnown = vals.filter((v) => v.trades != null).reduce((s, v) => s + v.trades!, 0);
    const netKnown = round2(vals.filter((v) => v.netPnl != null).reduce((s, v) => s + v.netPnl!, 0));
    if (m.trades != null && nKnown !== m.trades) out.push({ key: 'symbol_count_gap', label: 'trades not covered by the listed symbols', reported: m.trades, computed: nKnown, diff: nKnown - m.trades, status: 'not_comparable',
      note: `${m.trades - nKnown} trades belong to symbols whose detail was not provided (implied residual net ${m.netPnl != null ? round2(m.netPnl - netKnown) : 'unknown'} — derived, not reported)` });
  }
  return out;
}

/** Snapshot vs ledger for the same period/accounts. */
export function reconcileWithLedger(m: ReportedMetrics, trades: LedgerTrade[]): Check[] {
  const closed = trades.filter((t) => t.status === 'closed' && t.netPnl != null);
  const net = closed.length ? round2(closed.reduce((s, t) => s + t.netPnl!, 0)) : null;
  const wins = closed.filter((t) => t.netPnl! > 0).length, losses = closed.filter((t) => t.netPnl! < 0).length;
  const out: Check[] = [
    cmp('trades', 'trade count', m.trades, trades.length, 0),
    cmp('net_pnl', 'net P&L', m.netPnl, net),
    cmp('wins', 'wins', m.wins, closed.length ? wins : null, 0),
    cmp('losses', 'losses', m.losses, closed.length ? losses : null, 0),
    cmp('best', 'best trade', m.bestTrade, closed.length ? Math.max(...closed.map((t) => t.netPnl!)) : null),
    cmp('worst', 'worst trade', m.worstTrade, closed.length ? Math.min(...closed.map((t) => t.netPnl!)) : null),
  ];
  for (const [sym, v] of Object.entries(m.bySymbol ?? {})) {
    const ts = closed.filter((t) => (t.instrumentRoot ?? t.symbol) === sym);
    out.push(cmp(`sym_${sym}_n`, `${sym} trades`, v.trades, trades.filter((t) => (t.instrumentRoot ?? t.symbol) === sym).length, 0));
    out.push(cmp(`sym_${sym}_net`, `${sym} net P&L`, v.netPnl, ts.length ? round2(ts.reduce((s, t) => s + t.netPnl!, 0)) : null));
  }
  for (const [side, v] of Object.entries(m.bySide ?? {})) {
    const ts = closed.filter((t) => t.side === side);
    out.push(cmp(`side_${side}_n`, `${side} trades`, v.trades, trades.filter((t) => t.side === side).length, 0));
    out.push(cmp(`side_${side}_net`, `${side} net P&L`, v.netPnl, ts.length ? round2(ts.reduce((s, t) => s + t.netPnl!, 0)) : null));
  }
  return out;
}

/** Figures quoted in the build prompt (§3). Stored only as a reported snapshot — never as trades. */
export const TRADEZELLA_REPORT_2024_12_11_TO_2025_05_30 = {
  sourceName: 'TraderZella report (summary quoted in build prompt §3)',
  dataset: 'tradezella_515',
  periodStart: '2024-12-11', periodEnd: '2025-05-30',
  notes: 'Aggregated report figures, not a raw ledger. The source file (Pasted text 20261031-090156.txt) was not available to this build; per-symbol detail for MGC/MES/MBT/MET/ZM is missing. Spans several accounts (Elite, TopstepX, Tradovate).',
  metrics: {
    trades: 515, netPnl: 17756.37, wins: 276, losses: 237, breakeven: 1, open: 1, winRatePct: 53.80,
    avgWin: 223.21, avgLoss: -181.43, bestTrade: 3611, worstTrade: -2777.80,
    bySymbol: { NQ: { trades: 215, winRatePct: 59.35, netPnl: 12823.20 }, MNQ: { trades: 275, winRatePct: 51.27, netPnl: 5130.98 } },
    bySide: { long: { trades: 394, netPnl: 11663.64 }, short: { trades: 121, netPnl: 6092.73 } },
  } as ReportedMetrics,
};

export const ALPHA_FUTURES_REPORT_HISTORICAL = {
  sourceName: 'Alpha Futures account summary (older NotebookLM report)',
  dataset: 'alpha_futures_103',
  periodStart: null as string | null, periodEnd: null as string | null,
  notes: 'Separate, historical, unverified dataset. Never merged with the 515-trade report. Win rate "about 55%" is approximate in the source.',
  metrics: { trades: 103, netPnl: 682.26, worstTrade: -922.80 } as ReportedMetrics,
};
