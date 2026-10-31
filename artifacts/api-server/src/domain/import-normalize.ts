// ═══════════════════════════════════════════════════════════════
// Import normalization: column mapping, validation, P&L labelling, dedupe keys.
// Pure: takes parsed CSV + mapping, returns per-row results. No DB access.
// ═══════════════════════════════════════════════════════════════
import { createHash } from 'node:crypto';
import { parseTimestamp, parseNumber } from './timestamps.js';
import { specFor } from './instruments.js';
import { resolvePnl, computeRisk, round2, type Side, type ValueSource } from './pnl.js';

export type ImportKind = 'trades' | 'fills';

export const TRADE_FIELDS = [
  'external_id', 'account', 'symbol', 'side', 'quantity', 'entry_time', 'exit_time', 'entry_price', 'exit_price',
  'gross_pnl', 'fees', 'commission', 'net_pnl', 'stop_price', 'target_price', 'tick_size', 'tick_value',
  'setup', 'notes', 'tags', 'currency',
] as const;
export const FILL_FIELDS = ['external_id', 'order_id', 'account', 'symbol', 'side', 'quantity', 'price', 'time', 'fees', 'tick_size', 'tick_value', 'currency'] as const;
export type TradeField = typeof TRADE_FIELDS[number];
export type FillField = typeof FILL_FIELDS[number];

/** field → one column name, or several joined with a space (e.g. separate date + time columns). */
export type Mapping = Partial<Record<string, string | string[]>>;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const TRADE_SYNONYMS: Record<TradeField, string[]> = {
  external_id: ['tradeid', 'id', 'externalid', 'positionid', 'ticket', 'tradenumber'],
  account: ['account', 'accountname', 'accountid', 'acct'],
  symbol: ['symbol', 'instrument', 'contract', 'ticker', 'market'],
  side: ['side', 'direction', 'type', 'longshort', 'position', 'action'],
  quantity: ['quantity', 'qty', 'contracts', 'size', 'volume', 'lots'],
  entry_time: ['entrytime', 'opentime', 'entrydatetime', 'opendatetime', 'opened', 'entrydate', 'opendate', 'starttime', 'datetimeopen'],
  exit_time: ['exittime', 'closetime', 'exitdatetime', 'closedatetime', 'closed', 'exitdate', 'closedate', 'endtime', 'datetimeclose'],
  entry_price: ['entryprice', 'openprice', 'avgentryprice', 'averageentry', 'avgentry', 'entry'],
  exit_price: ['exitprice', 'closeprice', 'avgexitprice', 'averageexit', 'avgexit', 'exit'],
  gross_pnl: ['grosspnl', 'grosspl', 'grossprofit', 'gross', 'pnlgross', 'grossreturn'],
  fees: ['fees', 'fee', 'totalfees', 'exchangefees'],
  commission: ['commission', 'commissions', 'comm'],
  net_pnl: ['netpnl', 'netpl', 'netprofit', 'net', 'pnlnet', 'netreturn', 'realizedpnl', 'pnl', 'pl', 'profit', 'profitloss'],
  stop_price: ['stoploss', 'stopprice', 'stop', 'sl', 'initialstop'],
  target_price: ['profittarget', 'target', 'targetprice', 'takeprofit', 'tp'],
  tick_size: ['ticksize'],
  tick_value: ['tickvalue'],
  setup: ['setup', 'playbook', 'strategy', 'model'],
  notes: ['notes', 'note', 'comment', 'comments', 'journal'],
  tags: ['tags', 'tag', 'labels'],
  currency: ['currency', 'ccy'],
};
const FILL_SYNONYMS: Record<FillField, string[]> = {
  external_id: ['fillid', 'executionid', 'execid', 'id', 'tradeid'],
  order_id: ['orderid', 'order'],
  account: ['account', 'accountname', 'accountid'],
  symbol: ['symbol', 'contract', 'instrument', 'product'],
  side: ['side', 'buysell', 'action', 'bs'],
  quantity: ['quantity', 'qty', 'filledqty', 'size', 'contracts'],
  price: ['price', 'fillprice', 'avgprice', 'executionprice'],
  time: ['time', 'timestamp', 'filltime', 'datetime', 'executiontime', 'date'],
  fees: ['fees', 'commission', 'commissions', 'fee'],
  tick_size: ['ticksize'], tick_value: ['tickvalue'], currency: ['currency'],
};

export interface Preset {
  id: string; kind: ImportKind; label: string; verified: false; notes: string[];
  mapping: Mapping; transform?: 'tradovate_performance';
}

/** Presets are UNVERIFIED against a real export file: always review the mapping preview. */
export const PRESETS: Preset[] = [
  {
    id: 'generic_trades', kind: 'trades', label: 'Generic round-trip trades CSV (auto-detect headers)', verified: false,
    notes: ['Columns are matched by common header names; review every mapping before importing.'], mapping: {},
  },
  {
    id: 'tradezella_like', kind: 'trades', label: 'TradeZella-style trade export (header auto-detect)', verified: false,
    notes: ['No real TradeZella export file was available to this build — mapping is header-based guesswork until a sample confirms it.',
      'There is no direct TradeZella API integration.'], mapping: {},
  },
  {
    id: 'tradovate_performance', kind: 'trades', label: 'Tradovate “Performance” CSV (buy/sell pairs)', verified: false,
    notes: ['Expected columns: symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp, soldTimestamp, buyFillId, sellFillId.',
      'pnl is mapped as GROSS (commissions are typically separate) — verify against your statement.'],
    mapping: { symbol: 'symbol', quantity: 'qty', gross_pnl: 'pnl', tick_size: '_tickSize' }, transform: 'tradovate_performance',
  },
  {
    id: 'generic_fills', kind: 'fills', label: 'Generic fills / executions CSV (grouped flat-to-flat)', verified: false,
    notes: ['Fills are grouped into positions from flat to flat per account+symbol; grouping confidence is shown per trade.'], mapping: {},
  },
];

export function suggestMapping(headers: string[], kind: ImportKind): Mapping {
  const syn = kind === 'trades' ? TRADE_SYNONYMS : FILL_SYNONYMS;
  const used = new Set<string>();
  const out: Mapping = {};
  const normed = headers.map((h) => ({ h, n: norm(h) }));
  for (const [field, names] of Object.entries(syn)) {
    for (const name of names) {
      const hit = normed.find((x) => x.n === name && !used.has(x.h));
      if (hit) { out[field] = hit.h; used.add(hit.h); break; }
    }
  }
  // split date + time columns: "Open Date" + "Open Time"
  if (kind === 'trades') {
    for (const [field, d, t] of [['entry_time', ['opendate', 'entrydate'], ['opentime', 'entrytime']], ['exit_time', ['closedate', 'exitdate'], ['closetime', 'exittime']]] as const) {
      const dh = normed.find((x) => (d as readonly string[]).includes(x.n));
      const th = normed.find((x) => (t as readonly string[]).includes(x.n));
      if (dh && th && dh.h !== th.h) out[field] = [dh.h, th.h];
    }
  }
  return out;
}

function getCell(row: Record<string, string>, m: string | string[] | undefined): string {
  if (!m) return '';
  if (Array.isArray(m)) return m.map((c) => (row[c] ?? '').trim()).filter(Boolean).join(' ');
  return (row[m] ?? '').trim();
}

export function parseSide(raw: string): Side | null {
  const s = raw.trim().toLowerCase();
  if (/^(long|buy|b|l|bought|bot|buy to open)$/.test(s)) return 'long';
  if (/^(short|sell|s|sold|sld|sell short|sell to open)$/.test(s)) return 'short';
  return null;
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface NormalizedTrade {
  externalId: string | null; accountName: string | null; symbol: string; instrumentRoot: string | null;
  side: Side; quantity: number; status: 'closed' | 'open';
  entryTime: string; exitTime: string | null; entryPrice: number | null; exitPrice: number | null;
  tickSize: number | null; tickValue: number | null; tickSource: string | null;
  grossPnl: number | null; grossSource: ValueSource; fees: number | null; feesSource: ValueSource;
  netPnl: number | null; netSource: ValueSource; recomputedGross: number | null; pnlMismatch: number | null;
  stopPrice: number | null; targetPrice: number | null; initialRiskUsd: number | null; initialRiskSource: string | null;
  setup: string | null; notes: string | null; tags: string[]; currency: string;
  timestampsHadOffset: boolean; fieldSources: Record<string, string>;
}

export interface RowResult<T> {
  rowIndex: number;            // 1-based data row number (header excluded)
  raw: Record<string, string>;
  rowSha: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  value: T | null;
  dedupeKey: string | null;
}

export interface NormalizeOptions { timezone: string; dateOrder?: 'MDY' | 'DMY'; defaultCurrency?: string; preset?: Preset }

export function rowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

export function normalizeTradeRow(raw: Record<string, string>, rowIndex: number, mapping: Mapping, opt: NormalizeOptions): RowResult<NormalizedTrade> {
  const errors: string[] = [], warnings: string[] = [];
  const src: Record<string, string> = {};
  const cell = (f: string) => getCell(raw, mapping[f]);
  const colName = (f: string) => { const m = mapping[f]; return Array.isArray(m) ? m.join(' + ') : String(m); };
  const rowSha = sha256(JSON.stringify(raw));
  const res = (value: NormalizedTrade | null, key: string | null): RowResult<NormalizedTrade> =>
    ({ rowIndex, raw, rowSha, ok: errors.length === 0 && value != null, errors, warnings, value, dedupeKey: key });

  const symbol = cell('symbol');
  if (!symbol) errors.push('symbol is missing');
  let side = parseSide(cell('side'));
  let entryRaw = cell('entry_time'), exitRaw = cell('exit_time');
  let entryPrice = parseNumber(cell('entry_price')), exitPrice = parseNumber(cell('exit_price'));
  let externalId = cell('external_id') || null;

  if (opt.preset?.transform === 'tradovate_performance') {
    const bt = raw['boughtTimestamp'] ?? '', st = raw['soldTimestamp'] ?? '';
    const btp = parseTimestamp(bt, opt.timezone, opt.dateOrder), stp = parseTimestamp(st, opt.timezone, opt.dateOrder);
    if (!btp || !stp) errors.push('boughtTimestamp / soldTimestamp missing or unparseable');
    else {
      side = btp.utcMs <= stp.utcMs ? 'long' : 'short';
      entryRaw = side === 'long' ? bt : st; exitRaw = side === 'long' ? st : bt;
      const bp = parseNumber(raw['buyPrice']), sp = parseNumber(raw['sellPrice']);
      entryPrice = side === 'long' ? bp : sp; exitPrice = side === 'long' ? sp : bp;
      src.side = 'derived: boughtTimestamp vs soldTimestamp'; src.entry_price = src.exit_price = 'import: buyPrice/sellPrice';
      src.entry_time = src.exit_time = 'import: boughtTimestamp/soldTimestamp';
    }
    if (!externalId && (raw['buyFillId'] || raw['sellFillId'])) { externalId = `${raw['buyFillId'] ?? ''}-${raw['sellFillId'] ?? ''}`; src.external_id = 'import: buyFillId-sellFillId'; }
  } else if (!side) errors.push(`side "${cell('side')}" not recognised (expected long/short/buy/sell)`);

  const qty = parseNumber(cell('quantity'));
  const quantity = qty == null ? NaN : Math.abs(qty);
  if (!(quantity > 0)) errors.push('quantity must be a positive number');
  if (qty != null && qty < 0 && !side) side = 'short';

  const et = parseTimestamp(entryRaw, opt.timezone, opt.dateOrder);
  if (!et) errors.push(entryRaw ? `entry time "${entryRaw}" not parseable` : 'entry time is missing');
  const xt = exitRaw ? parseTimestamp(exitRaw, opt.timezone, opt.dateOrder) : null;
  if (exitRaw && !xt) errors.push(`exit time "${exitRaw}" not parseable`);
  for (const t of [et, xt]) {
    if (t?.gap) warnings.push(`local time ${t === et ? entryRaw : exitRaw} does not exist in ${opt.timezone} (DST gap) — shifted`);
    if (t?.ambiguous) warnings.push(`local time ${t === et ? entryRaw : exitRaw} is ambiguous in ${opt.timezone} (DST fall-back) — earlier instant used`);
  }
  if (et && xt && xt.utcMs < et.utcMs) errors.push('exit time is before entry time');
  const hadOffset = Boolean(et?.hadOffset && (!xt || xt.hadOffset));
  if (et && !et.hadOffset) warnings.push(`timestamps have no UTC offset — interpreted as ${opt.timezone}`);

  for (const [f, v] of [['entry_price', entryPrice], ['exit_price', exitPrice]] as const) {
    if (cell(f) && v == null && !opt.preset?.transform) errors.push(`${f} "${cell(f)}" is not a number`);
  }
  const closed = Boolean(xt) || exitPrice != null;
  if (exitPrice != null && !xt) warnings.push('exit price present but exit time missing');
  if (xt && exitPrice == null) warnings.push('exit time present but exit price missing — P&L can only come from the source');

  // contract spec
  const spec = specFor(symbol);
  let tickSize = parseNumber(cell('tick_size')), tickValue = parseNumber(cell('tick_value'));
  let tickSource: string | null = null;
  if (tickSize && tickValue) tickSource = 'import';
  else if (spec) { tickSize = tickSize || spec.tickSize; tickValue = tickValue || spec.tickValue; tickSource = spec.source; }
  else { tickSize = null; tickValue = null; warnings.push(`no contract spec for "${symbol}" — P&L cannot be recomputed from prices`); }

  const commission = parseNumber(cell('commission'));
  const feesOnly = parseNumber(cell('fees'));
  const reportedFees = commission == null && feesOnly == null ? null : round2((commission ?? 0) + (feesOnly ?? 0));
  const pnl = resolvePnl({
    side: side ?? 'long', quantity, entryPrice, exitPrice, tickSize, tickValue,
    reportedGross: parseNumber(cell('gross_pnl')), reportedNet: parseNumber(cell('net_pnl')), reportedFees, closed,
  });
  warnings.push(...pnl.warnings.filter((w) => !w.startsWith('open position')));

  const stopPrice = parseNumber(cell('stop_price')), targetPrice = parseNumber(cell('target_price'));
  let initialRiskUsd: number | null = null, initialRiskSource: string | null = null;
  if (stopPrice != null && entryPrice != null && tickSize && tickValue && side && quantity > 0) {
    const r = computeRisk({ side, entryPrice, stopPrice, quantity: Math.round(quantity), tickSize, tickValue });
    if (r.valid && r.riskUsd != null) { initialRiskUsd = r.riskUsd; initialRiskSource = `recomputed from imported stop (${colName('stop_price')}) and entry`; }
    else warnings.push(`imported stop not usable for initial risk: ${r.errors.join('; ')}`);
  } else if (stopPrice == null) warnings.push('no initial stop — R-multiple not available');

  for (const f of TRADE_FIELDS) if (mapping[f] && !src[f]) src[f] = `import: ${colName(f)}`;
  if (pnl.grossSource === 'recomputed') src.gross_pnl = 'recomputed';
  if (pnl.netSource === 'recomputed') src.net_pnl = 'recomputed';
  if (pnl.feesSource === 'recomputed') src.fees = 'recomputed (gross − net)';
  if (tickSource && tickSource !== 'import') src.tick_size = src.tick_value = tickSource;

  if (errors.length || !side || !et) return res(null, null);
  const value: NormalizedTrade = {
    externalId, accountName: cell('account') || null, symbol: symbol.toUpperCase(), instrumentRoot: spec?.root ?? null,
    side, quantity, status: closed ? 'closed' : 'open', entryTime: et.iso, exitTime: xt?.iso ?? null, entryPrice, exitPrice,
    tickSize, tickValue, tickSource,
    grossPnl: pnl.gross, grossSource: pnl.grossSource, fees: pnl.fees, feesSource: pnl.feesSource,
    netPnl: pnl.net, netSource: pnl.netSource, recomputedGross: pnl.recomputedGross, pnlMismatch: pnl.mismatch,
    stopPrice, targetPrice, initialRiskUsd, initialRiskSource,
    setup: cell('setup') || null, notes: cell('notes') || null,
    tags: cell('tags') ? cell('tags').split(/[;,|]/).map((t) => t.trim()).filter(Boolean) : [],
    currency: (cell('currency') || opt.defaultCurrency || 'USD').toUpperCase(),
    timestampsHadOffset: hadOffset, fieldSources: src,
  };
  return res(value, tradeDedupeKey(value));
}

export function tradeDedupeKey(t: Pick<NormalizedTrade, 'externalId' | 'symbol' | 'side' | 'quantity' | 'entryTime' | 'exitTime' | 'entryPrice' | 'exitPrice'>): string {
  if (t.externalId) return 'ext:' + t.externalId;
  return 'h:' + sha256([t.symbol, t.side, t.quantity, t.entryTime, t.exitTime ?? '', t.entryPrice ?? '', t.exitPrice ?? ''].join('|')).slice(0, 32);
}

// ── Fills ─────────────────────────────────────────────────────
export interface NormalizedFill {
  externalId: string | null; orderId: string | null; accountName: string | null; symbol: string;
  side: 'buy' | 'sell'; quantity: number; price: number; time: string; timeMs: number;
  fees: number | null; tickSize: number | null; tickValue: number | null; currency: string; hadOffset: boolean;
}

export function normalizeFillRow(raw: Record<string, string>, rowIndex: number, mapping: Mapping, opt: NormalizeOptions): RowResult<NormalizedFill> {
  const errors: string[] = [], warnings: string[] = [];
  const cell = (f: string) => getCell(raw, mapping[f]);
  const rowSha = sha256(JSON.stringify(raw));
  const symbol = cell('symbol').toUpperCase();
  if (!symbol) errors.push('symbol is missing');
  const sd = parseSide(cell('side'));
  if (!sd) errors.push(`side "${cell('side')}" not recognised (expected buy/sell)`);
  const qRaw = parseNumber(cell('quantity'));
  if (!(qRaw != null && Math.abs(qRaw) > 0)) errors.push('quantity must be a non-zero number');
  const price = parseNumber(cell('price'));
  if (price == null) errors.push('price is missing or not a number');
  const t = parseTimestamp(cell('time'), opt.timezone, opt.dateOrder);
  if (!t) errors.push(cell('time') ? `time "${cell('time')}" not parseable` : 'time is missing');
  if (t && !t.hadOffset) warnings.push(`timestamp has no UTC offset — interpreted as ${opt.timezone}`);
  const spec = specFor(symbol);
  const tickSize = parseNumber(cell('tick_size')) || spec?.tickSize || null;
  const tickValue = parseNumber(cell('tick_value')) || spec?.tickValue || null;
  if (!tickSize || !tickValue) warnings.push(`no contract spec for "${symbol}" — P&L cannot be computed`);
  if (errors.length || !sd || !t || price == null || qRaw == null) return { rowIndex, raw, rowSha, ok: false, errors, warnings, value: null, dedupeKey: null };
  const value: NormalizedFill = {
    externalId: cell('external_id') || null, orderId: cell('order_id') || null, accountName: cell('account') || null, symbol,
    side: sd === 'long' ? 'buy' : 'sell', quantity: Math.abs(qRaw), price, time: t.iso, timeMs: t.utcMs,
    fees: parseNumber(cell('fees')), tickSize, tickValue, currency: (cell('currency') || opt.defaultCurrency || 'USD').toUpperCase(), hadOffset: t.hadOffset,
  };
  const key = value.externalId ? 'fill:' + value.externalId
    : 'fillh:' + sha256([symbol, value.side, value.quantity, value.price, value.time, value.orderId ?? ''].join('|')).slice(0, 32);
  return { rowIndex, raw, rowSha, ok: true, errors, warnings, value, dedupeKey: key };
}
