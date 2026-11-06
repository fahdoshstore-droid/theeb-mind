// ============================================================
// MarketBulls — Legacy COT for NASDAQ-100 (primary source)
// Page: https://market-bulls.com/cot-report-nasdaq-100/
//
// The page renders its COT report client-side. The Legacy <table> is an
// empty shell (2 header rows, zero data rows); the real data lives in two
// embedded JSON blobs:
//
//   1. `var data = JSON.parse(JSON.stringify([...]))` — the weekly history
//      (~157 rows), carrying NET positions only:
//        'As of Date in Form YYYY-MM-DD',
//        'Net Positions Noncommercial',
//        'Net Positions Commercials',
//        'Net Positions Nonreportable'.
//
//   2. `lcot_data = JSON.parse(JSON.stringify([...]))` — a single row, the
//      latest report's raw detail, carrying the long/short legs:
//        'Noncommercial Positions-Long (All)' / '-Short (All)',
//        'Commercial Positions-Long (All)' / '-Short (All)',
//        'Nonreportable Positions-Long (All)' / '-Short (All)'.
//
// Every week except the latest is net-only (long/short = null); the latest
// week gets its long/short from lcot_data, matched by reportDate. A field is
// null when the source does not publish it — never 0. The parser throws if
// no recognisable data is present and never guesses a number.
//
// Grouping stays strict: Disaggregated / TFF categories (Dealer, Asset
// Manager, Leveraged Money, Other Reportable, …) are ignored rather than
// mapped to Non-commercial.
// ============================================================

import { parseNum, parseDate } from './html-tables.js';
import type { LegacyGroupKey, LegacyField, LegacyWeek, LegacyGroupPositions, LegacyGroups } from './cot-legacy.types.js';
import { LEGACY_GROUP_KEYS } from './cot-legacy.types.js';

export const MARKETBULLS_COT_URL = 'https://market-bulls.com/cot-report-nasdaq-100/';

// ── Header classification (kept for the strict Legacy-vs-Disaggregated map) ──

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
const asStr = (v: unknown): string | null => (v == null ? null : String(v));

// ── Embedded JSON blobs ────────────────────────────────────

const HISTORY_BLOB_RE = /var\s+data\s*=\s*JSON\.parse\(JSON\.stringify\((\[[\s\S]*?\])\s*\)\s*\)/g;
const LCOT_DATA_RE = /lcot_data\s*=\s*JSON\.parse\(JSON\.stringify\((\[[\s\S]*?\])\s*\)\s*\)/g;

const DATE_KEY = 'As of Date in Form YYYY-MM-DD';
const NET_KEYS: Record<LegacyGroupKey, string> = {
  nonCommercial: 'Net Positions Noncommercial',
  commercial: 'Net Positions Commercials',
  nonReportable: 'Net Positions Nonreportable',
};
const LONG_KEYS: Record<LegacyGroupKey, string> = {
  nonCommercial: 'Noncommercial Positions-Long (All)',
  commercial: 'Commercial Positions-Long (All)',
  nonReportable: 'Nonreportable Positions-Long (All)',
};
const SHORT_KEYS: Record<LegacyGroupKey, string> = {
  nonCommercial: 'Noncommercial Positions-Short (All)',
  commercial: 'Commercial Positions-Short (All)',
  nonReportable: 'Nonreportable Positions-Short (All)',
};

/** Every JSON blob in `html` matching `re`, parsed to an array of plain objects. */
function jsonArrays(html: string, re: RegExp): Record<string, unknown>[][] {
  const out: Record<string, unknown>[][] = [];
  for (const m of String(html).matchAll(re)) {
    let arr: unknown;
    try {
      arr = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (Array.isArray(arr) && arr.length && arr.every((x) => x !== null && typeof x === 'object')) {
      out.push(arr as Record<string, unknown>[]);
    }
  }
  return out;
}

interface HistoryRow {
  reportDate: string;
  net: Record<LegacyGroupKey, number | null>;
}

/** Returns Legacy weeks, newest first. Throws when the page has no recognisable COT data. */
export function parseMarketBullsLegacyCot(html: string): LegacyWeek[] {
  // 1. Weekly net-position history from the `var data` blob.
  let history: HistoryRow[] = [];
  for (const arr of jsonArrays(html, HISTORY_BLOB_RE)) {
    const rows: HistoryRow[] = [];
    for (const o of arr) {
      const reportDate = parseDate(asStr(o[DATE_KEY]));
      if (!reportDate) continue;
      const net = {} as Record<LegacyGroupKey, number | null>;
      let usable = false;
      for (const g of LEGACY_GROUP_KEYS) {
        const n = fin(parseNum(asStr(o[NET_KEYS[g]])));
        net[g] = n;
        if (n !== null) usable = true;
      }
      if (usable) rows.push({ reportDate, net });
    }
    if (rows.length) {
      history = rows;
      break;
    }
  }
  if (!history.length) {
    throw new Error(
      "MarketBulls COT: no recognisable Legacy data (no 'var data' weekly-history JSON blob with net positions)",
    );
  }

  // 2. Latest report's long/short legs from the `lcot_data` blob (optional enrichment).
  let detail: Record<string, unknown> | null = null;
  for (const arr of jsonArrays(html, LCOT_DATA_RE)) {
    detail = arr[0];
    break;
  }
  const detailDate = detail ? parseDate(asStr(detail[DATE_KEY])) : null;

  const weeks: LegacyWeek[] = history.map((r) => {
    const d = detailDate === r.reportDate ? detail : null;
    const groups = {} as LegacyGroups;
    for (const g of LEGACY_GROUP_KEYS) {
      const gp: LegacyGroupPositions = {
        long: d ? fin(parseNum(asStr(d[LONG_KEYS[g]]))) : null,
        short: d ? fin(parseNum(asStr(d[SHORT_KEYS[g]]))) : null,
        net: r.net[g],
      };
      groups[g] = gp;
    }
    return { reportDate: r.reportDate, groups };
  });

  return weeks.sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
}
