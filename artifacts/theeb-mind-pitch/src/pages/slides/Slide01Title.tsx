const base = import.meta.env.BASE_URL;

export default function Slide01Title() {
  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#0c0b09' }}>

      {/* Full-bleed wolf image — pinned to physical right (RTL-safe) */}
      <div className="absolute top-0 bottom-0" style={{ right: 0, width: '55vw' }}>
        <img
          src={`${base}wolf-hero.png`}
          crossOrigin="anonymous"
          alt="Theeb Mind Wolf"
          className="w-full h-full object-cover"
          style={{ opacity: 0.85, filter: 'drop-shadow(0 0 6vw rgba(201,146,74,0.25))' }}
        />
      </div>

      {/* Dark gradient overlay — left to right */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, #0c0b09 42%, rgba(12,11,9,0.82) 62%, rgba(12,11,9,0.1) 100%)' }}
      />

      {/* Subtle gold grain top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a55, transparent)' }}
      />

      {/* Content — left column */}
      <div className="absolute inset-0 flex flex-col justify-center" style={{ paddingRight: '52vw', paddingLeft: '6vw' }}>

        {/* Top label */}
        <div
          className="flex items-center gap-2 mb-6"
          style={{ fontFamily: 'IBM Plex Mono', fontSize: '1.1vw', color: '#c9924a', letterSpacing: '0.22em', textTransform: 'uppercase' }}
        >
          <span style={{ display: 'inline-block', width: '2.5vw', height: '1px', background: '#c9924a' }} />
          Saudi AI · Hackathon 2026
        </div>

        {/* Arabic headline */}
        <h1
          style={{
            fontFamily: 'Cairo',
            fontSize: '5.8vw',
            fontWeight: 900,
            color: '#ede8e3',
            lineHeight: 1.15,
            textWrap: 'balance',
            marginBottom: '1.5vw',
          }}
        >
          لا تتنبأ بالسوق.
          <br />
          <span style={{ color: '#c9924a' }}>افهم قراراتك.</span>
        </h1>

        {/* Product name */}
        <div
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '1.3vw',
            fontWeight: 700,
            color: '#ede8e3',
            letterSpacing: '0.3em',
            marginBottom: '2.5vw',
            opacity: 0.7,
          }}
        >
          THEEB MIND · عقلية الذيب
        </div>

        {/* Divider */}
        <div style={{ width: '5vw', height: '2px', background: 'linear-gradient(90deg, #c9924a, transparent)', marginBottom: '2.5vw' }} />

        {/* Tagline */}
        <p
          style={{
            fontFamily: 'Cairo',
            fontSize: '1.9vw',
            fontWeight: 400,
            color: '#9a9086',
            lineHeight: 1.7,
            maxWidth: '34vw',
            textWrap: 'pretty',
          }}
        >
          منصة ذكاء اصطناعي تحلّل قراراتك في السوق المالي
          وتكشف أنماط أخطائك قبل فوات الأوان
        </p>

        {/* URL */}
        <div
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '1vw',
            color: '#c9924a',
            marginTop: '3.5vw',
            opacity: 0.75,
          }}
        >
          theeb-mind-audit.replit.app
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: '1px', background: 'linear-gradient(90deg, #c9924a33, transparent)' }}
      />
    </div>
  );
}
