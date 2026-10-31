// Risk / trading limits are NOT constants any more. They live in each user's versioned rules profile
// (risk_rules table, /api/ledger/rules). The old values (MAX_TRADES=2, MIN_RRR=2.5, DAILY_LOSS_LIMIT=600,
// MAX_RISK_PER_TRADE=500, CONSEC_LOSS_LIMIT=2, NO_TRADE_DAYS=[3,5]) are kept there as *historical* versions.
// Killzones: see config/killzones.ts (America/New_York, DST-aware).
export const CONFIG = {
  MAX_CONFLUENCE: 7,
  MIN_CONFLUENCE: 2,

  SCORING_WEIGHTS: {
    confluence: 0.35,
    gate: 0.25,
    rrr: 0.20,
    timing: 0.10,
    alignment: 0.10,
  } as const,

  // ── Unified Decision Quality Engine weights ────────────
  // Confluence 30%, Psychology 25%, Quality 25%, Safety 15%
  // AHA penalty applied on top (up to -20 pts)
  QUALITY_WEIGHTS: {
    confluence: 0.30,
    psychology: 0.25,
    quality:    0.25,
    safety:     0.15,
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