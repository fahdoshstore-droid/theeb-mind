// ============================================================
// TRIL — manual marks for R (Raid), I (Inversion), L (Liquidity)
//
// MVP storage: this device only (localStorage). Nothing is sent to
// the server. Marks are records the trader writes; they are not drawn
// on the TradingView widget and they never produce a score or signal.
//
// Self-contained (no imports) so it can be unit-tested directly.
// ============================================================

export type MarkType = 'raid' | 'inversion' | 'liquidity';
export const MARK_TYPES: readonly MarkType[] = ['raid', 'inversion', 'liquidity'];
export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

export interface TrilMark {
  id: string;
  instrument: string;
  date: string; // YYYY-MM-DD (New York trading date)
  time: string; // HH:MM (New York)
  timeframe: Timeframe;
  type: MarkType;
  /** A single price uses priceLow only; a zone uses both. */
  priceLow: number;
  priceHigh: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type MarkInput = Omit<TrilMark, 'id' | 'createdAt' | 'updatedAt'>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MARKS_STORAGE_KEY = 'theeb-tril-marks-v1';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function validateMark(m: Partial<MarkInput>): string[] {
  const e: string[] = [];
  if (!m.instrument || !String(m.instrument).trim()) e.push('instrument');
  if (!m.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) e.push('date');
  if (!m.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time)) e.push('time');
  if (!m.timeframe || !(TIMEFRAMES as readonly string[]).includes(m.timeframe)) e.push('timeframe');
  if (!m.type || !MARK_TYPES.includes(m.type)) e.push('type');
  if (typeof m.priceLow !== 'number' || !Number.isFinite(m.priceLow) || m.priceLow <= 0) e.push('price');
  if (m.priceHigh !== null && m.priceHigh !== undefined) {
    if (typeof m.priceHigh !== 'number' || !Number.isFinite(m.priceHigh) || m.priceHigh <= 0) e.push('priceHigh');
    else if (typeof m.priceLow === 'number' && m.priceHigh < m.priceLow) e.push('zoneOrder');
  }
  if (m.note !== undefined && typeof m.note !== 'string') e.push('note');
  return e;
}

function isMark(x: unknown): x is TrilMark {
  if (!x || typeof x !== 'object') return false;
  const m = x as TrilMark;
  return typeof m.id === 'string' && validateMark(m).length === 0 && typeof m.createdAt === 'string';
}

export interface MarkStore {
  list(filter?: { instrument?: string; date?: string; type?: MarkType }): TrilMark[];
  add(input: MarkInput): Result<TrilMark>;
  update(id: string, patch: Partial<MarkInput>): Result<TrilMark>;
  remove(id: string): boolean;
  /** True when the device storage could not be read or written. */
  storageError(): boolean;
}

export function createMarkStore(
  storage: StorageLike | null,
  opts: { key?: string; now?: () => Date; newId?: () => string } = {},
): MarkStore {
  const key = opts.key ?? MARKS_STORAGE_KEY;
  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  let failed = false;
  let memory: TrilMark[] = [];

  const read = (): TrilMark[] => {
    if (!storage) return memory;
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isMark) : [];
    } catch {
      failed = true;
      return memory;
    }
  };
  const write = (marks: TrilMark[]) => {
    memory = marks;
    if (!storage) return;
    try { storage.setItem(key, JSON.stringify(marks)); } catch { failed = true; }
  };
  const normalise = (m: MarkInput): MarkInput => ({
    ...m,
    instrument: m.instrument.trim(),
    priceHigh: m.priceHigh === undefined ? null : m.priceHigh,
    note: (m.note ?? '').trim(),
  });

  return {
    list(filter = {}) {
      return read()
        .filter((m) => (!filter.instrument || m.instrument === filter.instrument)
          && (!filter.date || m.date === filter.date)
          && (!filter.type || m.type === filter.type))
        .sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : a.date + a.time > b.date + b.time ? -1 : 0));
    },
    add(input) {
      const n = normalise(input);
      const errors = validateMark(n);
      if (errors.length) return { ok: false, errors };
      const t = now().toISOString();
      const mark: TrilMark = { ...n, id: newId(), createdAt: t, updatedAt: t };
      write([...read(), mark]);
      return { ok: true, value: mark };
    },
    update(id, patch) {
      const all = read();
      const i = all.findIndex((m) => m.id === id);
      if (i < 0) return { ok: false, errors: ['notFound'] };
      const merged = normalise({ ...all[i], ...patch } as MarkInput);
      const errors = validateMark(merged);
      if (errors.length) return { ok: false, errors };
      const updated: TrilMark = { ...all[i], ...merged, id, createdAt: all[i].createdAt, updatedAt: now().toISOString() };
      const next = all.slice();
      next[i] = updated;
      write(next);
      return { ok: true, value: updated };
    },
    remove(id) {
      const all = read();
      const next = all.filter((m) => m.id !== id);
      if (next.length === all.length) return false;
      write(next);
      return true;
    },
    storageError: () => failed,
  };
}

/** Browser storage, or null when it is blocked (private mode, disabled site data). */
export function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__theeb_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
