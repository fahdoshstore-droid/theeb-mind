import { useState } from 'react';
import { api } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, useAsync, Loading, ErrorBox, statusTone } from '../../components/ledger/ui';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const show = (key: string, v: any) => {
  if (v == null) return '—';
  if (key.includes('weekdays')) return (v as number[]).map((d) => WD[d]).join(', ');
  if (key === 'enabled_sessions') return (v as string[]).map((s) => (s === 'ny_am' ? 'NY AM 09:30–12:10' : 'NY PM 13:30–16:10')).join(' + ');
  if (key.endsWith('_usd')) return `$${v}`;
  return String(v);
};

function Editor({ rule, onSaved }: { rule: any; onSaved: () => void }) {
  const kind = rule.key.includes('weekdays') ? 'weekdays' : rule.key === 'enabled_sessions' ? 'sessions' : 'number';
  const [val, setVal] = useState<any>(rule.active?.value ?? (kind === 'number' ? '' : []));
  const [reason, setReason] = useState(''); const [status, setStatus] = useState<'active' | 'observation'>('active'); const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setErr(null);
    try { await api.put(`/ledger/rules/${rule.key}`, { value: kind === 'number' ? Number(val) : val, reason: reason || null, status }); setReason(''); onSaved(); } catch (e) { setErr(e); }
  };
  const toggle = (x: any) => setVal((v: any[]) => (v.includes(x) ? v.filter((y) => y !== x) : [...v, x].sort()));
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
      {kind === 'number' && <input style={{ ...C.input, width: 100 }} inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} />}
      {kind === 'weekdays' && WD.map((d, i) => <label key={d} style={{ fontSize: 12 }}><input type="checkbox" checked={val.includes(i)} onChange={() => toggle(i)} />{d}</label>)}
      {kind === 'sessions' && ['ny_am', 'ny_pm'].map((s) => <label key={s} style={{ fontSize: 12 }}><input type="checkbox" checked={val.includes(s)} onChange={() => toggle(s)} />{s === 'ny_am' ? 'NY AM' : 'NY PM'}</label>)}
      <select style={C.input} value={status} onChange={(e) => setStatus(e.target.value as any)}><option value="active">active</option><option value="observation">observation (لا يُطبّق)</option></select>
      <input style={{ ...C.input, flex: 1, minWidth: 140 }} placeholder="سبب التغيير (يُحفظ في السجل)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button style={C.btnGhost} onClick={save}>حفظ كنسخة جديدة</button>
      {err != null && <ErrorBox error={err} />}
    </div>
  );
}

export default function Rules() {
  const r = useAsync(() => api.get('/ledger/rules'), []);
  const h = useAsync(() => api.get<any[]>('/ledger/rules/history'), []);
  const reload = () => { r.reload(); h.reload(); };
  const act = async (fn: () => Promise<unknown>) => { await fn(); reload(); };
  return (
    <LedgerShell title="Personal rules profile" subtitle="قيمك الحالية مؤرخة ولها مصدر وسجل تعديل. الإعدادات القديمة محفوظة كنسخ historical ولا تُطبّق تلقائياً.">
      {r.loading ? <Loading /> : r.error ? <ErrorBox error={r.error} /> : <>
        <Notice tone="neutral">{r.data.note}</Notice>
        {r.data.rules.some((x: any) => x.needsConfirmation) && <Notice>بعض القيم المفعّلة مأخوذة من تعليمات البناء وتنتظر تأكيدك (Confirm) أو تعديلك.</Notice>}
        {r.data.rules.map((rule: any) => (
          <Card key={rule.key} title={rule.label} right={<div style={{ display: 'flex', gap: 6 }}>
            {rule.active ? <Badge tone="good">active: {show(rule.key, rule.active.value)}</Badge> : <Badge>لا توجد قيمة مفعّلة — لا يُطبّق</Badge>}
            {rule.needsConfirmation && <button style={C.btn} onClick={() => act(() => api.post(`/ledger/rules/version/${rule.active.id}/confirm`))}>Confirm</button>}</div>}>
            {rule.conflicts.length > 0 && <Notice>تعارض مع نسخ أخرى: {rule.conflicts.map((c: any) => `${show(rule.key, c.value)} (${c.status} — ${c.source})`).join(' · ')}</Notice>}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead><tr>{['v', 'القيمة', 'الحالة', 'المصدر', 'من', 'إلى', 'مؤكد', ''].map((x, i) => <th key={i} style={C.th}>{x}</th>)}</tr></thead>
              <tbody>{rule.versions.map((v: any) => (
                <tr key={v.id}><td style={C.td}>{v.version}</td><td style={C.td}>{show(rule.key, v.value)}</td><td style={C.td}><Badge tone={v.status === 'active' ? 'good' : statusTone(v.status)}>{v.status}</Badge></td>
                  <td style={{ ...C.td, ...C.muted, maxWidth: 320 }}>{v.source}{v.note ? ` — ${v.note}` : ''}</td><td style={{ ...C.td, ...C.mono }}>{v.effectiveFrom?.slice(0, 10) ?? '—'}</td><td style={{ ...C.td, ...C.mono }}>{v.effectiveTo?.slice(0, 10) ?? '—'}</td>
                  <td style={C.td}>{v.confirmedAt ? v.confirmedAt.slice(0, 10) : '—'}</td>
                  <td style={C.td}>{v.status !== 'active' && <button style={C.btnGhost} onClick={() => act(() => api.post(`/ledger/rules/version/${v.id}/status`, { status: 'active', reason: `re-activated v${v.version}` }))}>تفعيل</button>}
                    {v.status === 'active' && <button style={C.btnGhost} onClick={() => act(() => api.post(`/ledger/rules/version/${v.id}/status`, { status: 'disabled', reason: 'disabled by user' }))}>تعطيل</button>}</td></tr>
              ))}</tbody>
            </table>
            <Editor rule={rule} onSaved={reload} />
          </Card>
        ))}
      </>}
      <Card title="سجل التعديلات">
        {h.loading ? <Loading /> : (h.data ?? []).slice(0, 80).map((x: any, i: number) => <div key={i} style={{ ...C.mono, ...C.muted }}>{x.changed_at} · {x.rule_key} · {x.action} · {JSON.stringify(x.old)} → {JSON.stringify(x.new)}{x.reason ? ` · ${x.reason}` : ''}</div>)}
      </Card>
    </LedgerShell>
  );
}
