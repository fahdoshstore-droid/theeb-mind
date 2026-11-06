// ============================================================
// CFTC — Legacy COT, Futures Only (independent validation source)
// Public Reporting Environment dataset 6dca-aqww
// Contract 209742 = NASDAQ-100 STOCK INDEX (MINI) — CME (E-mini)
//
// Field names follow the dataset schema used by the reviewed query on
// branch claude/theeb-mind-trading-dashboard-nl5zv7. Not yet tested
// against a live response from the build environment.
// ============================================================

import type { LegacyWeek, LegacyGroupPositions } from './cot-legacy.types.js';

export const CFTC_LEGACY_DATASET_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';
export const NQ_CFTC_CODE = '209742';

export function cftcLegacyQueryUrl(limit = 26): string {
  const q = new URLSearchParams({
    cftc_contract_market_code: NQ_CFTC_CODE,
    $order: 'report_date_as_yyyy_mm_dd DESC',
    $limit: String(limit),
  });
  return `${CFTC_LEGACY_DATASET_URL}?${q.toString()}`;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function side(long: number | null, short: number | null): LegacyGroupPositions {
  return { long, short, net: long !== null && short !== null ? long - short : null };
}

/** Parses the dataset rows. Throws when nothing usable is returned. Newest first. */
export function parseCftcLegacy(rows: unknown): LegacyWeek[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('CFTC: empty response');
  const weeks: LegacyWeek[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (r.cftc_contract_market_code !== undefined && String(r.cftc_contract_market_code).trim() !== NQ_CFTC_CODE) continue;
    const reportDate = String(r.report_date_as_yyyy_mm_dd ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) continue;
    const nonCommercial = side(num(r.noncomm_positions_long_all), num(r.noncomm_positions_short_all));
    const commercial = side(num(r.comm_positions_long_all), num(r.comm_positions_short_all));
    const nonReportable = side(num(r.nonrept_positions_long_all), num(r.nonrept_positions_short_all));
    if (nonCommercial.net === null || commercial.net === null || nonReportable.net === null) continue;
    weeks.push({ reportDate, groups: { nonCommercial, commercial, nonReportable } });
  }
  if (!weeks.length) throw new Error('CFTC: no usable rows for contract ' + NQ_CFTC_CODE);
  return weeks.sort((a, b) => (a.reportDate < b.reportDate ? 1 : -1));
}
