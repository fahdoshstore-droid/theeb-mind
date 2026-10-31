// Timestamp parsing for imports. A timestamp without an explicit offset is interpreted
// in the time zone the user selected for the import — never in the server's zone.
import { zonedToUtc } from './ny-time.js';

export interface ParsedTimestamp {
  utcMs: number;
  iso: string;
  hadOffset: boolean;     // the source string carried its own UTC offset / Z / epoch
  gap?: boolean;          // local time does not exist (DST spring-forward)
  ambiguous?: boolean;    // local time occurs twice (DST fall-back) — earlier instant used
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function parseTimestamp(raw: unknown, tz: string, dateOrder: 'MDY' | 'DMY' = 'MDY'): ParsedTimestamp | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const done = (ms: number, hadOffset: boolean, extra: Partial<ParsedTimestamp> = {}): ParsedTimestamp | null =>
    Number.isFinite(ms) ? { utcMs: ms, iso: new Date(ms).toISOString(), hadOffset, ...extra } : null;

  if (/^\d{10}(\.\d+)?$/.test(s)) return done(Math.round(Number(s) * 1000), true);
  if (/^\d{13}$/.test(s)) return done(Number(s), true);
  if (/^\d{19}$/.test(s)) return done(Number(BigInt(s) / 1000000n), true);

  const iso = s.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
  if (/^\d{4}-\d{2}-\d{2}T.*([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)) return done(Date.parse(iso), true);

  let y: number, mo: number, d: number, rest: string;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/))) {
    const a = +m[1], b = +m[2];
    y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (dateOrder === 'DMY') { d = a; mo = b; } else { mo = a; d = b; }
    rest = m[4];
  } else if ((m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})(.*)$/))) {
    d = +m[1]; mo = MONTHS[m[2].toLowerCase()]; y = +m[3]; rest = m[4];
  } else if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})(.*)$/))) {
    mo = MONTHS[m[1].toLowerCase()]; d = +m[2]; y = +m[3]; rest = m[4];
  } else return null;
  if (!mo || mo > 12 || d < 1 || d > 31) return null;

  let h = 0, mi = 0, sec = 0;
  const t = rest.replace(/^[T ,]+/, '').trim();
  if (t) {
    const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*([AaPp][Mm])?\s*(.*)$/);
    if (!tm) return null;
    h = +tm[1]; mi = +tm[2]; sec = +(tm[3] || 0);
    const ampm = tm[4]?.toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    const tail = tm[5].trim();
    if (tail) {
      if (/^(z|utc|gmt)$/i.test(tail)) return done(Date.UTC(y, mo - 1, d, h, mi, sec), true);
      const off = tail.match(/^([+-])(\d{2}):?(\d{2})$/);
      if (!off) return null;
      const sign = off[1] === '-' ? -1 : 1;
      return done(Date.UTC(y, mo - 1, d, h, mi, sec) - sign * (+off[2] * 60 + +off[3]) * 60000, true);
    }
  }
  if (h > 23 || mi > 59 || sec > 59) return null;
  const r = zonedToUtc(y, mo, d, h, mi, sec, tz);
  return done(r.utcMs, false, { gap: r.gap, ambiguous: r.ambiguous });
}

/** Parses money/number strings: "$1,234.50", "(12.50)", "-12.5", "1.234,50" is NOT supported (ambiguous). */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s || /^(n\/?a|null|none|-|—)$/i.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[$€£\s]/g, '').replace(/USD$/i, '');
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
