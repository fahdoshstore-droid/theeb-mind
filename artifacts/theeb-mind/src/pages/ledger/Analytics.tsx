import { api, qs, fmtNum } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, useAsync, Loading, ErrorBox, Empty, Pnl, DrillDown } from '../../components/ledger/ui';
import { FilterBar, useFilters } from './Trades';

const GROUP_LABEL: Record<string, string> = { symbol: 'حسب الرمز', side: 'حسب الاتجاه', account: 'حسب الحساب', session: 'حسب الجلسة (NY)', weekday: 'حسب اليوم (NY)', hour: 'حسب الساعة (NY)', month: 'حسب الشهر', setup: 'حسب الـSetup', tradeOfDay: 'ترتيب الصفقة في اليوم (سياق، ليس حظراً)' };

function Curve({ pts }: { pts: { cum: number }[] }) {
  if (pts.length < 2) return <Empty>تحتاج صفقتين مغلقتين على الأقل مع وقت خروج.</Empty>;
  const w = 600, h = 160, min = Math.min(0, ...pts.map((p) => p.cum)), max = Math.max(0, ...pts.map((p) => p.cum)), span = max - min || 1;
  const xy = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - ((p.cum - min) / span) * h}`).join(' ');
  const zero = h - ((0 - min) / span) * h;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 180 }} role="img" aria-label="cumulative realized net P&L">
      <line x1="0" x2={w} y1={zero} y2={zero} stroke="var(--border-medium)" strokeDasharray="4 4" />
      <polyline points={xy} fill="none" stroke="var(--gold)" strokeWidth="2" />
    </svg>
  );
}

export default function Analytics() {
  const { f, set } = useFilters();
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const a = useAsync(() => api.get(`/ledger/analytics${qs(f)}`), [JSON.stringify(f)]);
  const d = a.data;
  return (
    <LedgerShell title="Analytics" subtitle="كل مقياس مع معادلته وحجم العينة ومصدره. لا استنتاج edge من عينة صغيرة.">
      <Card><FilterBar f={f} set={set} accounts={accounts.data ?? []} />
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}><span style={C.muted}>الحد الأدنى للعينة لإظهار المجموعة "كافية":</span>
          <input style={{ ...C.input, width: 70 }} type="number" min={1} value={f.minSample ?? '20'} onChange={(e) => set('minSample', e.target.value)} /></div></Card>
      {a.loading ? <Loading /> : a.error ? <ErrorBox error={a.error} /> : !d.scope.trades ? <Empty>لا توجد صفقات في هذا النطاق.</Empty> : <>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge>{d.scope.trades} صفقة</Badge><Badge>{d.scope.closedWithPnl} مغلقة بـP&L معروف</Badge>{d.scope.open > 0 && <Badge tone="warn">{d.scope.open} مفتوحة</Badge>}
          {d.scope.unknownPnl > 0 && <Badge tone="warn">{d.scope.unknownPnl} P&L unknown</Badge>}<Badge>{d.scope.accounts.length} حساب</Badge>{d.scope.includesDemo && <Badge tone="demo">يتضمن DEMO</Badge>}
          <Badge>{d.scope.from?.slice(0, 10)} → {d.scope.to?.slice(0, 10)}</Badge>
        </div>
        {d.notices.length > 0 && <Card title="جودة البيانات">{d.notices.map((n: any, i: number) => (
          <div key={n.code + i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}><Badge tone={n.level === 'warning' ? 'warn' : 'neutral'}>{n.code}</Badge><span style={{ fontSize: 12 }}>{n.message}</span><DrillDown ids={n.tradeIds} /></div>
        ))}</Card>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {d.metrics.map((m: any) => (
            <div key={m.key} style={{ ...C.card, padding: 12 }} title={m.formula}>
              <div style={C.muted}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>{m.value == null ? <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>not available</span> : m.unit === '$' ? <Pnl v={m.value} /> : m.unit === '%' ? `${m.value}%` : m.unit === 'x' ? `${m.value}×` : m.unit === 'R' ? `${m.value}R` : m.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>n = {m.sample} · {m.provenance}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.formula}</div>
              {m.note && <div style={{ fontSize: 10, color: 'var(--gold-bright)' }}>{m.note}</div>}
            </div>
          ))}
        </div>
        <Card title="Cumulative realized net P&L" right={<span style={C.muted}>ليس equity statement رسمياً</span>}>
          <Curve pts={d.cumulative} />
          <div style={C.muted}>{d.peakToTrough.label}: <Pnl v={d.peakToTrough.value} /></div>
        </Card>
        {Object.entries(d.groups).map(([k, rows]: [string, any]) => (
          <Card key={k} title={GROUP_LABEL[k] ?? k}>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['', 'n', 'W / L / BE', 'Win rate', 'Net', 'Avg R (n)', 'العينة', ''].map((h, i) => <th key={i} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((g: any) => (
                <tr key={g.key}><td style={C.td}>{g.key}</td><td style={C.td}>{g.n}</td><td style={C.td}>{g.wins} / {g.losses} / {g.breakeven}</td>
                  <td style={C.td}>{g.winRate == null ? '—' : `${g.winRate}%`}</td><td style={C.td}><Pnl v={g.net} /></td><td style={C.td}>{g.avgR == null ? '—' : `${fmtNum(g.avgR)}R (${g.nR})`}</td>
                  <td style={C.td}>{g.sufficient ? <Badge tone="good">n ≥ {d.minSample}</Badge> : <Badge tone="warn">عينة صغيرة</Badge>}</td><td style={C.td}><DrillDown ids={g.tradeIds} label="الصفقات" /></td></tr>
              ))}</tbody>
            </table></div>
          </Card>
        ))}
        <Notice tone="neutral">{Object.entries(d.definitions).map(([k, v]) => `${k}: ${v}`).join(' · ')}</Notice>
      </>}
    </LedgerShell>
  );
}
