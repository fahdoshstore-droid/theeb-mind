// Low-level trade persistence shared by imports, manual entry and demo seeding.
import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import type { NormalizedTrade } from '../../domain/import-normalize.js';

export type Origin = 'import_trades' | 'import_fills' | 'manual' | 'demo';

export interface InsertTrade extends NormalizedTrade {
  groupingConfidence?: string | null; groupingNotes?: string[] | null;
}

export function insertTrade(userId: string, accountId: string, batchId: string | null, origin: Origin, dedupeKey: string, t: InsertTrade, isDemo: boolean): string {
  const id = uuid();
  db.raw.prepare(`INSERT INTO trades (id, user_id, account_id, batch_id, origin, external_id, dedupe_key, symbol, instrument_root, side, quantity, status,
      entry_time, exit_time, entry_price, exit_price, tick_size, tick_value, tick_source, gross_pnl, gross_source, fees, fees_source, net_pnl, net_source,
      recomputed_gross, pnl_mismatch, currency, stop_price, stop_source, target_price, target_source, initial_risk_usd, initial_risk_source,
      grouping_confidence, grouping_notes_json, timestamps_had_offset, field_sources_json, setup, imported_notes, is_demo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, userId, accountId, batchId, origin, t.externalId, dedupeKey, t.symbol, t.instrumentRoot, t.side, t.quantity, t.status,
    t.entryTime, t.exitTime, t.entryPrice, t.exitPrice, t.tickSize, t.tickValue, t.tickSource, t.grossPnl, t.grossSource, t.fees, t.feesSource, t.netPnl, t.netSource,
    t.recomputedGross, t.pnlMismatch, t.currency, t.stopPrice, t.stopPrice != null ? (origin === 'manual' ? 'user (manual entry)' : 'import') : null,
    t.targetPrice, t.targetPrice != null ? (origin === 'manual' ? 'user (manual entry)' : 'import') : null, t.initialRiskUsd, t.initialRiskSource,
    t.groupingConfidence ?? null, t.groupingNotes ? JSON.stringify(t.groupingNotes) : null, t.timestampsHadOffset ? 1 : 0, JSON.stringify(t.fieldSources),
    t.setup, t.notes, isDemo ? 1 : 0);
  for (const tag of t.tags) db.raw.prepare('INSERT OR IGNORE INTO trade_tags (trade_id, user_id, tag, source) VALUES (?,?,?,?)').run(id, userId, tag.slice(0, 64), origin === 'manual' ? 'user' : 'import');
  return id;
}

/** Re-import with policy "update": refresh imported fields only; user annotations (notes, tags, grades, user-entered stop/target) are kept. */
export function updateImportedFields(userId: string, tradeId: string, batchId: string, t: NormalizedTrade): { before: Record<string, unknown>; changed: string[] } {
  const before = db.raw.prepare('SELECT * FROM trades WHERE id = ? AND user_id = ?').get(tradeId, userId) as Record<string, unknown>;
  const keepStop = before.stop_source != null && String(before.stop_source).startsWith('user');
  const keepTarget = before.target_source != null && String(before.target_source).startsWith('user');
  const next: Record<string, unknown> = {
    external_id: t.externalId, symbol: t.symbol, instrument_root: t.instrumentRoot, side: t.side, quantity: t.quantity, status: t.status,
    entry_time: t.entryTime, exit_time: t.exitTime, entry_price: t.entryPrice, exit_price: t.exitPrice, tick_size: t.tickSize, tick_value: t.tickValue, tick_source: t.tickSource,
    gross_pnl: t.grossPnl, gross_source: t.grossSource, fees: t.fees, fees_source: t.feesSource, net_pnl: t.netPnl, net_source: t.netSource,
    recomputed_gross: t.recomputedGross, pnl_mismatch: t.pnlMismatch, currency: t.currency, timestamps_had_offset: t.timestampsHadOffset ? 1 : 0,
    field_sources_json: JSON.stringify(t.fieldSources), imported_notes: t.notes, batch_id: batchId,
  };
  if (!keepStop) Object.assign(next, { stop_price: t.stopPrice, stop_source: t.stopPrice != null ? 'import' : null, initial_risk_usd: t.initialRiskUsd, initial_risk_source: t.initialRiskSource });
  if (!keepTarget) Object.assign(next, { target_price: t.targetPrice, target_source: t.targetPrice != null ? 'import' : null });
  const changed = Object.keys(next).filter((k) => k !== 'batch_id' && k !== 'field_sources_json' && String(before[k] ?? '') !== String(next[k] ?? ''));
  const cols = Object.keys(next);
  db.raw.prepare(`UPDATE trades SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`)
    .run(...cols.map((c) => next[c] as never), tradeId, userId);
  return { before: Object.fromEntries(changed.map((k) => [k, before[k]])), changed };
}
