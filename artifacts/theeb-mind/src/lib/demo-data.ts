// ============================================
// DHEEB MINDSET — Demo Mode Mock Data
// ============================================
import type {
  AnalysisResult,
  VerificationResult,
  JournalEntry,
  AnalyticsResult,
} from './types';

// ── Scenario 1: Strong Chart Analysis ──
export const DEMO_CHART_ANALYSIS: AnalysisResult = {
  decisionId: 'demo-chart-001',
  analysis: {
    marketBias: 'bullish',
    marketBiasAr: 'صعودي',
    keyLevels: [18520, 18400, 18350],
    narrative:
      'هيكل سوق صعودي واضح مع توافق قوي — المنطقة المؤسسية محددة والفجوة السعرية مؤكدة الاتجاه. سحب السيولة حدث بنجاح والمتوسط المتحرك يدعم. نافذة نشاط السوق نشطة حالياً. ينقص فقط تأكيد إعادة التوازن الفوري.',
  },
  scoring: {
    grade: 'A+',
    score: 82,
    maxScore: 100,
    confidence: 87,
    confluence: [
      { name: 'institutionalZone', nameAr: 'منطقة مؤسسية', present: true, weight: 0.18, detail: 'منطقة مؤسسية صعودية واضحة على الإطار 4 ساعات' },
      { name: 'fairValueGap', nameAr: 'فجوة سعرية', present: true, weight: 0.16, detail: 'فجوة سعرية متوسطة الحجم ضمن الاتجاه الصعودي' },
      { name: 'liquiditySweep', nameAr: 'سحب سيولة', present: true, weight: 0.15, detail: 'سحب سيولة أدنى واضح قبل الارتداد' },
      { name: 'maAlignment', nameAr: 'توافق المتوسطات', present: true, weight: 0.14, detail: 'EMA 21 و 50 و 200 بصعود واضح' },
      { name: 'supportResistance', nameAr: 'مستويات واضحة', present: true, weight: 0.13, detail: 'دعم عند 18400 ومقاومة عند 18520' },
      { name: 'killzone', nameAr: 'نافذة نشاط السوق', present: true, weight: 0.12, detail: 'نيويورك صباحاً — نشطة حالياً' },
      { name: 'immediateRebalance', nameAr: 'إعادة توازن فوري', present: false, weight: 0.12, detail: 'لم يتضح تأكيد إعادة التوازن بعد' },
    ],
    warnings: [],
    gateVerdict: 'GO',
  },
  coaching: {
    message:
      'الانضباط أعلى من أي إشارة — حتى مع توافق قوي، لا تنسَ أن السوق لا يعترف بيقينك. ليندا راشكه تقول: "التداول الاستثماري الناجح لا يعتمد على أن تكون محقاً دائماً، بل على أن تخسر أقل عندما تخطئ". حافظ على وقف خسارة محدد مسبقاً ولا تزد حجم الصفقة لمجرد أن التوافق عالي.',
    suggestions: [
      'حدد وقف الخسارة قبل الدخول ولا تعدّله عاطفياً',
      'لا تزد الحجم بسبب الثقة العالية — التزم بخطة إدارة المخاطر',
      'راقب إعادة التوازن الفوري كفرصة تأكيد إضافية',
    ],
  },
  killzone: {
    name: 'New York AM',
    nameAr: 'نيويورك صباحاً',
    status: 'active',
  },
  timestamp: new Date().toISOString(),
};

// ── Scenario 2: Misleading Financial Content (realistic Arabic tweet) ──
export const DEMO_MISLEADING_TEXT =
  '🚨 فرصة ذهبية لا تتكرر! 🚀\n\nالخبير المالي المعتمد محمد الفالي يكشف السهم الذي سينفجر غداً بنسبة 300% — هذي ليست نصيحة، هذي حقيقة مؤكدة!\n\n✅ أكثر من 5,000 مستخدم انضموا لمجموعتنا الخاصة وحققوا أرباحاً مضمونة\n✅ أنا شخصياً جربت واستفدت 45,000 ريال في أسبوع واحد\n✅ العرض ينتهي خلال 24 ساعة فقط — بعدين لا تلومني إذا فاتتك الفرصة\n\n💸 لا تفوتها — الرابط في البايو 💸\n\n#تداول #أسهم_سعودية #ربح_مضمون #فرصة_ذهبية';

export const DEMO_VERIFICATION: VerificationResult = {
  credibilityLevel: 'مضلل',
  trustScore: 23,
  claims: [
    { text: 'ربح مضمون 300%', score: 12, category: 'guaranteed_returns', categoryAr: 'أرباح مضمونة', verified: false },
    { text: 'الخبير المالي المعتمد محمد الفالي', score: 22, category: 'fake_authority', categoryAr: 'سلطة مزيفة', verified: false },
    { text: 'أكثر من 5,000 مستخدم حققوا أرباحاً مضمونة', score: 18, category: 'social_proof', categoryAr: 'إثبات اجتماعي مزيف', verified: false },
    { text: 'العرض ينتهي خلال 24 ساعة فقط', score: 35, category: 'urgency', categoryAr: 'ضغط زمني', verified: false },
    { text: 'استفدت 45,000 ريال في أسبوع واحد', score: 10, category: 'unrealistic_pnl', categoryAr: 'أرباح غير واقعية', verified: false },
  ],
  manipulationPatterns: [
    { type: 'fomo', typeAr: 'لغة الخوف من فوات الفرصة', description: 'استخدام عبارات مثل "لا تتكرر" و "لا تفوتها" لخلق إحساس عاجل بالخوف من تفويت فرصة نادرة', severity: 'high' },
    { type: 'guaranteed_returns', typeAr: 'أرباح مضمونة', description: 'وعد بأرباح مضمونة بنسبة 300% — وهو أمر مستحيل في أسواق المال، وأي ادعاء بالربح المضمون هو علامة حمراء واضحة', severity: 'high' },
    { type: 'fake_authority', typeAr: 'سلطة مزيفة', description: 'ادعاء اعتماد خبير مالي دون تقديم أي دليل أو رقم تسجيل هيئة السوق المالية', severity: 'medium' },
    { type: 'urgency', typeAr: 'ضغط زمني مصطنع', description: 'تحديد مهلة 24 ساعة لضغط المتلقي على اتخاذ قرار سريع دون تفكير كافٍ', severity: 'medium' },
    { type: 'social_proof', typeAr: 'إثبات اجتماعي مزيف', description: 'ادعاء وجود 5,000 مستخدم راضين دون أي إثبات أو مراجعات يمكن التحقق منها', severity: 'medium' },
  ],
  summary:
    'المحتوى يحتوي على 5 أنماط تلاعب خطيرة تشمل وعد بأرباح مضمومة وخلق ضغط زمني مصطنع وادعاء سلطة مزيفة وإثبات اجتماعي غير قابل للتحقق. لا توجد أي مصادر موثوقة تدعم الادعاءات المذكورة. تجنب التصرف بناءً على هذا المحتوى تماماً.',
  verdict: {
    title: 'محتوى مشبوه',
    explanation:
      'يحتوي هذا المحتوى على أنماط تلاعب خطيرة — أرباح مضمونة، ضغط زمني، وسلطة مزيفة. تجنب التصرف بناءً على هذا المحتوى تماماً.',
  },
};

// ── Scenario 3: Journal Behavioral Insight ──
export const DEMO_JOURNAL: JournalEntry = {
  decisions: [
    makeDemoDecision('d1', 'MNQ', '5m', 'A+', 78, 'win', 45, -30),
    makeDemoDecision('d2', 'NQ', '15m', 'B', 55, 'loss', -30, -25),
    makeDemoDecision('d3', 'Gold', '1h', 'A', 72, 'win', 20, -20),
    makeDemoDecision('d4', 'MNQ', '5m', 'C', 40, 'loss', -55, -14),
    makeDemoDecision('d5', 'ES', '15m', 'A+', 82, 'win', 35, -9),
    makeDemoDecision('d6', 'NQ', '5m', 'B', 58, 'loss', -25, -5),
    makeDemoDecision('d7', 'MNQ', '1h', 'A', 70, 'win', 15, -2),
    makeDemoDecision('d8', 'Oil', '4h', 'B', 60, 'breakeven', 0, 0),
    makeDemoDecision('d9', 'Gold', '15m', 'A+', 85, 'win', 50, 3),
    makeDemoDecision('d10', 'MNQ', '5m', 'A', 68, 'win', 25, 7),
    makeDemoDecision('d11', 'ES', '1h', 'A+', 80, 'win', 40, 14),
    makeDemoDecision('d12', 'NQ', '15m', 'A', 75, 'win', 30, 21),
  ],
  total: 12,
  page: 1,
  limit: 20,
};

function makeDemoDecision(
  id: string,
  instrument: string,
  timeframe: string,
  grade: 'A+' | 'A' | 'B' | 'C' | 'NO_TRADE',
  score: number,
  outcome: 'win' | 'loss' | 'breakeven',
  pnl: number,
  daysAgo: number,
) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
  return {
    id,
    userId: 'user-1',
    type: 'chart_analysis' as const,
    instrument,
    timeframe: timeframe as '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    scoring: {
      grade,
      score,
      maxScore: 100,
      confidence: score > 70 ? 80 + Math.floor(Math.random() * 15) : 50 + Math.floor(Math.random() * 20),
      confluence: [
        { name: 'institutionalZone', nameAr: 'منطقة مؤسسية', present: grade !== 'C', weight: 0.18 },
        { name: 'fairValueGap', nameAr: 'فجوة سعرية', present: grade === 'A+' || grade === 'A', weight: 0.16 },
        { name: 'liquiditySweep', nameAr: 'سحب سيولة', present: grade === 'A+', weight: 0.15 },
        { name: 'maAlignment', nameAr: 'توافق المتوسطات', present: grade !== 'C', weight: 0.14 },
        { name: 'supportResistance', nameAr: 'مستويات واضحة', present: true, weight: 0.13 },
        { name: 'killzone', nameAr: 'نافذة نشاط السوق', present: outcome === 'win', weight: 0.12 },
        { name: 'immediateRebalance', nameAr: 'إعادة توازن فوري', present: grade === 'A+', weight: 0.12 },
      ],
      warnings: grade === 'C' ? ['الدخول خارج نافذة نشاط السوق', 'توافق ضعيف'] : [],
      gateVerdict: (grade === 'A+' || grade === 'A' ? 'GO' : grade === 'B' ? 'CAUTION' : 'STOP') as 'GO' | 'CAUTION' | 'STOP',
    },
    outcome,
    pnl,
    createdAt: d.toISOString(),
  };
}

// ── Analytics with realistic non-linear improvement ──
export const DEMO_ANALYTICS: AnalyticsResult = {
  totalDecisions: 12,
  winRate: 0.58,
  averageConfluence: 68.8,
  bestKillzone: 'new_york_am',
  bestKillzoneAr: 'نيويورك صباحاً',
  gradeDistribution: { 'A+': 4, A: 4, B: 3, C: 1, NO_TRADE: 0 },
  improvementTimeline: [
    { date: makeDate(-28), averageScore: 42 },
    { date: makeDate(-25), averageScore: 48 },
    { date: makeDate(-22), averageScore: 51 },
    { date: makeDate(-18), averageScore: 55 },
    { date: makeDate(-15), averageScore: 52 },    // slight dip
    { date: makeDate(-12), averageScore: 58 },
    { date: makeDate(-9), averageScore: 64 },
    { date: makeDate(-7), averageScore: 68 },
    { date: makeDate(-4), averageScore: 72 },
    { date: makeDate(-1), averageScore: 76 },
  ],
};

function makeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAgo);
  return d.toISOString().split('T')[0];
}