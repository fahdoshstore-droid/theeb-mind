import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, C, Field, useAsync, Loading, ErrorBox, Empty, Pnl, Src, TradeLink } from '../../components/ledger/ui';

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const f = Object.fromEntries(sp.entries()) as Record<string, string>;
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  return { f, set };
}

export function FilterBar({ f, set, accounts }: { f: Record<string, string>; set: (k: string, v: string) => void; accounts: any[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
      <Field label="الحساب"><select style={C.input} value={f.accountIds ?? ''} onChange={(e) => set('accountIds', e.target.value)}>
        <option value="">كل الحسابات الحقيقية</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.is_demo ? 'DEMO · ' : ''}{a.name}</option>)}</select></Field>
      <Field label="من (UTC)"><input type="date" style={C.input} value={f.from?.slice(0, 10) ?? ''} onChange={(e) => set('from', e.target.value ? `${e.target.value}T00:00:00.000Z` : '')} /></Field>
      <Field label="إلى (UTC)"><input type="date" style={C.input} value={f.to?.slice(0, 10) ?? ''} onChange={(e) => set('to', e.target.value ? `${e.target.value}T23:59:59.999Z` : '')} /></Field>
      <Field label="Symbol"><input style={C.input} value={f.symbol ?? ''} placeholder="NQ / MNQ" onChange={(e) => set('symbol', e.target.value)} /></Field>
      <Field label="Side"><select style={C.input} value={f.side ?? ''} onChange={(e) => set('side', e.target.value)}><option value="">الكل</option><option value="long">long</option><option value="short">short</option></select></Field>
      <Field label="النتيجة"><select style={C.input} value={f.outcome ?? ''} onChange={(e) => set('outcome', e.target.value)}><option value="">الكل</option><option value="win">win</option><option value="loss">loss</option><option value="breakeven">breakeven</option></select></Field>
      <Field label="Tag"><input style={C.input} value={f.tag ?? ''} onChange={(e) => set('tag', e.target.value)} /></Field>
      <Field label="بحث"><input style={C.input} value={f.q ?? ''} placeholder="ملاحظات، setup، ID" onChange={(e) => set('q', e.target.value)} /></Field>
    </div>
  );
}

function Calendar({ days }: { days: { date: string; net: number; trades: number; unknown: number; tradeIds: string[] }[] }) {
  const months = useMemo(() => {
    const m = new Map<string, typeof days>();
    for (const d of days) { const k = d.date.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k)!.push(d); }
    return [...m.entries()].slice(-6);
  }, [days]);
  if (!days.length) return <Empty>لا توجد أيام بصفقات مغلقة.</Empty>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
      {months.map(([month, ds]) => {
        const first = new Date(`${month}-01T12:00:00Z`); const n = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        const by = new Map(ds.map((d) => [d.date, d]));
        return (
          <div key={month}>
            <div style={{ ...C.muted, marginBottom: 4 }}>{month} (NY trading date)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {Array.from({ length: first.getUTCDay() }).map((_, i) => <div key={'x' + i} />)}
              {Array.from({ length: n }).map((_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, '0')}`; const d = by.get(date);
                return (
                  <Link key={date} to={d ? `/ledger/trades?ids=${d.tradeIds.join(',')}` : '#'} onClick={(e) => { if (!d) e.preventDefault(); }}
                    title={d ? `${date}: ${d.trades} trades, net ${d.net}${d.unknown ? `, ${d.unknown} unknown P&L` : ''}` : date}
                    style={{ aspectRatio: '1', borderRadius: 4, fontSize: 9, display: 'grid', placeItems: 'center', cursor: d ? 'pointer' : 'default', textDecoration: 'none',
                      background: !d ? 'var(--void-raised)' : d.net > 0 ? 'var(--green-bg)' : d.net < 0 ? 'var(--red-bg)' : 'var(--gold-subtle)', color: d ? 'var(--text)' : 'var(--text-muted)' }}>{i + 1}</Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Trades() {
  const { f, set } = useFilters();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const trades = useAsync(() => api.get<any[]>(`/ledger/trades${qs(f)}`), [JSON.stringify(f)]);
  const cal = useAsync(() => (view === 'calendar' ? api.get<any[]>(`/ledger/trades/calendar${qs(f)}`) : Promise.resolve([])), [JSON.stringify(f), view]);
  return (
    <LedgerShell title="الصفقات" subtitle="كل قيمة P&L موسومة بمصدرها: source-reported / recomputed / estimated / unknown."
      actions={<div style={{ display: 'flex', gap: 6 }}>
        <button style={view === 'list' ? C.btn : C.btnGhost} onClick={() => setView('list')}>قائمة</button>
        <button style={view === 'calendar' ? C.btn : C.btnGhost} onClick={() => setView('calendar')}>تقويم</button>
        <a style={{ ...C.btnGhost, textDecoration: 'none' }} href={`/api/ledger/export${qs({ ...f, format: 'csv' })}`}>تصدير CSV</a>
      </div>}>
      <Card><FilterBar f={f} set={set} accounts={accounts.data ?? []} />{f.ids && <div style={{ marginTop: 8 }}><Badge tone="warn">drill-down: {f.ids.split(',').length} صفقة محددة</Badge> <button style={C.btnGhost} onClick={() => set('ids', '')}>إزالة</button></div>}</Card>
      {view === 'calendar' ? <Card title="تقويم صافي P&L اليومي">{cal.loading ? <Loading /> : cal.error ? <ErrorBox error={cal.error} /> : <Calendar days={cal.data ?? []} />}</Card> : (
        <Card title={trades.data ? `${trades.data.length} صفقة` : 'الصفقات'}>
          {trades.loading ? <Loading /> : trades.error ? <ErrorBox error={trades.error} /> : !trades.data?.length ? <Empty>لا توجد صفقات بهذه الفلاتر. ابدأ من Import Center.</Empty> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['', 'Entry (NY)', 'الحساب', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'Net', 'مصدر', 'R', 'Setup', 'Tags'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>{trades.data.map((t) => (
                <tr key={t.id}>
                  <td style={C.td}><TradeLink id={t.id}>فتح</TradeLink>{t.isDemo && <> <Badge tone="demo">DEMO</Badge></>}</td>
                  <td style={{ ...C.td, ...C.mono }}>{t.entryNy}</td><td style={C.td}>{t.accountName}</td><td style={{ ...C.td, ...C.mono }}>{t.symbol}</td>
                  <td style={C.td}>{t.side}</td><td style={C.td}>{t.quantity}</td><td style={{ ...C.td, ...C.mono }}>{t.entryPrice ?? '—'}</td><td style={{ ...C.td, ...C.mono }}>{t.exitPrice ?? (t.status === 'open' ? 'open' : '—')}</td>
                  <td style={C.td}><Pnl v={t.netPnl} /></td><td style={C.td}><Src s={t.netSource} /></td>
                  <td style={{ ...C.td, ...C.mono }}>{t.rMultiple ?? <span style={C.muted} title="no verifiable initial risk">n/a</span>}</td>
                  <td style={C.td}>{t.setup ?? <span style={C.muted}>not recorded</span>}</td><td style={C.td}>{t.tags.map((g: string, i: number) => <Badge key={i}>{g}</Badge>)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
    </LedgerShell>
  );
}
