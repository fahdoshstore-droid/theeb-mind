// ═══════════════════════════════════════════════════════════════
// TradingView MCP adapter — primary live market data (server-side)
//
// The dashboard server acts as an MCP *client* and connects to a
// TradingView MCP server you run/configure. Credentials for that
// server stay in this process's environment; nothing reaches the browser.
//
//   TRADINGVIEW_MCP_URL        Streamable-HTTP endpoint (e.g. http://localhost:8000/mcp)
//   TRADINGVIEW_MCP_COMMAND    …or a stdio command (e.g. "uvx")
//   TRADINGVIEW_MCP_ARGS       JSON array of args for the command
//   TRADINGVIEW_MCP_TOOL       tool name returning OHLC bars (auto-detected if empty)
//   TRADINGVIEW_MCP_TOOL_ARGS  JSON template; placeholders {symbol} {exchange} {ticker} {interval} {count}
//   TRADINGVIEW_MCP_INTERVALS  JSON map, e.g. {"15m":"15","5m":"5"} (default: 15m / 5m)
//   TRADINGVIEW_DATA_DELAYED   "true" if your TradingView feed is delayed (caps freshness at DELAYED)
//   TV_SYMBOL_NQ / TV_SYMBOL_NAS100 / TV_SYMBOL_SPX / TV_SYMBOL_VIX  (EXCHANGE:TICKER)
// ═══════════════════════════════════════════════════════════════
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const TV_SYMBOLS = {
    NQ: process.env.TV_SYMBOL_NQ || 'CME_MINI:NQ1!',
    NAS100: process.env.TV_SYMBOL_NAS100 || 'OANDA:NAS100USD',
    SPX: process.env.TV_SYMBOL_SPX || 'CME_MINI:ES1!',
    VIX: process.env.TV_SYMBOL_VIX || 'TVC:VIX',
};

const DEFAULT_TOOL_ARGS = '{"symbol":"{symbol}","interval":"{interval}","bars":{count}}';
// A bars tool must look like OHLC history AND accept a symbol + a timeframe; scanners/screeners never qualify.
const TOOL_NAME_GOOD = /(ohlc|bars|candles|klines|history|historical|price_data|chart_data)/i;
const TOOL_NAME_BAD = /(scan|screener|pattern|top_|gainer|loser|filter|backtest|strategy|sentiment|news|analysis|overview|watchlist)/i;
const SYMBOL_PARAM = /^(symbol|ticker|tickers|instrument|pair)$/i;
const TF_PARAM = /^(interval|timeframe|resolution|tf|period)$/i;

/** Picks the OHLC-history tool from an MCP tool list, or null. */
export function detectBarsTool(tools) {
    const ok = (t) => {
        const props = Object.keys((t.inputSchema && t.inputSchema.properties) || {});
        return TOOL_NAME_GOOD.test(t.name) && !TOOL_NAME_BAD.test(t.name) && props.some((p) => SYMBOL_PARAM.test(p)) && props.some((p) => TF_PARAM.test(p));
    };
    return (tools.find(ok) || {}).name || null;
}

export function tvConfigured(env = process.env) {
    return Boolean(env.TRADINGVIEW_MCP_URL || env.TRADINGVIEW_MCP_COMMAND);
}

function parseJSONEnv(v, fallback) {
    if (!v) return fallback;
    try { return JSON.parse(v); } catch { return fallback; }
}

// ── Normalisation of whatever bar shape the MCP tool returns ─────────
function toMs(t) {
    if (t == null) return null;
    if (typeof t === 'number') return t < 1e11 ? t * 1000 : t; // seconds vs ms
    if (typeof t === 'string') {
        if (/^\d+(\.\d+)?$/.test(t)) return toMs(Number(t));
        const ms = Date.parse(t);
        return Number.isFinite(ms) ? ms : null;
    }
    return null;
}
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const pick = (o, keys) => { for (const k of keys) if (o[k] !== undefined) return o[k]; return undefined; };
const T_KEYS = ['time', 'timestamp', 'datetime', 'date', 't', 'Time', 'Date', 'Datetime'];
const O_KEYS = ['open', 'o', 'Open'], H_KEYS = ['high', 'h', 'High'], L_KEYS = ['low', 'l', 'Low'], C_KEYS = ['close', 'c', 'Close'], V_KEYS = ['volume', 'v', 'Volume'];

function barFromObject(o) {
    const t = toMs(pick(o, T_KEYS));
    const b = { t, o: num(pick(o, O_KEYS)), h: num(pick(o, H_KEYS)), l: num(pick(o, L_KEYS)), c: num(pick(o, C_KEYS)) };
    const v = num(pick(o, V_KEYS));
    if (Number.isFinite(v)) b.v = v;
    return b;
}
function barFromArray(a) {
    const b = { t: toMs(a[0]), o: num(a[1]), h: num(a[2]), l: num(a[3]), c: num(a[4]) };
    if (Number.isFinite(num(a[5]))) b.v = num(a[5]);
    return b;
}
const validBar = (b) => b && Number.isFinite(b.t) && [b.o, b.h, b.l, b.c].every(Number.isFinite) && b.h >= b.l;

/** Finds an OHLC series anywhere inside a JSON payload. Returns sorted, de-duplicated bars. */
export function extractBars(payload) {
    const seen = new Set();
    let best = [];
    const consider = (bars) => { const v = bars.filter(validBar); if (v.length > best.length) best = v; };
    const walk = (node, depth) => {
        if (!node || depth > 6 || seen.has(node)) return;
        if (typeof node !== 'object') return;
        seen.add(node);
        if (Array.isArray(node)) {
            if (node.length && node.every((x) => x && typeof x === 'object' && !Array.isArray(x))) consider(node.map(barFromObject));
            else if (node.length && node.every((x) => Array.isArray(x) && x.length >= 5)) consider(node.map(barFromArray));
            node.forEach((x) => walk(x, depth + 1));
            return;
        }
        // column-oriented: { time:[...], open:[...], ... }
        const tArr = pick(node, T_KEYS), oArr = pick(node, O_KEYS), hArr = pick(node, H_KEYS), lArr = pick(node, L_KEYS), cArr = pick(node, C_KEYS);
        if ([tArr, oArr, hArr, lArr, cArr].every(Array.isArray)) {
            const vArr = pick(node, V_KEYS);
            consider(tArr.map((t, i) => {
                const b = { t: toMs(t), o: num(oArr[i]), h: num(hArr[i]), l: num(lArr[i]), c: num(cArr[i]) };
                if (Array.isArray(vArr) && Number.isFinite(num(vArr[i]))) b.v = num(vArr[i]);
                return b;
            }));
        }
        Object.values(node).forEach((x) => walk(x, depth + 1));
    };
    walk(payload, 0);
    const map = new Map();
    for (const b of best) map.set(b.t, b);
    return [...map.values()].sort((a, b) => a.t - b.t);
}

/** Pull JSON out of an MCP CallToolResult (structuredContent or text blocks). */
export function payloadFromToolResult(result) {
    if (!result) throw new Error('empty MCP result');
    if (result.isError) {
        const msg = (result.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').slice(0, 200);
        throw new Error('MCP tool error: ' + (msg || 'unknown'));
    }
    let payload = result.structuredContent;
    if (!payload) {
        const texts = (result.content || []).filter((c) => c.type === 'text').map((c) => c.text);
        for (const t of texts) {
            try { payload = JSON.parse(t); break; } catch { /* try next */ }
            const m = t.match(/[[{][\s\S]*[\]}]/);
            if (m) { try { payload = JSON.parse(m[0]); break; } catch { /* ignore */ } }
        }
    }
    if (payload === undefined) throw new Error('MCP tool returned no JSON');
    // Many MCP servers report failures inside the JSON with isError=false — surface them
    const err = payload && !Array.isArray(payload) && typeof payload === 'object' ? payload.error : null;
    if (err) throw new Error('MCP tool error: ' + (typeof err === 'string' ? err : err.message || JSON.stringify(err)).slice(0, 300));
    return payload;
}

export function fillTemplate(template, vars) {
    const walk = (v) => {
        if (typeof v === 'string') {
            const whole = v.match(/^\{(\w+)\}$/);
            if (whole && whole[1] in vars) return vars[whole[1]];
            return v.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : _));
        }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
        return v;
    };
    // allow unquoted numeric placeholders like {count} in the JSON template
    const json = template.replace(/:\s*\{(\w+)\}/g, (_, k) => ': "{' + k + '}"');
    return walk(JSON.parse(json));
}

// ── Connection (lazy, single, auto-reset on failure) ─────────────────
let clientPromise = null;
let toolName = null;

async function connect(env) {
    const client = new Client({ name: 'theeb-mind-dashboard', version: '1.0.0' });
    let transport;
    if (env.TRADINGVIEW_MCP_URL) {
        transport = new StreamableHTTPClientTransport(new URL(env.TRADINGVIEW_MCP_URL));
    } else {
        // Pass through only what the MCP process needs (incl. its own TradingView credentials)
        const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^ANTHROPIC_/.test(k)));
        transport = new StdioClientTransport({ command: env.TRADINGVIEW_MCP_COMMAND, args: parseJSONEnv(env.TRADINGVIEW_MCP_ARGS, []), env: childEnv, stderr: 'ignore' });
    }
    try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        toolName = env.TRADINGVIEW_MCP_TOOL || detectBarsTool(tools);
        if (!toolName) throw new Error('MCP server exposes no OHLC-history tool (15m/5m bars) — set TRADINGVIEW_MCP_TOOL if one exists. Tools: ' + tools.map((t) => t.name).join(', '));
        if (!tools.some((t) => t.name === toolName)) throw new Error(`Tool "${toolName}" not offered by the MCP server`);
        return client;
    } catch (e) {
        // never leave a spawned MCP process / open session behind a failed connect
        try { await client.close(); } catch { /* ignore */ }
        throw e;
    }
}

// After a failed connect, fail fast for a while instead of respawning the MCP process on every request
const CONNECT_BACKOFF_MS = 60_000;
let lastConnectFailure = null;

async function getClient(env) {
    if (!clientPromise && lastConnectFailure && Date.now() - lastConnectFailure.at < CONNECT_BACKOFF_MS) throw lastConnectFailure.error;
    if (!clientPromise) {
        clientPromise = connect(env).then((c) => { lastConnectFailure = null; return c; }, (e) => { clientPromise = null; lastConnectFailure = { at: Date.now(), error: e }; throw e; });
    }
    return clientPromise;
}

export async function resetTradingViewClient() {
    const p = clientPromise;
    clientPromise = null;
    toolName = null;
    lastConnectFailure = null;
    if (p) { try { (await p).close(); } catch { /* ignore */ } }
}

/** Fetch bars for a logical symbol key (NQ / NAS100 / SPX / VIX) and timeframe ('15m' | '5m' | '1d'). */
export async function fetchTradingViewBars(key, tf, { count = 200, env = process.env } = {}) {
    const client = await getClient(env);
    const symbol = TV_SYMBOLS[key] || key;
    const [exchange, ticker] = symbol.includes(':') ? symbol.split(':') : ['', symbol];
    const intervals = Object.assign({ '15m': '15m', '5m': '5m', '1d': '1d' }, parseJSONEnv(env.TRADINGVIEW_MCP_INTERVALS, {}));
    const args = fillTemplate(env.TRADINGVIEW_MCP_TOOL_ARGS || DEFAULT_TOOL_ARGS, { symbol, exchange, ticker, interval: intervals[tf] || tf, count });
    let result;
    try {
        result = await client.callTool({ name: toolName, arguments: args }, undefined, { timeout: 20_000 });
    } catch (e) {
        await resetTradingViewClient(); // reconnect next time
        throw e;
    }
    const bars = extractBars(payloadFromToolResult(result));
    if (!bars.length) throw new Error('MCP tool returned no OHLC bars for ' + symbol);
    return { bars, symbol, delayed: String(env.TRADINGVIEW_DATA_DELAYED).toLowerCase() === 'true' };
}
