import { CONFIG } from './constants.js';

export type KillzoneKey = keyof typeof CONFIG.KILLZONES;

export interface CurrentKillzone {
  key: KillzoneKey | null;
  label: string | null;
  isActive: boolean;
}

export function getCurrentKillzone(): CurrentKillzone {
  const hour = new Date().getUTCHours();

  for (const [key, zone] of Object.entries(CONFIG.KILLZONES)) {
    if (hour >= zone.start && hour < zone.end) {
      return { key: key as KillzoneKey, label: zone.label, isActive: true };
    }
  }

  return { key: null, label: null, isActive: false };
}

export function getKillzoneByHour(hour: number): KillzoneKey | null {
  for (const [key, zone] of Object.entries(CONFIG.KILLZONES)) {
    if (hour >= zone.start && hour < zone.end) {
      return key as KillzoneKey;
    }
  }
  return null;
}