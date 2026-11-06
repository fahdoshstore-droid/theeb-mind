// ============================================================
// HTML table helpers (server-side, no dependencies).
// Ported from artifacts/theeb-dashboard/lib/marketbulls.mjs on the
// unmerged branch claude/theeb-mind-trading-dashboard-nl5zv7, reviewed
// and typed. They never guess a value: unparseable cells become NaN.
// ============================================================

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', minus: '-', ndash: '-', mdash: '-',
};

export function cleanText(html: string): string {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, n) => (n in ENTITIES ? ENTITIES[n] : m))
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

interface GridCell { text: string; th: boolean }

/** Parses every <table> into flattened headers (multi-row headers joined) and body rows. */
export function parseTables(html: string): ParsedTable[] {
  const tables: ParsedTable[] = [];
  const tableRe = /<table\b[\s\S]*?<\/table>/gi;
  let tm: RegExpExecArray | null;
  while ((tm = tableRe.exec(html))) {
    const rowsRaw: { th: boolean; text: string; span: number; rspan: number }[][] = [];
    const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = trRe.exec(tm[0]))) {
      const cells: { th: boolean; text: string; span: number; rspan: number }[] = [];
      const cellRe = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi;
      let cm: RegExpExecArray | null;
      while ((cm = cellRe.exec(rm[0]))) {
        const span = Number((cm[2].match(/colspan\s*=\s*["']?(\d+)/i) || [])[1] || 1);
        const rspan = Number((cm[2].match(/rowspan\s*=\s*["']?(\d+)/i) || [])[1] || 1);
        cells.push({
          th: cm[1].toLowerCase() === 'th',
          text: cleanText(cm[3]),
          span: Math.max(1, Math.min(span, 20)),
          rspan: Math.max(1, Math.min(rspan, 10)),
        });
      }
      if (cells.length) rowsRaw.push(cells);
    }
    const grid: (GridCell | undefined)[][] = [];
    rowsRaw.forEach((cells, r) => {
      grid[r] = grid[r] || [];
      let col = 0;
      for (const c of cells) {
        while (grid[r][col] !== undefined) col++;
        for (let dr = 0; dr < c.rspan; dr++) {
          grid[r + dr] = grid[r + dr] || [];
          for (let dc = 0; dc < c.span; dc++) grid[r + dr][col + dc] = { text: c.text, th: c.th };
        }
        col += c.span;
      }
    });
    const isHeaderRow = (row: (GridCell | undefined)[], r: number) =>
      row.every((c) => !c || c.th) ||
      (r === 0 && !parseDate((row[0] || { text: '' }).text) &&
        !row.slice(1).some((c) => c && Number.isFinite(parseNum(c.text))));
    let i = 0;
    while (i < grid.length && isHeaderRow(grid[i], i)) i++;
    const width = Math.max(0, ...grid.map((r) => r.length));
    const headers: string[] = [];
    for (let col = 0; col < width; col++) {
      const parts: string[] = [];
      for (let r = 0; r < i; r++) {
        const c = grid[r][col];
        if (c && c.text && parts[parts.length - 1] !== c.text) parts.push(c.text);
      }
      headers.push(parts.join(' ').trim());
    }
    const rows = grid.slice(i).map((row) => Array.from({ length: width }, (_, col) => (row[col] ? row[col]!.text : '')));
    tables.push({ headers, rows });
  }
  return tables;
}

/** Parses "12,345", "-1,234", "(1,234)", "+56". Returns NaN for anything else. */
export function parseNum(s: string | null | undefined): number {
  if (s == null) return NaN;
  let t = String(s).replace(/[\s$%]/g, '').replace(/−/g, '-');
  if (!t) return NaN;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return NaN;
  const n = Number(t);
  return neg ? -n : n;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Returns YYYY-MM-DD or null. Supports ISO, US m/d/y, d.m.y, "Nov 3, 2026", "3 Nov 2026". */
export function parseDate(s: string | null | undefined): string | null {
  const t = String(s || '').trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/)) && m[1].toLowerCase() in MONTHS) {
    return `${m[3]}-${String(MONTHS[m[1].toLowerCase()] + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  if ((m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/)) && m[2].toLowerCase() in MONTHS) {
    return `${m[3]}-${String(MONTHS[m[2].toLowerCase()] + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}
