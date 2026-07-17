export default function Slide02Problem() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col"
      style={{ background: '#0c0b09' }}
    >
      {/* Subtle background texture */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(201,146,74,0.06) 0%, transparent 70%)' }}
      />

      {/* Top accent line */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a44, transparent)', flexShrink: 0 }} />

      {/* Header */}
      <div className="flex items-baseline gap-4" style={{ padding: '5vh 7vw 0' }}>
        <span
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '0.95vw',
            color: '#c9924a',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
          }}
        >
          ٠٢ · Problem
        </span>
        <div style={{ flex: 1, height: '1px', background: '#c9924a22' }} />
      </div>

      {/* Title */}
      <h2
        style={{
          fontFamily: 'Cairo',
          fontSize: '4vw',
          fontWeight: 800,
          color: '#ede8e3',
          padding: '2.5vh 7vw 0',
          lineHeight: 1.2,
        }}
      >
        المشكلة
      </h2>

      {/* Three problem cards */}
      <div
        className="flex gap-6"
        style={{ padding: '4vh 7vw 0', flex: 1 }}
      >

        {/* Card 1 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(201,146,74,0.05)',
            border: '1px solid rgba(201,146,74,0.15)',
            borderRadius: '1vw',
            padding: '3.5vh 2.5vw',
          }}
        >
          <div
            style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '7vw',
              fontWeight: 700,
              color: '#c9924a',
              lineHeight: 1,
              marginBottom: '2vh',
            }}
          >
            85%
          </div>
          <p
            style={{
              fontFamily: 'Cairo',
              fontSize: '1.9vw',
              fontWeight: 600,
              color: '#ede8e3',
              lineHeight: 1.55,
              marginBottom: '1.5vh',
            }}
          >
            من المتداولين يخسرون بسبب قراراتهم
          </p>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
            لا بسبب السوق — بسبب عقليتهم وأنماطهم السلوكية
          </p>
        </div>

        {/* Card 2 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1vw',
            padding: '3.5vh 2.5vw',
          }}
        >
          <div
            style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '4.5vw',
              fontWeight: 700,
              color: '#ede8e3',
              lineHeight: 1,
              marginBottom: '2vh',
              opacity: 0.25,
            }}
          >
            ???
          </div>
          <p
            style={{
              fontFamily: 'Cairo',
              fontSize: '1.9vw',
              fontWeight: 600,
              color: '#ede8e3',
              lineHeight: 1.55,
              marginBottom: '1.5vh',
            }}
          >
            المتداول لا يعرف لماذا يفشل
          </p>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
            فقط يعرف أنه خسر — بدون تشخيص لا يوجد تحسّن
          </p>
        </div>

        {/* Card 3 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '1vw',
            padding: '3.5vh 2.5vw',
          }}
        >
          <div
            style={{
              fontFamily: 'IBM Plex Mono',
              fontSize: '4.5vw',
              fontWeight: 700,
              color: '#ede8e3',
              lineHeight: 1,
              marginBottom: '2vh',
              opacity: 0.25,
            }}
          >
            0
          </div>
          <p
            style={{
              fontFamily: 'Cairo',
              fontSize: '1.9vw',
              fontWeight: 600,
              color: '#ede8e3',
              lineHeight: 1.55,
              marginBottom: '1.5vh',
            }}
          >
            لا توجد أداة تشخيص سلوكي للمتداول العربي
          </p>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
            الأدوات الموجودة تحلّل السوق — لا تحلّل القرار
          </p>
        </div>

      </div>

      {/* Bottom padding */}
      <div style={{ height: '6vh' }} />

      {/* Bottom accent line */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a22, transparent)', flexShrink: 0 }} />
    </div>
  );
}
