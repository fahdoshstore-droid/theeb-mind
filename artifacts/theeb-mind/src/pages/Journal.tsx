import { useEffect, useState } from 'react';
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  Filter,
  X,
  TrendingUp,
  Target,
  Clock,
  BarChart3,
  AlertTriangle,
  Flame,
  Activity,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getJournal, getAnalytics, recordOutcome, getRuleViolations, getTradeFingerprint } from '../lib/api';
import type { Decision, AnalyticsResult, Outcome, Grade, RuleViolationRecord, TradeFingerprint } from '../lib/types';
import GuardBadge from '../components/shared/GuardBadge';

const USER_ID = 'user-1';

const GRADE_OPTIONS: (Grade | 'all')[] = ['all', 'A+', 'A', 'B', 'C', 'NO_TRADE'];
const OUTCOME_OPTIONS: (Outcome | 'all')[] = ['all', 'win', 'loss', 'breakeven'];
const OUTCOME_LABELS: Record<string, string> = {
  win: 'ربح',
  loss: 'خسارة',
  breakeven: 'تعادل',
};

// ── SVG Sparkline ──
function Sparkline({ data, width = 200, height = 60 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#c9a84c"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2)}
          r="3"
          fill="#c9a84c"
        />
      )}
    </svg>
  );
}

// ── Behavioral Insight Card ──
function InsightCard({ icon, title, detail, variant }: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  variant: 'danger' | 'success' | 'info';
}) {
  const bgMap = {
    danger: 'bg-warning/10 border-warning/30',
    success: 'bg-emerald/10 border-emerald/30',
    info: 'bg-gold/10 border-gold/30',
  };
  const textMap = {
    danger: 'text-warning',
    success: 'text-emerald',
    info: 'text-gold',
  };
  const iconBgMap = {
    danger: 'bg-warning/20',
    success: 'bg-emerald/20',
    info: 'bg-gold/20',
  };
  return (
    <div className={`rounded-xl border-2 p-4 ${bgMap[variant]}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBgMap[variant]}`}>
          {icon}
        </div>
        <div>
          <p className={`font-bold text-sm ${textMap[variant]}`}>{title}</p>
          <p className={`text-sm mt-1 text-cream/70`}>{detail}</p>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Loading Cards ──
function SkeletonCards() {
  return (
    <div className="space-y-8 page-enter">
      <div>
        <div className="skeleton-dark h-8 w-48 rounded mb-2" />
        <div className="skeleton-dark h-4 w-72 rounded" />
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton-dark w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-dark h-4 w-32 rounded" />
              <div className="skeleton-dark h-3 w-56 rounded" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border-2 border-emerald/30 bg-emerald/10 p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton-dark w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-dark h-4 w-28 rounded" />
              <div className="skeleton-dark h-3 w-44 rounded" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border-2 border-gold/30 bg-gold/10 p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton-dark w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-dark h-4 w-36 rounded" />
              <div className="skeleton-dark h-3 w-52 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="card-dark">
        <div className="skeleton-dark h-4 w-40 rounded mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton-dark h-4 w-20 rounded" />
              <div className="skeleton-dark h-8 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card-dark">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="skeleton-dark w-12 h-8 rounded" />
              <div className="space-y-2">
                <div className="skeleton-dark h-4 w-32 rounded" />
                <div className="skeleton-dark h-3 w-20 rounded" />
              </div>
            </div>
            <div className="skeleton-dark h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Journal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [violations, setViolations] = useState<RuleViolationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'violations'>('overview');
  const [fingerprints, setFingerprints] = useState<Record<string, TradeFingerprint | 'loading' | 'none'>>({});

  // Filters
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome | 'all'>('all');
  const instrumentFilter = searchParams.get('instrument') ?? 'all';
  const clearInstrumentFilter = () => setSearchParams({});

  // Outcome modal
  const [modalDecisionId, setModalDecisionId] = useState<string | null>(null);
  const [outcomeValue, setOutcomeValue] = useState<Outcome>('win');
  const [pnlValue, setPnlValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleExpandDecision = async (decisionId: string) => {
    const next = expandedId === decisionId ? null : decisionId;
    setExpandedId(next);
    if (next && !fingerprints[next]) {
      setFingerprints((prev) => ({ ...prev, [next]: 'loading' }));
      try {
        const fp = await getTradeFingerprint(next, USER_ID);
        setFingerprints((prev) => ({ ...prev, [next]: fp }));
      } catch {
        setFingerprints((prev) => ({ ...prev, [next]: 'none' }));
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [j, a, v] = await Promise.allSettled([
        getJournal(USER_ID),
        getAnalytics(USER_ID),
        getRuleViolations(USER_ID, 50),
      ]);
      if (j.status === 'fulfilled') setDecisions(j.value.decisions);
      if (a.status === 'fulfilled') setAnalytics(a.value);
      if (v.status === 'fulfilled') setViolations(v.value);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordOutcome = async () => {
    if (!modalDecisionId) return;
    setSubmitting(true);
    try {
      const pnl = pnlValue ? parseFloat(pnlValue) : undefined;
      await recordOutcome(modalDecisionId, outcomeValue, pnl);
      setModalDecisionId(null);
      setPnlValue('');
      setOutcomeValue('win');
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered decisions
  const filtered = decisions.filter((d) => {
    if (gradeFilter !== 'all' && d.scoring.grade !== gradeFilter) return false;
    if (outcomeFilter !== 'all' && d.outcome !== outcomeFilter) return false;
    if (instrumentFilter !== 'all' && (d.instrument ?? '') !== instrumentFilter) return false;
    return true;
  });

  // Compute behavioral metrics
  const winsOutsideKillzone = decisions.filter(d => d.outcome === 'loss' && !d.scoring.confluence.find(f => f.name === 'killzone')?.present);
  const streakCount = computeDisciplineStreak(decisions);
  const winRateImprovement = analytics ? ((analytics.winRate - 0.40) * 100).toFixed(0) : '0';
  const sparklineData = analytics?.improvementTimeline.map(t => t.averageScore) ?? [];

  if (loading) {
    return <SkeletonCards />;
  }

  if (error) {
    return (
      <div className="card-dark border-warning/30 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-warning mb-3" />
        <p className="text-warning font-medium">{error}</p>
        <button onClick={loadData} className="btn-primary mt-4">إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 slide-up-stagger">
      <div>
        <h2 className="text-2xl font-bold text-cream">الرؤية السلوكية</h2>
        <p className="text-cream/50 mt-1">تتبع قراراتك وسجل نتائجها</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-gold text-gold'
              : 'border-transparent text-cream/50 hover:text-cream/80'
          }`}
        >
          السجل والتحليل
        </button>
        <button
          onClick={() => setActiveTab('violations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
            activeTab === 'violations'
              ? 'border-warning text-warning'
              : 'border-transparent text-cream/50 hover:text-cream/80'
          }`}
        >
          <ShieldAlert size={14} />
          المخالفات
          {violations.length > 0 && (
            <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full">
              {violations.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Violations Tab ── */}
      {activeTab === 'violations' && (
        <ViolationsTab violations={violations} />
      )}

      {/* ── Overview Tab guard ── */}
      {activeTab !== 'overview' ? null : (<>

      {/* Behavioral Insights */}
      <div className="space-y-3">
        <InsightCard
          icon={<AlertTriangle size={20} className="text-warning" />}
          title="المشكلة الأكثر تكراراً"
          detail={winsOutsideKillzone.length > 0
            ? `الدخول خارج نافذة نشاط السوق — آخر ${winsOutsideKillzone.length} خسائر كانت خارج نافذة النشاط`
            : 'لا توجد نمط متكرر — استمر في الالتزام بالفلتر'}
          variant={winsOutsideKillzone.length > 0 ? 'danger' : 'success'}
        />
        <InsightCard
          icon={<TrendingUp size={20} className="text-emerald" />}
          title="تحسن ملحوظ"
          detail={`مؤشر جودة القرار ارتفع ${winRateImprovement}% هذا الأسبوع`}
          variant="success"
        />
        <InsightCard
          icon={<Flame size={20} className="text-gold" />}
          title="أنضبط أكثر"
          detail={`${streakCount} قرارات متتالية مع فلتر الجاهزية النفسية`}
          variant="info"
        />
      </div>

      {/* Quality Score Sparkline */}
      {sparklineData.length > 1 && (
        <div className="card-dark">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-cream">مؤشر جودة القرار</h3>
            <span className="text-xs text-cream/40">آخر {sparklineData.length} قرارات</span>
          </div>
          <Sparkline data={sparklineData} />
        </div>
      )}

      {/* Analytics */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<BarChart3 size={20} />} label="إجمالي القرارات" value={String(analytics.totalDecisions)} />
          <StatCard icon={<TrendingUp size={20} />} label="نسبة الربح" value={`${(analytics.winRate * 100).toFixed(1)}%`} trend="up" />
          <StatCard icon={<Target size={20} />} label="متوسط درجة القرار" value={`${analytics.averageConfluence.toFixed(1)}`} />
          <StatCard icon={<Clock size={20} />} label="أفضل نافذة نشاط السوق" value={analytics.bestKillzoneAr ?? analytics.bestKillzone} />
        </div>
      )}

      {/* Grade Distribution */}
      {analytics && (
        <div className="card-dark">
          <h3 className="text-lg font-bold text-cream mb-4">توزيع الدرجات</h3>
          <div className="flex gap-3 flex-wrap">
            {(Object.entries(analytics.gradeDistribution) as [Grade, number][]).map(([grade, count]) => (
              <div key={grade} className="flex-1 min-w-[80px] text-center">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full border-4 mb-2 ${
                  grade === 'A+' || grade === 'A' ? 'bg-emerald/10 border-emerald/40' :
                  grade === 'B' ? 'bg-gold/10 border-gold/40' :
                  'bg-warning/10 border-warning/40'
                }`}>
                  <span className={`text-lg font-extrabold ${
                    grade === 'A+' || grade === 'A' ? 'text-emerald' :
                    grade === 'B' ? 'text-gold' :
                    'text-warning'
                  }`}>{grade}</span>
                </div>
                <p className="text-sm font-bold text-cream">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deep Analysis Link */}
      <Link
        to="/performance"
        className="card-dark flex items-center justify-between group hover:border-gold/30 transition-colors border border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
            <Activity size={18} className="text-gold" />
          </div>
          <div>
            <p className="font-bold text-cream text-sm">تحليل أعمق</p>
            <p className="text-cream/40 text-xs">منحنى الإنصاف · الانسحاب · تحليل الأدوات</p>
          </div>
        </div>
        <span className="text-gold/60 group-hover:text-gold transition-colors text-lg">←</span>
      </Link>

      {/* Filters */}
      <div className="card-dark">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} className="text-cream/40" />
          <h3 className="font-bold text-cream">تصفية</h3>
        </div>
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-xs text-cream/50 mb-1">الدرجة</label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value as Grade | 'all')}
              className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-void-light text-cream
                         focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                         placeholder:text-cream/40 transition-all duration-200 text-sm"
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g === 'all' ? 'الكل' : g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-cream/50 mb-1">النتيجة</label>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as Outcome | 'all')}
              className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-void-light text-cream
                         focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                         placeholder:text-cream/40 transition-all duration-200 text-sm"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o} value={o}>{o === 'all' ? 'الكل' : OUTCOME_LABELS[o] ?? o}</option>
              ))}
            </select>
          </div>
          {instrumentFilter !== 'all' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gold/40 bg-gold/10 text-gold text-sm font-mono">
              <span>أداة: {instrumentFilter}</span>
              <button onClick={clearInstrumentFilter} className="hover:text-cream transition-colors">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Decisions List */}
      {filtered.length === 0 ? (
        <div className="card-dark text-center py-16">
          <div className="w-20 h-20 mx-auto bg-void-lighter rounded-2xl flex items-center justify-center mb-4">
            <BookOpen size={40} className="text-cream/20" />
          </div>
          <p className="text-cream/50 font-medium text-lg">لا توجد قرارات</p>
          <p className="text-cream/40 text-sm mt-1">ابدأ بتحليل شارت لتسجيل قرارك الأول</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <div key={d.id} className="card-dark">
              {/* Header Row */}
              <button
                onClick={() => handleExpandDecision(d.id)}
                className="w-full flex items-center justify-between text-right"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-extrabold ${
                    d.scoring.grade === 'A+' || d.scoring.grade === 'A' ? 'text-emerald' :
                    d.scoring.grade === 'B' ? 'text-gold' :
                    d.scoring.grade === 'C' ? 'text-warning' : 'text-cream/40'
                  }`}>
                    {d.scoring.grade}
                  </span>
                  <div className="text-right">
                    <p className="font-medium text-cream truncate-mobile">
                      {d.instrument ?? 'تحليل شارت'}
                      {d.timeframe ? ` · ${d.timeframe}` : ''}
                    </p>
                    <p className="text-xs text-cream/40">
                      {new Date(d.createdAt).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.outcome && (
                    <OutcomePill outcome={d.outcome} />
                  )}
                  {!d.outcome && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalDecisionId(d.id); }}
                      className="text-xs text-gold hover:underline"
                    >
                      سجّل النتيجة
                    </button>
                  )}
                  <span className="text-sm text-cream font-bold">{d.scoring.score}/{d.scoring.maxScore}</span>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === d.id && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                  {/* Decision Quality */}
                  <div>
                    <p className="text-sm font-medium text-cream mb-2">جودة القرار</p>
                    <div className="space-y-1">
                      {d.scoring.confluence.map((f) => (
                        <div key={f.name} className="flex items-center justify-between text-sm">
                          <span className="text-cream/60">{f.nameAr}</span>
                          <span className={f.present ? 'text-emerald' : 'text-warning'}>
                            {f.present ? '✓' : '✕'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warnings */}
                  {d.scoring.warnings.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-cream mb-1">تحذيرات</p>
                      <ul className="text-sm text-gold space-y-1">
                        {d.scoring.warnings.map((w, i) => (
                          <li key={i}>• {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Psychological Readiness */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-cream">الجاهزية النفسية</span>
                    <GuardBadge verdict={d.scoring.gateVerdict} size="sm" />
                  </div>

                  {/* AHA Moment Badge */}
                  {(() => {
                    const fp = fingerprints[d.id];
                    if (!fp || fp === 'none') return null;
                    if (fp === 'loading') return (
                      <div className="text-xs text-cream/30 animate-pulse">جاري تحليل بصمة الصفقة...</div>
                    );
                    const sim = fp.ahaResult.similarityPercent;
                    if (sim === 0) return null;
                    const matched = fp.ahaResult.signatures.filter(s => s.matched);
                    const badgeColor = sim >= 70 ? 'text-warning' : sim >= 40 ? 'text-gold' : 'text-cream/60';
                    const badgeBg = sim >= 70 ? 'bg-warning/10 border-warning/30' : sim >= 40 ? 'bg-gold/10 border-gold/30' : 'bg-white/5 border-white/10';
                    return (
                      <div className={`rounded-lg border p-3 ${badgeBg}`}>
                        <div className={`flex items-center gap-2 font-bold text-xs ${badgeColor} mb-1`}>
                          <span>⚡ AHA MOMENT</span>
                          <span className="font-mono">{sim}%</span>
                          <span className="font-normal text-cream/40">تشابه مع أنماط خاسرة سابقة</span>
                        </div>
                        {matched.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {matched.map(s => (
                              <span key={s.type} className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeBg} ${badgeColor}`}>
                                {s.typeAr}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Outcome */}
                  {d.outcome && d.pnl !== undefined && (
                    <div className="text-sm text-cream/60">
                      الربح/الخسارة: <span className={d.pnl >= 0 ? 'text-emerald' : 'text-warning'}>
                        {d.pnl >= 0 ? '+' : ''}{d.pnl}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Outcome Modal */}
      {modalDecisionId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModalDecisionId(null)}>
          <div className="bg-void-light rounded-2xl p-6 w-full max-w-sm mx-4 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-cream">تسجيل النتيجة</h3>
              <button onClick={() => setModalDecisionId(null)}>
                <X size={20} className="text-cream/40" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-cream mb-2">النتيجة</label>
                <div className="flex gap-2">
                  {(['win', 'loss', 'breakeven'] as Outcome[]).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOutcomeValue(o)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                        outcomeValue === o
                          ? 'border-gold bg-gold text-void'
                          : 'border-white/20 text-cream/60'
                      }`}
                    >
                      {OUTCOME_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-cream mb-1">الربح/الخسارة (اختياري)</label>
                <input
                  type="number"
                  value={pnlValue}
                  onChange={(e) => setPnlValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-void text-cream
                             focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                             placeholder:text-cream/40 transition-all duration-200"
                  dir="ltr"
                />
              </div>

              <button
                onClick={handleRecordOutcome}
                disabled={submitting}
                className="btn-primary w-full disabled:opacity-50"
              >
                {submitting ? 'جاري الحفظ...' : 'حفظ النتيجة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>)}
    </div>
  );
}

// ── Violations Tab Component ─────────────────────────────────────────────────
function ViolationsTab({ violations }: { violations: RuleViolationRecord[] }) {
  const SEVERITY_CONFIG = {
    block:   { label: 'إيقاف',    cls: 'bg-warning/10 text-warning border-warning/30' },
    warning: { label: 'تحذير',   cls: 'bg-gold/10 text-gold border-gold/30' },
  } as const;

  // totalOccurrences comes from the backend per-rule count
  const occurrenceByRule = violations.reduce<Record<string, number>>((acc, v) => {
    // Use backend totalOccurrences; keep the max per rule_id since every row carries it
    acc[v.rule_id] = Math.max(acc[v.rule_id] ?? 0, v.totalOccurrences);
    return acc;
  }, {});

  if (violations.length === 0) {
    return (
      <div className="card-dark text-center py-16">
        <div className="w-16 h-16 mx-auto bg-emerald/10 rounded-2xl flex items-center justify-center mb-4">
          <ShieldCheck size={32} className="text-emerald" />
        </div>
        <p className="text-emerald font-semibold text-lg">لا مخالفات مسجلة</p>
        <p className="text-cream/40 text-sm mt-1">أنت ملتزم بالدستور — استمر</p>
      </div>
    );
  }

  // Rule streak summary cards
  const ruleStats = Object.entries(occurrenceByRule)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card-dark">
          <p className="text-xs text-cream/50 mb-1">إجمالي المخالفات</p>
          <p className="text-3xl font-extrabold text-warning">{violations.length}</p>
        </div>
        <div className="card-dark">
          <p className="text-xs text-cream/50 mb-1">أكثر قاعدة مخالفة</p>
          {ruleStats[0] ? (
            <>
              <p className="text-sm font-bold text-cream">{violations.find(v => v.rule_id === ruleStats[0][0])?.rule_name ?? '—'}</p>
              <p className="text-xs text-cream/40">{ruleStats[0][1]} مرة</p>
            </>
          ) : <p className="text-cream/40 text-sm">—</p>}
        </div>
      </div>

      {/* Top offending rules */}
      {ruleStats.length > 0 && (
        <div className="card-dark">
          <h3 className="text-sm font-bold text-cream mb-3">القواعد الأكثر مخالفة</h3>
          <div className="space-y-2">
            {ruleStats.map(([ruleId, total]) => {
              const sev = violations.find(v => v.rule_id === ruleId)?.severity ?? 'warning';
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={ruleId} className="flex items-center justify-between text-sm">
                  <span className="text-cream/70">
                    {violations.find(v => v.rule_id === ruleId)?.rule_name ?? ruleId}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                    <span className="font-bold text-cream">{total}×</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Violation history list */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-cream/60 uppercase tracking-wider">سجل المخالفات</h3>
        {violations.map((v) => {
          const cfg = SEVERITY_CONFIG[v.severity] ?? SEVERITY_CONFIG.warning;
          const dateStr = new Date(v.created_at).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          return (
            <div key={v.id} className={`rounded-xl border p-3 flex items-start gap-3 ${cfg.cls}`}>
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold truncate">{v.rule_name}</p>
                  <span className="text-xs opacity-70 shrink-0">{dateStr}</span>
                </div>
                {v.totalOccurrences > 1 && (
                  <p className="text-xs opacity-60 mt-0.5">تكرر {v.totalOccurrences} مرات إجمالاً</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="card-dark flex flex-col gap-1">
      <div className="flex items-center gap-2 text-cream/50">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <p className="text-2xl font-bold text-cream">{value}</p>
        {trend === 'up' && <span className="text-xs text-emerald font-medium">↑</span>}
        {trend === 'down' && <span className="text-xs text-warning font-medium">↓</span>}
      </div>
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    win: { text: 'ربح', cls: 'bg-emerald/10 text-emerald' },
    loss: { text: 'خسارة', cls: 'bg-warning/10 text-warning' },
    breakeven: { text: 'تعادل', cls: 'bg-cream/10 text-cream/60' },
  };
  const cfg = map[outcome] ?? { text: outcome, cls: 'bg-cream/10 text-cream/60' };
  return <span className={`badge ${cfg.cls}`}>{cfg.text}</span>;
}

function computeDisciplineStreak(decisions: Decision[]): number {
  let streak = 0;
  for (let i = decisions.length - 1; i >= 0; i--) {
    const d = decisions[i];
    if (d.scoring.gateVerdict === 'GO') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}