// Session windows in America/New_York time (DST-aware). NY AM / NY PM follow the TRIL source summary
// (09:30–12:10 and 13:30–16:10). Other sessions are context labels only and never count as "active".
import { zonedParts, NY_TZ } from '../domain/ny-time.js';
import { SOURCE_KILLZONES } from '../domain/tril.js';

export const KILLZONES = {
  nyAM: { start: SOURCE_KILLZONES.ny_am.start, end: SOURCE_KILLZONES.ny_am.end, label: 'نيويورك صباحاً (09:30–12:10 NY)', active: true },
  nyPM: { start: SOURCE_KILLZONES.ny_pm.start, end: SOURCE_KILLZONES.ny_pm.end, label: 'نيويورك مساءً (13:30–16:10 NY)', active: true },
  nyLunch: { start: 12 * 60 + 10, end: 13 * 60 + 30, label: 'نيويورك غداء', active: false },
} as const;

export type KillzoneKey = keyof typeof KILLZONES;

export interface CurrentKillzone {
  key: KillzoneKey | null;
  label: string | null;
  isActive: boolean;
}

export function getKillzoneAt(utcMs: number): CurrentKillzone {
  const m = zonedParts(utcMs, NY_TZ).minutesOfDay;
  for (const [key, z] of Object.entries(KILLZONES)) {
    if (m >= z.start && m < z.end) return { key: key as KillzoneKey, label: z.label, isActive: z.active };
  }
  return { key: null, label: null, isActive: false };
}

export function getCurrentKillzone(): CurrentKillzone {
  return getKillzoneAt(Date.now());
}

/** @deprecated hour-based lookup; kept for callers that only know a NY hour. */
export function getKillzoneByHour(nyHour: number): KillzoneKey | null {
  const m = nyHour * 60;
  for (const [key, z] of Object.entries(KILLZONES)) if (m >= z.start && m < z.end) return key as KillzoneKey;
  return null;
}
