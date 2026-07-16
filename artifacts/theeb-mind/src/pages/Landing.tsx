import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

export default function Landing() {
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            const children = entry.target.querySelectorAll('.fade-up:not(.instant)');
            children.forEach((child) => {
              (child as HTMLElement).classList.add('instant');
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    sectionsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!orbRef.current) return;
      const scrollY = window.scrollY;
      const orbs = orbRef.current.querySelectorAll('.orb-parallax');
      orbs.forEach((orb, i) => {
        const speed = i === 0 ? 0.12 : 0.06;
        (orb as HTMLElement).style.transform = `translateY(${scrollY * speed}px)`;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sectionCb = (idx: number) => (el: HTMLElement | null) => {
    sectionsRef.current[idx] = el;
  };

  return (
    <div className="min-h-screen" dir="rtl">

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 1 — HERO
          ═══════════════════════════════════════════════════════════ */}
      <section className="section-void min-h-screen flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
        <div ref={orbRef} className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb-parallax absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] md:w-[900px] md:h-[900px] bg-gold/4 rounded-full blur-3xl" />
          <div className="orb-parallax absolute bottom-0 right-0 w-[500px] h-[500px] md:w-[600px] md:h-[600px] bg-emerald/3 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          {/* Wolf mark */}
          <div className="fade-up instant mb-10">
            <svg width="72" height="72" viewBox="0 0 48 48" fill="none" className="mx-auto wolf-glow opacity-50">
              <path d="M24 6L14 22L8 38H18L24 28L30 38H40L34 22L24 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none" />
              <circle cx="19" cy="20" r="2" fill="#c9a84c" opacity="0.7" />
              <circle cx="29" cy="20" r="2" fill="#c9a84c" opacity="0.7" />
            </svg>
          </div>

          <p className="fade-up instant fade-up-delay-1 text-gold/70 text-sm font-bold tracking-[0.2em] uppercase mb-8">
            THEEB MIND
          </p>

          <h1 className="fade-up instant fade-up-delay-1 text-3xl md:text-5xl lg:text-6xl font-extrabold text-cream leading-tight mb-6">
            لا تتنبأ بالسوق.
            <br />
            <span className="text-gold">افهم قراراتك.</span>
          </h1>

          <p className="fade-up instant fade-up-delay-2 text-base md:text-lg lg:text-xl text-cream/50 max-w-xl mx-auto mb-12">
            بنية تحتية لذكاء القرار. ليست منصة تداول. ليست توصيات. طبقة ذكاء بين الإنسان والقرار المالي.
          </p>

          <div className="fade-up instant fade-up-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/analyze"
              className="btn-primary inline-flex items-center gap-2 text-lg px-10 py-4 rounded-xl"
            >
              ابدأ التحليل
              <ArrowUpRight size={22} />
            </Link>
            <a
              href="#the-problem"
              className="btn-ghost inline-flex items-center gap-2 text-lg"
            >
              اكتشف كيف تعمل
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 scroll-hint">
          <a href="#the-problem" className="flex flex-col items-center gap-1 text-cream/30 hover:text-cream/50 transition-colors">
            <span className="text-xs tracking-widest">استكشف</span>
            <ChevronDown size={20} />
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 2 — THE PROBLEM
          ═══════════════════════════════════════════════════════════ */}
      <section
        id="the-problem"
        ref={sectionCb(0)}
        className="section-premium py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">المشكلة</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              السوق ليس المشكلة.
            </h2>
            <p className="text-cream/50 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
              السوق محايد. يتحرك وفق قوانينه. المشكلة في طريقة اتخاذ القرار. 87% من المتداولين يخسرون — ليس لأن السوق ضدهم، بل لأن قراراتهم تُبنى على العاطفة، الاندفاع، والمحتوى المضلل.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 fade-up">
            {[
              { label: 'عاطفة', text: 'الخوف من فوات الفرصة. الطمع. الانتقام من الخسارة. القرار يُتخذ قبل أن يكتمل الفهم.' },
              { label: 'تضليل', text: 'محتوى مالي مضلل. وعود أرباح خيالية. مؤثرون بلا رقابة. المعلومات تصل مشوهة.' },
              { label: 'غياب الوعي', text: 'لا توجد أداة عربية واحدة تساعد المستثمر يفهم قراره قبل أن ينفذه. التنفيذ بلا وعي.' },
            ].map((item, i) => (
              <div key={i} className="card-dark-premium p-8 text-center">
                <p className="text-gold font-extrabold text-lg mb-3">{item.label}</p>
                <p className="text-cream/60 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 3 — INTELLIGENCE ARCHITECTURE
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(1)}
        className="section-void py-20 md:py-28 px-6"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">البنية</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              أربع طبقات من الذكاء.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              كل قرار يمر عبر أربع طبقات تحليلية قبل أن يصل إليك. ليست توصية. ليست إشارة شراء أو بيع. تقييم لجودة القرار من أربع زوايا مستقلة.
            </p>
          </div>

          <div className="space-y-4 fade-up">
            {[
              { num: '01', title: 'ذكاء السوق', en: 'Market Intelligence', desc: 'السياق الكلي. التموضع المؤسسي. البيئة الاقتصادية. أين نقف في الدورة؟' },
              { num: '02', title: 'ذكاء الشارت', en: 'Chart Intelligence', desc: 'هيكل السوق. السيولة. مناطق الاهتمام. سياق التنفيذ. هل اللحظة مناسبة؟' },
              { num: '03', title: 'الذكاء السلوكي', en: 'Behavioral Intelligence', desc: 'انضباطك. نفسيتك. أنماط قراراتك. هل أنت مستعد؟ أم تقودك العاطفة؟' },
              { num: '04', title: 'محرك القرار', en: 'Decision Engine', desc: 'تجميع الطبقات الثلاث في إطار قرار واحد. ليس رأياً. إطار. ثم القرار لك.' },
            ].map((layer, i) => (
              <div key={i} className="card-dark-premium flex flex-col md:flex-row items-start gap-6 p-6 md:p-8">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                  <span className="text-gold font-mono text-sm font-bold">{layer.num}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-3 mb-2">
                    <h3 className="text-cream font-extrabold text-lg">{layer.title}</h3>
                    <span className="text-cream/25 text-xs font-mono tracking-wider">{layer.en}</span>
                  </div>
                  <p className="text-cream/50 text-sm leading-relaxed">{layer.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 4 — MARKET INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(2)}
        className="section-premium py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">الطبقة الأولى</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              ذكاء السوق.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              قبل أن تنظر إلى الشارت، افهم أين تقف. السيولة. التموضع المؤسسي. السردية الاقتصادية. البيئة تصنع السياق، والسياق يصنع القرار.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 fade-up">
            {[
              { label: 'التموضع المؤسسي', text: 'أين يقف المال الذكي؟ COT. التزام المتداولين. تدفقات المؤسسات. هل السوق في تراكم أم توزيع؟' },
              { label: 'السيولة', text: 'هل البيئة داعمة أم متشددة؟ أسعار الفائدة. الميزانيات العمومية. تدفق رأس المال. السيولة تسبق السعر.' },
              { label: 'السردية', text: 'ما القصة التي تحرك السوق الآن؟ ذكاء اصطناعي؟ طاقة؟ تحول رقمي؟ السردية تحدد الاتجاه قبل الشارت.' },
              { label: 'المخاطر', text: 'أحداث التقويم. FOMC. CPI. NFP. التوترات الجيوسياسية. المخاطرة تُقاس قبل الفرصة.' },
            ].map((item, i) => (
              <div key={i} className="card-dark-premium p-6">
                <p className="text-gold font-bold text-sm mb-2">{item.label}</p>
                <p className="text-cream/50 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 5 — CHART INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(3)}
        className="section-void py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">الطبقة الثانية</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              ذكاء الشارت.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              بعد فهم البيئة، ننظر إلى هيكل السعر. ليس للتنبؤ. للفهم. أين السيولة؟ أين مناطق الاهتمام؟ هل الهيكل يدعم الاتجاه أم يحذر منه؟
            </p>
          </div>

          <div className="space-y-6 fade-up">
            {[
              { label: 'هيكل السوق', text: 'الاتجاه العام. القمم والقيعان. كسر الهيكل أم استمراره؟ الهيكل يحدد الإطار.' },
              { label: 'السيولة', text: 'أين تتجمع الأوامر؟ أين وقف الخسارة؟ أين يدخل المال الذكي؟ اصطياد السيولة يسبق الحركة.' },
              { label: 'مناطق الاهتمام', text: 'الخصم. العلاوة. التوازن. أين المنطقة ذات الاحتمالية الأعلى؟ ليس تخميناً. تحليل.' },
              { label: 'سياق التنفيذ', text: 'هل التوقيت مناسب؟ هل نحن في نافذة نشاط؟ هل اكتملت شروط الدخول؟ التنفيذ بلا سياق = مقامرة.' },
            ].map((item, i) => (
              <div key={i} className="card-dark-premium p-6 flex gap-4">
                <div className="flex-shrink-0 w-1 bg-gold/30 rounded-full" />
                <div>
                  <p className="text-cream font-bold text-sm mb-1">{item.label}</p>
                  <p className="text-cream/50 text-sm leading-relaxed">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 6 — BEHAVIORAL INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(4)}
        className="section-premium py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">الطبقة الثالثة</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              الذكاء السلوكي.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              أفضل تحليل فني لا قيمة له إذا اتخذته في حالة نفسية خاطئة. الانضباط قبل التحليل. الوعي قبل التنفيذ. تتبّع قراراتك. افهم أنماطك.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 fade-up">
            {[
              { label: 'سجل القرارات', text: 'كل قرار يُسجل. كل نتيجة تُربط. ليس للوم. للفهم. الأنماط تظهر عبر الزمن.' },
              { label: 'البوابة النفسية', text: 'قبل أن تتخذ قراراً، أسئلة تفحص حالتك. هل أنت منضبط؟ أم منتقم؟ أم خائف من الفوات؟' },
              { label: 'التطور', text: 'مع كل قرار، النظام يتعلم أنماطك. ليس ليحكم عليك. ليساعدك ترى أين تتحسن وأين تكرر الخطأ.' },
            ].map((item, i) => (
              <div key={i} className="card-dark-premium p-8 text-center">
                <p className="text-gold font-extrabold text-lg mb-3">{item.label}</p>
                <p className="text-cream/50 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 fade-up">
            <Link to="/journal" className="btn-outline inline-flex items-center gap-2">
              افتح سجل القرارات
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 7 — DECISION ENGINE
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(5)}
        className="section-void py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">الطبقة الرابعة</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              محرك القرار.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              ثلاث طبقات. إطار واحد. السوق + الشارت + السلوك. ليس رأياً. ليس توصية. إطار. ثم القرار لك. دائماً.
            </p>
          </div>

          {/* Architecture diagram — pure text, no fake metrics */}
          <div className="fade-up max-w-lg mx-auto">
            <div className="relative py-8">
              {/* Top row — 3 inputs */}
              <div className="flex justify-center gap-4 md:gap-8 mb-6">
                {['ذكاء السوق', 'ذكاء الشارت', 'الذكاء السلوكي'].map((label, i) => (
                  <div key={i} className="bg-void-light border border-gold/10 rounded-xl px-4 py-3 text-center">
                    <p className="text-cream/70 text-xs font-bold">{label}</p>
                  </div>
                ))}
              </div>
              {/* Connector lines */}
              <div className="flex justify-center mb-6">
                <svg width="240" height="40" viewBox="0 0 240 40" className="opacity-20">
                  <line x1="40" y1="0" x2="120" y2="40" stroke="#c9a84c" strokeWidth="1" />
                  <line x1="120" y1="0" x2="120" y2="40" stroke="#c9a84c" strokeWidth="1" />
                  <line x1="200" y1="0" x2="120" y2="40" stroke="#c9a84c" strokeWidth="1" />
                </svg>
              </div>
              {/* Bottom — Decision Engine */}
              <div className="bg-gold/5 border border-gold/20 rounded-2xl px-8 py-6 text-center">
                <p className="text-gold font-extrabold text-xl mb-1">محرك القرار</p>
                <p className="text-cream/40 text-sm">إطار. ليس رأياً. القرار لك.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 fade-up">
            <Link to="/analyze" className="btn-primary inline-flex items-center gap-2 text-lg px-10 py-4 rounded-xl">
              ابدأ التحليل
              <ArrowUpRight size={22} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 8 — HOW THE WOLF THINKS
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(6)}
        className="section-premium py-20 md:py-28 px-6"
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-12 fade-up">عقلية الذيب</p>

          <div className="space-y-8 text-cream fade-up">
            <p className="text-xl md:text-2xl lg:text-3xl font-bold leading-relaxed">
              يقرأ البيئة.
            </p>
            <p className="text-cream/30 text-sm max-w-md mx-auto">
              لا يتحرك قبل أن يفهم. السياق قبل القرار. الصورة الكاملة قبل الخطوة الأولى.
            </p>

            <div className="w-16 h-px bg-gold/20 mx-auto" />

            <p className="text-xl md:text-2xl lg:text-3xl font-bold leading-relaxed">
              ينتظر.
            </p>
            <p className="text-cream/30 text-sm max-w-md mx-auto">
              الصبر ليس ضعفاً. هو السلاح. اللحظة المناسبة تأتي لمن ينتظرها. لا لمن يطاردها.
            </p>

            <div className="w-16 h-px bg-gold/20 mx-auto" />

            <p className="text-xl md:text-2xl lg:text-3xl font-bold leading-relaxed">
              يصفي الضوضاء.
            </p>
            <p className="text-cream/30 text-sm max-w-md mx-auto">
              السوق مليء بالصوت. التوصيات. الإشاعات. التغريدات. الذيب يسمع كل شيء. يستجيب للقليل.
            </p>

            <div className="w-16 h-px bg-gold/20 mx-auto" />

            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-gold leading-relaxed">
              ينفذ بانتقائية.
            </p>
            <p className="text-cream/30 text-sm max-w-md mx-auto">
              لا يطارد كل فرصة. عندما تكتمل الشروط — يتحرك. بدقة. بلا تردد. بلا ندم.
            </p>
          </div>

          <div className="mt-16 opacity-15">
            <svg width="240" height="48" viewBox="0 0 240 48" fill="none" className="mx-auto">
              <path d="M20 42L40 10L60 28L80 6L100 34L120 12L140 30L160 8L180 36L200 14L220 42" stroke="#c9a84c" strokeWidth="1" />
            </svg>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 9 — THE VISION
          ═══════════════════════════════════════════════════════════ */}
      <section
        ref={sectionCb(7)}
        className="section-void py-20 md:py-28 px-6"
      >
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-16 fade-up">
            <p className="text-gold/60 text-sm font-bold tracking-[0.2em] uppercase mb-4">الرؤية</p>
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-extrabold text-cream leading-tight mb-6">
              بنية تحتية لذكاء القرار.
            </h2>
            <p className="text-cream/50 text-lg leading-relaxed max-w-2xl mx-auto">
              في سوق فيه أكثر من 12 مليون متداول، لا توجد أداة عربية واحدة تساعد المستثمر يفهم قراراته. THEEB MIND تبني هذه الطبقة. ليست منصة تداول. ليست توصيات. ليست بوت يتنبأ. طبقة ذكاء بين الإنسان والقرار المالي.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 fade-up max-w-2xl mx-auto">
            {[
              { label: 'للمستثمر الفردي', text: 'افهم قرارك قبل أن تنفذه. كشف التضليل. تتبّع الأنماط. تحسين الانضباط.' },
              { label: 'للمؤسسة', text: 'تقييم جودة القرار عبر الزمن. تدقيق موضوعي. بنية تحتية للوعي المالي المؤسسي.' },
              { label: 'للسوق', text: 'رفع مستوى الوعي المالي. عربي أولاً. صنع في السعودية. متوافق مع رؤية 2030.' },
            ].map((item, i) => (
              <div key={i} className="card-dark-premium p-6 text-center">
                <p className="text-gold font-bold text-sm mb-2">{item.label}</p>
                <p className="text-cream/50 text-xs leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SCREEN 10 — CTA
          ═══════════════════════════════════════════════════════════ */}
      <section className="section-premium py-20 md:py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 cta-gold-glow pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="fade-up text-2xl md:text-3xl lg:text-4xl font-extrabold text-cream mb-4">
            ابدأ الآن. افهم قراراتك.
          </h2>
          <p className="fade-up text-cream/40 mb-10 text-lg">
            الخطوة الأولى نحو قرار واعٍ
          </p>
          <Link
            to="/analyze"
            className="fade-up btn-primary inline-flex items-center gap-2 text-lg px-12 py-4 rounded-xl"
          >
            ابدأ التحليل
            <ArrowUpRight size={22} />
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════ */}
      <footer className="bg-void-light py-10 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          {/* Trust row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center mb-8">
            {[
              { icon: '🇸🇦', label: 'صنع في السعودية' },
              { icon: '🎓', label: 'تحليل تعليمي', sub: 'ليس نصيحة مالية' },
              { icon: '🔤', label: 'عربي أولاً' },
              { icon: '🤖', label: 'ذكاء اصطناعي متقدم' },
              { icon: '🏆', label: 'PRO5 Ventures' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{item.icon}</span>
                <p className="text-cream/30 font-bold text-xs">{item.label}</p>
                {item.sub && <p className="text-cream/15 text-[10px]">{item.sub}</p>}
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-cream/15 text-xs leading-relaxed max-w-2xl mx-auto">
              هذه المنصة تقدم تحليلاً تعليمياً وتقييماً لجودة القرار المالي. لا تشكل نصيحة مالية أو توصية بالشراء أو البيع. جميع قرارات التداول يتخذها المستخدم بنفسه وعلى مسؤوليته الخاصة.
            </p>
            <p className="text-cream/10 text-xs mt-4">
              © {new Date().getFullYear()} THEEB MIND — PRO5 Ventures
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
