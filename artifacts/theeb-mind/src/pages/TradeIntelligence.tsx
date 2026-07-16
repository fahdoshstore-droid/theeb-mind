// ============================================
// THEEB MIND — Trade Intelligence Page
// ============================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Zap, RefreshCw, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { getIntelligencePatterns, getIntelligenceTrends } from '../lib/api';
import type { PatternSummary, TrendSummary } from '../lib/types';

const USER_ID = 'user-1';

// ── Grade colour helpers ─────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return '#1E8FFF';
  if (grade === 'B') return '#c9a84c';
  return '#FF3B5C';
}

function riskColor(level: 'high' | 'medium' | 'low'): string {
  return level === 'high' ? '#FF3B5C' : level === 'medium' ? '#c9a84c' : '#1E8FFF';
}

function riskBg(level: 'high' | 'medium' | 'low'): string {
  return level === 'high' ? 'rgba(229,62,62,.10)' : level === 'medium' ? 'rgba(201,168,76,.10)' : 'rgba(62,207,142,.10)';
}

function riskBorder(level: 'high' | 'medium' | 'low'): string {
  return level === 'high' ? 'rgba(229,62,62,.30)' : level === 'medium' ? 'rgba(201,168,76,.30)' : 'rgba(62,207,142,.30)';
}

// ── Quality Trend SVG Bars ───────────────────────────────

function TrendBars({ points }: { points: { score: number; grade: string }[] }) {
  if (points.length === 0) return <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>لا توجد بيانات كافية</div>;

  const BAR_W = 8;
  const GAP = 3;
  const H = 60;
  const totalW = points.length * (BAR_W + GAP);

  return (
    <svg width={totalW} height={H + 16} style={{ overflow: 'visible' }}>
      {points.map((p, i) => {
        const barH = Math.max(3, Math.round((p.score / 100) * H));
        const x = i * (BAR_W + GAP);
        const y = H - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH}
              fill={gradeColor(p.grade)} rx={2} opacity={0.85} />
            {i % 5 === 0 && (
              <text x={x + BAR_W / 2} y={H + 13} textAnchor="middle"
                fill="rgba(255,255,255,.3)" fontSize={7} fontFamily="JetBrains Mono">
                {p.score}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Heatmap Cell ─────────────────────────────────────────

function HeatCell({ winRate, trades, instrument, timeframe, onClick }: {
  winRate: number; trades: number; instrument: string; timeframe: string; onClick?: () => void;
}) {
  const level = winRate < 35 ? 'high' : winRate < 55 ? 'medium' : 'low';
  return (
    <div
      onClick={onClick}
      title={onClick ? `عرض صفقات ${instrument}` : undefined}
      style={{
        padding: '8px 6px',
        borderRadius: 6,
        background: riskBg(level),
        border: '1px solid ' + riskBorder(level),
        textAlign: 'center',
        minWidth: 64,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity .15s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.opacity = '.75'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
    >
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 800, color: riskColor(level) }}>
        {winRate}%
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
        {instrument}·{timeframe}
      </div>
      <div style={{ fontSize: 7, color: 'rgba(255,255,255,.25)' }}>{trades} صفقة</div>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(15,20,30,.7)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 12,
      padding: '16px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono',
      fontSize: 8,
      color: 'rgba(255,255,255,.35)',
      letterSpacing: '.18em',
      textTransform: 'uppercase',
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function TradeIntelligence() {
  const navigate = useNavigate();
  const [patterns, setPatterns] = useState<PatternSummary | null>(null);
  const [trends, setTrends] = useState<TrendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, t] = await Promise.all([
        getIntelligencePatterns(USER_ID),
        getIntelligenceTrends(USER_ID),
      ]);
      setPatterns(p);
      setTrends(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-dark h-8 w-48 rounded" />
        <div className="skeleton-dark h-32 rounded-xl" />
        <div className="skeleton-dark h-48 rounded-xl" />
        <div className="skeleton-dark h-40 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-dark border-warning/30 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-warning mb-3" />
        <p className="text-warning font-medium">{error}</p>
        <button onClick={load} className="btn-primary mt-4">إعادة المحاولة</button>
      </div>
    );
  }

  const noData = !patterns || (patterns.signatures.length === 0 && patterns.heatmap.length === 0);

  return (
    <div className="space-y-6 slide-up-stagger" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cream">ذكاء الصفقات</h2>
          <p className="text-cream/50 mt-1 text-sm">
            تحليل الأنماط الفاشلة والاتجاهات لتحسين قراراتك
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 text-xs text-cream/40 hover:text-cream/70 transition-colors"
        >
          <RefreshCw size={14} />
          تحديث
        </button>
      </div>

      {noData ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,.35)' }}>
            <Zap size={40} style={{ margin: '0 auto 12px', opacity: .4 }} />
            <div style={{ fontSize: 14, marginBottom: 6 }}>لا توجد بيانات كافية بعد</div>
            <div style={{ fontSize: 11 }}>ابدأ بتحليل صفقات لتفعيل ذكاء الأنماط</div>
          </div>
        </Card>
      ) : (
        <>
          {/* ── DANGER ZONES ──────────────────────────────── */}
          {patterns && patterns.dangerZones.length > 0 && (
            <Card style={{ border: '1px solid rgba(229,62,62,.25)', background: 'rgba(229,62,62,.04)' }}>
              <SectionLabel>⚠ مناطق الخطر النشطة</SectionLabel>
              <div className="space-y-3">
                {patterns.dangerZones.map((z) => (
                  <div key={z.type} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: riskBg(z.riskLevel),
                    border: '1px solid ' + riskBorder(z.riskLevel),
                  }}>
                    <AlertTriangle size={16} style={{ color: riskColor(z.riskLevel), flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: riskColor(z.riskLevel) }}>
                        {z.typeAr}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', marginTop: 2 }}>
                        {z.hitCount} من آخر {z.totalChecked} قرار · معدل الخسارة {Math.round(z.avgLossRate * 100)}%
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 800,
                      color: riskColor(z.riskLevel),
                    }}>
                      {z.hitCount}×
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── FAILURE SIGNATURE CARDS ───────────────────── */}
          {patterns && patterns.signatures.length > 0 && (
            <Card>
              <SectionLabel>بصمات الفشل — آخر 20 قرار</SectionLabel>
              <div className="space-y-4">
                {patterns.signatures.map((sig) => (
                  <div key={sig.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: sig.hitCount > 0 ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.4)' }}>
                        {sig.typeAr}
                      </span>
                      <span style={{
                        fontFamily: 'JetBrains Mono', fontSize: 10,
                        color: riskColor(sig.riskLevel),
                      }}>
                        {sig.hitCount}/{sig.totalChecked}
                      </span>
                    </div>
                    <div style={{
                      height: 5, background: 'rgba(255,255,255,.06)',
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: sig.totalChecked > 0
                          ? `${Math.round((sig.hitCount / sig.totalChecked) * 100)}%`
                          : '0%',
                        background: riskColor(sig.riskLevel),
                        borderRadius: 3,
                        transition: 'width .4s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.28)', marginTop: 3 }}>
                      معدل الخسارة التاريخي: {Math.round(sig.avgLossRate * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── QUALITY TREND ─────────────────────────────── */}
          {trends && trends.qualityTrend.length > 0 && (
            <Card>
              <SectionLabel>مسار جودة القرار — آخر 30 صفقة</SectionLabel>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, overflowX: 'auto' }}>
                  <TrendBars points={trends.qualityTrend} />
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 22, fontWeight: 800, color: '#c9a84c' }}>
                      {trends.averageScore}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>متوسط الجودة</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {Object.entries(trends.gradeDistribution).map(([grade, count]) => (
                      <div key={grade} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, fontWeight: 700, color: gradeColor(grade) }}>
                          {grade}
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>{count}</div>
                      </div>
                    ))}
                  </div>
                  {(trends.bestInstrument || trends.worstInstrument) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {trends.bestInstrument && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                          <TrendingUp size={10} style={{ color: '#1E8FFF' }} />
                          <span style={{ color: 'rgba(255,255,255,.4)' }}>الأفضل:</span>
                          <span style={{ color: '#1E8FFF', fontFamily: 'JetBrains Mono' }}>{trends.bestInstrument}</span>
                        </div>
                      )}
                      {trends.worstInstrument && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                          <TrendingDown size={10} style={{ color: '#FF3B5C' }} />
                          <span style={{ color: 'rgba(255,255,255,.4)' }}>الأضعف:</span>
                          <span style={{ color: '#FF3B5C', fontFamily: 'JetBrains Mono' }}>{trends.worstInstrument}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── INSTRUMENT HEATMAP ────────────────────────── */}
          {patterns && patterns.heatmap.length > 0 && (
            <Card>
              <SectionLabel>خريطة حرارة الأدوات × الإطار الزمني</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {patterns.heatmap.map((cell) => (
                  <HeatCell
                    key={`${cell.instrument}::${cell.timeframe}`}
                    instrument={cell.instrument}
                    timeframe={cell.timeframe}
                    winRate={cell.winRate}
                    trades={cell.totalTrades}
                    onClick={() => navigate(`/journal?instrument=${encodeURIComponent(cell.instrument)}`)}
                  />
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { level: 'high' as const, label: 'خطر — أقل من 35%' },
                  { level: 'medium' as const, label: 'متوسط — 35–55%' },
                  { level: 'low' as const, label: 'جيد — أكثر من 55%' },
                ].map(({ level, label }) => (
                  <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: 2,
                      background: riskColor(level), opacity: .7,
                    }} />
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,.35)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── TOP FAILURE PATTERNS ──────────────────────── */}
          {patterns && patterns.topFailurePatterns.length > 0 && (
            <Card>
              <SectionLabel>أكثر الأنماط تكراراً</SectionLabel>
              <div className="space-y-2">
                {patterns.topFailurePatterns.map((p, i) => (
                  <div key={p.patternKey} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 7,
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid rgba(255,255,255,.06)',
                  }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono', fontSize: 10,
                      color: i < 3 ? '#e53e3e' : 'rgba(255,255,255,.3)',
                      minWidth: 16, textAlign: 'center',
                    }}>
                      #{i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
                        {p.instrument} · {p.timeframe}
                        {p.killzone !== 'none' && p.killzone && (
                          <span style={{ color: 'rgba(255,255,255,.35)', marginRight: 4 }}> · {p.killzone}</span>
                        )}
                        <span style={{ marginRight: 4, color: gradeColor(p.grade) }}>{p.grade}</span>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 800,
                      color: i < 3 ? '#e53e3e' : 'rgba(255,255,255,.4)',
                    }}>
                      {p.hitCount}×
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Footer note */}
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,.2)', textAlign: 'center' }}>
        يُعاد حساب التحليل كل 15 دقيقة · يستند إلى آخر 20 قرار
      </p>
    </div>
  );
}
