// ============================================================
// MarketBulls — Legacy COT for NASDAQ-100 (primary source)
// Page: https://market-bulls.com/cot-report-nasdaq-100/
//
// The page is HTML, so this parser reads its tables. It maps columns
// strictly to the three CFTC Legacy groups and throws if the page does
// not contain a recognisable Legacy table. It never guesses a number.
//
// Reviewed port of parseMarketBullsCOT() from the unmerged branch
// claude/theeb-mind-trading-dashboard-nl5zv7, with stricter grouping:
// TFF / Disaggregated categories (Managed Money, Leveraged Funds,
// Asset Manager, Dealer, Swap, Producer/Merchant) are rejected rather
// than mapped to Non-commercial.
//
// NOTE: not yet tested against a live MarketBulls response — the page
// was unreachable from the build environment. See
// docs/market-desk/COT-VALIDATION.md.
// ============================================================

import { parseTables, parseNum, parseDate } from './html-tables.js';
import type { LegacyGroupKey, LegacyField, LegacyWeek, LegacyGroupPositions } from './cot-legacy.types.js';
import { LEGACY_GROUP_KEYS } from './cot-legacy.types.js';

export const MARKETBULLS_COT_URL = 'https://market-bulls.com/cot-report-nasdaq-100/';

const NON_LEGACY = /(managed\s*money|leveraged|asset\s*manag|dealer|swap|producer|merchant|other\s*reportable)/i;
const NON_COMMERCIAL = /(non[\s-]?commercial|large\s*spec)/i;
const NON_REPORTABLE = /(non[\s-]?reportable|small\s*(trader|spec))/i;
const COMMERCIAL = /commercial/i;
const IGNORED_FIELD = /(chang|chg|Δ|delta|index|%|percent|ratio|week\s*over|w\/w)/i;

export function groupOfHeader(h: string): LegacyGroupKey | null {
  if (NON_REPORTABLE.test(h)) return 'nonReportable';
  if (NON_COMMERCIAL.test(h)) return 'nonCommercial';
  if (COMMERCIAL.test(h)) return 'commercial';
  return null;
}

export function fieldOfHeader(h: string): LegacyField | null {
  if (IGNORED_FIELD.test(h)) return null;
  if (/\bnet\b/i.test(h)) return 'net';
  if (/\blongs?\b/i.test(h)) return 'long';
  if (/\bshorts?\b/i.test(h)) return 'short';
  return null;
}

const fin = (n: number): number | null => (Number.isFinite(n) ? n : null);

/** Returns Legacy weeks, newest first. Throws when the page has no complete Legacy table. */
export function parseMarketBullsLegacyCot(html: string): LegacyWeek[] {
  const candidates: LegacyWeek[][] = [];
  for (const tb of parseTables(html)) {
    if (tb.headers.some((h) => NON_LEGACY.test(h))) continue; // TFF / Disaggregated table — not Legacy
    const dateCol = tb.headers.findIndex((h) => /date|week|report/i.test(h));
    const dc = dateCol >= 0 ? dateCol : 0;
    const cols: Partial<Record<`${LegacyGroupKey}.${LegacyField}`, number>> = {};
    tb.headers.forEach((h, i) => {
      const g = groupOfHeader(h);
      const f = fieldOfHeader(h);
      if (g && f) {
        const key = `${g}.${f}` as const;
        if (cols[key] === undefined) cols[key] = i;
      }
    });
    const complete = LEGACY_GROUP_KEYS.every(
      (g) => cols[`${g}.net`] !== undefined || (cols[`${g}.long`] !== undefined && cols[`${g}.short`] !== undefined),
    );
    if (!complete) continue;

    const weeks: LegacyWeek[] = [];
    for (const r of tb.rows) {
      const date = parseDate(r[dc]);
      if (!date) continue;
      const get = (g: LegacyGroupKey, f: LegacyField) => {
        const idx = cols[`${g}.${f}`];
        return idx === undefined ? null : fin(parseNum(r[idx]));
      };
      const groups = {} as Record<LegacyGroupKey, LegacyGroupPositions>;
      let usable = true;
      for (const g of LEGACY_GROUP_KEYS) {
        const long = get(g, 'long');
        const short = get(g, 'short');
        const pageNet = get(g, 'net');
        const net = pageNet ?? (long !== null && short !== null ? long - short : null);
        if (net === null) usable = false;
        groups[g] = { long, short, net };
      }
      if (usable) weeks.push({ reportDate: date, groups });
    }
    if (weeks.length) candidates.push(weeks);
  }
  if (!candidates.length) {
    throw new Error('MarketBulls COT: no complete Legacy table (Non-commercial, Commercial, Non-reportable) found');
  }
  const best = candidates.sort((a, b) => b.length - a.length)[0];
  return [...best].sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
}
