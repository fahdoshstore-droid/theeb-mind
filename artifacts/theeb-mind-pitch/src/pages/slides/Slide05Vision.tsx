const base = import.meta.env.BASE_URL;

export default function Slide05Vision() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: '#0c0b09' }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(201,146,74,0.08) 0%, transparent 70%)' }}
      />

      {/* Top horizontal rule */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a55, transparent)' }} />

      {/* Wolf emblem — faded background */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: 0.04 }}>
        <img
          src={`${base}wolf-hero.png`}
          crossOrigin="anonymous"
          alt=""
          style={{ width: '55vw', height: '55vw', objectFit: 'contain' }}
        />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center" style={{ textAlign: 'center', padding: '0 12vw', zIndex: 1 }}>

        {/* Label */}
        <div
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '0.95vw',
            color: '#c9924a',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            marginBottom: '4vh',
          }}
        >
          ٠٥ · Vision
        </div>

        {/* Main statement */}
        <h2
          style={{
            fontFamily: 'Cairo',
            fontSize: '4.5vw',
            fontWeight: 900,
            color: '#ede8e3',
            lineHeight: 1.2,
            textWrap: 'balance',
            marginBottom: '3vh',
          }}
        >
          المتداول الذي يفهم نفسه
          <br />
          <span style={{ color: '#c9924a' }}>يتفوق على السوق</span>
        </h2>

        {/* Divider */}
        <div style={{ width: '6vw', height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a, transparent)', marginBottom: '3.5vh' }} />

        {/* Two bullets */}
        <div className="flex flex-col items-center" style={{ gap: '1.8vh', marginBottom: '5vh' }}>
          <p style={{ fontFamily: 'Cairo', fontSize: '2vw', color: '#9a9086', lineHeight: 1.6 }}>
            أول منصة ذكاء قرار مالي مبنية للمتداول العربي
          </p>
          <p style={{ fontFamily: 'Cairo', fontSize: '2vw', color: '#9a9086', lineHeight: 1.6 }}>
            Saudi-Built · AI-Powered · Decision-First
          </p>
        </div>

        {/* CTA box */}
        <div
          style={{
            background: 'rgba(201,146,74,0.08)',
            border: '1px solid rgba(201,146,74,0.3)',
            borderRadius: '0.8vw',
            padding: '1.8vh 3.5vw',
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5vh',
          }}
        >
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85vw', color: '#c9924a', letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.7 }}>
            Live Demo
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.5vw', color: '#c9924a', fontWeight: 600 }}>
            theeb-mind-audit.replit.app
          </div>
        </div>

      </div>

      {/* Bottom rule */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a55, transparent)' }} />

      {/* Corner marks */}
      <div style={{ position: 'absolute', bottom: '3vh', left: '5vw', fontFamily: 'IBM Plex Mono', fontSize: '0.8vw', color: '#c9924a', opacity: 0.35, letterSpacing: '0.15em' }}>
        THEEB MIND · عقلية الذيب
      </div>
      <div style={{ position: 'absolute', bottom: '3vh', right: '5vw', fontFamily: 'IBM Plex Mono', fontSize: '0.8vw', color: '#c9924a', opacity: 0.35, letterSpacing: '0.15em' }}>
        Hackathon 2026
      </div>
    </div>
  );
}
