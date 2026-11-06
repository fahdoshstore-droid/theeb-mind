// ============================================================
// THEEB MIND — Legacy COT service (NASDAQ-100)
//
// MarketBulls = primary source. CFTC = independent validation.
// States:
//   VERIFIED          both sources agree on every field they both publish
//   MISMATCH          both sources returned the week, but values differ —
//                     shown as unverified, never as verified
//   DATA_UNAVAILABLE  a source failed or the week cannot be compared —
//                     no position values are returned at all
//
// The comparison rule is PROVISIONAL_EXACT_MATCH: no tolerance is
// invented. Every comparison is recorded so observed differences can be
// reviewed before a permanent rule is proposed.
// There are no hard-coded fallback values anywhere in this module.
// ============================================================

import {
  LEGACY_GROUP_KEYS, LEGACY_FIELDS, VALIDATION_RULE, VALIDATION_RULE_NOTE,
  type LegacyWeek, type LegacyCotResult, type LegacyDifference, type LegacyCotReason,
  type SourceReport, type LegacyGroupKey, type LegacyCotHistoryPoint,
} from './cot-legacy.types.js';
import { MARKETBULLS_COT_URL, parseMarketBullsLegacyCot } from './marketbulls-cot.js';
import { cftcLegacyQueryUrl, parseCftcLegacy, NQ_CFTC_CODE, CFTC_LEGACY_DATASET_URL } from './cftc-legacy.js';

const HISTORY_WEEKS = 12;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const UA = 'THEEB-MIND/1.0 (market research workspace)';

export type SourceOutcome =
  | { ok: true; weeks: LegacyWeek[]; fetchedAt: string }
  | { ok: false; error: string; fetchedAt: string };

export interface LegacyCotDeps {
  fetchPrimary: () => Promise<SourceOutcome>;
  fetchValidation: () => Promise<SourceOutcome>;
  now: () => Date;
}

// ── Comparison ─────────────────────────────────────────────

export function compareWeeks(primary: LegacyWeek, validation: LegacyWeek): { fieldsCompared: number; differences: LegacyDifference[] } {
  let fieldsCompared = 0;
  const differences: LegacyDifference[] = [];
  for (const g of LEGACY_GROUP_KEYS) {
    for (const f of LEGACY_FIELDS) {
      const a = primary.groups[g][f];
      const b = validation.groups[g][f];
      if (a === null || b === null) continue; // a source does not publish this field
      fieldsCompared++;
      if (a !== b) differences.push({ reportDate: primary.reportDate, group: g, field: f, primary: a, validation: b, delta: a - b });
    }
  }
  return { fieldsCompared, differences };
}

const latestDate = (o: SourceOutcome) => (o.ok && o.weeks.length ? o.weeks[0].reportDate : null);

function sourceReport(name: 'MarketBulls' | 'CFTC', url: string, o: SourceOutcome): SourceReport {
  return {
    name, url,
    status: o.ok ? 'OK' : 'UNAVAILABLE',
    fetchedAt: o.fetchedAt,
    latestReportDate: latestDate(o),
    error: o.ok ? null : o.error,
  };
}

/** Pure decision function: two source outcomes in, one result out. */
export function evaluateLegacyCot(primary: SourceOutcome, validation: SourceOutcome, now: Date): LegacyCotResult {
  const base = (status: LegacyCotResult['status'], reason: LegacyCotReason | null): LegacyCotResult => ({
    status, reason,
    instrument: 'NASDAQ-100',
    report: 'CFTC_LEGACY_FUTURES_ONLY',
    cftcContractCode: NQ_CFTC_CODE,
    reportDate: null,
    groups: null,
    netChange: null,
    history: null,
    validation: { rule: VALIDATION_RULE, note: VALIDATION_RULE_NOTE, comparedWeek: null, fieldsCompared: 0, differences: [] },
    sources: {
      primary: sourceReport('MarketBulls', MARKETBULLS_COT_URL, primary),
      validation: sourceReport('CFTC', CFTC_LEGACY_DATASET_URL, validation),
    },
    checkedAt: now.toISOString(),
  });

  if (!primary.ok && !validation.ok) return base('DATA_UNAVAILABLE', 'BOTH_UNAVAILABLE');
  if (!primary.ok) return base('DATA_UNAVAILABLE', 'PRIMARY_UNAVAILABLE');
  if (!validation.ok) return base('DATA_UNAVAILABLE', 'VALIDATION_UNAVAILABLE');

  const latest = primary.weeks[0];
  const byDate = new Map(validation.weeks.map((w) => [w.reportDate, w]));
  const match = byDate.get(latest.reportDate);
  if (!match) {
    const r = base('DATA_UNAVAILABLE', 'VALIDATION_WEEK_NOT_FOUND');
    r.validation.comparedWeek = latest.reportDate;
    return r;
  }

  const cmp = compareWeeks(latest, match);
  if (cmp.fieldsCompared === 0) {
    const r = base('DATA_UNAVAILABLE', 'NO_COMPARABLE_FIELDS');
    r.validation.comparedWeek = latest.reportDate;
    return r;
  }

  if (cmp.differences.length > 0) {
    const r = base('MISMATCH', 'VALUES_DIFFER');
    r.reportDate = latest.reportDate;
    r.validation.comparedWeek = latest.reportDate;
    r.validation.fieldsCompared = cmp.fieldsCompared;
    r.validation.differences = cmp.differences;
    r.sources.primary.unverifiedLatest = latest;
    r.sources.validation.unverifiedLatest = match;
    return r;
  }

  // VERIFIED — build history from weeks that are themselves verified.
  const verified = new Set<string>();
  const history: LegacyCotHistoryPoint[] = [];
  for (const w of primary.weeks.slice(0, HISTORY_WEEKS)) {
    const v = byDate.get(w.reportDate);
    if (!v) continue;
    const c = compareWeeks(w, v);
    if (c.fieldsCompared === 0 || c.differences.length) continue;
    verified.add(w.reportDate);
    history.push({
      reportDate: w.reportDate,
      nonCommercialNet: w.groups.nonCommercial.net,
      commercialNet: w.groups.commercial.net,
      nonReportableNet: w.groups.nonReportable.net,
    });
  }

  const prev = primary.weeks[1];
  let netChange: Record<LegacyGroupKey, number | null> | null = null;
  if (prev && verified.has(prev.reportDate)) {
    netChange = {} as Record<LegacyGroupKey, number | null>;
    for (const g of LEGACY_GROUP_KEYS) {
      const a = latest.groups[g].net, b = prev.groups[g].net;
      netChange[g] = a !== null && b !== null ? a - b : null;
    }
  }

  const r = base('VERIFIED', null);
  r.reportDate = latest.reportDate;
  r.groups = latest.groups;
  r.netChange = netChange;
  r.history = history;
  r.validation.comparedWeek = latest.reportDate;
  r.validation.fieldsCompared = cmp.fieldsCompared;
  return r;
}

// ── Observation log (for reviewing real differences) ───────

export interface LegacyCotObservation {
  checkedAt: string;
  status: LegacyCotResult['status'];
  reason: LegacyCotReason | null;
  comparedWeek: string | null;
  fieldsCompared: number;
  differences: LegacyDifference[];
  primaryLatest: string | null;
  validationLatest: string | null;
  primaryError: string | null;
  validationError: string | null;
}

const OBS_MAX = 100;
const observations: LegacyCotObservation[] = [];

function record(r: LegacyCotResult) {
  observations.unshift({
    checkedAt: r.checkedAt,
    status: r.status,
    reason: r.reason,
    comparedWeek: r.validation.comparedWeek,
    fieldsCompared: r.validation.fieldsCompared,
    differences: r.validation.differences,
    primaryLatest: r.sources.primary.latestReportDate,
    validationLatest: r.sources.validation.latestReportDate,
    primaryError: r.sources.primary.error,
    validationError: r.sources.validation.error,
  });
  if (observations.length > OBS_MAX) observations.length = OBS_MAX;
  if (r.status !== 'VERIFIED') {
    console.warn(`[cot-legacy] ${r.status}${r.reason ? ' (' + r.reason + ')' : ''} week=${r.validation.comparedWeek ?? '-'} diffs=${r.validation.differences.length}`);
  }
}

export function getLegacyCotObservations(): LegacyCotObservation[] {
  return observations.slice();
}

// ── Fetchers ───────────────────────────────────────────────

const errMsg = (e: unknown) => String(e instanceof Error ? e.message : e).slice(0, 300);

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res;
}

export const defaultDeps: LegacyCotDeps = {
  fetchPrimary: async () => {
    const fetchedAt = new Date().toISOString();
    try {
      const html = await (await fetchWithTimeout(MARKETBULLS_COT_URL, 'text/html')).text();
      return { ok: true, weeks: parseMarketBullsLegacyCot(html), fetchedAt };
    } catch (e) {
      return { ok: false, error: 'MarketBulls: ' + errMsg(e), fetchedAt };
    }
  },
  fetchValidation: async () => {
    const fetchedAt = new Date().toISOString();
    try {
      const rows = await (await fetchWithTimeout(cftcLegacyQueryUrl(HISTORY_WEEKS + 14), 'application/json')).json();
      return { ok: true, weeks: parseCftcLegacy(rows), fetchedAt };
    } catch (e) {
      return { ok: false, error: 'CFTC: ' + errMsg(e), fetchedAt };
    }
  },
  now: () => new Date(),
};

// ── Public API (cached, single-flight; DATA_UNAVAILABLE is never cached) ─

let cache: { at: number; value: LegacyCotResult } | null = null;
let pending: Promise<LegacyCotResult> | null = null;

export function clearLegacyCotCache(): void {
  cache = null;
  pending = null;
  observations.length = 0;
}

export async function getLegacyCot(deps: LegacyCotDeps = defaultDeps): Promise<LegacyCotResult> {
  const nowMs = deps.now().getTime();
  if (cache && nowMs - cache.at < CACHE_TTL_MS) return cache.value;
  if (pending) return pending;
  pending = (async () => {
    try {
      const [p, v] = await Promise.all([deps.fetchPrimary(), deps.fetchValidation()]);
      const result = evaluateLegacyCot(p, v, deps.now());
      record(result);
      cache = result.status === 'DATA_UNAVAILABLE' ? null : { at: nowMs, value: result };
      return result;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
