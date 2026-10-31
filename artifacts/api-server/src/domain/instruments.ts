// Futures contract specs used to recompute P&L and risk.
// Values follow the exchange contract specifications as commonly published by CME Group;
// they are built-in defaults, labelled as such, and can be overridden per trade / import.
export interface InstrumentSpec {
  root: string;
  name: string;
  tickSize: number;     // minimum price increment (points)
  tickValue: number;    // USD per tick per contract
  exchange: string;
  source: string;
}

const SRC = 'built-in default (CME contract spec) — verify against your broker statement';

export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  NQ:  { root: 'NQ',  name: 'E-mini Nasdaq-100',       tickSize: 0.25, tickValue: 5.00,  exchange: 'CME',   source: SRC },
  MNQ: { root: 'MNQ', name: 'Micro E-mini Nasdaq-100', tickSize: 0.25, tickValue: 0.50,  exchange: 'CME',   source: SRC },
  ES:  { root: 'ES',  name: 'E-mini S&P 500',          tickSize: 0.25, tickValue: 12.50, exchange: 'CME',   source: SRC },
  MES: { root: 'MES', name: 'Micro E-mini S&P 500',    tickSize: 0.25, tickValue: 1.25,  exchange: 'CME',   source: SRC },
  YM:  { root: 'YM',  name: 'E-mini Dow',              tickSize: 1,    tickValue: 5.00,  exchange: 'CBOT',  source: SRC },
  MYM: { root: 'MYM', name: 'Micro E-mini Dow',        tickSize: 1,    tickValue: 0.50,  exchange: 'CBOT',  source: SRC },
  RTY: { root: 'RTY', name: 'E-mini Russell 2000',     tickSize: 0.10, tickValue: 5.00,  exchange: 'CME',   source: SRC },
  M2K: { root: 'M2K', name: 'Micro E-mini Russell',    tickSize: 0.10, tickValue: 0.50,  exchange: 'CME',   source: SRC },
  GC:  { root: 'GC',  name: 'Gold',                    tickSize: 0.10, tickValue: 10.00, exchange: 'COMEX', source: SRC },
  MGC: { root: 'MGC', name: 'Micro Gold',              tickSize: 0.10, tickValue: 1.00,  exchange: 'COMEX', source: SRC },
  CL:  { root: 'CL',  name: 'Crude Oil',               tickSize: 0.01, tickValue: 10.00, exchange: 'NYMEX', source: SRC },
  MCL: { root: 'MCL', name: 'Micro Crude Oil',         tickSize: 0.01, tickValue: 1.00,  exchange: 'NYMEX', source: SRC },
  MBT: { root: 'MBT', name: 'Micro Bitcoin',           tickSize: 5,    tickValue: 0.50,  exchange: 'CME',   source: SRC },
  MET: { root: 'MET', name: 'Micro Ether',             tickSize: 0.50, tickValue: 0.05,  exchange: 'CME',   source: SRC },
  ZM:  { root: 'ZM',  name: 'Soybean Meal',            tickSize: 0.10, tickValue: 10.00, exchange: 'CBOT',  source: SRC },
};

const MONTH_CODES = 'FGHJKMNQUVXZ';

/** "MNQZ4", "NQH25", "MNQ 12-24", "/NQ", "NQ.c.0", "CME_MINI:NQ1!" → root. */
export function instrumentRoot(symbol: string): string | null {
  let s = String(symbol || '').trim().toUpperCase();
  if (!s) return null;
  s = s.replace(/^.*:/, '').replace(/^\//, '').replace(/\.[A-Z]\.\d+$/, '').replace(/\d!$/, '');
  s = s.split(/[\s.]/)[0];
  if (INSTRUMENTS[s]) return s;
  const m = s.match(new RegExp(`^([A-Z0-9]{1,4}?)([${MONTH_CODES}])(\\d{1,2})$`));
  if (m && INSTRUMENTS[m[1]]) return m[1];
  // longest known root that prefixes the symbol
  const roots = Object.keys(INSTRUMENTS).sort((a, b) => b.length - a.length);
  for (const r of roots) if (s.startsWith(r) && /^[FGHJKMNQUVXZ]?\d{0,2}$/.test(s.slice(r.length))) return r;
  return null;
}

export function specFor(symbol: string): InstrumentSpec | null {
  const r = instrumentRoot(symbol);
  return r ? INSTRUMENTS[r] : null;
}

/** USD per 1.0 price point per contract. */
export function pointValue(spec: { tickSize: number; tickValue: number }): number {
  return spec.tickValue / spec.tickSize;
}
