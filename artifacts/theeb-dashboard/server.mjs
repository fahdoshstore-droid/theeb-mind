// ═══════════════════════════════════════════════════════════════
// THEEB MIND — Dashboard server
// Serves the single-page dashboard and a small read-only data API.
// Secrets (ANTHROPIC_API_KEY) stay here; the browser never sees them.
// No broker connection, no order execution.
// ═══════════════════════════════════════════════════════════════
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCOT, getSeasonality, getVIX, getMarket, getNews } from './lib/sources.mjs';
import { tvConfigured } from './lib/tradingview-mcp.mjs';
import { readChart, aiConfigured, MODEL } from './lib/chart-reader.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, 'public');
const MAX_BODY = 8 * 1024 * 1024; // chart screenshots
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'",
};

function send(res, status, body, headers = {}) {
    const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
    res.writeHead(status, Object.assign({ 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, SECURITY_HEADERS, headers));
    res.end(isObj ? JSON.stringify(body) : body);
}

// Per-IP limiter for the paid AI endpoint
const hits = new Map();
function rateLimited(ip, limit = 6, windowMs = 60_000) {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(ip, arr);
    return arr.length > limit;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

async function serveStatic(req, res, pathname) {
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
    try {
        const data = await readFile(file);
        const type = MIME[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
        res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
        send(res, 404, 'Not found');
    }
}

export async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    try {
        if (req.method === 'GET' && p === '/api/health') return send(res, 200, { status: 'ok', time: new Date().toISOString() });
        if (req.method === 'GET' && p === '/api/config') {
            return send(res, 200, { aiConfigured: aiConfigured(), aiModel: aiConfigured() ? MODEL : null, marketProvider: tvConfigured() ? 'TradingView MCP' : 'Yahoo Finance (delayed fallback)', tradingViewConfigured: tvConfigured(), execution: false });
        }
        if (req.method === 'GET' && p === '/api/context') {
            const [cot, seasonality, vix] = await Promise.all([getCOT(), getSeasonality(), getVIX()]);
            return send(res, 200, { cot, seasonality, vix, fetchedAt: new Date().toISOString() });
        }
        if (req.method === 'GET' && p === '/api/market') return send(res, 200, await getMarket());
        if (req.method === 'GET' && p === '/api/news') return send(res, 200, await getNews());
        if (req.method === 'POST' && p === '/api/agent/chart-read') {
            if (!aiConfigured()) return send(res, 503, { error: 'AI_NOT_CONFIGURED', message: 'Set ANTHROPIC_API_KEY on the server to enable AI chart reading.' });
            if (rateLimited(req.socket.remoteAddress || 'local')) return send(res, 429, { error: 'RATE_LIMITED', message: 'Too many requests — wait a minute.' });
            let body;
            try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.status || 400, { error: 'BAD_REQUEST', message: e.status ? e.message : 'Invalid JSON' }); }
            const mediaType = body && body.mediaType;
            const imageBase64 = body && body.imageBase64;
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mediaType) || typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
                return send(res, 400, { error: 'BAD_REQUEST', message: 'imageBase64 (base64) and mediaType (png/jpeg/webp/gif) are required' });
            }
            try {
                const out = await readChart({ imageBase64, mediaType });
                return send(res, 200, out);
            } catch (e) {
                console.error('[chart-read]', e.code || '', e.message);
                const status = e.code === 'AI_REFUSED' ? 422 : 502;
                return send(res, status, { error: e.code || 'AI_ERROR', message: e.code ? e.message : 'AI request failed' });
            }
        }
        if (p.startsWith('/api/')) return send(res, 404, { error: 'NOT_FOUND' });
        if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
        return send(res, 405, 'Method not allowed');
    } catch (e) {
        console.error('[server]', e);
        return send(res, 500, { error: 'INTERNAL' });
    }
}

export function createServer() { return http.createServer(handle); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT) || 5173;
    const host = process.env.HOST || '0.0.0.0';
    createServer().listen(port, host, () => {
        console.log(`[THEEB MIND] dashboard on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
        console.log(`[THEEB MIND] market data: ${tvConfigured() ? 'TradingView MCP' : 'Yahoo (delayed) — set TRADINGVIEW_MCP_URL or TRADINGVIEW_MCP_COMMAND for live data'}`);
        console.log(`[THEEB MIND] AI chart reading: ${aiConfigured() ? 'enabled (' + MODEL + ')' : 'disabled — set ANTHROPIC_API_KEY to enable'}`);
    });
}
