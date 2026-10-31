import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, auth } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, useAsync, Loading, ErrorBox, Empty, Pnl, statusTone, DrillDown } from '../../components/ledger/ui';

function Checks({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...C.muted, marginBottom: 4 }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['الفحص', 'المُعلن', 'المحسوب', 'الفرق', 'الحالة'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.key}><td style={C.td}>{c.label}{c.note && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.note}</div>}</td><td style={{ ...C.td, ...C.mono }}>{c.reported ?? '—'}</td>
            <td style={{ ...C.td, ...C.mono }}>{c.computed ?? '—'}</td><td style={{ ...C.td, ...C.mono }}>{c.diff ?? '—'}</td><td style={C.td}><Badge tone={statusTone(c.status)}>{c.status}</Badge></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function LedgerHome() {
  const st = useAsync(() => auth.status(), []);
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const snaps = useAsync(() => api.get<any[]>('/ledger/snapshots'), []);
  const tmpl = useAsync(() => api.get<any[]>('/ledger/snapshots/templates'), []);
  const an = useAsync(() => api.get('/ledger/analytics'), []);
  const rules = useAsync(() => api.get('/ledger/rules'), []);
  const [err, setErr] = useState<unknown>(null);
  const run = async (fn: () => Promise<unknown>, after: () => void) => { setErr(null); try { await fn(); after(); } catch (e) { setErr(e); } };
  const stored = new Set((snaps.data ?? []).map((s) => s.dataset));
  const real = (accounts.data ?? []).filter((a) => !a.is_demo);
  return (
    <LedgerShell title="THEEB MIND · Journal" subtitle="Import & Reconcile ← Review ← Session ← Analytics ← Account/Payout"
      actions={<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {st.data?.user && <span style={C.muted}>{st.data.user.username}</span>}
        <a href="/api/ledger/export" style={{ ...C.btnGhost, textDecoration: 'none' }}>تصدير JSON كامل</a>
        <a href="/api/ledger/export?format=csv" style={{ ...C.btnGhost, textDecoration: 'none' }}>تصدير CSV</a>
        <button style={C.btnGhost} onClick={async () => { await auth.logout(); window.location.reload(); }}>خروج</button>
      </div>}>
      {err != null && <ErrorBox error={err} />}
      {rules.data?.rules?.some((r: any) => r.needsConfirmation) && <Notice>قيم المخاطرة الأولية ($500 / RRR 2.0 / $1,000 يومي / NY AM فقط) تنتظر تأكيدك — <Link to="/ledger/rules" style={{ color: 'inherit' }}>راجعها في قواعد المخاطرة</Link>. القيم القديمة ($600 / 2.5 / حد صفقتين) محفوظة كـhistorical ولا تُطبّق.</Notice>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <Card title="الـLedger الحقيقي">
          {an.loading ? <Loading /> : an.error ? <ErrorBox error={an.error} /> : !an.data.scope.trades ? <Empty>لا توجد صفقات حقيقية بعد. <Link to="/ledger/import" style={{ color: 'var(--gold-bright)' }}>استورد CSV</Link></Empty> : <>
            <div style={{ fontSize: 13 }}>{an.data.scope.trades} صفقة في {real.length} حساب · صافي محقق <Pnl v={an.data.metrics.find((m: any) => m.key === 'net_pnl').value} /></div>
            <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>{an.data.notices.map((n: any) => <div key={n.code} style={{ fontSize: 12 }}><Badge tone={n.level === 'warning' ? 'warn' : 'neutral'}>{n.code}</Badge> {n.message} <DrillDown ids={n.tradeIds} /></div>)}</div>
          </>}
        </Card>
        <Card title="DEMO data">
          <div style={C.muted}>بيانات تجريبية موسومة DEMO في حساب منفصل؛ مستبعدة من التحليلات الحقيقية افتراضياً.</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={C.btnGhost} onClick={() => run(() => api.post('/ledger/demo/seed'), () => { accounts.reload(); })}>إنشاء DEMO</button>
            <button style={C.btnGhost} onClick={() => run(() => api.del('/ledger/demo'), () => { accounts.reload(); })}>حذف DEMO</button>
          </div>
          {(accounts.data ?? []).filter((a) => a.is_demo).map((a) => <div key={a.id} style={{ marginTop: 6 }}><Badge tone="demo">DEMO</Badge> <Link to={`/ledger/trades?accountIds=${a.id}`} style={{ color: 'var(--gold-bright)', fontSize: 12 }}>{a.name}</Link></div>)}
        </Card>
      </div>
      <Card title="Reconciliation — تقارير مُعلنة مقابل الـLedger" right={<span style={C.muted}>reported_snapshot ≠ trades</span>}>
        <Notice tone="neutral">الأرقام المجمّعة من التقارير تُخزّن كـsnapshot فقط ولا تُنشأ منها صفقات. الفروق تُعرض كما هي دون تخمين السبب.</Notice>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {(tmpl.data ?? []).filter((t) => !stored.has(t.dataset)).map((t) => (
            <button key={t.id} style={C.btnGhost} onClick={() => run(() => api.post('/ledger/snapshots', { template: t.id }), snaps.reload)}>تخزين: {t.sourceName}</button>
          ))}
        </div>
        {snaps.loading ? <Loading /> : !snaps.data?.length ? <Empty>لا توجد snapshots.</Empty> : snaps.data.map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><b>{s.sourceName}</b><Badge>{s.dataset}</Badge><span style={C.muted}>{s.periodStart ?? '?'} → {s.periodEnd ?? '?'}</span></div>
            <div style={{ ...C.muted, marginTop: 4 }}>{s.notes}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
              <span style={C.muted}>قارن مع حسابات:</span>
              {real.map((a) => {
                const on = s.accountIds.includes(a.id);
                return <label key={a.id} style={{ fontSize: 12 }}><input type="checkbox" checked={on} onChange={() => run(() => api.put(`/ledger/snapshots/${s.id}/accounts`, { accountIds: on ? s.accountIds.filter((x: string) => x !== a.id) : [...s.accountIds, a.id] }), snaps.reload)} /> {a.name}</label>;
              })}
              <span style={C.muted}>({s.ledgerScope.trades} صفقة في النطاق)</span>
            </div>
            <Checks title="اتساق التقرير مع نفسه" rows={s.internalChecks} />
            <Checks title="التقرير مقابل الصفقات المستوردة" rows={s.vsLedger} />
          </div>
        ))}
      </Card>
    </LedgerShell>
  );
}
