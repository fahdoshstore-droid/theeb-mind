export interface GateQuestion {
  id: number;
  phase: string;
  question: string;
  options: { label: string; score: number; isBlocker: boolean }[];
}

export const GATE_QUESTIONS: GateQuestion[] = [
  {
    id: 1,
    phase: 'pre_trade',
    question: 'هل لديك خطة تداول واضحة ومكتوبة لهذه الصفقة؟',
    options: [
      { label: 'نعم، خطة واضحة مع نقاط الدخول والخروج', score: 3, isBlocker: false },
      { label: 'عندي فكرة عامة بس مو مكتوبة', score: 1, isBlocker: false },
      { label: 'لا، أشوف الشارت وأدخل على حسب الإحساس', score: 0, isBlocker: true },
    ],
  },
  {
    id: 2,
    phase: 'pre_trade',
    question: 'ما هو الحالة النفسية الحالية لديك؟',
    options: [
      { label: 'هادي ومتركز — جاهز للتنفيذ', score: 3, isBlocker: false },
      { label: 'متوتر شوي بس أقدر أتحكم', score: 1, isBlocker: false },
      { label: 'عصبي أو خايف أو متحمس زيادة', score: 0, isBlocker: true },
    ],
  },
  {
    id: 3,
    phase: 'pre_trade',
    question: 'هل راجعت آخر 5 صفقات واستخلصت الدروس؟',
    options: [
      { label: 'نعم، راجعتها وكتبت ملاحظاتي', score: 2, isBlocker: false },
      { label: 'عندي فكرة بس ما كتبت شي', score: 1, isBlocker: false },
      { label: 'لا، ما راجعت', score: 0, isBlocker: false },
    ],
  },
  {
    id: 4,
    phase: 'entry',
    question: 'هل انتظرت تأكيد الشمعة أم تدخل على أمل؟',
    options: [
      { label: 'نتظرت الإغلاق والتأكيد', score: 3, isBlocker: false },
      { label: 'دخلت بنص شمعة بس الإشارة واضحة', score: 1, isBlocker: false },
      { label: 'دخلت فزعة أخاف يفوتني', score: 0, isBlocker: true },
    ],
  },
  {
    id: 5,
    phase: 'entry',
    question: 'هل حددت وقف الخسارة قبل الدخول؟',
    options: [
      { label: 'نعم، محدد ومكتوب', score: 3, isBlocker: false },
      { label: 'عندي منطقة تقريبية', score: 1, isBlocker: false },
      { label: 'لا، أشوف السوق وأقرر', score: 0, isBlocker: true },
    ],
  },
  {
    id: 6,
    phase: 'risk',
    question: 'هل المخاطرة ضمن الحد اليومي المسموح؟',
    options: [
      { label: 'نعم، أقل من الحد اليومي', score: 3, isBlocker: false },
      { label: 'على الحد بالضبط', score: 1, isBlocker: false },
      { label: 'تجاوزت الحد اليومي', score: 0, isBlocker: true },
    ],
  },
  {
    id: 7,
    phase: 'risk',
    question: 'ما هو حجم المركز مقارنة برأس المال؟',
    options: [
      { label: '1-2% من رأس المال — إدارة مخاطر ممتازة', score: 3, isBlocker: false },
      { label: '3-5% — مخاطر متوسطة', score: 1, isBlocker: false },
      { label: 'أكثر من 5% — مخاطرة مفرطة', score: 0, isBlocker: true },
    ],
  },
  {
    id: 8,
    phase: 'trade_management',
    question: ' هل عندك خطة واضحة لنقل الوقف إلى التعادل؟',
    options: [
      { label: 'نعم، عند المستوى الفلاني أنقل', score: 3, isBlocker: false },
      { label: 'أعرف المبدأ بس ما حددت مستوى', score: 1, isBlocker: false },
      { label: 'ما أفكر في نقل الوقف', score: 0, isBlocker: false },
    ],
  },
  {
    id: 9,
    phase: 'trade_management',
    question: 'هل يمكن أن تغير رأيك إذا تحرك السوق عكس توقعك؟',
    options: [
      { label: 'نعم، عندي خطة بديلة واضحة', score: 3, isBlocker: false },
      { label: 'أحاول بس أحياناً أتجمد', score: 1, isBlocker: false },
      { label: 'لا، أمسك الصفقة وأتوكل', score: 0, isBlocker: true },
    ],
  },
  {
    id: 10,
    phase: 'post_trade',
    question: 'هل ستسجل الصفقة في دفتر التداول بعد الانتهاء؟',
    options: [
      { label: 'أكيد، أسجل كل صفقة بالتفصيل', score: 2, isBlocker: false },
      { label: 'أحياناً أسجل بس مش دايم', score: 1, isBlocker: false },
      { label: 'لا، ما أسجل', score: 0, isBlocker: false },
    ],
  },
];