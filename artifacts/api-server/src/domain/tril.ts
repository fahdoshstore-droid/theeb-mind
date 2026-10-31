// ═══════════════════════════════════════════════════════════════
// TRIL evaluator — T Time · R Raid · I Inversion · L Liquidity.
// Definition source: the user's summary of "TRIL trading system.pdf" (build prompt §4, 2026-10-31).
// The PDF itself was not available to this build; nothing beyond that summary is encoded.
//
// Principles
//  • Every criterion needs a recorded state AND an evidence source. A "yes" without a source,
//    or AI-assisted evidence the trader has not confirmed, is NOT evidence.
//  • Missing evidence ⇒ INSUFFICIENT_EVIDENCE, never PASS.
//  • PASS means "criteria satisfied by the recorded evidence" — it is not a win probability.
//  • "OD 30–40" appears in the source summary without a documented meaning: it is not interpreted.
// ═══════════════════════════════════════════════════════════════
import { NY_TZ, zonedParts, hhmm } from './ny-time.js';

export const TRIL_METHODOLOGY_VERSION = 'TRIL-source-summary-2026-10-31';

export type EvidenceState = 'yes' | 'no' | 'unclear' | 'na';
export type EvidenceSource = 'manual' | 'screenshot' | 'market_data' | 'ai_assisted';
export type ComponentStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE';
export type InversionState = 'none' | 'formed' | 'confirmed' | 'retest_seen' | 'invalidated';

export interface EvidenceItem {
  state?: EvidenceState | null;
  source?: EvidenceSource | null;
  note?: string | null;
  ref?: string | null;               // screenshot id / chart link
  confirmedByUser?: boolean | null;  // required for AI-assisted evidence to count
}

/** Reference methodology windows (source). Minutes of day in New York time, [start, end). */
export const SOURCE_KILLZONES = {
  ny_am: { label: 'NY AM Kill Zone', start: 9 * 60 + 30, end: 12 * 60 + 10 },
  ny_pm: { label: 'NY PM Kill Zone', start: 13 * 60 + 30, end: 16 * 60 + 10 },
} as const;
export type SessionKey = keyof typeof SOURCE_KILLZONES;

/** Macro windows, by minute of the hour. xx:50–xx:10 wraps across the hour. */
export const MACRO_WINDOWS = {
  cr: { label: 'xx:50–xx:10 (C/R — continuation/reversal)', inWindow: (m: number) => m >= 50 || m < 10 },
  mss_acc: { label: 'xx:20–xx:40 (MSS / ACC / M)', inWindow: (m: number) => m >= 20 && m < 40 },
} as const;

export interface TimeContext {
  nyTime: string; nyDate: string; weekday: number; utcOffsetMinutes: number;
  sourceKillzone: SessionKey | null;
  inEnabledSession: boolean;
  enabledSessions: SessionKey[];
  macroWindow: keyof typeof MACRO_WINDOWS | null;
}

export function timeContext(utcMs: number, enabledSessions: SessionKey[]): TimeContext {
  const p = zonedParts(utcMs, NY_TZ);
  let kz: SessionKey | null = null;
  for (const [k, z] of Object.entries(SOURCE_KILLZONES)) if (p.minutesOfDay >= z.start && p.minutesOfDay < z.end) kz = k as SessionKey;
  let macro: keyof typeof MACRO_WINDOWS | null = null;
  for (const [k, w] of Object.entries(MACRO_WINDOWS)) if (w.inWindow(p.minute)) macro = k as keyof typeof MACRO_WINDOWS;
  return {
    nyTime: hhmm(p.minutesOfDay), nyDate: p.date, weekday: p.weekday, utcOffsetMinutes: p.offsetMinutes,
    sourceKillzone: kz, inEnabledSession: kz != null && enabledSessions.includes(kz), enabledSessions, macroWindow: macro,
  };
}

export interface TrilInput {
  decisionTime?: string | null;          // ISO instant the decision/entry was made
  enabledSessions: SessionKey[];         // from the user's personal profile (not the source)
  sessionsConfirmed?: boolean;           // whether the user confirmed the enabled-session setting
  time?: { macroExceptionRaidToPdArray?: EvidenceItem };
  raid?: { liquiditySwept?: EvidenceItem & { level?: string | null }; smtVsEs?: EvidenceItem };
  inversion?: { type?: 'ifvg' | 'breaker' | null; state?: InversionState | null; source?: EvidenceSource | null; confirmedByUser?: boolean | null; note?: string | null;
    directPdArrayAfterRaid?: EvidenceItem };
  liquidity?: { drawOnLiquidity?: string | null; dolType?: 'ERL' | 'IRL' | null; target?: string | null; invalidation?: string | null; erlIrlStoryClear?: EvidenceItem;
    source?: EvidenceSource | null };
  topDown?: { htfBias?: 'bullish' | 'bearish' | 'neutral' | 'unclear' | null; mtf?: 'aligned' | 'conflict' | 'unclear' | null; ltfModel?: EvidenceItem };
}

export interface ComponentResult {
  key: 'T' | 'R' | 'I' | 'L' | 'TOP_DOWN';
  name: string;
  status: ComponentStatus;
  reasons: string[];
  missing: string[];
  evidenceSources: EvidenceSource[];
}

export interface TrilResult {
  methodologyVersion: string;
  overall: ComponentStatus;
  overallLabel: string;
  components: ComponentResult[];
  timeContext: TimeContext | null;
  notes: string[];
  disclaimer: string;
}

/** Exception items: not recorded → missing (ask the trader); explicit "na" → the exception does not apply. */
function exceptionVerdict(item: EvidenceItem | undefined | null, label: string) {
  if (!item || !item.state) return { v: 'missing' as const, why: `${label}: not recorded` };
  if (item.state === 'na') return { v: 'no' as const };
  return itemVerdict(item, label);
}

/** Evidence counts only with a state, a source and — for AI — the trader's confirmation. */
export function itemVerdict(item: EvidenceItem | undefined | null, label: string, optional = false):
  { v: 'yes' | 'no' | 'missing' | 'na'; why?: string; source?: EvidenceSource } {
  if (!item || !item.state) return { v: optional ? 'na' : 'missing', why: `${label}: not recorded` };
  if (item.state === 'na') return optional ? { v: 'na' } : { v: 'missing', why: `${label}: marked not-applicable, but it is a required TRIL criterion` };
  if (item.state === 'unclear') return { v: 'missing', why: `${label}: recorded as unclear` };
  if (!item.source) return { v: 'missing', why: `${label}: "${item.state}" recorded without an evidence source` };
  if (item.source === 'ai_assisted' && !item.confirmedByUser) return { v: 'missing', why: `${label}: AI-assisted evidence not confirmed by the trader` };
  return { v: item.state, source: item.source };
}

function combine(key: ComponentResult['key'], name: string, parts: { v: string; why?: string; source?: EvidenceSource; failWhy?: string }[]): ComponentResult {
  const reasons: string[] = [], missing: string[] = [], sources = new Set<EvidenceSource>();
  let anyNo = false, anyMissing = false;
  for (const p of parts) {
    if (p.source) sources.add(p.source);
    if (p.v === 'no') { anyNo = true; reasons.push(p.failWhy || p.why || 'criterion not met'); }
    else if (p.v === 'missing') { anyMissing = true; missing.push(p.why || 'missing'); }
    else if (p.why) reasons.push(p.why);
  }
  const status: ComponentStatus = anyNo ? 'FAIL' : anyMissing ? 'INSUFFICIENT_EVIDENCE' : 'PASS';
  return { key, name, status, reasons, missing, evidenceSources: [...sources] };
}

export function evaluateTril(input: TrilInput): TrilResult {
  const notes: string[] = [];
  // ── T — Time ───────────────────────────────────────────────
  let tc: TimeContext | null = null;
  const tParts: { v: string; why?: string; source?: EvidenceSource; failWhy?: string }[] = [];
  const ms = input.decisionTime ? Date.parse(input.decisionTime) : NaN;
  if (!Number.isFinite(ms)) tParts.push({ v: 'missing', why: 'Time: decision/entry timestamp not recorded' });
  else {
    tc = timeContext(ms, input.enabledSessions);
    if (!input.enabledSessions.length) tParts.push({ v: 'missing', why: 'Time: no personal trading session is enabled in your profile' });
    else if (tc.inEnabledSession) tParts.push({ v: 'yes', why: `Time: ${tc.nyTime} NY is inside ${SOURCE_KILLZONES[tc.sourceKillzone!].label} (enabled in your profile)`, source: 'market_data' });
    else if (tc.sourceKillzone) tParts.push({ v: 'no', failWhy: `Time: ${tc.nyTime} NY is inside the methodology's ${SOURCE_KILLZONES[tc.sourceKillzone].label}, but that session is not enabled in your personal profile` });
    else tParts.push({ v: 'no', failWhy: `Time: ${tc.nyTime} NY is outside both NY kill zones (AM 09:30–12:10, PM 13:30–16:10)` });
    if (tc.macroWindow) tParts.push({ v: 'yes', why: `Macro window: ${MACRO_WINDOWS[tc.macroWindow].label}`, source: 'market_data' });
    else {
      const ex = exceptionVerdict(input.time?.macroExceptionRaidToPdArray, 'Macro-window exception (major liquidity raid → direct PD Array)');
      if (ex.v === 'yes') tParts.push({ v: 'yes', why: 'Outside macro windows, exception recorded: major liquidity raid then direct PD Array', source: ex.source });
      else if (ex.v === 'no') tParts.push({ v: 'no', failWhy: `Macro window: ${tc.nyTime} is outside xx:50–xx:10 and xx:20–xx:40, and no raid→PD Array exception was recorded` });
      else tParts.push({ v: 'missing', why: `Macro window: outside macro windows; exception evidence ${ex.why?.split(': ')[1] ?? 'missing'}` });
    }
    if (input.sessionsConfirmed === false) notes.push('Your enabled-session setting has not been confirmed yet (source describes AM and PM; an older personal setting used AM only).');
  }
  const T = combine('T', 'Time', tParts);

  // ── R — Raid ───────────────────────────────────────────────
  const sweep = itemVerdict(input.raid?.liquiditySwept, 'Liquidity raid of a major high/low');
  const smt = itemVerdict(input.raid?.smtVsEs, 'SMT divergence vs ES');
  const level = input.raid?.liquiditySwept?.level?.trim();
  const R = combine('R', 'Raid', [
    { ...sweep, why: sweep.v === 'yes' ? `Raid recorded${level ? ` on ${level}` : ''}` : sweep.why, failWhy: 'No raid of a major high/low' },
    { ...smt, why: smt.v === 'yes' ? 'SMT vs ES recorded' : smt.why, failWhy: 'No SMT divergence vs ES' },
  ]);
  if (input.raid?.smtVsEs?.source === 'market_data') notes.push('SMT marked as market data: this app does not fetch ES data itself — the attached reference must show the ES comparison.');

  // ── I — Inversion ──────────────────────────────────────────
  const inv = input.inversion;
  const iParts: { v: string; why?: string; source?: EvidenceSource; failWhy?: string }[] = [];
  if (!inv || !inv.state) iParts.push({ v: 'missing', why: 'Inversion: IFVG/Breaker state not recorded' });
  else if (!inv.source) iParts.push({ v: 'missing', why: `Inversion: state "${inv.state}" recorded without an evidence source` });
  else if (inv.source === 'ai_assisted' && !inv.confirmedByUser) iParts.push({ v: 'missing', why: 'Inversion: AI-assisted evidence not confirmed by the trader' });
  else if (!inv.type && inv.state !== 'none') iParts.push({ v: 'missing', why: 'Inversion: type (IFVG or Breaker) not recorded' });
  else {
    const name = inv.type === 'breaker' ? 'Breaker' : 'IFVG';
    if (inv.state === 'none') iParts.push({ v: 'no', failWhy: 'Inversion: no IFVG/Breaker' });
    else if (inv.state === 'invalidated') iParts.push({ v: 'no', failWhy: `Inversion: ${name} invalidated` });
    else if (inv.state === 'formed') iParts.push({ v: 'no', failWhy: `Inversion: ${name} only formed — visual presence is not entry confirmation` });
    else if (inv.state === 'retest_seen') iParts.push({ v: 'yes', why: `Inversion: ${name} confirmed and retest seen`, source: inv.source });
    else { // confirmed, no retest yet
      const ex = exceptionVerdict(inv.directPdArrayAfterRaid, 'Retest exception (clear raid → price at PD Array directly)');
      if (ex.v === 'yes' && sweep.v === 'yes') iParts.push({ v: 'yes', why: `Inversion: ${name} confirmed; retest not required (raid → direct PD Array exception recorded)`, source: inv.source });
      else if (ex.v === 'yes') iParts.push({ v: 'missing', why: 'Inversion: retest exception requires a recorded liquidity raid' });
      else if (ex.v === 'missing') iParts.push({ v: 'missing', why: `Inversion: ${name} confirmed, retest not seen; exception ${ex.why?.split(': ')[1] ?? 'missing'}` });
      else iParts.push({ v: 'no', failWhy: `Inversion: ${name} confirmed but the entry model's retest was not seen and no exception applies` });
    }
  }
  const I = combine('I', 'Inversion', iParts);

  // ── L — Liquidity ──────────────────────────────────────────
  const liq = input.liquidity;
  const lParts: { v: string; why?: string; source?: EvidenceSource; failWhy?: string }[] = [];
  const need = (val: string | null | undefined, label: string) => (val && val.trim()
    ? { v: 'yes', why: `${label}: ${val.trim()}`, source: liq?.source ?? 'manual' as EvidenceSource }
    : { v: 'missing', why: `${label}: not recorded` });
  lParts.push(need(liq?.drawOnLiquidity ? `${liq.drawOnLiquidity}${liq.dolType ? ` (${liq.dolType})` : ''}` : null, 'Draw on Liquidity'));
  lParts.push(need(liq?.target, 'Target'));
  lParts.push(need(liq?.invalidation, 'Invalidation'));
  const story = itemVerdict(liq?.erlIrlStoryClear, 'ERL ↔ IRL story clear');
  lParts.push({ ...story, why: story.v === 'yes' ? 'ERL ↔ IRL movement is clear' : story.why, failWhy: 'ERL ↔ IRL story not clear — the source says to avoid trading the chop scenario' });
  const L = combine('L', 'Liquidity', lParts);

  // ── Top-down context (reported separately; not one of the four letters) ──
  const td = input.topDown;
  const tdParts: { v: string; why?: string; source?: EvidenceSource; failWhy?: string }[] = [];
  if (!td?.htfBias || td.htfBias === 'unclear') tdParts.push({ v: 'missing', why: 'HTF bias not recorded / unclear' });
  else tdParts.push({ v: 'yes', why: `HTF bias: ${td.htfBias}`, source: 'manual' });
  if (!td?.mtf || td.mtf === 'unclear') tdParts.push({ v: 'missing', why: 'MTF alignment not recorded / unclear' });
  else if (td.mtf === 'conflict') {
    tdParts.push({ v: 'yes', why: 'MTF conflicts with HTF', source: 'manual' });
    notes.push('HTF/MTF conflict: your reference says reduce contract size and trade the MTF structure (source-specific guidance, not a general rule).');
  } else tdParts.push({ v: 'yes', why: 'MTF aligned with HTF', source: 'manual' });
  const ltf = itemVerdict(td?.ltfModel, 'LTF entry model present');
  tdParts.push({ ...ltf, failWhy: 'LTF entry model not present' });
  const TD = combine('TOP_DOWN', 'Top-down HTF/MTF/LTF', tdParts);

  const core = [T, R, I, L];
  const overall: ComponentStatus = core.some((c) => c.status === 'FAIL') ? 'FAIL'
    : core.some((c) => c.status === 'INSUFFICIENT_EVIDENCE') ? 'INSUFFICIENT_EVIDENCE' : 'PASS';
  const overallLabel = overall === 'PASS' ? 'PASS — all four TRIL criteria satisfied by recorded evidence'
    : overall === 'FAIL' ? 'FAIL — at least one TRIL criterion recorded as not met'
    : 'INSUFFICIENT EVIDENCE — at least one TRIL criterion lacks recorded evidence';
  return {
    methodologyVersion: TRIL_METHODOLOGY_VERSION, overall, overallLabel,
    components: [...core, TD], timeContext: tc, notes,
    disclaimer: 'TRIL status describes whether your recorded evidence satisfies the methodology. It is not a probability of winning.',
  };
}
