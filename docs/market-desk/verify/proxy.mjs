// Serves a built SPA (argv[2]) on argv[3] and forwards /api to 127.0.0.1:argv[4].
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const [root, port, apiPort] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };
http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    const p = http.request({ host: '127.0.0.1', port: apiPort, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(p); return;
  }
  const u = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(root, u);
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); return res.end(b); }
  catch { const b = await readFile(path.join(root, 'index.html')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); }
}).listen(Number(port), '127.0.0.1');
