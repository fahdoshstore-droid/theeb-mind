// ═══════════════════════════════════════════════════════════════
// New York time helpers — IANA America/New_York via Intl (handles DST).
// Never uses the server's local time zone or a fixed UTC offset.
// ═══════════════════════════════════════════════════════════════

export const NY_TZ = 'America/New_York';

export interface ZonedParts {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  weekday: number;              // 0=Sunday … 6=Saturday (in the zone)
  date: string;                 // YYYY-MM-DD in the zone
  minutesOfDay: number;
  offsetMinutes: number;        // zone offset from UTC at that instant (e.g. -240 EDT, -300 EST)
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function zonedParts(utcMs: number, tz: string = NY_TZ): ZonedParts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const hour = Number(p.hour) % 24;
  const year = Number(p.year), month = Number(p.month), day = Number(p.day);
  const minute = Number(p.minute), second = Number(p.second);
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = Math.round((asUTC - Math.floor(utcMs / 1000) * 1000) / 60000);
  return {
    year, month, day, hour, minute, second,
    weekday: WD[p.weekday] ?? new Date(asUTC).getUTCDay(),
    date: `${p.year}-${p.month}-${p.day}`,
    minutesOfDay: hour * 60 + minute,
    offsetMinutes,
  };
}

/**
 * Converts a wall-clock time in `tz` to UTC ms. Two-pass offset resolution.
 * For a non-existent local time (spring-forward gap) the result is shifted forward;
 * for an ambiguous one (fall-back) the earlier instant is returned. `ambiguous`/`gap` flags report it.
 */
export function zonedToUtc(
  y: number, mo: number, d: number, h = 0, mi = 0, s = 0, tz: string = NY_TZ,
): { utcMs: number; gap: boolean; ambiguous: boolean } {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  if (tz === 'UTC') return { utcMs: naive, gap: false, ambiguous: false };
  const off1 = zonedParts(naive, tz).offsetMinutes;
  let guess = naive - off1 * 60000;
  const off2 = zonedParts(guess, tz).offsetMinutes;
  guess = naive - off2 * 60000;
  const back = zonedParts(guess, tz);
  const gap = back.hour !== h || back.minute !== mi;
  if (gap) {
    // non-existent wall time: use the pre-transition offset, which lands just after the gap (shifted forward)
    return { utcMs: Math.max(naive - off1 * 60000, naive - off2 * 60000), gap: true, ambiguous: false };
  }
  // ambiguity: another instant one hour apart maps to the same wall time — return the earlier one
  const same = (ms: number) => { const p = zonedParts(ms, tz); return p.hour === h && p.minute === mi && p.day === d; };
  if (same(guess - 3600000)) return { utcMs: guess - 3600000, gap: false, ambiguous: true };
  if (same(guess + 3600000)) return { utcMs: guess, gap: false, ambiguous: true };
  return { utcMs: guess, gap: false, ambiguous: false };
}

export function hhmm(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60), m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
