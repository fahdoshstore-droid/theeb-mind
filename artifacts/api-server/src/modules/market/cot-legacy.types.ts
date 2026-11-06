// ============================================================
// THEEB MIND — Legacy COT (NASDAQ-100) types
// Groups follow the CFTC Legacy report: Non-commercial,
// Commercial, Non-reportable. MarketBulls is the primary source,
// CFTC is the independent validation source.
// ============================================================

export type LegacyGroupKey = 'nonCommercial' | 'commercial' | 'nonReportable';
export const LEGACY_GROUP_KEYS: readonly LegacyGroupKey[] = ['nonCommercial', 'commercial', 'nonReportable'];

export type LegacyField = 'long' | 'short' | 'net';
export const LEGACY_FIELDS: readonly LegacyField[] = ['long', 'short', 'net'];

/** One group's positions. A field is null when the source does not publish it — never 0. */
export interface LegacyGroupPositions {
  long: number | null;
  short: number | null;
  net: number | null;
}

export type LegacyGroups = Record<LegacyGroupKey, LegacyGroupPositions>;

/** One weekly report (positions as of Tuesday). */
export interface LegacyWeek {
  reportDate: string; // YYYY-MM-DD
  groups: LegacyGroups;
}

export type LegacyCotStatus = 'VERIFIED' | 'MISMATCH' | 'DATA_UNAVAILABLE';

export type LegacyCotReason =
  | 'PRIMARY_UNAVAILABLE'
  | 'VALIDATION_UNAVAILABLE'
  | 'BOTH_UNAVAILABLE'
  | 'VALIDATION_WEEK_NOT_FOUND'
  | 'NO_COMPARABLE_FIELDS'
  | 'VALUES_DIFFER';

export type SourceFetchStatus = 'OK' | 'UNAVAILABLE';

export interface LegacyDifference {
  reportDate: string;
  group: LegacyGroupKey;
  field: LegacyField;
  primary: number;
  validation: number;
  /** primary − validation, in contracts */
  delta: number;
}

export interface SourceReport {
  name: 'MarketBulls' | 'CFTC';
  url: string;
  status: SourceFetchStatus;
  fetchedAt: string;
  latestReportDate: string | null;
  error: string | null;
  /** Only present when status is MISMATCH, so both sides can be inspected. Never marked as verified. */
  unverifiedLatest?: LegacyWeek;
}

export interface LegacyCotHistoryPoint {
  reportDate: string;
  nonCommercialNet: number | null;
  commercialNet: number | null;
  nonReportableNet: number | null;
}

/** The validation rule currently applied. Provisional until real responses have been reviewed. */
export const VALIDATION_RULE = 'PROVISIONAL_EXACT_MATCH' as const;
export const VALIDATION_RULE_NOTE =
  'Provisional: every field published by both sources must be identical. No tolerance is applied. ' +
  'This rule is pending review of observed differences between MarketBulls and CFTC.';

export interface LegacyCotResult {
  status: LegacyCotStatus;
  reason: LegacyCotReason | null;
  instrument: 'NASDAQ-100';
  report: 'CFTC_LEGACY_FUTURES_ONLY';
  cftcContractCode: string;
  /** Report week that was compared. null when nothing could be compared. */
  reportDate: string | null;
  /** Only set when status is VERIFIED. */
  groups: LegacyGroups | null;
  /** Week-over-week change in net, only when the previous week is also verified. */
  netChange: Record<LegacyGroupKey, number | null> | null;
  /** Verified weeks only, newest first. Only set when status is VERIFIED. */
  history: LegacyCotHistoryPoint[] | null;
  validation: {
    rule: typeof VALIDATION_RULE;
    note: string;
    comparedWeek: string | null;
    fieldsCompared: number;
    differences: LegacyDifference[];
  };
  sources: { primary: SourceReport; validation: SourceReport };
  checkedAt: string;
}
