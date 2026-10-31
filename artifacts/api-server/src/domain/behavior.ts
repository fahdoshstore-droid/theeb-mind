// Behavioral pattern detection — evidence-first. Each finding lists the trades/fills behind it.
// Findings are observations for the trader to confirm or reject; they never become blocking rules.
import { zonedParts, NY_TZ } from './ny-time.js';
import { SOURCE_KILLZONES, type SessionKey } from './tril.js';

export interface BehaviorTrade {
  id: string; accountId: string; symbol: string; side: 'long' | 'short'; quantity: number;
  entryTime: string; exitTime: string | null; netPnl: number | null; initialRiskUsd: number | null; notes: string | null;
  addedWhileAgainst?: { fillKey: string; price: number; avgBefore: number }[];
  trilInversionAtEntry?: string | null;   // inversion state recorded pre-trade, if any
}

export interface Finding {
  pattern: string; title: string; summary: string;
  evidence: { tradeId: string; detail: string }[];
  dataNeeded?: string;
  label: 'observation';
}

export const QUICK_REENTRY_MINUTES = 10;

export function detectBehavior(trades: BehaviorTrade[], enabledSessions: SessionKey[]): { findings: Finding[]; notAssessed: { pattern: string; reason: string }[] } {
  const findings: Finding[] = [], notAssessed: { pattern: string; reason: string }[] = [];
  const sorted = [...trades].sort((a, b) => a.entryTime.localeCompare(b.entryTime));
  const ny = (iso: string) => zonedParts(Date.parse(iso), NY_TZ);

  // 1) entries outside enabled sessions
  if (!enabledSessions.length) notAssessed.push({ pattern: 'outside_enabled_session', reason: 'no enabled sessions in your profile' });
  else {
    const ev = sorted.filter((t) => {
      const m = ny(t.entryTime).minutesOfDay;
      return !enabledSessions.some((s) => m >= SOURCE_KILLZONES[s].start && m < SOURCE_KILLZONES[s].end);
    }).map((t) => ({ tradeId: t.id, detail: `${t.symbol} entry ${ny(t.entryTime).date} ${String(ny(t.entryTime).hour).padStart(2, '0')}:${String(ny(t.entryTime).minute).padStart(2, '0')} NY` }));
    if (ev.length) findings.push({ pattern: 'outside_enabled_session', title: 'Entries outside your enabled sessions', label: 'observation',
      summary: `${ev.length} of ${sorted.length} entries are outside ${enabledSessions.map((s) => SOURCE_KILLZONES[s].label).join(' / ')}`, evidence: ev });
  }

  // 2) quick re-entry after a loss (same account+symbol) — NOT labelled revenge without the trader's own words
  const quick: Finding['evidence'] = [];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = [...sorted.slice(0, i)].reverse().find((p) => p.accountId === cur.accountId && p.symbol === cur.symbol && p.exitTime);
    if (!prev || prev.netPnl == null || prev.netPnl >= 0) continue;
    const gap = (Date.parse(cur.entryTime) - Date.parse(prev.exitTime!)) / 60000;
    if (gap >= 0 && gap <= QUICK_REENTRY_MINUTES) quick.push({ tradeId: cur.id, detail: `entered ${Math.round(gap)} min after losing trade ${prev.id} (${prev.netPnl})` });
  }
  if (quick.length) findings.push({ pattern: 'quick_reentry_after_loss', title: `Re-entry within ${QUICK_REENTRY_MINUTES} min after a loss`, label: 'observation',
    summary: `${quick.length} trades. Timing alone does not show the motive — confirm or reject each.`, evidence: quick });

  // 3) size increase after a loss (same day, same symbol)
  const size: Finding['evidence'] = [];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = [...sorted.slice(0, i)].reverse().find((p) => p.accountId === cur.accountId && p.symbol === cur.symbol);
    if (!prev || prev.netPnl == null || prev.netPnl >= 0 || ny(prev.entryTime).date !== ny(cur.entryTime).date) continue;
    if (cur.quantity > prev.quantity) size.push({ tradeId: cur.id, detail: `${cur.quantity} contracts after a ${prev.quantity}-contract loss (${prev.id})` });
  }
  if (size.length) findings.push({ pattern: 'size_up_after_loss', title: 'Larger size right after a loss (same day)', label: 'observation', summary: `${size.length} trades`, evidence: size });

  // 4) initial risk after losses vs otherwise
  const withRisk = sorted.filter((t) => t.initialRiskUsd != null);
  if (withRisk.length < 10) notAssessed.push({ pattern: 'risk_after_loss', reason: `needs ≥ 10 trades with a verifiable initial risk (have ${withRisk.length})` });
  else {
    const after: BehaviorTrade[] = [], other: BehaviorTrade[] = [];
    for (let i = 0; i < withRisk.length; i++) (i > 0 && (withRisk[i - 1].netPnl ?? 0) < 0 ? after : other).push(withRisk[i]);
    const avg = (a: BehaviorTrade[]) => a.reduce((s, t) => s + t.initialRiskUsd!, 0) / a.length;
    if (after.length >= 5 && other.length >= 5 && avg(after) > avg(other) * 1.2)
      findings.push({ pattern: 'risk_after_loss', title: 'Higher initial risk after losses', label: 'observation',
        summary: `avg initial risk $${avg(after).toFixed(0)} after a loss (n=${after.length}) vs $${avg(other).toFixed(0)} otherwise (n=${other.length})`,
        evidence: after.map((t) => ({ tradeId: t.id, detail: `initial risk $${t.initialRiskUsd}` })) });
  }

  // 5) adding to a position moving against it (needs fills)
  const fillsKnown = sorted.filter((t) => t.addedWhileAgainst !== undefined);
  if (!fillsKnown.length) notAssessed.push({ pattern: 'add_to_loser', reason: 'needs fill-level imports' });
  else {
    const ev = fillsKnown.filter((t) => t.addedWhileAgainst!.length).map((t) => ({ tradeId: t.id, detail: t.addedWhileAgainst!.map((a) => `added @ ${a.price} vs avg ${a.avgBefore}`).join('; ') }));
    if (ev.length) findings.push({ pattern: 'add_to_loser', title: 'Added to a position at a worse price than the average entry', label: 'observation', summary: `${ev.length} positions`, evidence: ev });
  }

  // 6) entry before confirmation (needs a pre-trade TRIL record)
  const withTril = sorted.filter((t) => t.trilInversionAtEntry != null);
  if (!withTril.length) notAssessed.push({ pattern: 'entry_before_confirmation', reason: 'needs pre-trade TRIL evaluations linked to trades' });
  else {
    const ev = withTril.filter((t) => t.trilInversionAtEntry === 'formed' || t.trilInversionAtEntry === 'none').map((t) => ({ tradeId: t.id, detail: `inversion recorded as "${t.trilInversionAtEntry}" before entry` }));
    if (ev.length) findings.push({ pattern: 'entry_before_confirmation', title: 'Entry before IFVG/Breaker confirmation', label: 'observation', summary: `${ev.length} of ${withTril.length} trades with a pre-trade record`, evidence: ev });
  }

  // 7) the trader's own words (revenge / FOMO / greed / fear) — only from notes they wrote
  const words: Record<string, RegExp> = {
    self_reported_revenge: /(revenge|انتقام)/i, self_reported_fomo: /(fomo|مستعجل|استعجال|chas)/i,
    self_reported_greed: /(greed|طمع)/i, self_reported_fear: /(fear|خوف)/i,
  };
  for (const [pattern, re] of Object.entries(words)) {
    const ev = sorted.filter((t) => t.notes && re.test(t.notes)).map((t) => ({ tradeId: t.id, detail: `note: "${t.notes!.slice(0, 140)}"` }));
    if (ev.length) findings.push({ pattern, title: `Your notes mention ${pattern.replace('self_reported_', '')}`, label: 'observation', summary: `${ev.length} trades — from your own written notes`, evidence: ev });
  }
  notAssessed.push({ pattern: 'trading_during_news', reason: 'no verified economic-calendar data is stored with trades' });
  return { findings, notAssessed };
}
