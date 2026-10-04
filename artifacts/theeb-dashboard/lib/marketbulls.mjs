// ═══════════════════════════════════════════════════════════════
// MarketBulls adapter — COT + Seasonality for the Nasdaq-100 (server-side)
//   COT:          https://market-bulls.com/cot-report-nasdaq-100/
//   Seasonality:  https://market-bulls.com/seasonal-tendencies-nasdaq-100/
//
// The pages are HTML, so the adapter parses tables / embedded chart data
// and validates every field. If the page format is not recognised the
// adapter throws — it never guesses a number.
// ═══════════════════════════════════════════════════════════════

export const MB_URLS = {
    cot: 'https://market-bulls.com/cot-report-nasdaq-100/',
    seasonality: 'https://market-bulls.com/seasonal-tendencies-nasdaq-100/',
};

// ── HTML helpers ─────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '-', ndash: '-', mdash: '-' };
export function cleanText(html) {
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&(\w+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m))
        .replace(/−/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Parse every <table> into { headers: string[] (flattened multi-row), rows: string[][] }. */
export function parseTables(html) {
    const tables = [];
    const tableRe = /<table\b[\s\S]*?<\/table>/gi;
    let tm;
    while ((tm = tableRe.exec(html))) {
        const rowsRaw = [];
        const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
        let rm;
        while ((rm = trRe.exec(tm[0]))) {
            const cells = [];
            const cellRe = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi;
            let cm;
            while ((cm = cellRe.exec(rm[0]))) {
                const span = Number((cm[2].match(/colspan\s*=\s*["']?(\d+)/i) || [])[1] || 1);
                const rspan = Number((cm[2].match(/rowspan\s*=\s*["']?(\d+)/i) || [])[1] || 1);
                cells.push({ th: cm[1].toLowerCase() === 'th', text: cleanText(cm[3]), span: Math.max(1, Math.min(span, 20)), rspan: Math.max(1, Math.min(rspan, 10)) });
            }
            if (cells.length) rowsRaw.push(cells);
        }
        // Place cells on a grid honouring colspan + rowspan
        const grid = [];
        rowsRaw.forEach((cells, r) => {
            grid[r] = grid[r] || [];
            let col = 0;
            for (const c of cells) {
                while (grid[r][col] !== undefined) col++;
                for (let dr = 0; dr < c.rspan; dr++) {
                    grid[r + dr] = grid[r + dr] || [];
                    for (let dc = 0; dc < c.span; dc++) grid[r + dr][col + dc] = { text: c.text, th: c.th, origin: dr === 0 };
                }
                col += c.span;
            }
        });
        const isHeaderRow = (row, r) => row.every((c) => !c || c.th) || (r === 0 && !parseDate((row[0] || {}).text) && !row.slice(1).some((c) => c && Number.isFinite(parseNum(c.text))));
        let i = 0;
        while (i < grid.length && isHeaderRow(grid[i], i)) i++;
        const width = Math.max(0, ...grid.map((r) => r.length));
        const headers = [];
        for (let col = 0; col < width; col++) {
            const parts = [];
            for (let r = 0; r < i; r++) { const c = grid[r][col]; if (c && c.text && parts[parts.length - 1] !== c.text) parts.push(c.text); }
            headers.push(parts.join(' ').trim());
        }
        const rows = grid.slice(i).map((row) => Array.from({ length: width }, (_, col) => (row[col] ? row[col].text : '')));
        tables.push({ headers, rows });
    }
    return tables;
}

export function parseNum(s) {
    if (s == null) return NaN;
    let t = String(s).replace(/[\s$%]/g, '').replace(/−/g, '-');
    if (!t) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else if (/^[+-]?\d+,\d+$/.test(t)) t = t.replace(',', '.'); // decimal comma
    if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return NaN;
    const n = Number(t);
    return neg ? -n : n;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
export function parseDate(s) {
    const t = String(s || '').trim();
    let m;
    if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
    if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // US m/d/y
    if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // d.m.y
    if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && m[1].toLowerCase() in MONTHS) {
        return `${m[3]}-${String(MONTHS[m[1].toLowerCase()] + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
    if ((m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/)) && m[2].toLowerCase() in MONTHS) {
        return `${m[3]}-${String(MONTHS[m[2].toLowerCase()] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return null;
}

// ── COT ──────────────────────────────────────────────────────
const GROUPS = {
    large: /(large\s*spec|non[\s-]?commercial|speculator|managed\s*money|leveraged)/i,
    small: /(small|non[\s-]?reportable|retail)/i,
};
function groupOf(h) {
    if (GROUPS.small.test(h)) return 'small';
    if (GROUPS.large.test(h)) return 'large';
    if (/commercial/i.test(h) && !/non[\s-]?commercial/i.test(h)) return 'comm';
    return null;
}
function fieldOf(h) {
    if (/cot\s*index|index/i.test(h)) {
        if (/(36|3\s*y|156)/i.test(h)) return 'idx36';
        if (/(6\s*m|26\s*w|half)/i.test(h)) return 'idx6';
        return 'idx';
    }
    if (/chang|chg|Δ|delta|weekly/i.test(h)) return 'change';
    if (/\bnet\b/i.test(h)) return 'net';
    if (/\blong/i.test(h)) return 'long';
    if (/\bshort/i.test(h)) return 'short';
    return null;
}

/** Normalised COT rows (newest first) from MarketBulls HTML. Throws if no recognisable table. */
export function parseMarketBullsCOT(html) {
    const candidates = [];
    for (const tb of parseTables(html)) {
        const dateCol = tb.headers.findIndex((h) => /date|week|report/i.test(h));
        const dc = dateCol >= 0 ? dateCol : 0;
        const cols = {};
        tb.headers.forEach((h, i) => {
            const g = groupOf(h), f = fieldOf(h);
            if (f && f.startsWith('idx')) { cols[f] = cols[f] ?? i; return; }
            if (g && f) cols[g + '.' + f] = cols[g + '.' + f] ?? i;
        });
        const hasLarge = ('large.long' in cols && 'large.short' in cols) || 'large.net' in cols;
        if (!hasLarge) continue;
        const rows = tb.rows.map((r) => {
            const get = (k) => (k in cols ? parseNum(r[cols[k]]) : NaN);
            return {
                date: parseDate(r[dc]),
                lsLong: get('large.long'), lsShort: get('large.short'), lsNet: get('large.net'), lsChange: get('large.change'),
                cLong: get('comm.long'), cShort: get('comm.short'), cNet: get('comm.net'),
                sLong: get('small.long'), sShort: get('small.short'), sNet: get('small.net'),
                idx6: get('idx6'), idx36: get('idx36'), idx: get('idx'),
            };
        }).filter((r) => r.date && (Number.isFinite(r.lsNet) || (Number.isFinite(r.lsLong) && Number.isFinite(r.lsShort))));
        if (rows.length) candidates.push(rows);
    }
    if (!candidates.length) throw new Error('MarketBulls COT: page format not recognised (no Large Speculators table)');
    const rows = candidates.sort((a, b) => b.length - a.length)[0].sort((a, b) => (a.date < b.date ? 1 : -1));
    return rows;
}

export function cotIndex(nets, weeks) {
    if (nets.length < weeks) return null;
    const w = nets.slice(0, weeks);
    const min = Math.min(...w), max = Math.max(...w);
    return max > min ? Math.round(((w[0] - min) / (max - min)) * 1000) / 10 : null;
}

/** Map normalised rows (newest first) → unified COT schema. */
export function toCOTSchema(rows, source) {
    const netOf = (r) => (Number.isFinite(r.lsNet) ? r.lsNet : r.lsLong - r.lsShort);
    const latest = rows[0];
    const nets = rows.map(netOf);
    const net = nets[0];
    const weeklyChange = Number.isFinite(latest.lsChange) ? latest.lsChange : nets.length > 1 ? net - nets[1] : null;
    const pageIdx = (k) => (Number.isFinite(latest[k]) ? latest[k] : null);
    const side = (l, s, n) => {
        if (!Number.isFinite(l) && !Number.isFinite(n)) return null;
        const out = {};
        if (Number.isFinite(l)) out.long = l;
        if (Number.isFinite(s)) out.short = s;
        out.net = Number.isFinite(n) ? n : Number.isFinite(l) && Number.isFinite(s) ? l - s : null;
        return out;
    };
    const idx6 = pageIdx('idx6') ?? cotIndex(nets, 26);
    const idx36 = pageIdx('idx36') ?? (pageIdx('idx') !== null && pageIdx('idx6') === null ? pageIdx('idx') : null) ?? cotIndex(nets, 156);
    return {
        reportDate: latest.date,
        largeSpecLong: Number.isFinite(latest.lsLong) ? latest.lsLong : null,
        largeSpecShort: Number.isFinite(latest.lsShort) ? latest.lsShort : null,
        largeSpecNet: net,
        weeklyChange,
        cotIndex6m: idx6,
        cotIndex36m: idx36,
        commercials: side(latest.cLong, latest.cShort, latest.cNet),
        smallTraders: side(latest.sLong, latest.sShort, latest.sNet),
        history: rows.length,
        source,
        fetchedAt: new Date().toISOString(),
        status: 'OK',
    };
}

// ── Seasonality ──────────────────────────────────────────────
const PERIOD_RE = { y10: /\b10\s*(y|yr|year)/i, y5: /\b5\s*(y|yr|year)/i, y2: /\b2\s*(y|yr|year)/i };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Extract named numeric series (e.g. Highcharts/Chart.js "10 years" lines) from inline scripts. */
export function extractSeries(html) {
    const out = {};
    const scripts = (html.match(/<script\b[\s\S]*?<\/script>/gi) || []).join('\n');
    const re = /["']?(?:name|label)["']?\s*:\s*["']([^"']{1,40})["'][\s\S]{0,400}?["']?data["']?\s*:\s*\[([\s\S]*?)\]\s*[,}]/g;
    let m;
    while ((m = re.exec(scripts))) {
        const name = m[1];
        const key = Object.keys(PERIOD_RE).find((k) => PERIOD_RE[k].test(name));
        if (!key || out[key]) continue;
        // values may be plain numbers or [x, y] pairs
        const pairs = [...m[2].matchAll(/\[\s*[^,\]]+,\s*(-?\d+(?:\.\d+)?)\s*\]/g)].map((x) => Number(x[1]));
        const nums = pairs.length ? pairs : m[2].split(',').map((x) => parseNum(x.replace(/[[\]"']/g, '')));
        const vals = nums.filter(Number.isFinite);
        if (vals.length >= 12) out[key] = vals;
    }
    return out;
}

function biasOfChange(ch) {
    if (!Number.isFinite(ch)) return null;
    return ch > 0.25 ? 'BULLISH' : ch < -0.25 ? 'BEARISH' : 'NEUTRAL';
}

/** Change expected over the next ~month from a seasonal curve (12 monthly values, or a daily curve). */
export function windowFromSeries(vals, now) {
    const d = new Date(now);
    const month = d.getUTCMonth();
    if (vals.length === 12) {
        const ch = vals[month];
        return { averageChange: Math.round(ch * 100) / 100, seasonalBias: biasOfChange(ch), basis: 'monthly average' };
    }
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    const doy = Math.floor((now - start) / 86400000);
    const i0 = Math.min(vals.length - 1, Math.round((doy / 365) * (vals.length - 1)));
    const step = Math.max(1, Math.round((vals.length / 365) * 30));
    const i1 = Math.min(vals.length - 1, i0 + step);
    if (i1 <= i0) return null;
    const meanAbs = vals.reduce((a, v) => a + Math.abs(v), 0) / vals.length;
    const ch = meanAbs > 50 ? ((vals[i1] - vals[i0]) / vals[i0]) * 100 : vals[i1] - vals[i0];
    return { averageChange: Math.round(ch * 100) / 100, seasonalBias: biasOfChange(ch), basis: 'next 30 days of seasonal curve' };
}

/** Monthly table: rows = months, columns = 10Y / 5Y / 2Y average change. */
function seasonalityFromTables(html) {
    for (const tb of parseTables(html)) {
        const cols = {};
        tb.headers.forEach((h, i) => { for (const k of Object.keys(PERIOD_RE)) if (PERIOD_RE[k].test(h) && !(k in cols)) cols[k] = i; });
        if (Object.keys(cols).length < 2) continue;
        const monthly = { y10: [], y5: [], y2: [] };
        let rowsFound = 0;
        for (const r of tb.rows) {
            const mi = MONTH_NAMES.findIndex((m) => r[0] && r[0].toLowerCase().startsWith(m.slice(0, 3).toLowerCase()));
            if (mi < 0) continue;
            rowsFound++;
            for (const k of Object.keys(cols)) monthly[k][mi] = parseNum(r[cols[k]]);
        }
        if (rowsFound >= 12) return Object.fromEntries(Object.entries(monthly).filter(([, v]) => v.filter(Number.isFinite).length === 12));
    }
    return {};
}

export function parseMarketBullsSeasonality(html, now = Date.now()) {
    let series = extractSeries(html);
    if (Object.keys(series).length < 2) series = seasonalityFromTables(html);
    const keys = Object.keys(series);
    if (keys.length < 2) throw new Error('MarketBulls seasonality: page format not recognised (no 10Y/5Y/2Y data)');
    const out = {};
    for (const k of ['y10', 'y5', 'y2']) out[k] = series[k] ? windowFromSeries(series[k], now) : null;
    return out;
}

/** Unified seasonality schema. windows: {y10,y5,y2} each {averageChange, seasonalBias, ...} | null */
export function toSeasonalitySchema(windows, source, now = Date.now()) {
    const d = new Date(now);
    const avail = ['y10', 'y5', 'y2'].map((k) => windows[k]).filter((w) => w && Number.isFinite(w.averageChange));
    const bull = avail.filter((w) => w.seasonalBias === 'BULLISH').length;
    const bear = avail.filter((w) => w.seasonalBias === 'BEARISH').length;
    const ok = avail.length >= 2;
    return {
        y10: windows.y10 || null,
        y5: windows.y5 || null,
        y2: windows.y2 || null,
        currentMonth: MONTH_NAMES[d.getUTCMonth()],
        currentDay: d.getUTCDate(),
        averageChange: ok ? Math.round((avail.reduce((a, w) => a + w.averageChange, 0) / avail.length) * 100) / 100 : null,
        seasonalBias: ok ? (bull >= 2 ? 'BULLISH' : bear >= 2 ? 'BEARISH' : 'NEUTRAL') : null,
        source,
        fetchedAt: new Date().toISOString(),
        status: ok ? 'OK' : 'DATA_UNAVAILABLE',
    };
}
