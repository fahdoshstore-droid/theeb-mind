// ============================================
// THEEB MIND — Frontend-Backend Adapters
// ============================================
// Maps every backend response shape to the exact
// frontend type expected by UI components.
// Zero changes needed in AnalyzeChart.tsx,
// Journal.tsx, or VerifyContent.tsx.
// ============================================

import type {
  AnalysisResult,
  VerificationResult,
  JournalEntry,
  AnalyticsResult,
  PsychologyState,
  GateResult,
  Decision,
  ConfluenceFactor,
  Grade,
  GateVerdict,
  MarketBias,
  KillzoneStatus,
  Outcome,
} from './types';

// ── Constants ──────────────────────────────────────────

const KILLZONE_AR_LABELS: Record<string, string> = {
  asian: 'الآسيوية',
  london: 'اللندنية',
  nyAM: 'نيويورك صباحاً',
  nyLunch: 'نيويورك غداء',
  nyPM: 'نيويورك مساءً',
};

const BIAS_MAP: Record<string, MarketBias> = {
  long: 'bullish',
  short: 'bearish',
  no_trade: 'neutral',
};

const BIAS_AR_MAP: Record<string, string> = {
  bullish: 'صعودي',
  bearish: 'هبوطي',
  neutral: 'محايد',
};

const CREDIBILITY_MAP: Record<string, 'موثوق' | 'يحتاج تحقق' | 'مضلل'> = {
  credible: 'موثوق',
  suspicious: 'يحتاج تحقق',
  rejected: 'مضلل',
};

const VERDICT_MAP: Record<string, GateVerdict> = {
  pass: 'GO',
  warning: 'CAUTION',
  fail: 'STOP',
};

const PHASE_MAP: Record<string, string> = {
  disciplined: 'calm',
  cautious: 'cautious',
  reckless: 'anxious',
};

const PHASE_AR_MAP: Record<string, string> = {
  calm: 'هادئ',
  cautious: 'حذر',
  anxious: 'متوتر',
};

const GRADE_SUGGESTIONS: Record<string, string[]> = {
  'A+': [
    'حدد وقف الخسارة قبل الدخول ولا تعدّله عاطفياً',
    'لا تزد الحجم بسبب الثقة العالية — التزم بخطة إدارة المخاطر',
    'راقب إعادة التوازن الفوري كفرصة تأكيد إضافية',
  ],
  'A': [
    'تأكد من إدارة المخاطر ونفذ بثقة',
    'انتظر تأكيد الشمعة قبل الدخول',
    'لا تتسرع — الإشارة الجيدة تحتاج توقيت جيد',
  ],
  'B': [
    'قلل حجم المركز — الإشارة متوسطة القوة',
    'كن مستعداً للخروج بسرعة إذا لم تثبت الإشارة',
    'انتظر إشارة أقوى إن أمكن',
  ],
  'C': [
    'الأفضل الانتظار لفرصة أوضح',
    'لا تدخل لمجرد الرغبة في التداول',
    'راجع معايير الدخول قبل الصفقة القادمة',
  ],
};

const CLAIM_CATEGORY_AR: Record<string, string> = {
  price_action: 'حركة السعر',
  pattern: 'نمط فني',
  fundamental: 'بيانات أساسية',
  sentiment: 'مشاعر السوق',
  manipulation: 'تلاعب',
};

const MANIPULATION_PATTERN_AR: Record<string, string> = {
  'ضغط بيعي متزامن': 'ضغط بيعي متزامن',
  'اختراق كاذب': 'اختراق كاذب',
  'تلاعب بالأسعار': 'تلاعب بالأسعار',
  'أوامر خفية': 'أوامر خفية',
  'سيولة وهمية': 'سيولة وهمية',
  'تأثير إعلامي': 'تأثير إعلامي',
  'تلاعب بسعر الافتتاح': 'تلاعب بسعر الافتتاح',
  'صيد وقف الخسارة': 'صيد وقف الخسارة',
  'هجوم مركزي': 'هجوم مركزي',
  'ضخ وتفريغ': 'ضخ وتفريغ',
};

// ── Helpers ────────────────────────────────────────────

function parseJsonSafe(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildConfluenceFactors(breakdown: Record<string, boolean> | null): ConfluenceFactor[] {
  const factorDefs: Array<{ name: string; nameAr: string; field: string; weight: number }> = [
    { name: 'institutionalZone', nameAr: 'منطقة مؤسسية', field: 'marketStructure', weight: 0.14 },
    { name: 'fairValueGap', nameAr: 'فجوة سعرية', field: 'fairValueGap', weight: 0.14 },
    { name: 'orderBlock', nameAr: 'كتلة أوامر', field: 'orderBlock', weight: 0.14 },
    { name: 'liquiditySweep', nameAr: 'سحب سيولة', field: 'liquiditySweep', weight: 0.29 },
    { name: 'killzone', nameAr: 'نافذة نشاط السوق', field: 'killzoneActive', weight: 0.14 },
    { name: 'immediateRebalance', nameAr: 'إعادة توازن فوري', field: 'immediateRebalance', weight: 0.14 },
    { name: 'maAlignment', nameAr: 'توافق المتوسطات', field: '', weight: 0 },
    { name: 'supportResistance', nameAr: 'مستويات واضحة', field: '', weight: 0 },
  ];

  return factorDefs.map((def) => {
    const present = def.field ? (breakdown?.[def.field] ?? false) : false;
    return {
      name: def.name,
      nameAr: def.nameAr,
      present,
      weight: def.weight,
      detail: present ? `${def.nameAr} — متوفر` : undefined,
    };
  });
}

function buildWarnings(
  factors: ConfluenceFactor[],
  dayBlocked: boolean,
  newsBlackout: boolean,
): string[] {
  const warnings: string[] = [];
  const missing = factors.filter((f) => !f.present && f.weight > 0);
  if (missing.length > 0) {
    warnings.push(`عوامل ناقصة: ${missing.map((f) => f.nameAr).join('، ')}`);
  }
  if (dayBlocked) warnings.push('اليوم ضمن أيام منع التداول');
  if (newsBlackout) warnings.push('تعليق أخباري — تجنب التداول');
  return warnings;
}

// ── Adapter 1: AnalysisResult ──────────────────────────

export function adaptAnalysisResult(raw: any): AnalysisResult {
  const confluenceBreakdown = raw.confluence?.confluenceBreakdown ?? null;
  const factors = buildConfluenceFactors(confluenceBreakdown);
  const visionJson = parseJsonSafe(raw.analysisJson);

  const marketBias: MarketBias = BIAS_MAP[raw.type] ?? 'neutral';

  return {
    decisionId: raw.decisionId ?? '',
    analysis: {
      marketBias,
      marketBiasAr: BIAS_AR_MAP[marketBias] ?? 'محايد',
      keyLevels: visionJson
        ? [visionJson.stopLoss, visionJson.takeProfit, visionJson.entry].filter(
            (v: any) => v != null,
          )
        : [],
      narrative: raw.confluence?.confluenceExplanation ?? '',
    },
    scoring: {
      grade: (raw.quality?.grade ?? raw.grade ?? 'C') as Grade,
      score: raw.quality?.totalScore ?? raw.qualityScore ?? 0,
      maxScore: 100,
      confidence: visionJson?.confidence ?? raw.quality?.totalScore ?? 50,
      confluence: factors,
      warnings: buildWarnings(factors, raw.dayBlocked ?? false, raw.newsBlackout ?? false),
      gateVerdict: VERDICT_MAP[raw.psychology?.verdict] ?? 'CAUTION',
    },
    coaching: {
      message: raw.coachingMessage ?? '',
      suggestions: GRADE_SUGGESTIONS[raw.quality?.grade ?? raw.grade] ?? [],
    },
    killzone: raw.killzone
      ? {
          name: raw.killzone.key ?? raw.killzone,
          nameAr: raw.killzone.label ?? KILLZONE_AR_LABELS[raw.killzone.key] ?? raw.killzone,
          status: 'active' as KillzoneStatus,
        }
      : { name: 'none', nameAr: 'خارج النافذة', status: 'inactive' as KillzoneStatus },
    timestamp: raw.timestamp ?? new Date().toISOString(),
  };
}

// ── Adapter 2: VerificationResult ──────────────────────

export function adaptVerificationResult(raw: any): VerificationResult {
  const credibilityLevel = CREDIBILITY_MAP[raw.credibility] ?? 'يحتاج تحقق';

  // Map claims if backend returns them, otherwise build from aggregate counts
  const claims = Array.isArray(raw.claims)
    ? raw.claims.map((c: any) => ({
        text: c.text ?? '',
        score: c.confidence ?? 50,
        category: c.category ?? 'sentiment',
        categoryAr: CLAIM_CATEGORY_AR[c.category] ?? 'مشاعر السوق',
        verified: c.verified ?? false,
      }))
    : [];

  // Map manipulation flags to pattern objects
  const manipulationPatterns = Array.isArray(raw.manipulationFlags)
    ? raw.manipulationFlags.map((flag: string) => ({
        type: flag,
        typeAr: MANIPULATION_PATTERN_AR[flag] ?? flag,
        description: `نمط تلاعب مكتشف: ${flag}`,
        severity: 'medium' as 'low' | 'medium' | 'high',
      }))
    : [];

  return {
    credibilityLevel,
    trustScore: raw.credibilityScore ?? 0,
    claims,
    manipulationPatterns,
    summary: raw.explanation ?? '',
    verdict: {
      title: raw.verdict ?? '',
      explanation: raw.explanation ?? '',
    },
  };
}

// ── Adapter 3: Decision (single) ────────────────────────

export function adaptDecision(raw: any): Decision {
  const scoringJson = parseJsonSafe(raw.scoringJson);
  const confluenceBreakdown = scoringJson?.breakdown ?? null;
  const factors = buildConfluenceFactors(confluenceBreakdown);
  const psychologyJson = parseJsonSafe(raw.psychologyJson);
  const visionJson = parseJsonSafe(raw.analysisJson);

  return {
    id: raw.id ?? '',
    userId: raw.userId ?? raw.user_id ?? '',
    type: 'chart_analysis' as const,
    instrument: raw.instrument ?? undefined,
    timeframe: raw.timeframe ?? undefined,
    scoring: {
      grade: (raw.grade ?? 'C') as Grade,
      score: raw.qualityScore ?? 0,
      maxScore: 100,
      confidence: visionJson?.confidence ?? raw.qualityScore ?? 50,
      confluence: factors,
      warnings: buildWarnings(factors, raw.dayBlocked ?? false, raw.newsBlackout ?? false),
      gateVerdict: VERDICT_MAP[psychologyJson?.verdict] ?? 'CAUTION',
    },
    outcome: (raw.outcome as Outcome) ?? undefined,
    pnl: raw.outcomePnl ?? undefined,
    createdAt: raw.createdAt ?? raw.created_at ?? '',
  };
}

// ── Adapter 4: JournalEntry ─────────────────────────────

export function adaptJournal(raw: any): JournalEntry {
  const decisions: Decision[] = Array.isArray(raw.decisions)
    ? raw.decisions.map(adaptDecision)
    : [];

  return {
    decisions,
    total: decisions.length,
    page: 1,
    limit: decisions.length,
  };
}

// ── Adapter 5: AnalyticsResult ──────────────────────────

export function adaptAnalytics(raw: any): AnalyticsResult {
  return {
    totalDecisions: raw.totalTrades ?? 0,
    winRate: (raw.winRate ?? 0) / 100, // backend returns 0-100, frontend expects 0-1
    averageConfluence: raw.avgConfluence ?? 0,
    bestKillzone: raw.bestKillzone ?? '',
    bestKillzoneAr: raw.bestKillzone
      ? KILLZONE_AR_LABELS[raw.bestKillzone] ?? raw.bestKillzone
      : '',
    gradeDistribution: (raw.gradeDistribution ?? {}) as Record<Grade, number>,
    improvementTimeline: [], // backend has no timeline — sparkline hidden safely
  };
}

// ── Adapter 6: PsychologyState ──────────────────────────

export function adaptPsychologyState(raw: any): PsychologyState {
  const phase = raw.phase ?? 'cautious';
  const emotionalState = PHASE_MAP[phase] ?? 'cautious';

  return {
    userId: raw.userId ?? raw.user_id ?? '',
    emotionalState,
    emotionalStateAr: PHASE_AR_MAP[emotionalState] ?? 'حذر',
    confidence: raw.score ?? 50,
    riskTolerance: raw.verdict === 'pass' ? 'low' : raw.verdict === 'fail' ? 'high' : 'medium',
    recentCheckin: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    recommendations:
      phase === 'disciplined'
        ? ['حافظ على هدوئك — لا تتخذ قرارات متسرعة', 'التزم بخطة التداول المحددة مسبقاً']
        : phase === 'reckless'
          ? ['توقف عن التداول فوراً — حالتك النفسية غير مستقرة', 'راجع أسباب الخسائر الأخيرة']
          : ['خذ استراحة قصيرة قبل الدخول', 'تأكد من جاهزيتك النفسية قبل أي صفقة'],
  };
}

// ── Adapter 7: GateResult ───────────────────────────────

export function adaptGateResult(raw: any): GateResult {
  const verdict: GateVerdict = VERDICT_MAP[raw.verdict] ?? 'CAUTION';
  const msgMap: Record<GateVerdict, string> = {
    GO: 'أنت جاهز — توافق عالي وحالة نفسية مستقرة',
    CAUTION: 'تنبيه — هناك بعض العوامل التي تحتاج مراجعة',
    STOP: 'غير جاهز — لا تتداول الآن حالة نفسية غير مستقرة',
  };

  return {
    verdict,
    score: raw.score ?? raw.percentage ?? 0,
    message: msgMap[verdict],
    messageAr: msgMap[verdict],
    details: raw.answers
      ? raw.answers.map(
          (a: any) =>
            `${a.question}: ${a.isBlocker ? '⚠️ حاجز' : '✓'} (${a.score} نقطة)`,
        )
      : [],
  };
}
