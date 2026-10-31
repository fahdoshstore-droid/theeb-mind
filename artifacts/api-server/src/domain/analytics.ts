// ═══════════════════════════════════════════════════════════════
// Performance analytics over ledger trades. Every metric carries its formula,
// sample size and provenance. Nothing is estimated; missing inputs → null + a notice.
// ═══════════════════════════════════════════════════════════════
import { zonedParts, NY_TZ } from './ny-time.js';
import { SOURCE_KILLZONES } from './tril.js';
import { round2 } from './pnl.js';

export interface LedgerTrade {
  id: string; accountId: string; accountName?: string; symbol: string; instrumentRoot: string | null;
  side: 'long' | 'short'; quantity: number; status: 'closed' | 'open';
  entryTime: string; exitTime: string | null;
  netPnl: number | null; netSource: string; grossPnl: number | null; fees: number | null;
  initialRiskUsd: number | null; initialRiskSource: string | null; setup: string | null;
  pnlMismatch: number | null; currency: string; isDemo: boolean; timestampsHadOffset: boolean;
}

export const DEFAULT_MIN_SAMPLE = 20;

export interface Metric { key: string; label: string; value: number | null; formula: string; sample: number; unit: '$' | '%' | 'R' | 'x' | 'n'; provenance: string; note?: string }
export interface GroupRow { key: string; n: number; wins: number; losses: number; breakeven: number; net: number; winRate: number | null; avgR: number | null; nR: number; tradeIds: string[]; sufficient: boolean }
export interface Notice { level: 'info' | 'warning'; code: string; message: string; tradeIds: string[] }

export interface AnalyticsResult {
  scope: { trades: number; closedWithPnl: number; open: number; unknownPnl: number; currencies: string[]; accounts: string[]; includesDemo: boolean; from: string | null; to: string | null };
  metrics: Metric[];
  groups: Record<string, GroupRow[]>;
  cumulative: { t: string; tradeId: string; cum: number }[];
  peakToTrough: { value: number | null; label: string; fromTradeId: string | null; toTradeId: string | null };
  notices: Notice[];
  minSample: number;
  definitions: Record<string, string>;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 100 : null);

export function computeAnalytics(trades: LedgerTrade[], minSample = DEFAULT_MIN_SAMPLE): AnalyticsResult {
  const notices: Notice[] = [];
  const closed = trades.filter((t) => t.status === 'closed' && t.netPnl != null);
  const open = trades.filter((t) => t.status === 'open');
  const unknown = trades.filter((t) => t.status === 'closed' && t.netPnl == null);
  const wins = closed.filter((t) => t.netPnl! > 0), losses = closed.filter((t) => t.netPnl! < 0), be = closed.filter((t) => t.netPnl === 0);
  const sumW = round2(wins.reduce((s, t) => s + t.netPnl!, 0)), sumL = round2(losses.reduce((s, t) => s + t.netPnl!, 0));
  const net = round2(closed.reduce((s, t) => s + t.netPnl!, 0));
  const withR = closed.filter((t) => t.initialRiskUsd != null && t.initialRiskUsd > 0);
  const avgR = withR.length ? Math.round((withR.reduce((s, t) => s + t.netPnl! / t.initialRiskUsd!, 0) / withR.length) * 100) / 100 : null;
  const prov = (() => {
    const c: Record<string, number> = {};
    for (const t of closed) c[t.netSource] = (c[t.netSource] || 0) + 1;
    return Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ') || 'no trades';
  })();

  const metrics: Metric[] = [
    { key: 'net_pnl', label: 'Net realized P&L', value: closed.length ? net : null, formula: 'Σ net P&L of closed trades with known net P&L', sample: closed.length, unit: '$', provenance: `per-trade net: ${prov}` },
    { key: 'win_rate', label: 'Win rate', value: pct(wins.length, wins.length + losses.length), formula: 'wins ÷ (wins + losses); breakeven (net = 0) and open trades excluded', sample: wins.length + losses.length, unit: '%', provenance: 'recomputed from ledger' },
    { key: 'win_rate_incl_be', label: 'Win rate incl. breakeven', value: pct(wins.length, closed.length), formula: 'wins ÷ all closed trades with known P&L', sample: closed.length, unit: '%', provenance: 'recomputed from ledger' },
    { key: 'avg_win', label: 'Average win', value: wins.length ? round2(sumW / wins.length) : null, formula: 'Σ net of winners ÷ number of winners', sample: wins.length, unit: '$', provenance: 'recomputed from ledger' },
    { key: 'avg_loss', label: 'Average loss', value: losses.length ? round2(sumL / losses.length) : null, formula: 'Σ net of losers ÷ number of losers', sample: losses.length, unit: '$', provenance: 'recomputed from ledger' },
    { key: 'profit_factor', label: 'Profit factor', value: losses.length && sumL !== 0 ? Math.round((sumW / Math.abs(sumL)) * 100) / 100 : null, formula: 'Σ net of winners ÷ |Σ net of losers| (net P&L, i.e. after fees when the source includes them)', sample: closed.length, unit: 'x', provenance: 'recomputed from ledger',
      note: losses.length ? undefined : 'not available: no losing trades in scope' },
    { key: 'expectancy', label: 'Expectancy per trade', value: closed.length ? round2(net / closed.length) : null, formula: 'net realized P&L ÷ closed trades with known P&L', sample: closed.length, unit: '$', provenance: 'recomputed from ledger' },
    { key: 'avg_r', label: 'Average R', value: avgR, formula: 'mean(net P&L ÷ initial risk) over trades with a verifiable initial risk only', sample: withR.length, unit: 'R', provenance: 'initial risk from recorded stop/entry/qty',
      note: withR.length < closed.length ? `${closed.length - withR.length} closed trades have no verifiable initial risk and are excluded` : undefined },
    { key: 'trades', label: 'Trades in scope', value: trades.length, formula: 'count of ledger trades after filters', sample: trades.length, unit: 'n', provenance: 'ledger' },
    { key: 'breakeven', label: 'Breakeven trades', value: be.length, formula: 'closed trades with net P&L exactly 0', sample: closed.length, unit: 'n', provenance: 'ledger' },
  ];

  // ── Groupings ──
  const group = (keyOf: (t: LedgerTrade) => string | null): GroupRow[] => {
    const m = new Map<string, LedgerTrade[]>();
    for (const t of closed) { const k = keyOf(t) ?? 'unknown / not recorded'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
    return [...m.entries()].map(([key, ts]) => {
      const w = ts.filter((t) => t.netPnl! > 0).length, l = ts.filter((t) => t.netPnl! < 0).length;
      const r = ts.filter((t) => t.initialRiskUsd != null && t.initialRiskUsd > 0);
      return { key, n: ts.length, wins: w, losses: l, breakeven: ts.length - w - l, net: round2(ts.reduce((s, t) => s + t.netPnl!, 0)),
        winRate: pct(w, w + l), avgR: r.length ? Math.round((r.reduce((s, t) => s + t.netPnl! / t.initialRiskUsd!, 0) / r.length) * 100) / 100 : null,
        nR: r.length, tradeIds: ts.map((t) => t.id), sufficient: ts.length >= minSample };
    }).sort((a, b) => b.n - a.n);
  };
  const ny = (t: LedgerTrade) => zonedParts(Date.parse(t.entryTime), NY_TZ);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sessionOf = (t: LedgerTrade) => {
    const m = ny(t).minutesOfDay;
    for (const [k, z] of Object.entries(SOURCE_KILLZONES)) if (m >= z.start && m < z.end) return k === 'ny_am' ? 'NY AM KZ (09:30–12:10)' : 'NY PM KZ (13:30–16:10)';
    return 'outside NY kill zones';
  };
  // Nth trade of the NY trading day (frequency context — never a block)
  const nth = new Map<string, number>();
  const byDay = new Map<string, LedgerTrade[]>();
  for (const t of [...closed].sort((a, b) => a.entryTime.localeCompare(b.entryTime))) {
    const d = `${t.accountId}|${ny(t).date}`;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(t); nth.set(t.id, byDay.get(d)!.length);
  }
  const groups = {
    symbol: group((t) => t.instrumentRoot ?? t.symbol),
    side: group((t) => t.side),
    account: group((t) => t.accountName ?? t.accountId),
    session: group(sessionOf),
    weekday: group((t) => WD[ny(t).weekday]),
    hour: group((t) => `${String(ny(t).hour).padStart(2, '0')}:00 NY`),
    month: group((t) => ny(t).date.slice(0, 7)),
    setup: group((t) => t.setup),
    tradeOfDay: group((t) => { const n = nth.get(t.id)!; return n >= 3 ? '3rd+ trade of day' : n === 2 ? '2nd trade of day' : '1st trade of day'; }),
  };

  // ── Cumulative realized P&L (not an equity statement) ──
  const ordered = closed.filter((t) => t.exitTime).sort((a, b) => a.exitTime!.localeCompare(b.exitTime!));
  let cum = 0, peak = 0, peakId: string | null = null, worst = 0, worstFrom: string | null = null, worstTo: string | null = null;
  const cumulative = ordered.map((t) => {
    cum = round2(cum + t.netPnl!);
    if (cum > peak) { peak = cum; peakId = t.id; }
    if (cum - peak < worst) { worst = round2(cum - peak); worstFrom = peakId; worstTo = t.id; }
    return { t: t.exitTime!, tradeId: t.id, cum };
  });
  if (ordered.length < closed.length) notices.push({ level: 'warning', code: 'missing_exit_time', message: `${closed.length - ordered.length} closed trades have no exit time and are not on the cumulative curve`, tradeIds: closed.filter((t) => !t.exitTime).map((t) => t.id) });

  // ── Data quality notices ──
  const noRisk = closed.filter((t) => t.initialRiskUsd == null);
  if (noRisk.length) notices.push({ level: 'info', code: 'no_initial_risk', message: `${noRisk.length} of ${closed.length} closed trades have no verifiable initial stop — excluded from R metrics`, tradeIds: noRisk.map((t) => t.id) });
  const mism = closed.filter((t) => t.pnlMismatch != null && Math.abs(t.pnlMismatch) > 0.01);
  if (mism.length) notices.push({ level: 'warning', code: 'pnl_mismatch', message: `${mism.length} trades: reported P&L differs from price-recomputed P&L`, tradeIds: mism.map((t) => t.id) });
  if (unknown.length) notices.push({ level: 'warning', code: 'unknown_pnl', message: `${unknown.length} closed trades have unknown net P&L and are excluded from P&L metrics`, tradeIds: unknown.map((t) => t.id) });
  if (open.length) notices.push({ level: 'info', code: 'open_positions', message: `${open.length} open positions excluded (unrealized P&L is not tracked)`, tradeIds: open.map((t) => t.id) });
  const recomputedNet = closed.filter((t) => t.netSource !== 'source_reported');
  if (recomputedNet.length) notices.push({ level: 'info', code: 'recomputed_net', message: `${recomputedNet.length} trades use recomputed (not source-reported) net P&L`, tradeIds: recomputedNet.map((t) => t.id) });
  const naive = trades.filter((t) => !t.timestampsHadOffset);
  if (naive.length) notices.push({ level: 'info', code: 'naive_timestamps', message: `${naive.length} trades had timestamps without UTC offset; they were interpreted in the time zone chosen at import`, tradeIds: naive.map((t) => t.id) });
  const currencies = [...new Set(trades.map((t) => t.currency))];
  if (currencies.length > 1) notices.push({ level: 'warning', code: 'mixed_currency', message: `trades in multiple currencies (${currencies.join(', ')}) are summed without conversion — filter by currency`, tradeIds: [] });
  const accounts = [...new Set(trades.map((t) => t.accountName ?? t.accountId))];
  if (accounts.length > 1) notices.push({ level: 'info', code: 'multi_account', message: `scope combines ${accounts.length} accounts — this is a multi-account total, not one account's result`, tradeIds: [] });
  if (closed.length && closed.length < minSample) notices.push({ level: 'warning', code: 'small_sample', message: `only ${closed.length} closed trades — below the minimum sample of ${minSample}; treat all metrics as descriptive`, tradeIds: [] });
  if (trades.some((t) => t.isDemo)) notices.push({ level: 'warning', code: 'demo', message: 'scope includes DEMO trades', tradeIds: trades.filter((t) => t.isDemo).map((t) => t.id) });

  const times = trades.map((t) => t.entryTime).sort();
  return {
    scope: { trades: trades.length, closedWithPnl: closed.length, open: open.length, unknownPnl: unknown.length, currencies, accounts, includesDemo: trades.some((t) => t.isDemo), from: times[0] ?? null, to: times[times.length - 1] ?? null },
    metrics, groups, cumulative,
    peakToTrough: { value: cumulative.length ? worst : null, label: 'Largest peak-to-trough decline of cumulative realized net P&L (closed trades only; not an official account drawdown — deposits, withdrawals and intraday equity are not included)', fromTradeId: worstFrom, toTradeId: worstTo },
    notices, minSample,
    definitions: {
      win: 'net P&L > 0', loss: 'net P&L < 0', breakeven: 'net P&L = 0',
      session: 'entry time converted to America/New_York (DST-aware)',
      sufficient: `a group is marked sufficient when n ≥ ${minSample}; this is a visibility threshold, not proof of edge`,
    },
  };
}
