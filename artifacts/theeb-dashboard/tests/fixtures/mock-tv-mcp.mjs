// Minimal stand-in for a TradingView MCP server (stdio) used by the tests.
// MOCK_MODE: ok | error | empty ; MOCK_SHAPE: objects | arrays | columns
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const mode = process.env.MOCK_MODE || 'ok';
const shape = process.env.MOCK_SHAPE || 'objects';
const server = new McpServer({ name: 'mock-tradingview', version: '0.0.1' });

server.registerTool('get_ohlcv', {
    description: 'OHLCV bars',
    inputSchema: { symbol: z.string(), interval: z.string(), bars: z.number() },
}, async ({ symbol, interval, bars }) => {
    if (mode === 'error') return { isError: true, content: [{ type: 'text', text: 'symbol not found: ' + symbol }] };
    if (mode === 'empty') return { content: [{ type: 'text', text: JSON.stringify({ symbol, data: [] }) }] };
    const step = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '1d': 86400 }[interval];
    if (!step) return { isError: true, content: [{ type: 'text', text: 'unsupported interval: ' + interval }] };
    const last = Math.floor(Date.now() / 1000 / step) * step;
    const base = symbol.includes('VIX') ? 17 : symbol.includes('ES') ? 5800 : 20000;
    const rows = Array.from({ length: bars }, (_, i) => {
        const t = last - (bars - 1 - i) * step, c = base + Math.sin(i / 4) * base * 0.002;
        return { time: t, open: c - 1, high: c + 3, low: c - 4, close: c, volume: 100 + i };
    });
    let payload;
    if (shape === 'arrays') payload = { symbol, bars: rows.map((r) => [r.time, r.open, r.high, r.low, r.close, r.volume]) };
    else if (shape === 'columns') payload = { symbol, t: rows.map((r) => r.time), o: rows.map((r) => r.open), h: rows.map((r) => r.high), l: rows.map((r) => r.low), c: rows.map((r) => r.close), v: rows.map((r) => r.volume) };
    else payload = { symbol, interval, data: rows };
    return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
});

await server.connect(new StdioServerTransport());
