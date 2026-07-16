import { useState } from 'react';
import { ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Info, ChevronDown } from 'lucide-react';
import { verifyContent, DEMO_MISLEADING_TEXT } from '../lib/api';
import type { VerificationResult, CredibilityLevel } from '../lib/types';

const CREDIBILITY_CONFIG: Record<CredibilityLevel, { color: string; bg: string; border: string; icon: string; stroke: string }> = {
  'موثوق': { color: 'text-emerald', bg: 'bg-emerald-light', border: 'border-emerald/40', icon: '✓', stroke: '#00d68f' },
  'يحتاج تحقق': { color: 'text-gold', bg: 'bg-gold-light', border: 'border-gold/40', icon: '⚠', stroke: '#c9a84c' },
  'مضلل': { color: 'text-warning', bg: 'bg-warning-light', border: 'border-warning/40', icon: '✕', stroke: '#ff4757' },
};

// ── Circular Trust Gauge ──
function TrustGauge({ score, stroke }: { score: number; stroke: string }) {
  const [animated, setAnimated] = useState(0);
  const ref = useState<ReturnType<typeof requestAnimationFrame>>(0)[0];
  const rafRef = useState(0);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  // Animate on mount
  useState(() => {
    setAnimated(0);
    const start = performance.now();
    const duration = 1500;
    function tick(now: number) {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(eased * score);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle cx="60" cy="60" r={radius} stroke="#2A3A50" strokeWidth="8" fill="none" />
        <circle
          cx="60" cy="60" r={radius}
          stroke={stroke}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-100"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-cream" style={{ color: stroke }}>{Math.round(animated)}%</span>
        <span className="text-xs text-cream/50">درجة الثقة</span>
      </div>
    </div>
  );
}

// ── Scanning Animation ──
function ScanningAnimation() {
  return (
    <div className="page-enter space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-cream">التحقق من المحتوى</h2>
        <p className="text-cream/50 mt-1">جاري تحليل المحتوى...</p>
      </div>

      <div className="card-dark text-center py-12">
        <div className="scanning-dots">
          <span /><span /><span />
        </div>
        <p className="text-cream/60 mt-4 text-sm">تحليل أنماط التلاعب واللغة المستخدمة...</p>
        <div className="mt-6 space-y-3">
          <div className="skeleton-dark h-4 w-3/4 mx-auto rounded" />
          <div className="skeleton-dark h-4 w-1/2 mx-auto rounded" />
          <div className="skeleton-dark h-4 w-2/3 mx-auto rounded" />
        </div>
      </div>

      <div className="card-dark">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="skeleton-dark h-4 w-1/3 rounded" />
            <div className="skeleton-dark h-4 w-1/4 rounded" />
          </div>
          <div className="skeleton-dark h-3 w-full rounded" />
          <div className="skeleton-dark h-3 w-5/6 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function VerifyContent() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await verifyContent(text.trim());
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحقق');
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setText(DEMO_MISLEADING_TEXT);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setText('');
    setShowWhy(false);
  };

  // ---- Loading view ----
  if (loading) {
    return <ScanningAnimation />;
  }

  // ---- Result View ----
  if (result) {
    const cfg = CREDIBILITY_CONFIG[result.credibilityLevel];

    return (
      <div className="space-y-6 max-w-3xl slide-up-reveal">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cream">نتيجة التحقق</h2>
          <button onClick={reset} className="btn-outline text-sm">
            تحقق من محتوى آخر
          </button>
        </div>

        {/* Trust Score — Circular Gauge */}
        <div className={`card-dark border-2 ${cfg.border} text-center`}>
          <div className="flex flex-col items-center py-4">
            <TrustGauge score={result.trustScore} stroke={cfg.stroke} />
            <p className={`text-2xl font-extrabold mt-4 ${cfg.color}`}>{result.credibilityLevel}</p>
          </div>
        </div>

        {/* Verdict */}
        {result.verdict && (
          <div className="card-dark">
            <h3 className="text-lg font-bold mb-2 text-cream">{result.verdict.title}</h3>
            <p className="leading-relaxed text-cream/80">{result.verdict.explanation}</p>
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div className="card-dark">
            <h3 className="text-lg font-bold text-cream mb-2">ملخص</h3>
            <p className="text-cream/60 leading-relaxed">{result.summary}</p>
          </div>
        )}

        {/* Claims */}
        {result.claims.length > 0 && (
          <div className="card-dark">
            <h3 className="text-lg font-bold text-cream mb-4">الادعاءات المكتشفة</h3>
            <div className="space-y-3">
              {result.claims.map((claim, i) => {
                const isLow = claim.score < 40;
                const isMed = claim.score >= 40 && claim.score < 70;
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-4 border-2 ${
                      isLow ? 'border-warning/40 bg-warning/5' :
                      isMed ? 'border-gold/40 bg-gold/5' :
                      'border-emerald/40 bg-emerald/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {claim.verified ? (
                            <CheckCircle2 size={16} className="text-emerald" />
                          ) : (
                            <XCircle size={16} className="text-warning" />
                          )}
                          <span className="text-cream font-medium truncate-mobile">{claim.text}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isLow ? 'bg-warning/10 text-warning' :
                          isMed ? 'bg-gold/10 text-gold' :
                          'bg-emerald/10 text-emerald'
                        }`}>{claim.categoryAr}</span>
                      </div>
                      <div className="text-center shrink-0">
                        <p className={`text-2xl font-bold ${
                          isLow ? 'text-warning' : isMed ? 'text-gold' : 'text-emerald'
                        }`}>{claim.score}%</p>
                        <p className="text-xs text-cream/50">مصداقية</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Manipulation Patterns */}
        {result.manipulationPatterns.length > 0 && (
          <div className="card-dark border-gold/40">
            <h3 className="text-lg font-bold text-gold mb-3 flex items-center gap-2">
              <AlertTriangle size={20} />
              أنماط التلاعب المكتشفة
            </h3>
            <div className="space-y-3">
              {result.manipulationPatterns.map((p, i) => {
                const sevBg = p.severity === 'high' ? 'bg-warning/10 text-warning border-warning/30' : p.severity === 'medium' ? 'bg-gold/10 text-gold border-gold/30' : 'bg-emerald/10 text-emerald border-emerald/30';
                const sevLabel = p.severity === 'high' ? 'خطير' : p.severity === 'medium' ? 'متوسط' : 'منخفض';
                return (
                  <div key={i} className="bg-void-lighter rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-cream">{p.typeAr}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sevBg}`}>{sevLabel}</span>
                    </div>
                    <p className="text-sm text-cream/60">{p.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Why is verification important? */}
        <div className="card-dark border-white/10">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-cream/60">
              <Info size={18} />
              <span className="font-medium">لماذا هذا التحقق مهم؟</span>
            </div>
            <ChevronDown
              size={18}
              className={`text-cream/40 transition-transform duration-200 ${showWhy ? 'rotate-180' : ''}`}
            />
          </button>
          {showWhy && (
            <div className="mt-3 text-sm text-cream/60 leading-relaxed space-y-2">
              <p>المحتوى المالي العربي على الإنترنت مليء بالادعاءات المضللة والمبالغ فيها التي قد تؤدي إلى خسائر مالية كبيرة.</p>
              <p>عقلية الذيب يحلل هذا المحتوى ويكشف أنماط التلاعب مثل: الأرباح المضمونة، الضغط الزمني المصطنع، السلطة المزيفة، ولغة الخوف من فوات الفرصة.</p>
              <p>التحقق من المحتوى قبل التصرف بناءً عليه هو خط الدفاع الأول لحماية قراراتك المالية.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Form View ----
  return (
    <div className="space-y-6 max-w-2xl page-enter">
      <div>
        <h2 className="text-2xl font-bold text-cream">التحقق من المحتوى</h2>
        <p className="text-cream/50 mt-1">الصق المحتوى المالي العربي للتحقق من مصداقيته</p>
      </div>

      <div className="card-dark">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-cream">المحتوى</label>
          <button onClick={loadSample} className="text-xs text-gold hover:underline font-medium">
            جرّب مثال
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="الصق هنا نص المقالة أو التغريدة أو التحليل المالي..."
          rows={8}
          className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-void text-cream
                     focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold
                     placeholder:text-cream/40 transition-all duration-200 resize-y"
          dir="rtl"
        />
        <p className="text-xs text-cream/40 mt-2">
          {text.length} حرف
        </p>
      </div>

      {error && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 text-warning text-sm">
          <AlertTriangle size={18} className="inline ml-2" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <RefreshCw size={18} className="animate-spin" />
            جاري التحقق...
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            تحقق الآن
          </>
        )}
      </button>
    </div>
  );
}