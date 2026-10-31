import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { db } from '../src/db/db.js';
import { createApp } from '../src/app.js';

export async function startServer(): Promise<{ base: string; server: Server }> {
  db.init();
  const app = createApp();
  const server = await new Promise<Server>((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

export class Client {
  cookie = '';
  constructor(public base: string) {}
  async req(method: string, path: string, body?: unknown, opts: { csrf?: boolean; headers?: Record<string, string>; raw?: boolean } = {}) {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.csrf !== false) headers['X-Requested-With'] = 'theeb-mind';
    if (this.cookie) headers.Cookie = this.cookie;
    const res = await fetch(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get('set-cookie');
    if (sc) { const v = sc.split(';')[0]; this.cookie = v.endsWith('=') ? '' : v; }
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  get(p: string, o?: any) { return this.req('GET', p, undefined, o); }
  post(p: string, b?: unknown, o?: any) { return this.req('POST', p, b ?? {}, o); }
  put(p: string, b?: unknown, o?: any) { return this.req('PUT', p, b ?? {}, o); }
  patch(p: string, b?: unknown, o?: any) { return this.req('PATCH', p, b ?? {}, o); }
  del(p: string, o?: any) { return this.req('DELETE', p, undefined, o); }
}
