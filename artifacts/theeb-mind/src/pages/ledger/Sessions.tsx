import { useState } from 'react';
import { api } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, C, Field, useAsync, Loading, ErrorBox, Empty, Notice } from '../../components/ledger/ui';

const nyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function Sessions() {
  const notes = useAsync(() => api.get<any[]>('/ledger/notes'), []);
  const [n, setN] = useState<any>({ kind: 'session_pre', sessionDate: nyToday(), body: '', mood: '', readiness: '' });
  const [err, setErr] = useState<unknown>(null);
  const add = async () => {
    setErr(null);
    try { await api.post('/ledger/notes', { ...n, mood: n.mood ? Number(n.mood) : null, readiness: n.readiness ? Number(n.readiness) : null }); setN({ ...n, body: '' }); notes.reload(); } catch (e) { setErr(e); }
  };
  return (
    <LedgerShell title="Session journal" subtitle="مراجعة قبل الجلسة وبعدها. نصّك هو الدليل الأساسي — لا يُستنتج المزاج آلياً.">
      <Card title="ملاحظة جديدة">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          <Field label="النوع"><select style={C.input} value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })}><option value="session_pre">قبل الجلسة</option><option value="session_post">بعد الجلسة</option></select></Field>
          <Field label="تاريخ الجلسة (NY)"><input type="date" style={C.input} value={n.sessionDate} onChange={(e) => setN({ ...n, sessionDate: e.target.value })} /></Field>
          <Field label="المزاج 1–5"><select style={C.input} value={n.mood} onChange={(e) => setN({ ...n, mood: e.target.value })}><option value="">not recorded</option>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="الجاهزية 1–5"><select style={C.input} value={n.readiness} onChange={(e) => setN({ ...n, readiness: e.target.value })}><option value="">not recorded</option>{[1, 2, 3, 4, 5].map((x) => <option key={x}>{x}</option>)}</select></Field>
        </div>
        <Field label="الملاحظة"><textarea style={{ ...C.input, minHeight: 90, marginTop: 8 }} value={n.body} onChange={(e) => setN({ ...n, body: e.target.value })} placeholder={n.kind === 'session_pre' ? 'HTF bias، مستويات السيولة، الأخبار، خطة الجلسة…' : 'ما الذي التزمت به؟ ما الذي خالفته؟'} /></Field>
        <button style={{ ...C.btn, marginTop: 8 }} onClick={add} disabled={!n.body.trim()}>حفظ</button>
        {err != null && <ErrorBox error={err} />}
      </Card>
      <Notice tone="neutral">عدد الصفقات اليومي يظهر في Analytics ← "ترتيب الصفقة في اليوم" كسياق تحليلي فقط؛ لا يوجد حظر بعدد الصفقات.</Notice>
      <Card title="السجل">
        {notes.loading ? <Loading /> : notes.error ? <ErrorBox error={notes.error} /> : !notes.data?.length ? <Empty>لا توجد ملاحظات.</Empty> : notes.data.map((x) => (
          <div key={x.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><b style={C.mono}>{x.session_date}</b><Badge>{x.kind === 'session_pre' ? 'قبل' : 'بعد'}</Badge>{x.mood && <Badge>mood {x.mood}</Badge>}{x.readiness && <Badge>readiness {x.readiness}</Badge>}<span style={C.muted}>{x.created_at.slice(11, 16)} UTC</span></div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 4 }}>{x.body}</div>
          </div>
        ))}
      </Card>
    </LedgerShell>
  );
}
