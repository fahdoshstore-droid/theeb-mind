import { useNavigate } from 'react-router-dom';
import { BarChart3, ShieldCheck, Zap, Globe, BookOpen, ArrowLeft, TrendingUp, Brain, Target } from 'lucide-react';

// ── Seeded particles (no re-render jitter) ──────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const s = i * 2654435761;
  return { id: i, x: (s >>> 8) % 100, y: (s >>> 4) % 100, delay: (i * 0.37) % 5, dur: 3 + (i * 0.61) % 4 };
});

// ── Platform modules ────────────────────────────────────────────────────────
const MODULES = [
  {
    icon: BarChart3,
    route: '/analyze',
    label: 'مركز القرار',
    en: 'Decision Center',
    desc: 'حلّل صفقتك قبل الدخول — AI يقيّم القرار ويكشف التحيزات الخفية.',
    color: 'var(--gold)',
    glow: 'var(--gold-glow)',
    bg: 'var(--gold-subtle)',
    badge: 'ابدأ من هنا',
  },
  {
    icon: Globe,
    route: '/market',
    label: 'السياق الكلي',
    en: 'Market Intelligence',
    desc: 'بيانات COT + توقعات كبار البنوك + تقويم الأحداث في لوحة واحدة.',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.22)',
    bg: 'rgba(59,130,246,0.08)',
  },
  {
    icon: Zap,
    route: '/intelligence',
    label: 'أنماط الفشل',
    en: 'Trade Intelligence',
    desc: 'اكتشف الأنماط المتكررة في خسائرك واقطع دورة الأخطاء.',
    color: 'var(--emerald)',
    glow: 'var(--emerald-glow)',
    bg: 'rgba(16,185,129,0.08)',
  },
  {
    icon: BookOpen,
    route: '/journal',
    label: 'السجل والأداء',
    en: 'Journal',
    desc: 'سجّل كل صفقة مع التعليل النفسي وتابع تطور أدائك بمرور الوقت.',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.22)',
    bg: 'rgba(167,139,250,0.08)',
  },
  {
    icon: ShieldCheck,
    route: '/verify',
    label: 'التحقق',
    en: 'Verify',
    desc: 'افحص أي رواية أو ادعاء في السوق — ابنِ ثقتك على حقائق لا شائعات.',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.22)',
    bg: 'rgba(245,158,11,0.08)',
  },
];

// ── How it works steps ──────────────────────────────────────────────────────
const STEPS = [
  { num: '01', icon: Target, title: 'سجّل الفكرة', desc: 'قبل الدخول، اكتب تحليلك ودوافعك. هذه اللحظة هي الأهم.' },
  { num: '02', icon: Brain,  title: 'اسمع الـ AI',  desc: 'المنصة تقيّم القرار، تكشف التحيزات، وتعطيك درجة موضوعية.' },
  { num: '03', icon: TrendingUp, title: 'ابنِ النمط', desc: 'مع الوقت، تظهر الأنماط. تعلّم من بياناتك الحقيقية لا من الأمنيات.' },
];

// ── Component ───────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: 'var(--void)', color: 'var(--text)', fontFamily: 'var(--font-body)', overflowX: 'hidden' }}>

      {/* ── Ambient background ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 55% at 50% 0%, rgba(212,168,67,0.055) 0%, transparent 65%),
          radial-gradient(ellipse 50% 40% at 80% 60%, rgba(16,185,129,0.035) 0%, transparent 55%)
        ` }} />

      {/* ── Floating particles ── */}
      {PARTICLES.map(p => (
        <div key={p.id} style={{
          position: 'fixed', left: `${p.x}%`, top: `${p.y}%`,
          width: '2px', height: '2px', borderRadius: '50%',
          background: 'var(--gold)', opacity: 0.35,
          animation: `float-particle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          pointerEvents: 'none', zIndex: 0,
        }} />
      ))}

      {/* ══════════════════════════════════════════════════════════
          NAVBAR
          ══════════════════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '60px',
        background: 'rgba(5,5,8,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            overflow: 'hidden', border: '1.5px solid var(--border-medium)',
            boxShadow: '0 0 12px var(--gold-glow)',
            background: 'var(--void-raised)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <img src="/wolf-hero.png" alt="DHEEB" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '16px', letterSpacing: '0.5px' }}>
            عقلية الذيب
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '3px' }}>
            DHEEB MIND
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/analyze')}
          style={{
            background: 'linear-gradient(135deg, var(--emerald), var(--emerald-dim))',
            color: '#fff', border: 'none', borderRadius: '100px',
            padding: '8px 22px', fontSize: '13px', fontWeight: 700,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            boxShadow: '0 0 16px var(--emerald-glow)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
          onMouseLeave={e => (e.currentTarget.style.filter = '')}
        >
          ابدأ الآن
          <ArrowLeft size={13} />
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO
          ══════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative', zIndex: 1,
        minHeight: 'calc(100dvh - 60px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '60px 24px 80px',
      }}>
        {/* Wolf emblem */}
        <div style={{ position: 'relative', marginBottom: '36px' }}>
          <div style={{ position: 'absolute', width: '180px', height: '180px', borderRadius: '50%', border: '1px solid var(--border-medium)', animation: 'vault-ring 4s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: '162px', height: '162px', borderRadius: '50%', border: '1px solid var(--border)', animation: 'vault-ring 4s ease-in-out 1.3s infinite', pointerEvents: 'none' }} />
          <div style={{
            width: '140px', height: '140px', borderRadius: '50%',
            overflow: 'hidden', border: '2px solid var(--border-medium)',
            boxShadow: '0 0 50px var(--gold-glow), 0 0 100px rgba(212,168,67,0.07)',
            background: 'var(--void-raised)',
          }}>
            <img src="/wolf-hero.png" alt="DHEEB" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: 'var(--font-arabic)', fontSize: 'clamp(34px, 7vw, 54px)',
          fontWeight: 700, color: 'var(--gold)',
          textShadow: '0 0 40px var(--gold-glow)',
          margin: '0 0 10px', lineHeight: 1.2,
        }}>
          لا تتنبأ بالسوق. افهم قراراتك.
        </h1>

        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px',
          letterSpacing: '6px', color: 'var(--text-muted)',
          textTransform: 'uppercase', margin: '0 0 24px',
        }}>
          Saudi-built AI Decision Intelligence
        </p>

        {/* Description */}
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 'clamp(15px, 2.5vw, 18px)',
          color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.8,
          margin: '0 0 40px',
        }}>
          منصة ذكاء اصطناعي تساعدك على فهم أسباب قراراتك في التداول —
          قبل أن يُكلّفك الغموض أكثر مما تتوقع.
        </p>

        {/* CTA group */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/analyze')}
            style={{
              background: 'linear-gradient(135deg, var(--emerald), var(--emerald-dim))',
              color: '#fff', border: 'none', borderRadius: '100px',
              padding: '14px 38px', fontSize: '16px', fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              boxShadow: '0 0 30px var(--emerald-glow)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.12)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = ''; }}
          >
            ابدأ تحليل صفقتك
            <ArrowLeft size={16} />
          </button>

          <button
            onClick={() => document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: 'transparent', color: 'var(--gold)',
              border: '1px solid var(--border-medium)', borderRadius: '100px',
              padding: '14px 30px', fontSize: '14px', fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-subtle)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            استكشف المنصة
          </button>
        </div>

        {/* Scroll hint */}
        <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', opacity: 0.4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '3px' }}>SCROLL</span>
          <div style={{ width: '1px', height: '30px', background: 'linear-gradient(to bottom, var(--gold), transparent)' }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '80px 24px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Section label */}
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '5px', color: 'var(--emerald)', textTransform: 'uppercase', marginBottom: '12px' }}>
              HOW IT WORKS
            </p>
            <h2 style={{ fontFamily: 'var(--font-arabic)', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              ثلاث خطوات تبني منها عقلية مختلفة
            </h2>
          </div>

          {/* Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} style={{
                  background: 'var(--void-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '28px 24px',
                  display: 'flex', flexDirection: 'column', gap: '14px',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '28px', fontWeight: 700, color: 'var(--border-strong)', lineHeight: 1 }}>
                      {step.num}
                    </span>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--gold-subtle)', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color="var(--gold)" />
                    </div>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-arabic)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          MODULES GRID
          ══════════════════════════════════════════════════════════ */}
      <section id="modules" style={{
        position: 'relative', zIndex: 1,
        padding: '80px 24px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '5px', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '12px' }}>
              MODULES
            </p>
            <h2 style={{ fontFamily: 'var(--font-arabic)', fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              خمسة أدوات. قرار واحد أوضح.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px' }}>
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.route}
                  onClick={() => navigate(mod.route)}
                  style={{
                    background: 'var(--void-surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    padding: '32px 28px',
                    textAlign: 'right',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    transition: 'border-color 0.2s, background 0.2s, transform 0.15s',
                    fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = mod.color;
                    e.currentTarget.style.background = mod.bg;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--void-surface)';
                    e.currentTarget.style.transform = '';
                  }}
                >
                  {/* Icon row + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: mod.bg, border: `1px solid ${mod.color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={20} color={mod.color} />
                    </div>
                    {'badge' in mod && mod.badge && (
                      <span style={{
                        background: mod.bg,
                        color: mod.color,
                        border: `1px solid ${mod.color}55`,
                        borderRadius: '100px',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        letterSpacing: '0.3px',
                        fontFamily: 'var(--font-body)',
                      }}>
                        {mod.badge}
                      </span>
                    )}
                  </div>

                  {/* Text */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                      <h3 style={{ fontFamily: 'var(--font-arabic)', fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                        {mod.label}
                      </h3>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: mod.color, letterSpacing: '2px', opacity: 0.7 }}>
                        {mod.en}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.85, margin: 0 }}>
                      {mod.desc}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '4px' }}>
                    <span style={{ color: mod.color, fontSize: '11px', fontFamily: 'var(--font-mono)', letterSpacing: '2px', opacity: 0.6 }}>
                      ← افتح
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          BOTTOM CTA
          ══════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative', zIndex: 1,
        padding: '80px 24px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-arabic)', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, color: 'var(--gold)', margin: 0, lineHeight: 1.4 }}>
            الصفقة القادمة تستحق قرارًا أوضح
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.8, margin: 0 }}>
            ابدأ بتحليل الصفقة المقبلة الآن. لا يلزم تسجيل — فقط وضوح أكثر.
          </p>
          <button
            onClick={() => navigate('/analyze')}
            style={{
              background: 'linear-gradient(135deg, var(--emerald), var(--emerald-dim))',
              color: '#fff', border: 'none', borderRadius: '100px',
              padding: '15px 42px', fontSize: '16px', fontWeight: 700,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              boxShadow: '0 0 32px var(--emerald-glow)',
            }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.12)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = ''; }}
          >
            ابدأ الآن — مجانًا
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid var(--border)',
        padding: '24px',
        display: 'flex', justifyContent: 'center',
      }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.8, maxWidth: '480px', opacity: 0.6 }}>
          تحليل تعليمي — ليس نصيحة مالية. جميع القرارات على مسؤولية المستخدم الكامل.
          <br />
          <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px' }}>DHEEB MIND © 2025</span>
        </p>
      </footer>

    </div>
  );
}
