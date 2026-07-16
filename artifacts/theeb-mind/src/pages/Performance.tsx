import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, TrendingUp, TrendingDown, Activity, Target, BarChart3, Clock } from 'lucide-react';
import {
  getPerformanceSummary,
  getEquityCurve,
  getDrawdown,
  getInstrumentBreakdown,
  getPsychCorrelation,
  getTimeAnalysis,
} from '../lib/api';
import type {
  PerformanceSummary,
  EquityPoint,
  DrawdownResult,
  InstrumentStat,
  PsychCorrelation,
  KillzoneStat,
} from '../lib/types';

const USER_ID = 'user-1';

const KILLZONE_AR: Record<string, string> = {
  asian:    'الآسيوية',
  london:   'اللندنية',
  nyAM:     'نيويورك ص',
  nyLunch:  'نيويورك غ',
  nyPM:     'نيويورك م',
};

const VERDICT_AR: Record<string, string> = {
  pass:    'ناجح',
  warning: 'تحذير',
  fail:    'فشل',
};

const OUTCOME_AR: Record<string, string> = {
  win:       'ربح',
  loss:      'خسارة',
  breakeven: 'تعادل',
};

// ── Equity Curve SVG ──────────────────────────────────────────────────────────
function EquityCurve({ data }: { data: EquityPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-cream/30 text-sm">
        لا توجد بيانات كافية — سجّل نتائج صفقاتك أولاً
      </div>
    );
  }

  const W = 800, H = 160, PAD = { top: 16, right: 16, bottom: 24, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values   = data.map(p => p.cumulative);
  const minVal   = Math.min(0, ...values);
  const maxVal   = Math.max(0, ...values);
  const range    = maxVal - minVal || 1;

  const toX = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const toY = (v: number) => PAD.top + innerH - ((v - minVal) / range) * innerH;

  const zeroY    = toY(0);
  const points   = data.map((p, i) => `${toX(i)},${toY(p.cumulative)}`).join(' ');
  const lastPt   = data[data.length - 1];
  const lastIsUp = lastPt.cumulative >= 0;

  // Y-axis labels
  const yTicks = [minVal, minVal + range * 0.25, minVal + range * 0.5, minVal + range * 0.75, maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1"
          />
          <text x={PAD.left - 6} y={toY(v) + 4} textAnchor="end"
            fontSize="9" fill="rgba(255,255,255,0.3)">
            {v >= 0 ? '+' : ''}{Math.round(v)}
          </text>
        </g>
      ))}

      {/* Zero line */}
      {minVal < 0 && maxVal > 0 && (
        <line x1={PAD.left} y1={zeroY} x2={W - PAD.right} y2={zeroY}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4,3" />
      )}

      {/* Fill area */}
      <polyline
        points={`${toX(0)},${zeroY} ${points} ${toX(data.length - 1)},${zeroY}`}
        fill={lastIsUp ? 'rgba(0,214,143,0.08)' : 'rgba(255,59,92,0.08)'}
        stroke="none"
      />

      {/* Curve */}
      <polyline
        points={points}
        fill="none"
        stroke={lastIsUp ? '#00D68F' : '#FF3B5C'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Last point dot */}
      <circle
        cx={toX(data.length - 1)}
        cy={toY(lastPt.cumulative)}
        r="4"
        fill={lastIsUp ? '#00D68F' : '#FF3B5C'}
      />
    </svg>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color = 'text-cream', icon,
}: {
  label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="card-dark flex-1 min-w-[120px]">
      {icon && <div className="text-cream/30 mb-2">{icon}</div>}
      <p className="text-xs text-cream/40 mb-1">{label}</p>
      <p className={`text-xl font-extrabold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-xs text-cream/40 mt-1">{sub}</p>}
    </div>
  );
}

// ── Instrument Table ───────────────────────────────────────────────────────────
function InstrumentTable({ data }: { data: InstrumentStat[] }) {
  const [sortBy, setSortBy] = useState<'winRate' | 'avgPnl' | 'trades'>('trades');

  const sorted = [...data].sort((a, b) => b[sortBy] - a[sortBy]);

  if (data.length === 0) {
    return <div className="text-cream/30 text-sm text-center py-8">لا توجد بيانات</div>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(['trades', 'winRate', 'avgPnl'] as const).map(k => (
          <button key={k} onClick={() => setSortBy(k)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              sortBy === k
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-white/10 text-cream/40 hover:border-white/20'
            }`}>
            {k === 'trades' ? 'الصفقات' : k === 'winRate' ? 'الفوز%' : 'متوسط الربح'}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-right pb-2 text-cream/40 font-medium">الأداة</th>
              <th className="text-center pb-2 text-cream/40 font-medium">صفقات</th>
              <th className="text-center pb-2 text-cream/40 font-medium">فوز%</th>
              <th className="text-center pb-2 text-cream/40 font-medium">جودة</th>
              <th className="text-left pb-2 text-cream/40 font-medium">PnL</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.instrument} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="py-2 font-mono text-cream font-bold">{r.instrument}</td>
                <td className="py-2 text-center text-cream/70">{r.trades}</td>
                <td className="py-2 text-center">
                  <span className={r.winRate >= 50 ? 'text-emerald' : 'text-warning'}>
                    {r.winRate.toFixed(0)}%
                  </span>
                </td>
                <td className="py-2 text-center text-cream/70">{r.avgQuality.toFixed(0)}</td>
                <td className={`py-2 text-left font-mono ${r.avgPnl >= 0 ? 'text-emerald' : 'text-warning'}`}>
                  {r.avgPnl >= 0 ? '+' : ''}{r.avgPnl.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Psychology × Outcome Matrix ───────────────────────────────────────────────
function PsychMatrix({ data }: { data: PsychCorrelation }) {
  const total = data.verdicts.reduce((s, v) =>
    s + data.outcomes.reduce((s2, o) => s2 + (data.matrix[v]?.[o] ?? 0), 0), 0);

  const outcomeColor: Record<string, string> = {
    win: 'text-emerald', loss: 'text-warning', breakeven: 'text-gold',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="pb-2 text-cream/30 font-normal text-right"></th>
            {data.outcomes.map(o => (
              <th key={o} className={`pb-2 text-center font-medium ${outcomeColor[o]}`}>
                {OUTCOME_AR[o]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.verdicts.map(v => {
            const rowTotal = data.outcomes.reduce((s, o) => s + (data.matrix[v]?.[o] ?? 0), 0);
            return (
              <tr key={v} className="border-b border-white/5">
                <td className="py-2 text-cream/60 font-medium text-right pe-3">{VERDICT_AR[v]}</td>
                {data.outcomes.map(o => {
                  const count = data.matrix[v]?.[o] ?? 0;
                  const pct   = rowTotal > 0 ? (count / rowTotal) * 100 : 0;
                  const bg    = count === 0 ? 'bg-white/2' :
                                o === 'win' ? 'bg-emerald/10' :
                                o === 'loss' ? 'bg-warning/10' : 'bg-gold/10';
                  return (
                    <td key={o} className="py-2 text-center">
                      <div className={`mx-auto w-12 h-10 rounded-lg flex flex-col items-center justify-center ${bg}`}>
                        <span className={`font-bold text-sm ${count === 0 ? 'text-cream/20' : outcomeColor[o]}`}>
                          {count}
                        </span>
                        {rowTotal > 0 && count > 0 && (
                          <span className="text-cream/30" style={{ fontSize: 9 }}>
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {total === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-cream/30">لا توجد بيانات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Killzone Heatmap ──────────────────────────────────────────────────────────
function KillzoneHeatmap({ data }: { data: KillzoneStat[] }) {
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="space-y-2">
      {data.map(kz => {
        const winPct  = kz.total > 0 ? (kz.wins  / kz.total) * 100 : 0;
        const lossPct = kz.total > 0 ? (kz.losses / kz.total) * 100 : 0;
        const intensity = kz.total / maxTotal;

        return (
          <div key={kz.killzone} className="flex items-center gap-3">
            <span className="text-xs text-cream/50 w-20 text-right shrink-0">
              {KILLZONE_AR[kz.killzone] ?? kz.killzone}
            </span>
            <div className="flex-1 flex gap-1 h-7 rounded overflow-hidden">
              {kz.total === 0 ? (
                <div className="flex-1 bg-white/3 rounded flex items-center justify-center">
                  <span className="text-cream/20" style={{ fontSize: 10 }}>—</span>
                </div>
              ) : (
                <>
                  {kz.wins > 0 && (
                    <div
                      className="flex items-center justify-center text-emerald font-bold"
                      style={{ width: `${winPct}%`, background: `rgba(0,214,143,${0.15 + intensity * 0.25})`, fontSize: 10 }}
                    >
                      {kz.wins}
                    </div>
                  )}
                  {kz.breakevens > 0 && (
                    <div
                      className="flex items-center justify-center text-gold font-bold"
                      style={{ width: `${kz.total > 0 ? (kz.breakevens / kz.total) * 100 : 0}%`, background: `rgba(201,168,76,${0.15 + intensity * 0.15})`, fontSize: 10 }}
                    >
                      {kz.breakevens}
                    </div>
                  )}
                  {kz.losses > 0 && (
                    <div
                      className="flex items-center justify-center text-warning font-bold"
                      style={{ width: `${lossPct}%`, background: `rgba(255,59,92,${0.15 + intensity * 0.2})`, fontSize: 10 }}
                    >
                      {kz.losses}
                    </div>
                  )}
                </>
              )}
            </div>
            <span className="text-xs text-cream/30 w-8 text-left font-mono shrink-0">{kz.total}</span>
          </div>
        );
      })}
      <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
        {[['bg-emerald/20', 'text-emerald', 'ربح'], ['bg-gold/20', 'text-gold', 'تعادل'], ['bg-warning/20', 'text-warning', 'خسارة']].map(([bg, tc, label]) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${bg}`} />
            <span className={`text-xs ${tc}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drawdown Gauge ─────────────────────────────────────────────────────────────
function DrawdownGauge({ data }: { data: DrawdownResult }) {
  const severity = data.maxDrawdown === 0 ? 'none' :
                   data.maxDrawdown < 200 ? 'low' :
                   data.maxDrawdown < 500 ? 'medium' : 'high';

  const colorMap = { none: 'text-emerald', low: 'text-emerald', medium: 'text-gold', high: 'text-warning' };
  const labelMap = { none: 'ممتاز', low: 'منخفض', medium: 'متوسط', high: 'مرتفع' };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs text-cream/40 mb-1">أقصى انسحاب</p>
        <p className={`text-3xl font-extrabold font-mono ${colorMap[severity]}`}>
          {data.maxDrawdown === 0 ? '—' : `-${data.maxDrawdown.toFixed(0)}`}
        </p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${colorMap[severity]} bg-current/10`}>
          {labelMap[severity]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-white/3 rounded-lg p-3">
          <p className="text-xs text-cream/40 mb-1">الانسحاب الحالي</p>
          <p className={`font-bold font-mono ${data.currentDrawdown > 0 ? 'text-warning' : 'text-emerald'}`}>
            {data.currentDrawdown > 0 ? `-${data.currentDrawdown.toFixed(0)}` : '0'}
          </p>
        </div>
        <div className="bg-white/3 rounded-lg p-3">
          <p className="text-xs text-cream/40 mb-1">معامل التعافي</p>
          <p className={`font-bold font-mono ${data.recoveryFactor >= 1 ? 'text-emerald' : data.recoveryFactor >= 0 ? 'text-gold' : 'text-warning'}`}>
            {data.maxDrawdown === 0 ? '∞' : data.recoveryFactor.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="bg-white/3 rounded-lg p-3 text-center">
        <p className="text-xs text-cream/40 mb-1">ذروة الرصيد</p>
        <p className={`font-bold font-mono ${data.peakPnl >= 0 ? 'text-emerald' : 'text-warning'}`}>
          {data.peakPnl >= 0 ? '+' : ''}{data.peakPnl.toFixed(0)}
        </p>
      </div>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-6 page-enter">
      <div className="skeleton-dark h-8 w-48 rounded" />
      <div className="flex gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="card-dark flex-1 skeleton-dark h-20 rounded-xl" />)}
      </div>
      <div className="card-dark skeleton-dark h-44 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="card-dark skeleton-dark h-48 rounded-xl" />
        <div className="card-dark skeleton-dark h-48 rounded-xl" />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Performance() {
  const [summary,     setSummary]     = useState<PerformanceSummary | null>(null);
  const [equity,      setEquity]      = useState<EquityPoint[]>([]);
  const [drawdown,    setDrawdown]    = useState<DrawdownResult | null>(null);
  const [instruments, setInstruments] = useState<InstrumentStat[]>([]);
  const [psych,       setPsych]       = useState<PsychCorrelation | null>(null);
  const [killzones,   setKillzones]   = useState<KillzoneStat[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, e, d, ins, p, k] = await Promise.allSettled([
        getPerformanceSummary(USER_ID),
        getEquityCurve(USER_ID),
        getDrawdown(USER_ID),
        getInstrumentBreakdown(USER_ID),
        getPsychCorrelation(USER_ID),
        getTimeAnalysis(USER_ID),
      ]);
      if (s.status === 'fulfilled') setSummary(s.value);
      if (e.status === 'fulfilled') setEquity(e.value);
      if (d.status === 'fulfilled') setDrawdown(d.value);
      if (ins.status === 'fulfilled') setInstruments(ins.value);
      if (p.status === 'fulfilled') setPsych(p.value);
      if (k.status === 'fulfilled') setKillzones(k.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="card-dark text-center py-16">
        <Activity className="w-10 h-10 mx-auto text-warning mb-3" />
        <p className="text-warning font-medium mb-3">{error}</p>
        <button onClick={load} className="btn-primary">إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-up-stagger">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cream">ذكاء الأداء</h2>
          <p className="text-cream/50 mt-1 text-sm">تحليل شامل لأدائك في السوق</p>
        </div>
        <Link to="/journal" className="flex items-center gap-1 text-sm text-cream/40 hover:text-cream transition-colors">
          <ArrowRight size={14} />
          <span>السجل</span>
        </Link>
      </div>

      {/* Stats Strip */}
      {summary && (
        <div className="flex gap-3 flex-wrap">
          <StatCard
            label="إجمالي الصفقات"
            value={String(summary.totalTrades)}
            sub={`${summary.totalTradingDays} يوم تداول`}
            icon={<BarChart3 size={16} />}
          />
          <StatCard
            label="نسبة الفوز"
            value={`${summary.winRate}%`}
            sub={`${summary.wins} ر · ${summary.losses} خ · ${summary.breakevens} ت`}
            color={summary.winRate >= 50 ? 'text-emerald' : 'text-warning'}
            icon={<TrendingUp size={16} />}
          />
          <StatCard
            label="إجمالي الربح"
            value={`${summary.totalPnl >= 0 ? '+' : ''}${summary.totalPnl}`}
            color={summary.totalPnl >= 0 ? 'text-emerald' : 'text-warning'}
            icon={summary.totalPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          />
          <StatCard
            label="متوسط RRR"
            value={summary.avgRrr > 0 ? `${summary.avgRrr}:1` : '—'}
            color={summary.avgRrr >= 2 ? 'text-emerald' : summary.avgRrr >= 1 ? 'text-gold' : 'text-cream/50'}
            icon={<Target size={16} />}
          />
          <StatCard
            label="متوسط الجودة"
            value={summary.avgQualityScore > 0 ? `${summary.avgQualityScore}` : '—'}
            sub={`أفضل درجة ${summary.bestGradePct}%`}
            color={summary.avgQualityScore >= 70 ? 'text-emerald' : summary.avgQualityScore >= 50 ? 'text-gold' : 'text-warning'}
            icon={<Activity size={16} />}
          />
        </div>
      )}

      {/* Equity Curve */}
      <div className="card-dark">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-cream">منحنى الإنصاف</h3>
          <span className="text-xs text-cream/30 font-mono">{equity.length} نقطة</span>
        </div>
        <EquityCurve data={equity} />
      </div>

      {/* Row 2: Instruments + Psych Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-dark">
          <h3 className="font-bold text-cream mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-gold" />
            تحليل الأدوات
          </h3>
          <InstrumentTable data={instruments} />
        </div>

        <div className="card-dark">
          <h3 className="font-bold text-cream mb-4 flex items-center gap-2">
            <Activity size={16} className="text-gold" />
            الحالة النفسية × النتيجة
          </h3>
          {psych && <PsychMatrix data={psych} />}
        </div>
      </div>

      {/* Row 3: Killzone Heatmap + Drawdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-dark">
          <h3 className="font-bold text-cream mb-4 flex items-center gap-2">
            <Clock size={16} className="text-gold" />
            أداء نوافذ السوق
          </h3>
          <KillzoneHeatmap data={killzones} />
        </div>

        <div className="card-dark">
          <h3 className="font-bold text-cream mb-4 flex items-center gap-2">
            <TrendingDown size={16} className="text-gold" />
            تحليل الانسحاب
          </h3>
          {drawdown && <DrawdownGauge data={drawdown} />}
        </div>
      </div>

    </div>
  );
}
