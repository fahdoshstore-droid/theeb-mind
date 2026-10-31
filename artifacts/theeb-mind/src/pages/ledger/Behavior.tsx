import { useState } from 'react';
import { api, qs } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, useAsync, Loading, ErrorBox, Empty, TradeLink, DrillDown } from '../../components/ledger/ui';
import { FilterBar, useFilters } from './Trades';

export default function Behavior() {
  const { f, set } = useFilters();
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const b = useAsync(() => api.get(`/ledger/behavior${qs(f)}`), [JSON.stringify(f)]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const fb = async (pattern: string, tradeId: string, verdict: 'confirmed' | 'rejected') => {
    await api.post('/ledger/behavior/feedback', { pattern, tradeId, verdict, note: notes[`${pattern}|${tradeId}`] || null }); b.reload();
  };
  return (
    <LedgerShell title="Behavioral memory" subtitle="ملاحظات مبنية على بياناتك وكلماتك — صحّح أو ارفض كل تصنيف. لا شيء هنا يمنع التداول.">
      <Card><FilterBar f={f} set={set} accounts={accounts.data ?? []} /></Card>
      {b.loading ? <Loading /> : b.error ? <ErrorBox error={b.error} /> : <>
        <Notice tone="neutral">{b.data.note}</Notice>
        {!b.data.findings.length && <Empty>لا توجد أنماط في هذا النطاق.</Empty>}
        {b.data.findings.map((fi: any) => (
          <Card key={fi.pattern} title={fi.title} right={<div style={{ display: 'flex', gap: 6 }}><Badge>{fi.label}</Badge><DrillDown ids={fi.evidence.map((e: any) => e.tradeId)} /></div>}>
            <div style={{ ...C.muted, marginBottom: 8 }}>{fi.summary}</div>
            {fi.evidence.slice(0, 50).map((e: any) => {
              const k = `${fi.pattern}|${e.tradeId}`;
              return (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <TradeLink id={e.tradeId} /><span style={{ fontSize: 12, flex: 1 }}>{e.detail}</span>
                  {e.feedback ? <Badge tone={e.feedback.verdict === 'confirmed' ? 'bad' : 'good'}>{e.feedback.verdict === 'confirmed' ? 'أكدته' : 'رفضته'}{e.feedback.note ? `: ${e.feedback.note}` : ''}</Badge> : <>
                    <input style={{ ...C.input, width: 180 }} placeholder="تعليقك (اختياري)" value={notes[k] ?? ''} onChange={(ev) => setNotes({ ...notes, [k]: ev.target.value })} />
                    <button style={C.btnGhost} onClick={() => fb(fi.pattern, e.tradeId, 'confirmed')}>صحيح</button>
                    <button style={C.btnGhost} onClick={() => fb(fi.pattern, e.tradeId, 'rejected')}>غير صحيح</button></>}
                </div>
              );
            })}
          </Card>
        ))}
        <Card title="غير مُقيَّم (بيانات ناقصة)">{b.data.notAssessed.map((n: any) => <div key={n.pattern} style={{ fontSize: 12 }}><Badge tone="warn">{n.pattern}</Badge> {n.reason}</div>)}</Card>
      </>}
    </LedgerShell>
  );
}
