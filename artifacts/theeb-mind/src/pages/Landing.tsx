import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Seeded particles so they don't shift on re-render
const PARTICLES = Array.from({ length: 26 }, (_, i) => {
  const seed = i * 2654435761;
  const x = ((seed >>> 8) % 100);
  const y = ((seed >>> 4) % 100);
  const delay = (i * 0.37) % 5;
  const duration = 3 + (i * 0.61) % 4;
  return { id: i, x, y, delay, duration };
});

export default function Landing() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => navigate('/analyze'), 480);
  };

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className={exiting ? 'vault-exit' : ''}
      style={{
        minHeight: '100dvh',
        background: 'var(--void)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background radial glows */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,168,67,0.05) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 20% 80%, rgba(16,185,129,0.04) 0%, transparent 50%)
        `,
      }} />

      {/* Floating gold particles */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: '2px',
            height: '2px',
            borderRadius: '50%',
            background: 'var(--gold)',
            animation: `float-particle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Main content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>

        {/* Wolf + pulsing rings */}
        <div
          className="vault-wolf"
          style={{ position: 'relative', marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Outer ring */}
          <div style={{
            position: 'absolute',
            width: '160px', height: '160px',
            borderRadius: '50%',
            border: '1px solid var(--border-medium)',
            animation: 'vault-ring 4s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Inner ring */}
          <div style={{
            position: 'absolute',
            width: '144px', height: '144px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            animation: 'vault-ring 4s ease-in-out 1s infinite',
            pointerEvents: 'none',
          }} />
          {/* Wolf circle */}
          <div style={{
            width: '120px', height: '120px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--border-medium)',
            boxShadow: '0 0 40px var(--gold-glow), 0 0 80px rgba(212,168,67,0.08)',
            background: 'var(--void-raised)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src="/wolf-hero.png"
              alt="DHEEB"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = 'none';
                const parent = img.parentElement;
                if (parent) {
                  parent.innerHTML = `<svg width="72" height="72" viewBox="0 0 48 48" fill="none">
                    <path d="M24 6L14 22L8 38H18L24 28L30 38H40L34 22L24 6Z" stroke="#d4a843" stroke-width="1.5" fill="none"/>
                    <circle cx="19" cy="20" r="2" fill="#d4a843" opacity="0.7"/>
                    <circle cx="29" cy="20" r="2" fill="#d4a843" opacity="0.7"/>
                  </svg>`;
                }
              }}
            />
          </div>
        </div>

        {/* Arabic title */}
        <h1
          className="vault-title"
          style={{
            fontFamily: 'var(--font-arabic)',
            fontSize: 'clamp(32px, 6vw, 42px)',
            fontWeight: 700,
            color: 'var(--gold)',
            textShadow: '0 0 40px var(--gold-glow), 0 0 80px rgba(212,168,67,0.12)',
            margin: '0 0 8px',
            lineHeight: 1.2,
          }}
        >
          عقلية الذيب
        </h1>

        {/* EN subtitle */}
        <p
          className="vault-sub"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '8px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            margin: '0 0 22px',
          }}
        >
          DHEEB MINDSET
        </p>

        {/* Gold divider */}
        <div
          className="vault-divider"
          style={{
            width: '50px', height: '1px',
            background: 'linear-gradient(to left, transparent, var(--gold), transparent)',
            marginBottom: '22px',
          }}
        />

        {/* Tagline */}
        <p
          className="vault-tagline"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(15px, 2.5vw, 18px)',
            fontWeight: 500,
            color: 'var(--text)',
            margin: '0 0 8px',
          }}
        >
          لا تتنبأ بالسوق. افهم قراراتك.
        </p>

        {/* Description */}
        <p
          className="vault-tagline"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '1px',
            margin: '0 0 38px',
          }}
        >
          Saudi-built AI Decision Intelligence
        </p>

        {/* Enter button */}
        <button
          className="vault-btn"
          onClick={handleEnter}
          style={{
            background: 'linear-gradient(135deg, var(--emerald), var(--emerald-dim))',
            color: '#fff',
            border: 'none',
            borderRadius: '100px',
            padding: '14px 44px',
            fontSize: '15px',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            boxShadow: '0 0 24px var(--emerald-glow)',
            transition: 'filter 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
            letterSpacing: '0.5px',
          }}
          onMouseEnter={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.filter = 'brightness(1.15)';
            b.style.transform = 'scale(1.04)';
            b.style.boxShadow = '0 0 44px var(--emerald-glow)';
          }}
          onMouseLeave={(e) => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.filter = '';
            b.style.transform = '';
            b.style.boxShadow = '0 0 24px var(--emerald-glow)';
          }}
          onMouseDown={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
          }}
        >
          ›› ابدأ الآن
        </button>
      </div>

      {/* Disclaimer */}
      <p style={{
        position: 'absolute', bottom: '20px',
        fontFamily: 'var(--font-body)',
        fontSize: '9px',
        color: 'var(--text-muted)',
        maxWidth: '480px',
        textAlign: 'center',
        padding: '0 20px',
        lineHeight: 1.7,
        opacity: 0.5,
      }}>
        تحليل تعليمي — ليس نصيحة مالية. جميع القرارات على مسؤولية المستخدم.
      </p>
    </div>
  );
}
