import { useParams } from 'react-router-dom';
import { api } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, C, useAsync, Loading, ErrorBox, TradeLink, statusTone } from '../../components/ledger/ui';

export default function ImportBatch() {
  const { id } = useParams();
  const b = useAsync(() => api.get(`/ledger/imports/${id}`), [id]);
  if (b.loading) return <LedgerShell title="دفعة استيراد"><Loading /></LedgerShell>;
  if (b.error) return <LedgerShell title="دفعة استيراد"><ErrorBox error={b.error} /></LedgerShell>;
  const d = b.data;
  return (
    <LedgerShell title={`دفعة استيراد · ${d.filename ?? d.id.slice(0, 8)}`} subtitle={<>SHA-256 <span style={C.mono}>{d.file_sha256}</span> · {d.timezone} · policy {d.duplicate_policy}</>}
      actions={<a href={`/api/ledger/imports/${d.id}/source`} style={{ ...C.btnGhost, textDecoration: 'none' }}>تنزيل الملف المصدر</a>}>
      <Card title="الربط المستخدم"><pre style={{ ...C.mono, whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(d.mapping, null, 2)}</pre></Card>
      <Card title={`الصفوف الخام (${d.rows.length})`}>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['#', 'النتيجة', 'الصفقة', 'الصف الخام', 'أخطاء/تحذيرات'].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
          <tbody>{d.rows.map((r: any) => (
            <tr key={r.rowIndex}><td style={C.td}>{r.rowIndex}</td><td style={C.td}><Badge tone={statusTone(r.outcome === 'imported' || r.outcome === 'grouped' ? 'ok' : r.outcome === 'error' ? 'error' : 'info')}>{r.outcome}</Badge></td>
              <td style={C.td}>{r.tradeId ? <TradeLink id={r.tradeId} /> : '—'}</td>
              <td style={{ ...C.td, ...C.mono, maxWidth: 520, wordBreak: 'break-all' }}>{JSON.stringify(r.raw)}</td>
              <td style={C.td}>{r.errors.map((e: string, i: number) => <div key={i} style={{ color: 'var(--red)' }}>✕ {e}</div>)}{r.warnings.map((w: string, i: number) => <div key={i} style={C.muted}>• {w}</div>)}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
    </LedgerShell>
  );
}
