// ═══════════════════════════════════════════════════════════════
// Import Center: preview (no writes) → commit (one transaction).
// Raw rows are stored verbatim with their outcome; the source file is stored with its SHA-256.
// ═══════════════════════════════════════════════════════════════
import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import { parseCsv } from '../../domain/csv.js';
import { isValidTimeZone } from '../../domain/ny-time.js';
import {
  PRESETS, suggestMapping, normalizeTradeRow, normalizeFillRow, rowsToObjects, sha256, tradeDedupeKey,
  type ImportKind, type Mapping, type NormalizedTrade, type NormalizedFill, type RowResult,
} from '../../domain/import-normalize.js';
import { groupFills } from '../../domain/fills.js';
import { instrumentRoot } from '../../domain/instruments.js';
import { round2 } from '../../domain/pnl.js';
import { audit, badRequest } from './common.js';
import { findOrCreateAccount, getAccount } from './accounts.service.js';
import { insertTrade, updateImportedFields } from './trades.store.js';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20000;

export interface ImportRequest {
  content: string; filename?: string | null; kind: ImportKind; preset?: string | null; mapping?: Mapping | null;
  timezone: string; dateOrder?: 'MDY' | 'DMY'; accountId?: string | null; accountName?: string | null;
}

type RowOutcome = 'new' | 'duplicate_existing' | 'duplicate_in_file' | 'error' | 'overlap_existing_fills';

interface PlannedRow {
  rowIndex: number; raw: Record<string, string>; rowSha: string; errors: string[]; warnings: string[];
  outcome: RowOutcome; accountName: string | null; dedupeKey: string | null; existingTradeId?: string | null;
  trade?: NormalizedTrade | null; fill?: NormalizedFill | null; positionIndex?: number;
}

interface Plan {
  fileSha: string; headers: string[]; mapping: Mapping; kind: ImportKind; preset: string | null; rows: PlannedRow[];
  positions: (NormalizedTrade & { groupingConfidence: string; groupingNotes: string[]; legs: { rowIndex: number; fillKey: string; role: string; split: boolean; qty: number }[]; accountName: string | null; dedupeKey: string; existingTradeId: string | null; addedWhileAgainst: unknown[] })[];
  accounts: { name: string; exists: boolean; id: string | null }[];
  previousBatches: { id: string; created_at: string; filename: string | null }[];
}

function buildPlan(userId: string, req: ImportRequest): Plan {
  if (typeof req.content !== 'string' || !req.content.trim()) throw badRequest('file content is empty');
  if (Buffer.byteLength(req.content, 'utf8') > MAX_IMPORT_BYTES) throw badRequest(`file exceeds ${MAX_IMPORT_BYTES / 1024 / 1024} MB`, 'FILE_TOO_LARGE');
  if (!isValidTimeZone(req.timezone)) throw badRequest(`unknown time zone "${req.timezone}"`);
  const preset = req.preset ? PRESETS.find((p) => p.id === req.preset) : undefined;
  if (req.preset && !preset) throw badRequest(`unknown preset "${req.preset}"`);
  if (preset && preset.kind !== req.kind) throw badRequest(`preset "${preset.id}" is for ${preset.kind} imports`);
  const table = parseCsv(req.content);
  if (!table.headers.length) throw badRequest('no header row found');
  if (table.rows.length > MAX_IMPORT_ROWS) throw badRequest(`too many rows (${table.rows.length} > ${MAX_IMPORT_ROWS})`, 'TOO_MANY_ROWS');
  if (new Set(table.headers).size !== table.headers.length) throw badRequest('duplicate column names in header row');

  let mapping: Mapping = req.mapping ?? suggestMapping(table.headers, req.kind);
  if (!req.mapping && preset?.mapping) {
    const presetCols = new Set(Object.values(preset.mapping).flat());
    mapping = Object.fromEntries(Object.entries(mapping).filter(([, v]) => ![v].flat().some((c) => presetCols.has(c as string))));
    for (const [f, c] of Object.entries(preset.mapping)) if ([c].flat().every((x) => table.headers.includes(x as string))) mapping[f] = c;
  }
  for (const [f, c] of Object.entries(mapping)) for (const col of [c].flat()) if (col && !table.headers.includes(col)) throw badRequest(`mapping for "${f}" refers to unknown column "${col}"`);

  const objs = rowsToObjects(table.headers, table.rows);
  const opt = { timezone: req.timezone, dateOrder: req.dateOrder ?? 'MDY' as const, preset };
  const batchAccountName = req.accountId ? getAccount(userId, req.accountId).name : req.accountName?.trim() || null;
  const fileSha = sha256(req.content);

  const rows: PlannedRow[] = [];
  const seen = new Set<string>();
  const results: RowResult<NormalizedTrade | NormalizedFill>[] = objs.map((o, i) => (req.kind === 'trades' ? normalizeTradeRow(o, i + 1, mapping, opt) : normalizeFillRow(o, i + 1, mapping, opt)));
  for (const r of results) {
    const accountName = (r.value as NormalizedTrade | NormalizedFill | null)?.accountName || batchAccountName;
    if (r.ok && !accountName) r.errors.push('no account: map an account column or choose an account for this import');
    const base: PlannedRow = { rowIndex: r.rowIndex, raw: r.raw, rowSha: r.rowSha, errors: r.errors, warnings: r.warnings, outcome: 'error', accountName, dedupeKey: r.dedupeKey };
    if (r.errors.length || !r.value) { rows.push(base); continue; }
    const k = `${accountName}|${r.dedupeKey}`;
    if (seen.has(k)) { rows.push({ ...base, outcome: 'duplicate_in_file', warnings: [...r.warnings, 'same trade/fill appears earlier in this file'] }); continue; }
    seen.add(k);
    if (req.kind === 'trades') rows.push({ ...base, outcome: 'new', trade: r.value as NormalizedTrade });
    else rows.push({ ...base, outcome: 'new', fill: r.value as NormalizedFill });
  }

  // accounts
  const names = [...new Set(rows.filter((r) => r.accountName && r.outcome !== 'error').map((r) => r.accountName!))];
  const accounts = names.map((name) => {
    const a = db.raw.prepare('SELECT id, is_demo FROM trading_accounts WHERE user_id = ? AND name = ?').get(userId, name) as { id: string; is_demo: number } | undefined;
    if (a?.is_demo) throw badRequest(`account "${name}" is a DEMO account — real imports cannot go into it`, 'DEMO_MIX');
    return { name, exists: Boolean(a), id: a?.id ?? null };
  });
  const accId = new Map(accounts.map((a) => [a.name, a.id]));

  // duplicates against existing data
  const positions: Plan['positions'] = [];
  if (req.kind === 'trades') {
    const q = db.raw.prepare('SELECT id FROM trades WHERE user_id = ? AND account_id = ? AND dedupe_key = ?');
    for (const r of rows) {
      if (r.outcome !== 'new' || !r.trade) continue;
      const id = accId.get(r.accountName!);
      const ex = id ? q.get(userId, id, r.dedupeKey) as { id: string } | undefined : undefined;
      if (ex) { r.outcome = 'duplicate_existing'; r.existingTradeId = ex.id; }
    }
  } else {
    const q = db.raw.prepare('SELECT id, trade_id FROM trade_fills WHERE user_id = ? AND account_id = ? AND dedupe_key = ?');
    const usable: { key: string; fill: NormalizedFill; row: PlannedRow }[] = [];
    for (const r of rows) {
      if (r.outcome !== 'new' || !r.fill) continue;
      const id = accId.get(r.accountName!);
      const ex = id ? q.get(userId, id, r.dedupeKey) as { id: string } | undefined : undefined;
      if (ex) { r.outcome = 'duplicate_existing'; continue; }
      usable.push({ key: `${r.rowIndex}`, fill: { ...r.fill, accountName: r.accountName }, row: r });
    }
    const byRow = new Map(usable.map((u) => [u.key, u.row]));
    for (const g of groupFills(usable.map((u) => ({ key: u.key, fill: u.fill })))) {
      const legs = g.legs.map((l) => ({ rowIndex: Number(l.fillKey), fillKey: byRow.get(l.fillKey)!.dedupeKey!, role: l.role, split: l.split, qty: l.qty }));
      const first = g.legs[0].fill;
      const ids = g.legs.map((l) => l.fill.externalId).filter(Boolean);
      const t: NormalizedTrade = {
        externalId: ids.length === g.legs.length ? `fills:${ids.join('+')}` : null, accountName: g.accountName, symbol: g.symbol, instrumentRoot: null,
        side: g.side, quantity: g.quantity, status: g.status, entryTime: g.entryTime, exitTime: g.exitTime,
        entryPrice: Math.round(g.avgEntry * 1e6) / 1e6, exitPrice: g.avgExit == null ? null : Math.round(g.avgExit * 1e6) / 1e6,
        tickSize: first.tickSize, tickValue: first.tickValue, tickSource: first.tickSize ? 'import or built-in spec' : null,
        grossPnl: g.grossPnl, grossSource: g.grossPnl == null ? 'unknown' : 'recomputed', fees: g.fees, feesSource: g.fees == null ? 'unknown' : 'source_reported',
        netPnl: g.netPnl, netSource: g.netPnl == null ? 'unknown' : 'recomputed', recomputedGross: g.grossPnl, pnlMismatch: null,
        stopPrice: null, targetPrice: null, initialRiskUsd: null, initialRiskSource: null, setup: null, notes: null, tags: [],
        currency: first.currency, timestampsHadOffset: g.legs.every((l) => l.fill.hadOffset),
        fieldSources: { entry_price: 'recomputed: qty-weighted average of opening fills', exit_price: 'recomputed: qty-weighted average of closing fills', gross_pnl: 'recomputed from fills (flat-to-flat cash flow × point value)', fees: 'sum of fill fees' },
      };
      t.instrumentRoot = instrumentRoot(t.symbol);
      const pi = positions.length;
      positions.push({ ...t, groupingConfidence: g.confidence, groupingNotes: g.confidenceReasons, legs, accountName: g.accountName, dedupeKey: '', existingTradeId: null, addedWhileAgainst: g.addedWhileAgainst });
      positions[pi].dedupeKey = 'pos:' + sha256(legs.map((l) => l.fillKey).join('|')).slice(0, 32);
      for (const l of legs) byRow.get(String(l.rowIndex))!.positionIndex = pi;
    }
  }
  const previousBatches = db.raw.prepare('SELECT id, created_at, filename FROM import_batches WHERE user_id = ? AND file_sha256 = ? ORDER BY created_at').all(userId, fileSha) as Plan['previousBatches'];
  return { fileSha, headers: table.headers, mapping, kind: req.kind, preset: preset?.id ?? null, rows, positions, accounts, previousBatches };
}

export function previewImport(userId: string, req: ImportRequest) {
  const plan = buildPlan(userId, req);
  const count = (o: RowOutcome) => plan.rows.filter((r) => r.outcome === o).length;
  const newTrades = plan.rows.filter((r) => r.outcome === 'new' && r.trade);
  const sumNet = (ts: (NormalizedTrade | null | undefined)[]) => round2(ts.reduce((s, t) => s + (t?.netPnl ?? 0), 0));
  const preset = PRESETS.find((p) => p.id === plan.preset);
  return {
    fileSha256: plan.fileSha, headers: plan.headers, mapping: plan.mapping, kind: plan.kind,
    preset: preset ? { id: preset.id, label: preset.label, verified: preset.verified, notes: preset.notes } : null,
    summary: {
      rows: plan.rows.length, valid: plan.rows.filter((r) => r.outcome !== 'error').length, errors: count('error'),
      new: count('new'), duplicatesExisting: count('duplicate_existing'), duplicatesInFile: count('duplicate_in_file'),
      positions: plan.kind === 'fills' ? plan.positions.length : undefined,
      lowConfidencePositions: plan.kind === 'fills' ? plan.positions.filter((p) => p.groupingConfidence !== 'high').length : undefined,
      netPnlOfNewRows: plan.kind === 'trades' ? sumNet(newTrades.map((r) => r.trade)) : sumNet(plan.positions),
      netPnlOfAllValidRows: plan.kind === 'trades' ? sumNet(plan.rows.filter((r) => r.trade).map((r) => r.trade)) : undefined,
      rowsWithUnknownNet: plan.kind === 'trades' ? plan.rows.filter((r) => r.trade && r.trade.netPnl == null).length : plan.positions.filter((p) => p.netPnl == null).length,
      rowsWithPnlMismatch: plan.rows.filter((r) => r.trade?.pnlMismatch != null && Math.abs(r.trade.pnlMismatch) > 0.01).length,
    },
    accounts: plan.accounts,
    sameFileImportedBefore: plan.previousBatches,
    rows: plan.rows.slice(0, 1000).map((r) => ({
      rowIndex: r.rowIndex, outcome: r.outcome, errors: r.errors, warnings: r.warnings, account: r.accountName, raw: r.raw,
      normalized: r.trade ?? r.fill ?? null, existingTradeId: r.existingTradeId ?? null, positionIndex: r.positionIndex ?? null,
    })),
    rowsTruncated: plan.rows.length > 1000,
    positions: plan.positions.slice(0, 1000).map(({ legs, ...p }) => ({ ...p, legs })),
  };
}

export function commitImport(userId: string, req: ImportRequest & { duplicatePolicy: 'skip' | 'update' | 'distinct'; expectedSha256: string }) {
  const plan = buildPlan(userId, req);
  if (plan.fileSha !== req.expectedSha256) throw badRequest('file changed since preview — preview again', 'PREVIEW_STALE');
  const policy = req.duplicatePolicy;
  if (plan.kind === 'fills' && policy === 'update') throw badRequest('policy "update" is not supported for fill imports (fills are immutable executions) — use skip');

  return db.raw.transaction(() => {
    const batchId = uuid();
    const accIds = new Map<string, string>();
    for (const a of plan.accounts) accIds.set(a.name, a.id ?? findOrCreateAccount(userId, a.name).id);
    let imported = 0, updated = 0, dup = 0, errors = 0, importedNet = 0;
    const sourceNet = round2(plan.rows.reduce((s, r) => s + (r.trade?.netPnl ?? 0), 0));
    db.raw.prepare(`INSERT INTO import_batches (id, user_id, kind, preset, filename, file_sha256, file_size, source_text, timezone, date_order, mapping_json, duplicate_policy, row_count, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'committing')`).run(batchId, userId, plan.kind, plan.preset, req.filename ?? null, plan.fileSha, Buffer.byteLength(req.content, 'utf8'),
      req.content, req.timezone, req.dateOrder ?? 'MDY', JSON.stringify(plan.mapping), policy, plan.rows.length);
    const rawIns = db.raw.prepare(`INSERT INTO import_raw_rows (batch_id, user_id, row_index, raw_json, row_sha256, outcome, errors_json, warnings_json, trade_id, fill_id) VALUES (?,?,?,?,?,?,?,?,?,?)`);

    if (plan.kind === 'trades') {
      for (const r of plan.rows) {
        let outcome: string = r.outcome, tradeId: string | null = null;
        if (r.outcome === 'error') { errors++; }
        else if (r.outcome === 'duplicate_in_file') { dup++; }
        else if (r.outcome === 'new' || r.outcome === 'duplicate_existing') {
          const acc = accIds.get(r.accountName!)!;
          const t = r.trade!;
          if (r.outcome === 'new') { tradeId = insertTrade(userId, acc, batchId, 'import_trades', r.dedupeKey!, t, false); outcome = 'imported'; imported++; importedNet += t.netPnl ?? 0; }
          else if (policy === 'skip') { outcome = 'duplicate_skipped'; tradeId = r.existingTradeId!; dup++; }
          else if (policy === 'update') {
            const { before, changed } = updateImportedFields(userId, r.existingTradeId!, batchId, t);
            audit(userId, 'ledger.trade.reimport_update', { tradeId: r.existingTradeId, batchId, rowIndex: r.rowIndex, changed, before });
            outcome = 'updated'; tradeId = r.existingTradeId!; updated++;
          } else {
            tradeId = insertTrade(userId, acc, batchId, 'import_trades', `${r.dedupeKey}#${batchId}:${r.rowIndex}`, t, false);
            outcome = 'imported_distinct'; imported++; importedNet += t.netPnl ?? 0;
          }
        }
        rawIns.run(batchId, userId, r.rowIndex, JSON.stringify(r.raw), r.rowSha, outcome, JSON.stringify(r.errors), JSON.stringify(r.warnings), tradeId, null);
      }
    } else {
      const posTrade = new Map<number, string>();
      for (const [pi, p] of plan.positions.entries()) {
        const acc = accIds.get(p.accountName!)!;
        posTrade.set(pi, insertTrade(userId, acc, batchId, 'import_fills', p.dedupeKey, { ...p }, false));
        imported++; importedNet += p.netPnl ?? 0;
      }
      const fillIns = db.raw.prepare(`INSERT INTO trade_fills (id, user_id, account_id, batch_id, trade_id, dedupe_key, external_id, order_id, symbol, side, quantity, price, fill_time, fees, role, allocated_qty)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const r of plan.rows) {
        let outcome: string = r.outcome, fillId: string | null = null, tradeId: string | null = null;
        if (r.outcome === 'error') errors++;
        else if (r.outcome === 'duplicate_in_file' || r.outcome === 'duplicate_existing') { dup++; outcome = r.outcome === 'duplicate_existing' ? 'duplicate_skipped' : 'duplicate_in_file'; }
        else if (r.fill && r.positionIndex != null) {
          const p = plan.positions[r.positionIndex];
          const legs = p.legs.filter((l) => l.rowIndex === r.rowIndex);
          tradeId = posTrade.get(r.positionIndex)!;
          fillId = uuid();
          fillIns.run(fillId, userId, accIds.get(r.accountName!)!, batchId, tradeId, r.dedupeKey, r.fill.externalId, r.fill.orderId, r.fill.symbol, r.fill.side, r.fill.quantity, r.fill.price,
            r.fill.time, r.fill.fees, legs.map((l) => l.role).join('+'), legs.reduce((s, l) => s + l.qty, 0));
          outcome = 'grouped';
        }
        rawIns.run(batchId, userId, r.rowIndex, JSON.stringify(r.raw), r.rowSha, outcome, JSON.stringify(r.errors), JSON.stringify(r.warnings), tradeId, fillId);
      }
    }
    db.raw.prepare(`UPDATE import_batches SET status='committed', imported_count=?, updated_count=?, duplicate_count=?, error_count=?, source_net_total=?, imported_net_total=? WHERE id=?`)
      .run(imported, updated, dup, errors, plan.kind === 'trades' ? sourceNet : null, round2(importedNet), batchId);
    audit(userId, 'ledger.import.commit', { batchId, kind: plan.kind, filename: req.filename, sha256: plan.fileSha, rows: plan.rows.length, imported, updated, duplicates: dup, errors, policy });
    return { batchId, rows: plan.rows.length, imported, updated, duplicates: dup, errors, sourceNetTotal: plan.kind === 'trades' ? sourceNet : null, importedNetTotal: round2(importedNet) };
  })();
}

export function listBatches(userId: string) {
  return db.raw.prepare(`SELECT id, kind, preset, filename, file_sha256, file_size, timezone, duplicate_policy, row_count, imported_count, updated_count, duplicate_count, error_count,
    source_net_total, imported_net_total, status, is_demo, created_at FROM import_batches WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
}

export function getBatch(userId: string, id: string) {
  const b = db.raw.prepare(`SELECT id, kind, preset, filename, file_sha256, file_size, timezone, date_order, mapping_json, duplicate_policy, row_count, imported_count, updated_count,
    duplicate_count, error_count, source_net_total, imported_net_total, status, is_demo, created_at FROM import_batches WHERE id = ? AND user_id = ?`).get(id, userId) as Record<string, unknown> | undefined;
  if (!b) return null;
  const rows = db.raw.prepare('SELECT row_index, raw_json, row_sha256, outcome, errors_json, warnings_json, trade_id, fill_id FROM import_raw_rows WHERE batch_id = ? AND user_id = ? ORDER BY row_index').all(id, userId) as Record<string, string>[];
  return { ...b, mapping: JSON.parse(String(b.mapping_json)), rows: rows.map((r) => ({ rowIndex: r.row_index, raw: JSON.parse(r.raw_json), rowSha256: r.row_sha256, outcome: r.outcome, errors: JSON.parse(r.errors_json), warnings: JSON.parse(r.warnings_json), tradeId: r.trade_id, fillId: r.fill_id })) };
}

export function getBatchSource(userId: string, id: string): { filename: string | null; text: string; sha256: string } | null {
  const b = db.raw.prepare('SELECT filename, source_text, file_sha256 FROM import_batches WHERE id = ? AND user_id = ?').get(id, userId) as { filename: string | null; source_text: string; file_sha256: string } | undefined;
  return b ? { filename: b.filename, text: b.source_text, sha256: b.file_sha256 } : null;
}
