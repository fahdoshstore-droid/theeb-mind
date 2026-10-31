import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtUsd } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, Field, useAsync, Loading, ErrorBox, Pnl, Src, statusTone, Empty } from '../../components/ledger/ui';

function Row({ k, v, src }: { k: string; v: React.ReactNode; src?: string | null }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
    <span style={{ color: 'var(--text-secondary)' }}>{k}</span><span>{v ?? <span style={C.muted}>not recorded</span>}{src && <span style={{ ...C.muted, marginInlineStart: 8, fontSize: 10 }}>← {src}</span>}</span></div>;
}

export default function TradeDetail() {
  const { id } = useParams();
  const d = useAsync(() => api.get(`/ledger/trades/${id}`), [id]);
  const [form, setForm] = useState<any>({}); const [tags, setTags] = useState(''); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<unknown>(null);
  useEffect(() => { if (d.data) { const t = d.data.trade; setForm({ setup: t.setup ?? '', executionGrade: t.executionGrade ?? '', emotionBefore: t.emotionBefore ?? '', emotionAfter: t.emotionAfter ?? '', userNotes: t.userNotes ?? '', stopPrice: t.stopPrice ?? '', targetPrice: t.targetPrice ?? '' }); setTags(t.tags.join(', ')); } }, [d.data]);
  if (d.loading) return <LedgerShell title="صفقة"><Loading /></LedgerShell>;
  if (d.error) return <LedgerShell title="صفقة"><ErrorBox error={d.error} /></LedgerShell>;
  const { trade: t, rawRows, fills, tril, attachments, history } = d.data;
  const fs = t.fieldSources ?? {};
  const save = async () => {
    setErr(null); setMsg(null);
    try {
      const patch: any = { setup: form.setup || null, executionGrade: form.executionGrade || null, emotionBefore: form.emotionBefore || null, emotionAfter: form.emotionAfter || null, userNotes: form.userNotes || null };
      if (String(form.stopPrice) !== String(t.stopPrice ?? '')) patch.stopPrice = form.stopPrice === '' ? null : Number(form.stopPrice);
      if (String(form.targetPrice) !== String(t.targetPrice ?? '')) patch.targetPrice = form.targetPrice === '' ? null : Number(form.targetPrice);
      await api.patch(`/ledger/trades/${t.id}`, patch);
      await api.put(`/ledger/trades/${t.id}/tags`, { tags: tags.split(',').map((x) => x.trim()).filter(Boolean) });
      setMsg('تم الحفظ — البيانات المستوردة والصف الخام لم تتغير.'); d.reload();
    } catch (e) { setErr(e); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setErr(null);
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      await api.post(`/ledger/trades/${t.id}/attachments`, { mime: file.type, dataBase64: b64, caption: file.name });
      d.reload();
    } catch (e) { setErr(e); }
  };
  return (
    <LedgerShell title={`${t.symbol} · ${t.side} · ${t.entryNy} NY`} subtitle={<>{t.accountName} · origin {t.origin}{t.externalId && <> · external id <span style={C.mono}>{t.externalId}</span></>} {t.isDemo && <Badge tone="demo">DEMO</Badge>}</>}
      actions={<Link to={`/ledger/review?tradeId=${t.id}`} style={{ ...C.btn, textDecoration: 'none' }}>مراجعة TRIL لهذه الصفقة</Link>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card title="بيانات التنفيذ (مع مصدر كل حقل)">
          <Row k="Quantity" v={t.quantity} src={fs.quantity} />
          <Row k="Entry" v={<span style={C.mono}>{t.entryPrice} @ {t.entryTime}</span>} src={fs.entry_price} />
          <Row k="Exit" v={t.exitTime ? <span style={C.mono}>{t.exitPrice} @ {t.exitTime}</span> : t.status} src={fs.exit_price} />
          <Row k="Duration" v={t.durationMin != null ? `${t.durationMin} min` : null} />
          <Row k="Gross P&L" v={<><Pnl v={t.grossPnl} /> <Src s={t.grossSource} /></>} src={fs.gross_pnl} />
          <Row k="Fees" v={<>{fmtUsd(t.fees)} <Src s={t.feesSource} /></>} src={fs.fees} />
          <Row k="Net P&L" v={<><Pnl v={t.netPnl} /> <Src s={t.netSource} /></>} src={fs.net_pnl} />
          <Row k="Recomputed gross" v={t.recomputedGross != null ? fmtUsd(t.recomputedGross) : null} src={t.tickSource ? `tick ${t.tickSize} = $${t.tickValue} (${t.tickSource})` : undefined} />
          {t.pnlMismatch != null && Math.abs(t.pnlMismatch) > 0.01 && <Notice tone="bad">فرق بين P&L المصدر والمحسوب من الأسعار: {fmtUsd(t.pnlMismatch)}</Notice>}
          <Row k="Initial stop" v={t.stopPrice} src={t.stopSource} />
          <Row k="Target" v={t.targetPrice} src={t.targetSource} />
          <Row k="Initial risk" v={t.initialRiskUsd != null ? fmtUsd(t.initialRiskUsd) : null} src={t.initialRiskSource} />
          <Row k="R-multiple" v={t.rMultiple ?? <span style={C.muted}>غير متاح — لا يوجد initial risk قابل للتحقق</span>} />
          {t.groupingConfidence && <Row k="ثقة تجميع fills" v={<Badge tone={statusTone(t.groupingConfidence)}>{t.groupingConfidence}</Badge>} src={t.groupingNotes.join('؛ ')} />}
          {t.importedNotes && <Row k="ملاحظات مستوردة" v={t.importedNotes} src="import (read-only)" />}
        </Card>
        <Card title="ملاحظاتك وتقييمك (لا تغيّر البيانات المستوردة)">
          <div style={{ display: 'grid', gap: 8 }}>
            <Field label="Setup / Playbook"><input style={C.input} value={form.setup ?? ''} onChange={(e) => setForm({ ...form, setup: e.target.value })} /></Field>
            <Field label="Execution grade"><select style={C.input} value={form.executionGrade ?? ''} onChange={(e) => setForm({ ...form, executionGrade: e.target.value })}><option value="">not recorded</option>{['A', 'B', 'C', 'D', 'F'].map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="الحالة النفسية قبل"><input style={C.input} value={form.emotionBefore ?? ''} onChange={(e) => setForm({ ...form, emotionBefore: e.target.value })} /></Field>
            <Field label="الحالة النفسية بعد"><input style={C.input} value={form.emotionAfter ?? ''} onChange={(e) => setForm({ ...form, emotionAfter: e.target.value })} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Initial stop" hint="إن أُدخل بعد الصفقة يوسم retrospective"><input style={C.input} inputMode="decimal" value={form.stopPrice ?? ''} onChange={(e) => setForm({ ...form, stopPrice: e.target.value })} /></Field>
              <Field label="Target"><input style={C.input} inputMode="decimal" value={form.targetPrice ?? ''} onChange={(e) => setForm({ ...form, targetPrice: e.target.value })} /></Field>
            </div>
            <Field label="Tags (مفصولة بفواصل)"><input style={C.input} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
            <Field label="ملاحظات"><textarea style={{ ...C.input, minHeight: 100 }} value={form.userNotes ?? ''} onChange={(e) => setForm({ ...form, userNotes: e.target.value })} /></Field>
            <button style={C.btn} onClick={save}>حفظ</button>
            {msg && <Notice tone="good">{msg}</Notice>}{err != null && <ErrorBox error={err} />}
          </div>
        </Card>
      </div>
      <Card title="Screenshots" right={<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload(e.target.files?.[0])} style={{ ...C.input, padding: 4 }} />}>
        {!attachments.length ? <Empty>لا توجد صور. (PNG/JPEG/WEBP حتى 3MB — تُخزّن على الخادم ولا تُرسل لأي مزود AI)</Empty> :
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{attachments.map((a: any) => <a key={a.id} href={`/api/ledger/attachments/${a.id}`} target="_blank" rel="noreferrer"><img src={`/api/ledger/attachments/${a.id}`} alt={a.caption ?? ''} style={{ maxHeight: 160, borderRadius: 8, border: '1px solid var(--border)' }} /></a>)}</div>}
      </Card>
      <Card title="سجلات TRIL">
        {!tril.length ? <Empty>لا يوجد تقييم TRIL. التحليل قبل الصفقة يجب أن يُسجّل قبل الدخول.</Empty> : tril.map((e: any) => (
          <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <Badge>{e.phase}</Badge><Badge tone={statusTone(e.overall)}>{e.overall}</Badge><span style={C.mono}>{e.recorded_at}</span>
            {e.retrospective && <Badge tone="warn" title="recorded after the entry time">retrospective — سُجّل بعد الدخول</Badge>}
            <Link to={`/ledger/review?id=${e.id}`} style={{ color: 'var(--gold-bright)', fontSize: 12 }}>فتح</Link>
          </div>
        ))}
      </Card>
      {fills.length > 0 && <Card title={`Fills (${fills.length})`}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Time', 'Side', 'Qty', 'Price', 'Fees', 'Role', 'ID'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
        <tbody>{fills.map((x: any) => <tr key={x.id}><td style={{ ...C.td, ...C.mono }}>{x.fill_time}</td><td style={C.td}>{x.side}</td><td style={C.td}>{x.quantity}</td><td style={{ ...C.td, ...C.mono }}>{x.price}</td><td style={C.td}>{fmtUsd(x.fees)}</td><td style={C.td}>{x.role}</td><td style={{ ...C.td, ...C.mono }}>{x.external_id ?? '—'}</td></tr>)}</tbody></table></Card>}
      <Card title="الصفوف الخام المصدرية (للتدقيق)">
        {!rawRows.length ? <Empty>صفقة يدوية — لا يوجد صف مستورد.</Empty> : rawRows.map((r: any, i: number) => (
          <div key={i} style={{ marginBottom: 8 }}><div style={C.muted}><Link to={`/ledger/imports/${r.batchId}`} style={{ color: 'var(--gold-bright)' }}>{r.filename ?? r.batchId.slice(0, 8)}</Link> · row {r.rowIndex} · {r.outcome} · {r.importedAt}</div>
            <pre style={{ ...C.mono, whiteSpace: 'pre-wrap', margin: '4px 0 0', background: 'var(--void-raised)', padding: 8, borderRadius: 6 }}>{JSON.stringify(r.raw, null, 1)}</pre></div>
        ))}
      </Card>
      {history.length > 0 && <Card title="سجل التعديلات (audit)">{history.map((h: any, i: number) => <div key={i} style={{ ...C.muted, ...C.mono }}>{h.at} · {h.type} · {JSON.stringify(h.data.after ?? h.data.changed ?? {}).slice(0, 200)}</div>)}</Card>}
    </LedgerShell>
  );
}
