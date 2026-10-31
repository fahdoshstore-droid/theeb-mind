import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { Link, NavLink } from 'react-router-dom';

export const C = {
  card: { background: 'var(--void-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 } as CSSProperties,
  input: { background: 'var(--void-raised)', border: '1px solid var(--border-medium)', borderRadius: 8, color: 'var(--text)', padding: '7px 10px', fontSize: 13, fontFamily: 'var(--font-body)', minWidth: 0 } as CSSProperties,
  btn: { background: 'var(--gold)', color: '#1a140c', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' } as CSSProperties,
  btnGhost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' } as CSSProperties,
  mono: { fontFamily: 'var(--font-mono)', fontSize: 12 } as CSSProperties,
  muted: { color: 'var(--text-secondary)', fontSize: 12 } as CSSProperties,
  th: { textAlign: 'start', padding: '6px 8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' } as CSSProperties,
  td: { padding: '6px 8px', borderBottom: '1px solid var(--border)', fontSize: 12, verticalAlign: 'top' } as CSSProperties,
};

const TONES: Record<string, { bg: string; fg: string }> = {
  good: { bg: 'var(--green-bg)', fg: 'var(--green)' }, bad: { bg: 'var(--red-bg)', fg: 'var(--red)' },
  warn: { bg: 'var(--gold-subtle)', fg: 'var(--gold-bright)' }, neutral: { bg: 'var(--void-raised)', fg: 'var(--text-secondary)' },
  demo: { bg: 'rgba(147,112,219,0.18)', fg: '#b9a3ec' },
};
export function Badge({ tone = 'neutral', children, title }: { tone?: keyof typeof TONES | string; children: ReactNode; title?: string }) {
  const t = TONES[tone] ?? TONES.neutral;
  return <span title={title} style={{ background: t.bg, color: t.fg, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>{children}</span>;
}

export const statusTone = (s: string) => (/^(PASS|ok|pass|match|ELIGIBLE|confirmed|high)$/i.test(s) ? 'good' : /^(FAIL|exceeds|below|reached|fail|mismatch|NOT_ELIGIBLE|rejected|error)$/i.test(s) ? 'bad' : /INSUFFICIENT|unknown|UNKNOWN|not_comparable|medium|low|info/.test(s) ? 'warn' : 'neutral');

export function Card({ title, children, right, style }: { title?: ReactNode; children: ReactNode; right?: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ ...C.card, ...style }}>
      {(title || right) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: 'var(--gold)', fontWeight: 700 }}>{title}</h3>{right}
      </div>}
      {children}
    </section>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'bad' | 'good' | 'neutral'; children: ReactNode }) {
  const t = TONES[tone];
  return <div role="status" style={{ background: t.bg, color: t.fg, borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: 1.6 }}>{children}</div>;
}

export function Loading() { return <div style={C.muted}>جارٍ التحميل…</div>; }
export function ErrorBox({ error }: { error: unknown }) {
  return <Notice tone="bad">{error instanceof Error ? error.message : String(error)}</Notice>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ ...C.muted, padding: '18px 0', textAlign: 'center' }}>{children}</div>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: unknown; loading: boolean; reload: () => void } {
  const [state, set] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true, error: null }));
    fn().then((data) => alive && set({ data, error: null, loading: false })).catch((error) => alive && set({ data: null, error, loading: false }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: () => setN((x) => x + 1) };
}

export function Pnl({ v }: { v: number | null | undefined }) {
  if (v == null) return <span style={C.muted}>unknown</span>;
  return <span style={{ ...C.mono, color: v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-secondary)' }}>{v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}</span>;
}

export function Src({ s }: { s?: string | null }) {
  if (!s) return null;
  const tone = s === 'source_reported' ? 'neutral' : s === 'recomputed' ? 'neutral' : s === 'estimated' ? 'warn' : s === 'unknown' ? 'warn' : 'neutral';
  return <Badge tone={tone} title="value provenance">{s.replace('_', '-')}</Badge>;
}

const TABS = [
  { to: '/ledger', label: 'نظرة عامة', end: true }, { to: '/ledger/import', label: 'Import Center' }, { to: '/ledger/trades', label: 'الصفقات' },
  { to: '/ledger/review', label: 'TRIL Review' }, { to: '/ledger/sessions', label: 'الجلسات' }, { to: '/ledger/analytics', label: 'Analytics' },
  { to: '/ledger/behavior', label: 'السلوك' }, { to: '/ledger/accounts', label: 'الحسابات و Payout' }, { to: '/ledger/rules', label: 'قواعد المخاطرة' },
];

export function LedgerShell({ title, subtitle, children, actions }: { title: string; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div dir="rtl" style={{ padding: '56px 20px 40px', maxWidth: 1280, margin: '0 auto', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      <nav aria-label="ledger" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} style={({ isActive }) => ({ padding: '6px 12px', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 600,
            background: isActive ? 'var(--gold-subtle)' : 'transparent', color: isActive ? 'var(--gold)' : 'var(--text-secondary)', border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border)'}` })}>{t.label}</NavLink>
        ))}
      </nav>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{title}</h1>
          {subtitle && <div style={{ ...C.muted, marginTop: 4 }}>{subtitle}</div>}
        </div>
        {actions}
      </header>
      <div style={{ display: 'grid', gap: 14 }}>{children}</div>
    </div>
  );
}

export function TradeLink({ id, children }: { id: string; children?: ReactNode }) {
  return <Link to={`/ledger/trades/${id}`} style={{ color: 'var(--gold-bright)', ...C.mono }}>{children ?? id.slice(0, 8)}</Link>;
}

export function DrillDown({ ids, label }: { ids: string[]; label?: string }) {
  if (!ids.length) return null;
  return <Link to={`/ledger/trades?ids=${ids.slice(0, 400).join(',')}`} style={{ color: 'var(--gold-bright)', fontSize: 11 }}>{label ?? `عرض ${ids.length} صفقة`} ←</Link>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
      <span>{label}</span>{children}{hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
    </label>
  );
}
