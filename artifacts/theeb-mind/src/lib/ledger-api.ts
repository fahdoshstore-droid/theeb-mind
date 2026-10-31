// Ledger API client. Session cookie only (HttpOnly) — no keys or user ids in the bundle.
const BASE = '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method, credentials: 'same-origin',
    headers: { 'X-Requested-With': 'theeb-mind', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(json?.error?.message || `HTTP ${res.status}`, res.status, json?.error?.code);
  }
  return (json?.data ?? json) as T;
}

export const api = {
  get: <T = any>(p: string) => call<T>('GET', p),
  post: <T = any>(p: string, b: unknown = {}) => call<T>('POST', p, b),
  put: <T = any>(p: string, b: unknown = {}) => call<T>('PUT', p, b),
  patch: <T = any>(p: string, b: unknown = {}) => call<T>('PATCH', p, b),
  del: <T = any>(p: string) => call<T>('DELETE', p),
};

export const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface AuthStatus { authenticated: boolean; user: { id: string; username: string } | null; bootstrapRequired: boolean; bootstrapTokenRequired?: boolean; registrationOpen: boolean }
export const auth = {
  status: () => api.get<AuthStatus>('/auth/status'),
  login: (username: string, password: string) => api.post('/auth/login', { username, password }),
  register: (username: string, password: string, claimLegacyData: boolean, bootstrapToken?: string) => api.post('/auth/register', { username, password, claimLegacyData, bootstrapToken: bootstrapToken || undefined }),
  logout: () => api.post('/auth/logout'),
};

export const fmtUsd = (v: number | null | undefined) => (v == null ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const fmtNum = (v: number | null | undefined, d = 2) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: d }));
export const SOURCE_LABEL: Record<string, string> = { source_reported: 'source-reported', recomputed: 'recomputed', estimated: 'estimated', unknown: 'unknown' };
