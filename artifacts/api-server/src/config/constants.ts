export const CONFIG = {
  MAX_TRADES: 2,
  MIN_RRR: 2.5,
  DAILY_LOSS_LIMIT: 600,
  MAX_RISK_PER_TRADE: 500,
  MAX_CONFLUENCE: 7,
  MIN_CONFLUENCE: 2,
  CONSEC_LOSS_LIMIT: 2,
  NO_TRADE_DAYS: [3, 5] as const,

  KILLZONES: {
    asian: { start: 0, end: 7, label: 'الآسيوية' },
    london: { start: 7, end: 12, label: 'اللندنية' },
    nyAM: { start: 12, end: 16, label: 'نيويورك صباحاً' },
    nyLunch: { start: 16, end: 19, label: 'نيويورك غداء' },
    nyPM: { start: 19, end: 24, label: 'نيويورك مساءً' },
  } as const,

  SCORING_WEIGHTS: {
    confluence: 0.35,
    gate: 0.25,
    rrr: 0.20,
    timing: 0.10,
    alignment: 0.10,
  } as const,

  VERIFY_THRESHOLDS: {
    credible: 75,
    suspicious: 40,
  } as const,

  MANIPULATION_PATTERNS: [
    'ضغط بيعي متزامن',
    'اختراق كاذب',
    'تلاعب بالأسعار',
    'أوامر خفية',
    'سيولة وهمية',
    'تأثير إعلامي',
    'تلاعب بسعر الافتتاح',
    'صيد وقف الخسارة',
    'هجوم مركزي',
    'ضخ وتفريغ',
  ] as const,
} as const;