// ============================================================
// THEEB MIND — Real COT Data Service
// Source: CFTC public data (updated every Friday)
// Financial Futures: EUR, GBP, USD INDEX, NAS
// Disaggregated:     GOLD
// ============================================================

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface CotRow {
  instrument: string;    // display label
  netLong: number;       // managed money net (long - short)
  change: number;        // week-over-week net change
  bias: 'bullish' | 'bearish' | 'neutral';
  reportDate: string;    // YYYY-MM-DD of latest CFTC report
}

// ── Cache (in-memory, 6 hours) ────────────────────────────
interface Cache { data: CotRow[]; fetchedAt: number }
let cache: Cache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// ── URL templates ─────────────────────────────────────────
const YEAR = new Date().getFullYear();
const FIN_URL  = `https://www.cftc.gov/files/dea/history/fut_fin_txt_${YEAR}.zip`;
const DISAGG_URL = `https://www.cftc.gov/files/dea/history/fut_disagg_txt_${YEAR}.zip`;

// ── Instruments we track ──────────────────────────────────
// Financial futures (TFF format): Asset Manager = managed money proxy
const FIN_TARGETS: Record<string, string> = {
  'NASDAQ-100 Consolidated':          'NAS',
  'EURO FX - CHICAGO':                'EUR',
  'BRITISH POUND - CHICAGO':          'GBP',
  'USD INDEX - ICE':                  'DXY',
};

// Disaggregated (Managed Money category)
const DISAGG_TARGETS: Record<string, string> = {
  'GOLD - COMMODITY EXCHANGE':        'GOLD',
};

// ── CSV helpers ───────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function num(s: string): number {
  const n = parseInt(s.replace(/\s/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function toBias(net: number): 'bullish' | 'bearish' | 'neutral' {
  const pct = Math.abs(net);
  if (pct < 5000) return 'neutral';
  return net > 0 ? 'bullish' : 'bearish';
}

// ── Download & extract a zip → CSV text ──────────────────
function fetchAndExtract(url: string, tmpLabel: string): string {
  const dir  = join(tmpdir(), `cot_${tmpLabel}`);
  const zip  = join(tmpdir(), `cot_${tmpLabel}.zip`);

  // Download
  execSync(`curl -s -o "${zip}" --max-time 25 "${url}"`, { stdio: 'pipe' });

  // Extract
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  execSync(`unzip -o "${zip}" -d "${dir}"`, { stdio: 'pipe' });

  // Find the .txt file
  const files = execSync(`ls "${dir}"`, { encoding: 'utf-8' }).trim().split('\n');
  const txt = files.find(f => f.endsWith('.txt'));
  if (!txt) throw new Error(`No .txt found in ${url}`);
  return readFileSync(join(dir, txt), 'utf-8');
}

// ── Parse financial futures (TFF) ────────────────────────
// Columns (0-indexed):
//  0:name  2:date  11:amLong  12:amShort  28:chgAmLong  29:chgAmShort
function parseFinancial(csv: string): CotRow[] {
  const lines = csv.split('\n').filter(l => l.trim());
  const rows: CotRow[] = [];

  // Latest date per target — we want only the most recent row for each
  const latest: Record<string, { date: string; row: CotRow }> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 30) continue;

    const name = cols[0];
    const date = cols[2]; // YYYY-MM-DD

    const label = Object.keys(FIN_TARGETS).find(k => name.toUpperCase().includes(k.toUpperCase()));
    if (!label) continue;

    const instrument = FIN_TARGETS[label];
    const amLong  = num(cols[11]);
    const amShort = num(cols[12]);
    const chgAmLong  = num(cols[28]);
    const chgAmShort = num(cols[29]);
    const netLong = amLong - amShort;
    const change  = chgAmLong - chgAmShort;

    const entry = { date, row: { instrument, netLong, change, bias: toBias(netLong), reportDate: date } };
    if (!latest[instrument] || date > latest[instrument].date) {
      latest[instrument] = entry;
    }
  }

  for (const v of Object.values(latest)) rows.push(v.row);
  return rows;
}

// ── Parse disaggregated (managed money columns) ──────────
// Columns (0-indexed): 0:name  2:date  13:mmLong  14:mmShort
// Changes: parsed dynamically from header
function parseDisagg(csv: string): CotRow[] {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const mmLongIdx  = header.indexOf('M_Money_Positions_Long_All');
  const mmShortIdx = header.indexOf('M_Money_Positions_Short_All');
  const chgLongIdx = header.indexOf('Change_in_M_Money_Long_All');
  const chgShortIdx = header.indexOf('Change_in_M_Money_Short_All');

  const rows: CotRow[] = [];
  const latest: Record<string, { date: string; row: CotRow }> = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 20) continue;

    const name = cols[0];
    const date = cols[2];

    const label = Object.keys(DISAGG_TARGETS).find(k => name.toUpperCase().includes(k.toUpperCase()));
    if (!label) continue;

    const instrument = DISAGG_TARGETS[label];
    const mmLong  = mmLongIdx  >= 0 ? num(cols[mmLongIdx])  : 0;
    const mmShort = mmShortIdx >= 0 ? num(cols[mmShortIdx]) : 0;
    const chgLong  = chgLongIdx  >= 0 ? num(cols[chgLongIdx])  : 0;
    const chgShort = chgShortIdx >= 0 ? num(cols[chgShortIdx]) : 0;
    const netLong = mmLong - mmShort;
    const change  = chgLong - chgShort;

    const entry = { date, row: { instrument, netLong, change, bias: toBias(netLong), reportDate: date } };
    if (!latest[instrument] || date > latest[instrument].date) {
      latest[instrument] = entry;
    }
  }

  for (const v of Object.values(latest)) rows.push(v.row);
  return rows;
}

// ── Public API ────────────────────────────────────────────
export async function getCotData(): Promise<CotRow[]> {
  // Return cache if fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const [finCsv, disaggCsv] = await Promise.all([
      Promise.resolve(fetchAndExtract(FIN_URL, 'fin')),
      Promise.resolve(fetchAndExtract(DISAGG_URL, 'disagg')),
    ]);

    const finRows    = parseFinancial(finCsv);
    const disaggRows = parseDisagg(disaggCsv);
    const combined   = [...disaggRows, ...finRows];

    // Sort: GOLD, NAS, DXY, EUR, GBP
    const ORDER = ['GOLD', 'NAS', 'DXY', 'EUR', 'GBP'];
    combined.sort((a, b) => {
      const ai = ORDER.indexOf(a.instrument);
      const bi = ORDER.indexOf(b.instrument);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    cache = { data: combined, fetchedAt: Date.now() };
    console.log(`[cot] fetched ${combined.length} instruments, latest: ${combined[0]?.reportDate}`);
    return combined;
  } catch (err) {
    console.error('[cot] fetch failed, using fallback:', err);
    // Fallback static data (clearly flagged as stale)
    return FALLBACK_COT;
  }
}

// ── Fallback (only used if CFTC is unreachable) ───────────
const FALLBACK_COT: CotRow[] = [
  { instrument: 'GOLD', netLong: 116000, change: 4000,  bias: 'bullish', reportDate: 'fallback' },
  { instrument: 'NAS',  netLong: -6000,  change: -2000, bias: 'bearish', reportDate: 'fallback' },
  { instrument: 'DXY',  netLong: -12000, change: -3000, bias: 'bearish', reportDate: 'fallback' },
  { instrument: 'EUR',  netLong:  18000, change: 5000,  bias: 'bullish', reportDate: 'fallback' },
  { instrument: 'GBP',  netLong:  -3000, change: 800,   bias: 'neutral', reportDate: 'fallback' },
];
