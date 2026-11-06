// Legacy COT (NASDAQ-100): MarketBulls primary, CFTC validation.
// VERIFIED shows values. MISMATCH shows both sides as unverified.
// DATA_UNAVAILABLE shows the reason and no numbers at all.
import { useEffect, useState } from 'react';
import { getCotLegacy } from '../../lib/api';
import type { LegacyCotResult, LegacyGroupKey, LegacyCotReason } from '../../lib/types';
import { StateChip, SourceStage } from './StateChip';

const GROUPS: { key: LegacyGroupKey; ar: string; en: string }[] = [
  { key: 'nonCommercial', ar: 'غير التجاريين', en: 'NON-COMMERCIAL' },
  { key: 'commercial', ar: 'التجاريون', en: 'COMMERCIAL' },
  { key: 'nonReportable', ar: 'غير المبلَّغ عنهم', en: 'NON-REPORTABLE' },
];

const REASON_AR: Record<LegacyCotReason, string> = {
  PRIMARY_UNAVAILABLE: 'تعذّر جلب MarketBulls (المصدر الأساسي). لا تُعرض قيم CFTC بدلاً منه.',
  VALIDATION_UNAVAILABLE: 'تعذّر جلب CFTC للتحقق. لا تُعرض قيم MarketBulls غير المتحقق منها.',
  BOTH_UNAVAILABLE: 'تعذّر الوصول إلى MarketBulls و CFTC.',
  VALIDATION_WEEK_NOT_FOUND: 'أسبوع تقرير MarketBulls غير موجود في بيانات CFTC بعد.',
  NO_COMPARABLE_FIELDS: 'لا توجد حقول مشتركة يمكن مقارنتها بين المصدرين.',
  VALUES_DIFFER: 'القيم تختلف بين المصدرين.',
};

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));
const signed = (n: number | null | undefined) => (n === null || n === undefined ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US'));
const time = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' ET';

function HistoryBars({ history }: { history: NonNullable<LegacyCotResult['history']> }) {
  const weeks = [...history].reverse(); // oldest → newest, left to right
  const vals = weeks.flatMap((w) => [w.nonCommercialNet, w.commercialNet, w.nonReportableNet]).filter((v): v is number => v !== null);
  const max = Math.max(1, ...vals.map(Math.abs));
  const rows: { key: 'nonCommercialNet' | 'commercialNet' | 'nonReportableNet'; label: string }[] = [
    { key: 'nonCommercialNet', label: 'NON-COMM' }, { key: 'commercialNet', label: 'COMMERCIAL' }, { key: 'nonReportableNet', label: 'NON-REPT' },
  ];
  const W = 340, rowH = 44, bw = Math.min(20, (W - 90) / Math.max(1, weeks.length) - 4);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${rows.length * rowH + 6}`} role="img" aria-label="صافي المراكز للأسابيع المتحقق منها" style={{ direction: 'ltr' }}>
      {rows.map((r, ri) => {
        const mid = 4 + ri * rowH + rowH / 2;
        return (
          <g key={r.key}>
            <line x1={4} x2={W - 86} y1={mid} y2={mid} stroke="#22272d" />
            {weeks.map((w, i) => {
              const v = w[r.key];
              if (v === null) return null;
              const h = (Math.abs(v) / max) * (rowH / 2 - 4);
              return <rect key={w.reportDate} x={8 + i * (bw + 4)} y={v >= 0 ? mid - h : mid} width={bw} height={Math.max(1, h)}
                fill={v >= 0 ? '#3fb68b' : '#e5534b'} fillOpacity={i === weeks.length - 1 ? 1 : 0.45} />;
            })}
            <text x={W - 80} y={mid - 4} fill="#979ea7" fontFamily="IBM Plex Mono, monospace" fontSize={9}>{r.label}</text>
            <text x={W - 80} y={mid + 10} fill="#dcdfe3" fontFamily="IBM Plex Mono, monospace" fontSize={11}>{signed(weeks[weeks.length - 1]?.[r.key])}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CotLegacyPanel() {
  const [data, setData] = useState<LegacyCotResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCotLegacy()
      .then((d) => { if (alive) setData(d); })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const verified = data?.status === 'VERIFIED';

  return (
    <div className="rb" data-testid="cot-legacy" data-status={data?.status ?? (error ? 'REQUEST_FAILED' : 'LOADING')}>
      <div className="rh">
        <h3>COT</h3><span className="code">NASDAQ-100 · LEGACY</span>
        {loading ? <span className="chip mute">LOADING</span>
          : data ? <StateChip state={data.status === 'DATA_UNAVAILABLE' ? 'UNAVAILABLE' : data.status} />
          : <StateChip state="UNAVAILABLE" />}
      </div>
      <div className="prov">
        <span><b>MarketBulls</b> primary</span><SourceStage entry="cotPrimary" verified={verified} />
      </div>
      <div className="prov">
        <span><b>CFTC</b> validation · contract 209742 · futures only</span><SourceStage entry="cotValidation" verified={verified} />
      </div>

      {loading && <p className="cap">جاري جلب المصدرين والمقارنة…</p>}

      {!loading && error && (
        <div className="na-box"><span>تعذّر الوصول إلى خادم THEEB MIND. لا تُعرض أي قيم.</span><span className="mono ltr" style={{ fontSize: 10 }}>{error.slice(0, 160)}</span></div>
      )}

      {data && data.status === 'DATA_UNAVAILABLE' && (
        <div className="na-box">
          <span>{data.reason ? REASON_AR[data.reason] : 'البيانات غير متاحة.'}</span>
          <span className="mono ltr" style={{ fontSize: 10 }}>
            MarketBulls: {data.sources.primary.status}{data.sources.primary.error ? ' — ' + data.sources.primary.error : ''}
            <br />CFTC: {data.sources.validation.status}{data.sources.validation.error ? ' — ' + data.sources.validation.error : ''}
          </span>
          <span className="mono ltr" style={{ fontSize: 10 }}>checked {time(data.checkedAt)}</span>
        </div>
      )}

      {data && data.status === 'VERIFIED' && data.groups && (
        <>
          <div className="prov"><span>positions as of Tue <b>{data.reportDate}</b></span><span>checked {time(data.checkedAt)}</span></div>
          <table className="cot">
            <thead><tr><th>الفئة</th><th>LONG</th><th>SHORT</th><th>NET</th><th>Δ NET</th></tr></thead>
            <tbody>
              {GROUPS.map((g) => (
                <tr key={g.key}>
                  <td>{g.ar}</td>
                  <td className="num">{fmt(data.groups![g.key].long)}</td>
                  <td className="num">{fmt(data.groups![g.key].short)}</td>
                  <td className="num">{signed(data.groups![g.key].net)}</td>
                  <td className="num">{signed(data.netChange?.[g.key] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.history && data.history.length > 1 && <HistoryBars history={data.history} />}
          <p className="cap"><b>صافي المراكز بالعقود، للأسابيع المتحقق منها فقط.</b> Δ يظهر فقط إذا كان الأسبوع السابق متحققاً منه أيضاً.</p>
        </>
      )}

      {data && data.status === 'MISMATCH' && (
        <>
          <div className="na-box" style={{ borderColor: 'rgba(217,163,58,.45)', background: 'none' }}>
            <span>القيم تختلف بين MarketBulls و CFTC لأسبوع <span className="num">{data.reportDate}</span>. البيانات أدناه <b>غير متحقق منها</b>.</span>
          </div>
          <table className="cot">
            <thead><tr><th>NET</th><th>MarketBulls</th><th>CFTC</th></tr></thead>
            <tbody>
              {GROUPS.map((g) => {
                const differs = data.validation.differences.some((d) => d.group === g.key);
                return (
                  <tr key={g.key}>
                    <td>{g.ar}</td>
                    <td className={'num' + (differs ? ' diff' : '')}>{fmt(data.sources.primary.unverifiedLatest?.groups[g.key].net)}</td>
                    <td className={'num' + (differs ? ' diff' : '')}>{fmt(data.sources.validation.unverifiedLatest?.groups[g.key].net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="cap">
            {data.validation.differences.length} اختلاف من {data.validation.fieldsCompared} حقلاً مقارناً. لا يُطبَّق أي هامش تسامح.
          </p>
        </>
      )}

      {data && <p className="cap" style={{ color: 'var(--d-t3)' }}>قاعدة التحقق الحالية مؤقتة: تطابق تام في كل حقل ينشره المصدران، دون هامش، حتى تُراجَع الفروقات الفعلية.</p>}
    </div>
  );
}
