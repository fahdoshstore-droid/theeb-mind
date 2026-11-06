// ============================================================
// TRIL — T (Time)
// Approved methodology: Monday, Tuesday, Thursday only,
// 09:30–12:10 America/New_York. The window starts at 09:30:00 and
// ends at 12:10:00 (12:10 itself is outside). DST is handled by the
// IANA time zone through Intl — never by a fixed UTC offset and never
// by the browser's local time zone.
//
// This module is self-contained (no imports) and isolated from the
// legacy killzone / scoring code.
// ============================================================

export const TRIL_TIME = {
  timeZone: 'America/New_York',
  startMinute: 9 * 60 + 30, // 09:30
  endMinute: 12 * 60 + 10, // 12:10 (exclusive)
  allowedWeekdays: [1, 2, 4] as readonly number[], // Mon, Tue, Thu
  label: 'NY AM 09:30–12:10',
} as const;

export type TrilTimeStatus = 'IN_WINDOW' | 'BEFORE_WINDOW' | 'AFTER_WINDOW' | 'DAY_NOT_ALLOWED';

export interface NyParts {
  date: string; // YYYY-MM-DD in New York
  time: string; // HH:MM in New York
  weekday: number; // 0 = Sunday … 6 = Saturday, in New York
  minuteOfDay: number;
  second: number;
  utcOffsetMinutes: number; // −240 during EDT, −300 during EST
}

export interface TrilTimeResult extends NyParts {
  status: TrilTimeStatus;
  inWindow: boolean;
  allowedDay: boolean;
  /** Minutes until 09:30 today, when the day is allowed and the window has not started. */
  minutesUntilStart: number | null;
  /** Minutes until 12:10, while inside the window (rounded up). */
  minutesRemaining: number | null;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
let formatter: Intl.DateTimeFormat | null = null;

function nyFormatter(): Intl.DateTimeFormat {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TRIL_TIME.timeZone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }
  return formatter;
}

export function nyParts(utcMs: number): NyParts {
  const p: Record<string, string> = {};
  for (const part of nyFormatter().formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  const second = Number(p.second);
  const year = Number(p.year), month = Number(p.month), day = Number(p.day);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcOffsetMinutes = Math.round((wallAsUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${String(hour).padStart(2, '0')}:${p.minute}`,
    weekday: WEEKDAY[p.weekday] ?? new Date(wallAsUtc).getUTCDay(),
    minuteOfDay: hour * 60 + minute,
    second,
    utcOffsetMinutes,
  };
}

export function evaluateTrilTime(utcMs: number): TrilTimeResult {
  const p = nyParts(utcMs);
  const allowedDay = TRIL_TIME.allowedWeekdays.includes(p.weekday);
  const m = p.minuteOfDay;
  let status: TrilTimeStatus;
  if (!allowedDay) status = 'DAY_NOT_ALLOWED';
  else if (m < TRIL_TIME.startMinute) status = 'BEFORE_WINDOW';
  else if (m >= TRIL_TIME.endMinute) status = 'AFTER_WINDOW';
  else status = 'IN_WINDOW';
  const exact = m + p.second / 60;
  return {
    ...p,
    status,
    inWindow: status === 'IN_WINDOW',
    allowedDay,
    minutesUntilStart: status === 'BEFORE_WINDOW' ? Math.ceil(TRIL_TIME.startMinute - exact) : null,
    minutesRemaining: status === 'IN_WINDOW' ? Math.ceil(TRIL_TIME.endMinute - exact) : null,
  };
}

export const WEEKDAY_LABELS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function formatOffset(utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes < 0 ? '−' : '+';
  const a = Math.abs(utcOffsetMinutes);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`;
}
