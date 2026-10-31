import { v4 as uuid } from 'uuid';
import { createHash } from 'node:crypto';
import { db } from '../../db/db.js';
import { audit, badRequest, notFound, j, nowIso } from './common.js';
import { getAccount } from './accounts.service.js';
import { insertTrade } from './trades.store.js';
import { computeRisk, resolvePnl, rMultiple } from '../../domain/pnl.js';
import { specFor } from '../../domain/instruments.js';
import { tradeDedupeKey, type NormalizedTrade } from '../../domain/import-normalize.js';
import { zonedParts, NY_TZ } from '../../domain/ny-time.js';
import type { LedgerTrade } from '../../domain/analytics.js';

export interface TradeRow { [k: string]: any }

export interface TradeFilter {
  accountIds?: string[]; from?: string; to?: string; symbol?: string; side?: 'long' | 'short'; status?: 'open' | 'closed';
  tag?: string; setup?: string; q?: string; includeDemo?: boolean; outcome?: 'win' | 'loss' | 'breakeven'; ids?: string[];
  limit?: number; offset?: number;
}

export function queryTrades(userId: string, f: TradeFilter): TradeRow[] {
  const where = ['t.user_id = ?']; const args: unknown[] = [userId];
  if (f.accountIds?.length) { where.push(`t.account_id IN (${f.accountIds.map(() => '?').join(',')})`); args.push(...f.accountIds); }
  else if (!f.includeDemo) where.push('t.is_demo = 0');
  if (f.ids?.length) { where.push(`t.id IN (${f.ids.map(() => '?').join(',')})`); args.push(...f.ids); }
  if (f.from) { where.push('t.entry_time >= ?'); args.push(f.from); }
  if (f.to) { where.push('t.entry_time <= ?'); args.push(f.to); }
  if (f.symbol) { where.push('(t.symbol = ? OR t.instrument_root = ?)'); args.push(f.symbol.toUpperCase(), f.symbol.toUpperCase()); }
  if (f.side) { where.push('t.side = ?'); args.push(f.side); }
  if (f.status) { where.push('t.status = ?'); args.push(f.status); }
  if (f.setup) { where.push('t.setup = ?'); args.push(f.setup); }
  if (f.outcome === 'win') where.push('t.net_pnl > 0'); else if (f.outcome === 'loss') where.push('t.net_pnl < 0'); else if (f.outcome === 'breakeven') where.push('t.net_pnl = 0');
  if (f.tag) { where.push('EXISTS (SELECT 1 FROM trade_tags g WHERE g.trade_id = t.id AND g.user_id = t.user_id AND g.tag = ?)'); args.push(f.tag); }
  if (f.q) { where.push('(t.symbol LIKE ? OR t.user_notes LIKE ? OR t.imported_notes LIKE ? OR t.setup LIKE ? OR t.external_id LIKE ?)'); const q = `%${f.q}%`; args.push(q, q, q, q, q); }
  const limit = Math.min(Math.max(f.limit ?? 5000, 1), 20000), offset = Math.max(f.offset ?? 0, 0);
  return db.raw.prepare(`SELECT t.*, a.name AS account_name, (SELECT group_concat(tag, '\u001f') FROM trade_tags g WHERE g.trade_id = t.id) AS tags_concat
    FROM trades t JOIN trading_accounts a ON a.id = t.account_id AND a.user_id = t.user_id WHERE ${where.join(' AND ')} ORDER BY t.entry_time DESC LIMIT ? OFFSET ?`).all(...args, limit, offset) as TradeRow[];
}

export function tradeOut(t: TradeRow) {
  const ny = zonedParts(Date.parse(t.entry_time), NY_TZ);
  return {
    id: t.id, accountId: t.account_id, accountName: t.account_name, origin: t.origin, batchId: t.batch_id, externalId: t.external_id,
    symbol: t.symbol, instrumentRoot: t.instrument_root, side: t.side, quantity: t.quantity, status: t.status,
    entryTime: t.entry_time, exitTime: t.exit_time, entryNy: `${ny.date} ${String(ny.hour).padStart(2, '0')}:${String(ny.minute).padStart(2, '0')}`,
    durationMin: t.exit_time ? Math.round((Date.parse(t.exit_time) - Date.parse(t.entry_time)) / 60000) : null,
    entryPrice: t.entry_price, exitPrice: t.exit_price, tickSize: t.tick_size, tickValue: t.tick_value, tickSource: t.tick_source,
    grossPnl: t.gross_pnl, grossSource: t.gross_source, fees: t.fees, feesSource: t.fees_source, netPnl: t.net_pnl, netSource: t.net_source,
    recomputedGross: t.recomputed_gross, pnlMismatch: t.pnl_mismatch, currency: t.currency,
    stopPrice: t.stop_price, stopSource: t.stop_source, targetPrice: t.target_price, targetSource: t.target_source,
    initialRiskUsd: t.initial_risk_usd, initialRiskSource: t.initial_risk_source, rMultiple: rMultiple(t.net_pnl, t.initial_risk_usd),
    groupingConfidence: t.grouping_confidence, groupingNotes: j<string[]>(t.grouping_notes_json, []),
    timestampsHadOffset: Boolean(t.timestamps_had_offset), fieldSources: j<Record<string, string>>(t.field_sources_json, {}),
    setup: t.setup, executionGrade: t.execution_grade, emotionBefore: t.emotion_before, emotionAfter: t.emotion_after,
    userNotes: t.user_notes, importedNotes: t.imported_notes, tags: t.tags_concat ? String(t.tags_concat).split('\u001f') : [],
    isDemo: Boolean(t.is_demo), createdAt: t.created_at, updatedAt: t.updated_at,
  };
}

export function toLedgerTrade(t: TradeRow): LedgerTrade {
  return { id: t.id, accountId: t.account_id, accountName: t.account_name, symbol: t.symbol, instrumentRoot: t.instrument_root, side: t.side, quantity: t.quantity,
    status: t.status, entryTime: t.entry_time, exitTime: t.exit_time, netPnl: t.net_pnl, netSource: t.net_source, grossPnl: t.gross_pnl, fees: t.fees,
    initialRiskUsd: t.initial_risk_usd, initialRiskSource: t.initial_risk_source, setup: t.setup, pnlMismatch: t.pnl_mismatch, currency: t.currency,
    isDemo: Boolean(t.is_demo), timestampsHadOffset: Boolean(t.timestamps_had_offset) };
}

function getTradeRow(userId: string, id: string): TradeRow {
  const t = queryTrades(userId, { ids: [id], includeDemo: true })[0];
  if (!t) throw notFound('trade');
  return t;
}

export function getTradeDetail(userId: string, id: string) {
  const t = getTradeRow(userId, id);
  const raw = db.raw.prepare(`SELECT r.batch_id, r.row_index, r.raw_json, r.outcome, r.warnings_json, b.filename, b.created_at FROM import_raw_rows r JOIN import_batches b ON b.id = r.batch_id
    WHERE r.user_id = ? AND r.trade_id = ? ORDER BY b.created_at, r.row_index`).all(userId, id) as any[];
  const fills = db.raw.prepare('SELECT id, external_id, order_id, side, quantity, price, fill_time, fees, role, allocated_qty FROM trade_fills WHERE user_id = ? AND trade_id = ? ORDER BY fill_time').all(userId, id);
  const notes = db.raw.prepare("SELECT id, body, created_at, updated_at FROM journal_notes WHERE user_id = ? AND trade_id = ? AND kind = 'trade' ORDER BY created_at").all(userId, id);
  const tril = db.raw.prepare('SELECT id, phase, overall, recorded_at, locked_at, decision_time FROM tril_evaluations WHERE user_id = ? AND trade_id = ? ORDER BY recorded_at').all(userId, id) as any[];
  const attachments = db.raw.prepare('SELECT id, mime, size, caption, created_at FROM trade_attachments WHERE user_id = ? AND trade_id = ? ORDER BY created_at').all(userId, id);
  const history = db.raw.prepare(`SELECT event_type, event_data, created_at FROM audit_events WHERE user_id = ? AND event_type LIKE 'ledger.trade.%' AND event_data LIKE ? ORDER BY id`).all(userId, `%"tradeId":"${id}"%`) as any[];
  return {
    trade: tradeOut(t),
    rawRows: raw.map((r) => ({ batchId: r.batch_id, rowIndex: r.row_index, raw: JSON.parse(r.raw_json), outcome: r.outcome, warnings: JSON.parse(r.warnings_json), filename: r.filename, importedAt: r.created_at })),
    fills, notes, attachments,
    tril: tril.map((e) => ({ ...e, retrospective: e.phase === 'pre_trade' && Date.parse(e.recorded_at) > Date.parse(t.entry_time) })),
    history: history.map((h) => ({ type: h.event_type, data: JSON.parse(h.event_data), at: h.created_at })),
  };
}

const ANNOTATION_FIELDS = ['setup', 'executionGrade', 'emotionBefore', 'emotionAfter', 'userNotes', 'stopPrice', 'targetPrice'] as const;

/** User annotations. Imported values and raw rows are never modified here. */
export function annotateTrade(userId: string, id: string, p: Partial<Record<typeof ANNOTATION_FIELDS[number], unknown>>) {
  const t = getTradeRow(userId, id);
  const sets: string[] = [], args: unknown[] = [], before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?`); args.push(v); before[col] = t[col]; after[col] = v; };
  if ('setup' in p) set('setup', (p.setup as string | null)?.toString().slice(0, 120) || null);
  if ('executionGrade' in p) set('execution_grade', p.executionGrade ?? null);
  if ('emotionBefore' in p) set('emotion_before', (p.emotionBefore as string | null)?.slice(0, 200) ?? null);
  if ('emotionAfter' in p) set('emotion_after', (p.emotionAfter as string | null)?.slice(0, 200) ?? null);
  if ('userNotes' in p) set('user_notes', (p.userNotes as string | null)?.slice(0, 20000) ?? null);
  const recordedAfter = t.exit_time ? Date.now() > Date.parse(t.exit_time) : Date.now() > Date.parse(t.entry_time);
  const label = `user (entered ${nowIso().slice(0, 10)}${recordedAfter ? ', after the trade — retrospective' : ''})`;
  if ('stopPrice' in p) {
    const v = p.stopPrice as number | null;
    set('stop_price', v); set('stop_source', v == null ? null : label);
    let risk: number | null = null, src: string | null = null;
    if (v != null && t.entry_price != null && t.tick_size && t.tick_value) {
      const r = computeRisk({ side: t.side, entryPrice: t.entry_price, stopPrice: v, quantity: Math.round(t.quantity), tickSize: t.tick_size, tickValue: t.tick_value });
      if (!r.valid) throw badRequest(r.errors.join('; '));
      risk = r.riskUsd; src = `recomputed from ${label} stop and entry`;
    }
    set('initial_risk_usd', risk); set('initial_risk_source', src);
  }
  if ('targetPrice' in p) { set('target_price', p.targetPrice ?? null); set('target_source', p.targetPrice == null ? null : label); }
  if (!sets.length) return tradeOut(t);
  db.raw.prepare(`UPDATE trades SET ${sets.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND user_id = ?`).run(...(args as never[]), id, userId);
  audit(userId, 'ledger.trade.annotate', { tradeId: id, before, after });
  return tradeOut(getTradeRow(userId, id));
}

export function setTags(userId: string, id: string, tags: string[]) {
  getTradeRow(userId, id);
  const clean = [...new Set(tags.map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 64)))].slice(0, 50);
  const before = (db.raw.prepare('SELECT tag FROM trade_tags WHERE trade_id = ? AND user_id = ?').all(id, userId) as { tag: string }[]).map((r) => r.tag);
  db.raw.transaction(() => {
    db.raw.prepare("DELETE FROM trade_tags WHERE trade_id = ? AND user_id = ? AND source = 'user'").run(id, userId);
    for (const tag of clean) db.raw.prepare("INSERT OR IGNORE INTO trade_tags (trade_id, user_id, tag, source) VALUES (?,?,?,'user')").run(id, userId, tag);
  })();
  audit(userId, 'ledger.trade.tags', { tradeId: id, before, after: clean });
  return tradeOut(getTradeRow(userId, id));
}

export function createManualTrade(userId: string, m: {
  accountId: string; symbol: string; side: 'long' | 'short'; quantity: number; entryTime: string; exitTime?: string | null;
  entryPrice: number; exitPrice?: number | null; fees?: number | null; netPnl?: number | null; stopPrice?: number | null; targetPrice?: number | null;
  setup?: string | null; notes?: string | null; tickSize?: number | null; tickValue?: number | null;
}) {
  const acc = getAccount(userId, m.accountId);
  const et = Date.parse(m.entryTime), xt = m.exitTime ? Date.parse(m.exitTime) : null;
  if (!Number.isFinite(et)) throw badRequest('entry time invalid');
  if (xt != null && (!Number.isFinite(xt) || xt < et)) throw badRequest('exit time invalid or before entry');
  const spec = specFor(m.symbol);
  const tickSize = m.tickSize ?? spec?.tickSize ?? null, tickValue = m.tickValue ?? spec?.tickValue ?? null;
  const closed = xt != null && m.exitPrice != null;
  const pnl = resolvePnl({ side: m.side, quantity: m.quantity, entryPrice: m.entryPrice, exitPrice: m.exitPrice ?? null, tickSize, tickValue,
    reportedGross: null, reportedNet: m.netPnl ?? null, reportedFees: m.fees ?? null, closed });
  let initialRiskUsd: number | null = null, initialRiskSource: string | null = null;
  if (m.stopPrice != null && tickSize && tickValue) {
    const r = computeRisk({ side: m.side, entryPrice: m.entryPrice, stopPrice: m.stopPrice, quantity: Math.round(m.quantity), tickSize, tickValue });
    if (!r.valid) throw badRequest(r.errors.join('; '));
    initialRiskUsd = r.riskUsd; initialRiskSource = 'recomputed from manually entered stop and entry';
  }
  const t: NormalizedTrade = {
    externalId: null, accountName: acc.name, symbol: m.symbol.toUpperCase(), instrumentRoot: spec?.root ?? null, side: m.side, quantity: m.quantity,
    status: closed ? 'closed' : 'open', entryTime: new Date(et).toISOString(), exitTime: xt != null ? new Date(xt).toISOString() : null,
    entryPrice: m.entryPrice, exitPrice: m.exitPrice ?? null, tickSize, tickValue, tickSource: m.tickSize ? 'user' : spec?.source ?? null,
    grossPnl: pnl.gross, grossSource: pnl.grossSource, fees: pnl.fees, feesSource: pnl.feesSource === 'source_reported' ? 'source_reported' : pnl.feesSource,
    netPnl: pnl.net, netSource: pnl.netSource, recomputedGross: pnl.recomputedGross, pnlMismatch: pnl.mismatch,
    stopPrice: m.stopPrice ?? null, targetPrice: m.targetPrice ?? null, initialRiskUsd, initialRiskSource, setup: m.setup ?? null, notes: null, tags: [],
    currency: acc.currency, timestampsHadOffset: true, fieldSources: { '*': 'manual entry' },
  };
  const id = insertTrade(userId, acc.id, null, acc.is_demo ? 'demo' : 'manual', tradeDedupeKey(t) + ':manual:' + uuid().slice(0, 8), t, Boolean(acc.is_demo));
  if (m.notes) db.raw.prepare('UPDATE trades SET user_notes = ? WHERE id = ? AND user_id = ?').run(m.notes.slice(0, 20000), id, userId);
  audit(userId, 'ledger.trade.manual_create', { tradeId: id });
  return tradeOut(getTradeRow(userId, id));
}

export function deleteManualTrade(userId: string, id: string) {
  const t = getTradeRow(userId, id);
  if (t.origin !== 'manual' && t.origin !== 'demo') throw badRequest('imported trades cannot be deleted individually (raw import rows reference them)');
  db.raw.transaction(() => {
    db.raw.prepare('UPDATE tril_evaluations SET trade_id = NULL WHERE trade_id = ? AND user_id = ?').run(id, userId);
    db.raw.prepare('DELETE FROM trades WHERE id = ? AND user_id = ?').run(id, userId);
  })();
  audit(userId, 'ledger.trade.delete', { tradeId: id, snapshot: tradeOut(t) });
}

// ── Attachments (screenshots) ──
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export function addAttachment(userId: string, tradeId: string, a: { mime: string; dataBase64: string; caption?: string | null }) {
  getTradeRow(userId, tradeId);
  const check = MAGIC[a.mime];
  if (!check) throw badRequest('only PNG, JPEG or WEBP images are accepted');
  const buf = Buffer.from(a.dataBase64, 'base64');
  if (!buf.length || buf.length > MAX_ATTACHMENT_BYTES) throw badRequest(`image must be 1 byte – ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`, 'FILE_TOO_LARGE');
  if (!check(buf)) throw badRequest('file content does not match its image type');
  const id = uuid();
  db.raw.prepare('INSERT INTO trade_attachments (id, user_id, trade_id, mime, size, sha256, data, caption) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, userId, tradeId, a.mime, buf.length, createHash('sha256').update(buf).digest('hex'), buf, a.caption?.slice(0, 300) ?? null);
  audit(userId, 'ledger.trade.attachment_add', { tradeId, attachmentId: id, size: buf.length });
  return { id, mime: a.mime, size: buf.length };
}

export function getAttachment(userId: string, id: string): { mime: string; data: Buffer } | null {
  return (db.raw.prepare('SELECT mime, data FROM trade_attachments WHERE id = ? AND user_id = ?').get(id, userId) as { mime: string; data: Buffer } | undefined) ?? null;
}

export function deleteAttachment(userId: string, id: string) {
  const r = db.raw.prepare('DELETE FROM trade_attachments WHERE id = ? AND user_id = ?').run(id, userId);
  if (!r.changes) throw notFound('attachment');
}

/** Daily P&L calendar by New York trading date (exit date). */
export function calendar(userId: string, f: TradeFilter) {
  const days = new Map<string, { date: string; net: number; trades: number; unknown: number; tradeIds: string[] }>();
  for (const t of queryTrades(userId, f)) {
    if (t.status !== 'closed' || !t.exit_time) continue;
    const d = zonedParts(Date.parse(t.exit_time), NY_TZ).date;
    const e = days.get(d) ?? { date: d, net: 0, trades: 0, unknown: 0, tradeIds: [] };
    e.trades++; e.tradeIds.push(t.id);
    if (t.net_pnl == null) e.unknown++; else e.net = Math.round((e.net + t.net_pnl) * 100) / 100;
    days.set(d, e);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
