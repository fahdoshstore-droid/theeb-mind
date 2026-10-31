import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtUsd } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, Field, useAsync, Loading, ErrorBox, Pnl, statusTone, Empty } from '../../components/ledger/ui';

const TZS = ['America/New_York', 'America/Chicago', 'UTC', 'Europe/London', 'Asia/Riyadh'];
const OUTCOME_LABEL: Record<string, string> = { new: 'جديد', duplicate_existing: 'مكرر (موجود سابقاً)', duplicate_in_file: 'مكرر داخل الملف', error: 'خطأ' };

export default function ImportCenter() {
  const meta = useAsync(() => api.get('/ledger/meta'), []);
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const batches = useAsync(() => api.get<any[]>('/ledger/imports'), []);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [kind, setKind] = useState<'trades' | 'fills'>('trades');
  const [preset, setPreset] = useState('generic_trades');
  const [tz, setTz] = useState('America/New_York');
  const [dateOrder, setDateOrder] = useState<'MDY' | 'DMY'>('MDY');
  const [accountId, setAccountId] = useState(''); const [accountName, setAccountName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string | string[]> | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [policy, setPolicy] = useState<'skip' | 'update' | 'distinct'>('skip');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null); const [result, setResult] = useState<any>(null);
  const [filter, setFilter] = useState<string>('all');

  const body = (m = mapping) => ({ content: file!.text, filename: file!.name, kind, preset, mapping: m, timezone: tz, dateOrder, accountId: accountId || null, accountName: accountName || null });
  const runPreview = async (m = mapping) => {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    try { const p = await api.post('/ledger/imports/preview', body(m)); setPreview(p); setMapping(p.mapping); } catch (e) { setErr(e); setPreview(null); } finally { setBusy(false); }
  };
  const commit = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.post('/ledger/imports/commit', { ...body(), duplicatePolicy: policy, expectedSha256: preview.fileSha256 }); setResult(r); setPreview(null); batches.reload(); accounts.reload(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const max = meta.data?.limits.maxImportBytes ?? 5242880;
    if (f.size > max) { setErr(new Error(`الملف أكبر من ${(max / 1048576).toFixed(0)} MB`)); return; }
    setFile({ name: f.name, text: await f.text() }); setMapping(null); setPreview(null); setResult(null);
  };
  const presets = (meta.data?.presets ?? []).filter((p: any) => p.kind === kind);
  const fields: string[] = kind === 'trades' ? meta.data?.tradeFields ?? [] : meta.data?.fillFields ?? [];
  const rows = (preview?.rows ?? []).filter((r: any) => filter === 'all' || r.outcome === filter);

  return (
    <LedgerShell title="Import Center" subtitle="رفع CSV ← معاينة الأعمدة والأخطاء والتكرار ← تأكيد الاستيراد في transaction واحدة. الصف الخام يُحفظ كما هو مع checksum.">
      <Card title="1 · الملف والإعدادات">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Field label="ملف CSV"><input type="file" accept=".csv,text/csv,.txt" onChange={(e) => onFile(e.target.files?.[0])} style={{ ...C.input, padding: 5 }} /></Field>
          <Field label="نوع البيانات" hint="Fill = تنفيذ واحد؛ Trade = صفقة كاملة (round trip)">
            <select style={C.input} value={kind} onChange={(e) => { const k = e.target.value as 'trades' | 'fills'; setKind(k); setPreset(k === 'trades' ? 'generic_trades' : 'generic_fills'); setMapping(null); setPreview(null); }}>
              <option value="trades">Trades (round-trip)</option><option value="fills">Fills / executions</option>
            </select>
          </Field>
          <Field label="Preset"><select style={C.input} value={preset} onChange={(e) => { setPreset(e.target.value); setMapping(null); }}>{presets.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="المنطقة الزمنية للتواريخ بلا offset" hint="لا يُفترض توقيت الخادم أبداً"><select style={C.input} value={tz} onChange={(e) => setTz(e.target.value)}>{TZS.map((z) => <option key={z}>{z}</option>)}</select></Field>
          <Field label="ترتيب التاريخ"><select style={C.input} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as 'MDY' | 'DMY')}><option value="MDY">MM/DD/YYYY</option><option value="DMY">DD/MM/YYYY</option></select></Field>
          <Field label="الحساب (إن لم يوجد عمود Account)">
            <select style={C.input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— من الملف أو اسم جديد —</option>
              {(accounts.data ?? []).filter((a) => !a.is_demo).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {!accountId && <input style={C.input} placeholder="اسم حساب جديد (اختياري)" value={accountName} onChange={(e) => setAccountName(e.target.value)} />}
          </Field>
        </div>
        {presets.find((p: any) => p.id === preset)?.notes.map((n: string, i: number) => <div key={i} style={{ ...C.muted, marginTop: 8 }}>• {n}</div>)}
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button style={C.btn} disabled={!file || busy} onClick={() => runPreview(null)}>{busy ? '…' : 'معاينة (لا يتم حفظ شيء)'}</button>
          {file && <span style={C.muted}>{file.name} · {(file.text.length / 1024).toFixed(1)} KB</span>}
        </div>
      </Card>

      {err != null && <ErrorBox error={err} />}
      {result && (
        <Notice tone="good">
          تم الاستيراد: {result.imported} جديد · {result.updated} محدّث · {result.duplicates} مكرر · {result.errors} خطأ — من {result.rows} صف.
          {result.sourceNetTotal != null && <> صافي P&L للصفوف الصالحة في المصدر {fmtUsd(result.sourceNetTotal)}؛ المستورد الجديد {fmtUsd(result.importedNetTotal)}.</>}
          {' '}<Link to={`/ledger/imports/${result.batchId}`} style={{ color: 'inherit' }}>تفاصيل الدفعة ←</Link>
        </Notice>
      )}

      {preview && (
        <>
          <Card title="2 · ربط الأعمدة (Column mapping)" right={<button style={C.btnGhost} onClick={() => runPreview(mapping)} disabled={busy}>إعادة المعاينة بهذا الربط</button>}>
            {preview.preset && !preview.preset.verified && <Notice>الـpreset غير متحقق منه مقابل ملف تصدير حقيقي — راجع كل عمود.</Notice>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8, marginTop: 10 }}>
              {fields.map((f) => (
                <Field key={f} label={f}>
                  <select style={C.input} value={Array.isArray(mapping?.[f]) ? (mapping![f] as string[]).join(' + ') : (mapping?.[f] as string) ?? ''}
                    onChange={(e) => { const v = e.target.value; const m = { ...(mapping ?? {}) }; if (!v) delete m[f]; else m[f] = v.includes(' + ') ? v.split(' + ') : v; setMapping(m); }}>
                    <option value="">— غير مسجل (unknown) —</option>
                    {Array.isArray(mapping?.[f]) && <option>{(mapping![f] as string[]).join(' + ')}</option>}
                    {preview.headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          </Card>

          <Card title="3 · ملخص التحقق">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Badge>{preview.summary.rows} صف</Badge><Badge tone="good">{preview.summary.new} جديد</Badge>
              <Badge tone={preview.summary.errors ? 'bad' : 'neutral'}>{preview.summary.errors} خطأ</Badge>
              <Badge tone="warn">{preview.summary.duplicatesExisting} مكرر موجود</Badge><Badge tone="warn">{preview.summary.duplicatesInFile} مكرر داخل الملف</Badge>
              {preview.summary.positions != null && <Badge>{preview.summary.positions} position مشتقة من fills · {preview.summary.lowConfidencePositions} بثقة أقل من high</Badge>}
              {preview.summary.rowsWithUnknownNet > 0 && <Badge tone="warn">{preview.summary.rowsWithUnknownNet} بدون net P&L</Badge>}
              {preview.summary.rowsWithPnlMismatch > 0 && <Badge tone="bad">{preview.summary.rowsWithPnlMismatch} فرق P&L بين المصدر والحساب</Badge>}
            </div>
            <div style={C.muted}>صافي P&L للصفوف الجديدة: <Pnl v={preview.summary.netPnlOfNewRows} />{preview.summary.netPnlOfAllValidRows != null && <> · لكل الصفوف الصالحة: <Pnl v={preview.summary.netPnlOfAllValidRows} /></>}</div>
            <div style={{ ...C.muted, marginTop: 6 }}>SHA-256: <span style={C.mono}>{preview.fileSha256}</span></div>
            {preview.sameFileImportedBefore.length > 0 && <div style={{ marginTop: 8 }}><Notice>هذا الملف نفسه (نفس checksum) استُورد سابقاً {preview.sameFileImportedBefore.length} مرة.</Notice></div>}
            {preview.accounts.some((a: any) => !a.exists) && <div style={{ ...C.muted, marginTop: 6 }}>حسابات ستُنشأ: {preview.accounts.filter((a: any) => !a.exists).map((a: any) => a.name).join('، ')}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              <Field label="سياسة التكرار للصفوف الموجودة سابقاً">
                <select style={C.input} value={policy} onChange={(e) => setPolicy(e.target.value as any)}>
                  <option value="skip">skip — تجاهل (افتراضي)</option>
                  {kind === 'trades' && <option value="update">update — تحديث الحقول المستوردة فقط (تبقى ملاحظاتك ووسومك)</option>}
                  <option value="distinct">import as distinct — استيراد كصفقات منفصلة عمداً</option>
                </select>
              </Field>
              <button style={C.btn} disabled={busy || preview.summary.valid === 0} onClick={commit}>تأكيد الاستيراد</button>
            </div>
          </Card>

          <Card title="4 · الصفوف" right={<select style={C.input} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">الكل</option>{Object.entries(OUTCOME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}>
            {preview.rowsTruncated && <Notice>يعرض أول 1000 صف فقط.</Notice>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['#', 'الحالة', 'الحساب', 'Symbol', 'Side', 'Qty', 'Entry (UTC)', 'Net', 'المصدر', 'أخطاء / تحذيرات'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r: any) => {
                    const n = r.normalized;
                    return (
                      <tr key={r.rowIndex}>
                        <td style={C.td}>{r.rowIndex}</td>
                        <td style={C.td}><Badge tone={r.outcome === 'new' ? 'good' : r.outcome === 'error' ? 'bad' : 'warn'}>{OUTCOME_LABEL[r.outcome] ?? r.outcome}</Badge></td>
                        <td style={C.td}>{r.account ?? '—'}</td>
                        <td style={{ ...C.td, ...C.mono }}>{n?.symbol ?? r.raw[preview.mapping.symbol] ?? '—'}</td>
                        <td style={C.td}>{n?.side ?? '—'}</td>
                        <td style={C.td}>{n?.quantity ?? '—'}</td>
                        <td style={{ ...C.td, ...C.mono }}>{n?.entryTime ?? n?.time ?? '—'}</td>
                        <td style={C.td}>{n ? <Pnl v={n.netPnl ?? null} /> : '—'}</td>
                        <td style={C.td}>{n?.netSource && <Badge tone={statusTone(n.netSource)}>{n.netSource}</Badge>}</td>
                        <td style={{ ...C.td, maxWidth: 380 }}>
                          {r.errors.map((e: string, i: number) => <div key={i} style={{ color: 'var(--red)' }}>✕ {e}</div>)}
                          {r.warnings.map((w: string, i: number) => <div key={i} style={C.muted}>• {w}</div>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {preview.positions?.length > 0 && (
            <Card title="Positions مشتقة من fills (flat → flat)">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['#', 'Symbol', 'Side', 'Max qty', 'Avg entry', 'Avg exit', 'Gross', 'Fees', 'Net', 'الثقة', 'ملاحظات'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
                <tbody>{preview.positions.map((p: any, i: number) => (
                  <tr key={i}><td style={C.td}>{i}</td><td style={C.td}>{p.symbol}</td><td style={C.td}>{p.side}</td><td style={C.td}>{p.quantity}</td>
                    <td style={{ ...C.td, ...C.mono }}>{p.entryPrice}</td><td style={{ ...C.td, ...C.mono }}>{p.exitPrice ?? 'open'}</td>
                    <td style={C.td}><Pnl v={p.grossPnl} /></td><td style={C.td}>{fmtUsd(p.fees)}</td><td style={C.td}><Pnl v={p.netPnl} /></td>
                    <td style={C.td}><Badge tone={statusTone(p.groupingConfidence)}>{p.groupingConfidence}</Badge></td><td style={{ ...C.td, ...C.muted }}>{p.groupingNotes.join('؛ ')}</td></tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <Card title="سجل دفعات الاستيراد">
        {batches.loading ? <Loading /> : batches.error ? <ErrorBox error={batches.error} /> : !batches.data?.length ? <Empty>لا توجد دفعات بعد.</Empty> : (
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['الوقت', 'الملف', 'النوع', 'صفوف', 'جديد', 'محدّث', 'مكرر', 'أخطاء', 'صافي المصدر', 'صافي المستورد', 'SHA-256'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>{batches.data.map((b: any) => (
              <tr key={b.id}><td style={{ ...C.td, ...C.mono }}><Link to={`/ledger/imports/${b.id}`} style={{ color: 'var(--gold-bright)' }}>{b.created_at.slice(0, 16).replace('T', ' ')}</Link></td>
                <td style={C.td}>{b.filename ?? '—'} {b.is_demo ? <Badge tone="demo">DEMO</Badge> : null}</td><td style={C.td}>{b.kind}</td><td style={C.td}>{b.row_count}</td><td style={C.td}>{b.imported_count}</td>
                <td style={C.td}>{b.updated_count}</td><td style={C.td}>{b.duplicate_count}</td><td style={C.td}>{b.error_count}</td><td style={C.td}><Pnl v={b.source_net_total} /></td><td style={C.td}><Pnl v={b.imported_net_total} /></td>
                <td style={{ ...C.td, ...C.mono }}>{b.file_sha256?.slice(0, 12)}…</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </LedgerShell>
  );
}
