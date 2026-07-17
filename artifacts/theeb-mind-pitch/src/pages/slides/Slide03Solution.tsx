const base = import.meta.env.BASE_URL;

export default function Slide03Solution() {
  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex"
      style={{ background: '#0c0b09' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 80% at 75% 50%, rgba(43,181,126,0.05) 0%, transparent 65%)' }}
      />

      {/* Top accent */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #2bb57e33, transparent)' }} />

      {/* LEFT — text content */}
      <div
        className="flex flex-col justify-center"
        style={{ width: '48vw', padding: '0 5vw 0 7vw', zIndex: 1 }}
      >
        {/* Label */}
        <div
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: '0.95vw',
            color: '#2bb57e',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: '2.5vh',
          }}
        >
          ٠٣ · Solution
        </div>

        {/* Headline */}
        <h2
          style={{
            fontFamily: 'Cairo',
            fontSize: '4.2vw',
            fontWeight: 800,
            color: '#ede8e3',
            lineHeight: 1.2,
            marginBottom: '1.5vh',
            textWrap: 'balance',
          }}
        >
          الحل
        </h2>

        <div style={{ width: '4vw', height: '2px', background: '#2bb57e', marginBottom: '4vh', opacity: 0.6 }} />

        {/* Feature rows */}
        <div className="flex flex-col" style={{ gap: '2.8vh' }}>

          <div className="flex items-start" style={{ gap: '1.5vw' }}>
            <div style={{ width: '0.35vw', borderRadius: '9999px', background: '#c9924a', flexShrink: 0, marginTop: '0.4vh', height: '4.5vh' }} />
            <div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.9vw', fontWeight: 700, color: '#ede8e3', marginBottom: '0.5vh' }}>
                ذكاء اصطناعي يقيّم قرارك
              </div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
                ارفع شارتك — الذكاء الاصطناعي يحلّل 6 عوامل ويعطيك نتيجة فورية
              </div>
            </div>
          </div>

          <div className="flex items-start" style={{ gap: '1.5vw' }}>
            <div style={{ width: '0.35vw', borderRadius: '9999px', background: '#c9924a', flexShrink: 0, marginTop: '0.4vh', height: '4.5vh' }} />
            <div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.9vw', fontWeight: 700, color: '#ede8e3', marginBottom: '0.5vh' }}>
                تتبع أنماط فشلك عبر الزمن
              </div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
                هيت ماب تفاعلي يكشف متى وأين تتكرر أخطاؤك
              </div>
            </div>
          </div>

          <div className="flex items-start" style={{ gap: '1.5vw' }}>
            <div style={{ width: '0.35vw', borderRadius: '9999px', background: '#c9924a', flexShrink: 0, marginTop: '0.4vh', height: '4.5vh' }} />
            <div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.9vw', fontWeight: 700, color: '#ede8e3', marginBottom: '0.5vh' }}>
                دستور التداول الشخصي
              </div>
              <div style={{ fontFamily: 'Cairo', fontSize: '1.5vw', color: '#9a9086', lineHeight: 1.6 }}>
                قواعد مخصصة تمنعك من تكرار نفس الأخطاء — للأبد
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT — chart image */}
      <div
        className="absolute top-0 right-0 bottom-0 flex items-center"
        style={{ width: '52vw' }}
      >
        {/* Gradient mask on left edge */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: '10vw', background: 'linear-gradient(90deg, #0c0b09, transparent)', zIndex: 2 }}
        />
        <img
          src={`${base}chart-ui.png`}
          crossOrigin="anonymous"
          alt="AI Trading Dashboard"
          className="w-full h-full object-cover"
          style={{ opacity: 0.75 }}
        />
        {/* Overlay tint */}
        <div className="absolute inset-0" style={{ background: 'rgba(12,11,9,0.25)' }} />
      </div>

      {/* Bottom accent */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, #2bb57e22, transparent)' }} />
    </div>
  );
}
