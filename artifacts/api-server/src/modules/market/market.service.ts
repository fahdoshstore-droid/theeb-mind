// ============================================
// THEEB MIND — Market Intelligence Service
// ============================================
// Macro context: DXY, VIX, US10Y snapshots,
// Economic Calendar, Weekly Bias, Macro Narrative
// ============================================

import { db } from '../../db/db.js';
import { randomUUID } from 'crypto';

// ── Row shapes ───────────────────────────────

interface SnapshotRow {
  id: string;
  instrument: string;
  metric: string;
  value: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  note: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  title: string;
  title_ar: string | null;
  impact: 'high' | 'medium' | 'low';
  event_date: string;
  currency: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  created_at: string;
}

interface BiasRow {
  id: string;
  user_id: string;
  instrument: string;
  bias: 'bullish' | 'bearish' | 'neutral';
  week_key: string;
  notes: string | null;
  created_at: string;
}

interface NarrativeRow {
  id: string;
  user_id: string;
  narrative_text: string;
  week_key: string;
  created_at: string;
}

// ── Week key helper ───────────────────────────

export function currentWeekKey(): string {
  const now = new Date();
  // ISO week number
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Seed data ─────────────────────────────────

let seeded = false;

export function seedMarketDataIfEmpty(): void {
  if (seeded) return;
  seeded = true;

  const raw = db.raw;

  // Snapshots
  const count = (raw.prepare('SELECT COUNT(*) as c FROM market_snapshots').get() as { c: number }).c;
  if (count === 0) {
    const ins = raw.prepare(
      `INSERT INTO market_snapshots (id, instrument, metric, value, direction, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertMany = raw.transaction((rows: Array<[string, string, string, number, string, string]>) => {
      for (const r of rows) ins.run(...r);
    });
    insertMany([
      [randomUUID(), 'DXY',   'index',  104.62, 'neutral',  'Dollar Index — consolidation near 104.5–105 resistance'],
      [randomUUID(), 'VIX',   'index',   13.4,  'neutral',  'Volatility — low regime, below 15 threshold'],
      [randomUUID(), 'US10Y', 'yield',    4.23, 'bearish',  'US 10-Year yield — mild pullback from 4.35'],
      [randomUUID(), 'GOLD',  'spot',  2380.0,  'bullish',  'Gold — bullish bias above key 2350 support'],
      [randomUUID(), 'NAS',   'future', 19640.0,'bullish',  'Nasdaq Futures — uptrend intact above 19200'],
    ] as Array<[string, string, string, number, string, string]>);
  }

  // Economic events — current week
  const weekKey = currentWeekKey();
  const evCount = (raw.prepare('SELECT COUNT(*) as c FROM economic_events').get() as { c: number }).c;
  if (evCount === 0) {
    // Seed a realistic week of events centred around "today"
    const base = new Date();
    const toISO = (offset: number) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };
    const insEv = raw.prepare(
      `INSERT INTO economic_events (id, title, title_ar, impact, event_date, currency, forecast, previous)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const rows: Array<[string, string, string, string, string, string, string, string]> = [
      [randomUUID(), 'FOMC Meeting Minutes',        'محضر اجتماع الفيدرالي',          'high',   toISO(-1), 'USD', '',       ''],
      [randomUUID(), 'US CPI (MoM)',                'مؤشر أسعار المستهلكين الأمريكي', 'high',   toISO(0),  'USD', '0.3%',   '0.4%'],
      [randomUUID(), 'US Initial Jobless Claims',   'طلبات إعانة البطالة الأمريكية',  'medium', toISO(1),  'USD', '225K',   '222K'],
      [randomUUID(), 'BOE Interest Rate Decision',  'قرار سعر الفائدة البريطاني',     'high',   toISO(1),  'GBP', '5.00%',  '5.25%'],
      [randomUUID(), 'US Retail Sales (MoM)',       'مبيعات التجزئة الأمريكية',       'high',   toISO(2),  'USD', '0.2%',   '-0.1%'],
      [randomUUID(), 'Michigan Consumer Sentiment', 'ثقة المستهلك — ميشيغان',         'medium', toISO(2),  'USD', '66.0',   '65.6'],
    ];
    const insMany = raw.transaction((rs: typeof rows) => { for (const r of rs) insEv.run(...r); });
    insMany(rows);
  }

  // Weekly bias seeds for dev user
  const biasCount = (raw.prepare(`SELECT COUNT(*) as c FROM weekly_bias WHERE week_key = ?`).get(weekKey) as { c: number }).c;
  if (biasCount === 0) {
    const insBias = raw.prepare(
      `INSERT OR IGNORE INTO weekly_bias (id, user_id, instrument, bias, week_key, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const seeds = [
      ['GOLD', 'bullish', 'فوق 2350 — الميل صعودي'],
      ['DXY',  'neutral', 'ترقب بيانات التضخم'],
      ['NAS',  'bullish', 'زخم صعودي فوق 19200'],
    ] as Array<[string, string, string]>;
    const tx = raw.transaction(() => {
      for (const [inst, bias, notes] of seeds) {
        insBias.run(randomUUID(), 'user-1', inst, bias, weekKey, notes);
      }
    });
    tx();
  }
}

// ── Market Snapshots ──────────────────────────

/** Latest snapshot per instrument+metric */
export function getLatestSnapshots(): SnapshotRow[] {
  const raw = db.raw;
  const rows = raw.prepare(`
    SELECT ms.*
    FROM market_snapshots ms
    INNER JOIN (
      SELECT instrument, metric, MAX(created_at) as latest
      FROM market_snapshots
      GROUP BY instrument, metric
    ) sub ON ms.instrument = sub.instrument AND ms.metric = sub.metric AND ms.created_at = sub.latest
    ORDER BY ms.instrument
  `).all() as SnapshotRow[];
  return rows;
}

/** Insert a new snapshot record */
export function insertSnapshot(
  instrument: string,
  metric: string,
  value: number,
  direction: 'bullish' | 'bearish' | 'neutral',
  note?: string
): SnapshotRow {
  const id = randomUUID();
  db.raw.prepare(
    `INSERT INTO market_snapshots (id, instrument, metric, value, direction, note)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, instrument.toUpperCase(), metric, value, direction, note ?? null);
  return db.raw.prepare('SELECT * FROM market_snapshots WHERE id = ?').get(id) as SnapshotRow;
}

// ── Economic Events ───────────────────────────

/** Events within the past 7 days and next 14 days */
export function getEconomicEvents(): EventRow[] {
  const rows = db.raw.prepare(`
    SELECT * FROM economic_events
    WHERE event_date >= date('now', '-7 days')
      AND event_date <= date('now', '+14 days')
    ORDER BY event_date ASC
  `).all() as EventRow[];
  return rows;
}

/** Insert an economic event */
export function insertEconomicEvent(ev: {
  title: string; titleAr?: string; impact: 'high'|'medium'|'low';
  eventDate: string; currency: string; actual?: string; forecast?: string; previous?: string;
}): EventRow {
  const id = randomUUID();
  db.raw.prepare(
    `INSERT INTO economic_events (id, title, title_ar, impact, event_date, currency, actual, forecast, previous)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, ev.title, ev.titleAr ?? null, ev.impact, ev.eventDate, ev.currency,
        ev.actual ?? null, ev.forecast ?? null, ev.previous ?? null);
  return db.raw.prepare('SELECT * FROM economic_events WHERE id = ?').get(id) as EventRow;
}

// ── Weekly Bias ───────────────────────────────

export function getWeeklyBias(userId: string): BiasRow[] {
  const weekKey = currentWeekKey();
  return db.raw.prepare(
    `SELECT * FROM weekly_bias WHERE user_id = ? AND week_key = ? ORDER BY instrument`
  ).all(userId, weekKey) as BiasRow[];
}

export function setWeeklyBias(
  userId: string, instrument: string,
  bias: 'bullish'|'bearish'|'neutral', notes?: string
): void {
  const weekKey = currentWeekKey();
  db.raw.prepare(`
    INSERT INTO weekly_bias (id, user_id, instrument, bias, week_key, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, instrument, week_key)
    DO UPDATE SET bias = excluded.bias, notes = excluded.notes
  `).run(randomUUID(), userId, instrument.toUpperCase(), bias, weekKey, notes ?? null);
}

// ── Macro Narrative ───────────────────────────

export function getMacroNarrative(userId: string): NarrativeRow | null {
  const weekKey = currentWeekKey();
  return (db.raw.prepare(
    `SELECT * FROM macro_narratives WHERE user_id = ? AND week_key = ?`
  ).get(userId, weekKey) as NarrativeRow | undefined) ?? null;
}

export function setMacroNarrative(userId: string, narrativeText: string): NarrativeRow {
  const weekKey = currentWeekKey();
  db.raw.prepare(`
    INSERT INTO macro_narratives (id, user_id, narrative_text, week_key)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, week_key)
    DO UPDATE SET narrative_text = excluded.narrative_text, created_at = datetime('now')
  `).run(randomUUID(), userId, narrativeText, weekKey);
  return db.raw.prepare(
    `SELECT * FROM macro_narratives WHERE user_id = ? AND week_key = ?`
  ).get(userId, weekKey) as NarrativeRow;
}
