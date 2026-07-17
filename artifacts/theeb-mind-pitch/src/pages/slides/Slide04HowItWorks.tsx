export default function Slide04HowItWorks() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col"
      style={{ background: '#0c0b09' }}
    >
      {/* Subtle radial */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(201,146,74,0.05) 0%, transparent 65%)' }}
      />

      {/* Top accent */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a44, transparent)', flexShrink: 0 }} />

      {/* Header */}
      <div style={{ padding: '5vh 7vw 0', flexShrink: 0 }}>
        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.95vw', color: '#c9924a', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '1.5vh' }}>
          ٠٤ · How It Works
        </div>
        <h2 style={{ fontFamily: 'Cairo', fontSize: '4vw', fontWeight: 800, color: '#ede8e3', lineHeight: 1.15 }}>
          كيف تعمل
        </h2>
      </div>

      {/* Three steps */}
      <div
        className="flex"
        style={{ padding: '4.5vh 7vw 0', gap: '2.5vw', flex: 1 }}
      >

        {/* Step 1 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(201,146,74,0.05)',
            border: '1px solid rgba(201,146,74,0.2)',
            borderRadius: '1.2vw',
            padding: '4vh 2.5vw',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Step number watermark */}
          <div
            style={{
              position: 'absolute',
              bottom: '-1vh',
              right: '-0.5vw',
              fontFamily: 'IBM Plex Mono',
              fontSize: '12vw',
              fontWeight: 800,
              color: '#c9924a',
              opacity: 0.06,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            1
          </div>

          <div
            style={{
              width: '3.5vw',
              height: '3.5vw',
              borderRadius: '50%',
              background: 'rgba(201,146,74,0.12)',
              border: '1px solid rgba(201,146,74,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'IBM Plex Mono',
              fontSize: '1.3vw',
              fontWeight: 700,
              color: '#c9924a',
              marginBottom: '3vh',
            }}
          >
            01
          </div>

          <div style={{ fontFamily: 'Cairo', fontSize: '2.2vw', fontWeight: 800, color: '#c9924a', marginBottom: '1.5vh' }}>
            حلّل
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85vw', color: '#c9924a99', letterSpacing: '0.15em', marginBottom: '2vh', textTransform: 'uppercase' }}>
            Analyze
          </div>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.65vw', color: '#ede8e3', lineHeight: 1.65, fontWeight: 400 }}>
            ارفع شارتك — الذكاء الاصطناعي يقيّم 6 عوامل ويعطيك نتيجة فورية
          </p>
          <div style={{ marginTop: '2.5vh', fontFamily: 'IBM Plex Mono', fontSize: '1.1vw', color: '#2bb57e', fontWeight: 600 }}>
            TRADE / DO NOT TRADE
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          <div style={{ width: '1.5vw', height: '1px', background: 'linear-gradient(90deg, #c9924a44, #c9924a22)' }} />
          <div style={{ width: '0.5vw', height: '0.5vw', borderRadius: '50%', background: '#c9924a44' }} />
        </div>

        {/* Step 2 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1.2vw',
            padding: '4vh 2.5vw',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '-1vh',
              right: '-0.5vw',
              fontFamily: 'IBM Plex Mono',
              fontSize: '12vw',
              fontWeight: 800,
              color: '#ede8e3',
              opacity: 0.03,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            2
          </div>

          <div
            style={{
              width: '3.5vw',
              height: '3.5vw',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'IBM Plex Mono',
              fontSize: '1.3vw',
              fontWeight: 700,
              color: '#9a9086',
              marginBottom: '3vh',
            }}
          >
            02
          </div>

          <div style={{ fontFamily: 'Cairo', fontSize: '2.2vw', fontWeight: 800, color: '#ede8e3', marginBottom: '1.5vh' }}>
            سجّل
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85vw', color: '#9a908699', letterSpacing: '0.15em', marginBottom: '2vh', textTransform: 'uppercase' }}>
            Journal
          </div>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.65vw', color: '#ede8e3', lineHeight: 1.65, fontWeight: 400 }}>
            كل صفقة تُحفظ وتُحلَّل في السجل الذكي مع تقييم شامل
          </p>
        </div>

        {/* Connector */}
        <div className="flex items-center" style={{ flexShrink: 0 }}>
          <div style={{ width: '1.5vw', height: '1px', background: 'linear-gradient(90deg, #c9924a22, #c9924a44)' }} />
          <div style={{ width: '0.5vw', height: '0.5vw', borderRadius: '50%', background: '#c9924a44' }} />
        </div>

        {/* Step 3 */}
        <div
          className="flex flex-col"
          style={{
            flex: 1,
            background: 'rgba(43,181,126,0.04)',
            border: '1px solid rgba(43,181,126,0.15)',
            borderRadius: '1.2vw',
            padding: '4vh 2.5vw',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '-1vh',
              right: '-0.5vw',
              fontFamily: 'IBM Plex Mono',
              fontSize: '12vw',
              fontWeight: 800,
              color: '#2bb57e',
              opacity: 0.05,
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            3
          </div>

          <div
            style={{
              width: '3.5vw',
              height: '3.5vw',
              borderRadius: '50%',
              background: 'rgba(43,181,126,0.1)',
              border: '1px solid rgba(43,181,126,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'IBM Plex Mono',
              fontSize: '1.3vw',
              fontWeight: 700,
              color: '#2bb57e',
              marginBottom: '3vh',
            }}
          >
            03
          </div>

          <div style={{ fontFamily: 'Cairo', fontSize: '2.2vw', fontWeight: 800, color: '#2bb57e', marginBottom: '1.5vh' }}>
            تعلّم
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono', fontSize: '0.85vw', color: '#2bb57e99', letterSpacing: '0.15em', marginBottom: '2vh', textTransform: 'uppercase' }}>
            Improve
          </div>
          <p style={{ fontFamily: 'Cairo', fontSize: '1.65vw', color: '#ede8e3', lineHeight: 1.65, fontWeight: 400 }}>
            أنماط الفشل تظهر في هيت ماب تفاعلي — تعرف متى تتوقف
          </p>
        </div>

      </div>

      {/* Bottom */}
      <div style={{ height: '5vh' }} />
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #c9924a22, transparent)', flexShrink: 0 }} />
    </div>
  );
}
