// ADA2AI — Dashboard & Capability Competitive Benchmark — executive deck generator
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

// ───────────────────────── CAPABILITY SCORES ─────────────────────────
// The source report (ADA2AI_Dashboard_Capability_Benchmark_2026-11-02.md) was NOT
// available in the build session. Do NOT estimate. Paste the report's 0–5 scores here,
// keeping "N/A" and "U" exactly. null = awaiting source.
const PRODUCTS = ["Wyscout", "DataMB", "Grintafy", "Grinta Rush", "Veo", "Ada2AI"];
const DIMENSIONS = [
  "Player Profiles", "Statistical Comparison", "Scouting Search", "Recruitment Workflow",
  "Video Library", "Events & Tagging", "Physical Tracking", "Match Replay", "Player Comparison",
  "Longitudinal Development", "Coach Workspace", "Academy Operations", "AI Assistant",
  "API Integrations", "Arabic-First Experience",
];
const SCORES = Object.fromEntries(DIMENSIONS.map((d) => [d, PRODUCTS.map(() => null)]));
const SCORES_AVAILABLE = Object.values(SCORES).some((r) => r.some((v) => v !== null));

// ───────────────────────── THEME ─────────────────────────
const THEME = {
  name: "ADA2AI Executive",
  headFontFace: "Cairo",
  bodyFontFace: "Cairo",
  colors: {
    dk1: "000A0F", lt1: "FFFFFF", dk2: "0D1C23", lt2: "EEEFEE",
    accent1: "00DCC8", accent2: "2E8C84", accent3: "7F8C92", accent4: "F2A93B",
    accent5: "E5484D", accent6: "007ABA", hlink: "00DCC8", folHlink: "7F8C92",
  },
};
const HEX = { bg: "000A0F", panel: "0D1C23", line: "1F343D" };

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "ADA2AI — Dashboard & Capability Competitive Benchmark";
pres.subject = "Executive Product & Technology Assessment — 2 November 2026";
pres.author = "ADA2AI";
pres.company = "ADA2AI";
pres.rtlMode = true;
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const BG = C.text1, PANEL = C.text2, WHITE = C.background1, SOFT = C.background2;
const TEAL = C.accent1, MTEAL = C.accent2, GREY = C.accent3, AMBER = C.accent4, RED = C.accent5, BLUE = C.accent6;
const W = 13.333, M = 0.6, CW = W - 2 * M;
const LOGO = __dirname + "/logo.png";
const PITCH = __dirname + "/pitch.png";
const FOOT = "ADA2AI  ·  Dashboard & Capability Benchmark  ·  2 Nov 2026";

// ───────────────────────── LAYOUTS ─────────────────────────
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.bg },
  objects: [
    { image: { path: LOGO, x: M, y: 6.98, w: 0.26, h: 0.26 } },
    { text: { text: FOOT, options: { x: M + 0.36, y: 6.98, w: 6, h: 0.26, fontFace: "Orbitron", fontSize: 8, color: "7F8C92", margin: 0, valign: "middle", align: "left" } } },
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.32, w: CW, h: 0.3, fontFace: "Orbitron", fontSize: 10, bold: true, color: "00DCC8", align: "right", margin: 0, rtlMode: false }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.62, w: CW, h: 0.8, fontFace: "Cairo", fontSize: 30, bold: true, color: "FFFFFF", align: "right", valign: "top", margin: 0, rtlMode: true, lang: "ar-SA" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.26, fontFace: "Orbitron", fontSize: 8, color: "7F8C92", align: "right" },
});
pres.defineSlideMaster({
  title: "HERO",
  background: { path: PITCH },
  objects: [],
});

// ───────────────────────── HELPERS ─────────────────────────
const AR = { rtlMode: true, lang: "ar-SA", align: "right", valign: "top", margin: 0, isTextBox: true, fontFace: "Cairo" };
function t(s, text, o) { s.addText(text, Object.assign({}, AR, { fontSize: 14, color: WHITE }, o)); }
function en(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: "Orbitron", fontSize: 14, color: TEAL, align: "right", valign: "top" }, o)); }
function rect(s, x, y, w, h, fill, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ x, y, w, h, rectRadius: 0.06, fill: { color: fill, transparency: o.tr || 0 }, line: o.line ? { color: o.line, width: o.lw || 1 } : { type: "none" } }, o.name ? { objectName: o.name } : {}));
}
function pill(s, text, x, y, w, color, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: o.h || 0.32, rectRadius: 0.16, fill: { color, transparency: o.tr ?? 82 }, line: { color, width: 1 } });
  s.addText(text, Object.assign({}, AR, { x, y, w, h: o.h || 0.32, align: "center", valign: "middle", fontSize: o.size || 11, bold: true, color: o.tc || color, fontFace: o.font || "Cairo" }));
}
function foot(s, text) { t(s, text, { x: M, y: 6.55, w: CW, h: 0.34, fontSize: 10, color: GREY, valign: "bottom" }); }
function arrowL(s, x, y, w, color = TEAL) { s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: 1.5, beginArrowType: "triangle" } }); }
function arrowD(s, x, y, h, color = TEAL) { s.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color, width: 1.5, endArrowType: "triangle" } }); }
function slide(section, kicker, title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  s.addNotes(notes);
  return s;
}
const SRC_REPORT = "المصدر: ADA2AI_Dashboard_Capability_Benchmark_2026-11-02.md";
const SRC_CODE = "Ada2AI GitHub main @31a060b";

// ═══════════════════ SECTION 01 — EXECUTIVE VERDICT ═══════════════════
const S1 = "01 · الحكم التنفيذي";
pres.addSection({ title: S1 });

// 1 — Cover
{
  const s = pres.addSlide({ masterName: "HERO", sectionTitle: S1 });
  s.addImage({ path: LOGO, x: W - M - 0.9, y: 0.7, w: 0.9, h: 0.9 });
  s.addText([
    { text: "ADA", options: { color: WHITE } }, { text: "2", options: { color: TEAL } }, { text: "AI", options: { color: WHITE } },
  ], { isTextBox: true, x: M, y: 1.8, w: CW, h: 1.1, fontFace: "Orbitron", fontSize: 66, bold: true, align: "right", margin: 0 });
  en(s, "Dashboard & Capability Competitive Benchmark", { x: M, y: 3.0, w: CW, h: 0.6, fontSize: 26, color: WHITE, bold: true });
  en(s, "Executive Product & Technology Assessment", { x: M, y: 3.6, w: CW, h: 0.45, fontSize: 16, color: TEAL });
  t(s, "تقييم تنفيذي للمنتج والتقنية — مقارنة لوحات التحكم والقدرات مع المنافسين", { x: M, y: 4.2, w: CW, h: 0.5, fontSize: 18, color: SOFT });
  en(s, "2 NOVEMBER 2026", { x: M, y: 6.3, w: 5, h: 0.35, fontSize: 12, color: GREY });
  t(s, "وثيقة قرار تنفيذية — ليست مادة تسويقية", { x: W - M - 6, y: 6.3, w: 6, h: 0.35, fontSize: 12, color: GREY });
  s.addNotes(
    "الافتتاح: هذا العرض تقييم تنفيذي لمنصة Ada2AI مقارنةً بخمسة مراجع في السوق، أُعدّ بتاريخ 2 نوفمبر 2026.\n" +
    "الهدف ليس إظهار Ada2AI أقوى مما هي عليه، بل توضيح أين تقف فعلياً، وأين يمكن أن تفوز، وما الذي يهدد مصداقيتها، وما القرارات المطلوبة الآن.\n" +
    "المصدر الأساسي هو تقرير ADA2AI_Dashboard_Capability_Benchmark_2026-11-02 إلى جانب فحص الكود ولقطة قاعدة البيانات الحية.\n" +
    "نطلب من الحضور في نهاية العرض الموافقة على خمسة قرارات واضحة."
  );
}

// 2 — Executive verdict
{
  const s = slide(S1, "01 · EXECUTIVE VERDICT", "أساس منتج قابل للاستخدام — لكن صفة «منصة ذكاء كروي مؤتمتة» لم تثبت بعد",
    "الرسالة الرئيسية: لدى Ada2AI أساس منتج حقيقي يمكن البناء عليه، لكن لم يثبت بعد أنها منصة ذكاء كروي مؤتمتة بالكامل.\n" +
    "الدليل: الكود يحتوي لوحات تحكم حسب الدور (لاعب، مدرب، كشاف، منظمات) ونماذج تقييم ورفع فيديو. لكن لقطة قاعدة البيانات في 2 نوفمبر 2026 تُظهر 0 سجلات في video_analyses و0 في reports و0 في matches، وجدول evaluations غير موجود في القاعدة الحية، ولا يوجد دليل تشغيل مستقل لخط YOLO/FastAPI.\n" +
    "الأهمية: الخلط بين «موجود في الكود» و«مثبت تشغيلياً» هو أكبر خطر على المصداقية أمام المستثمرين والأكاديميات.\n" +
    "القرار المقترح: نتواصل خارجياً بما هو مثبت فقط، ونصنّف كل ما عداه كمرحلة تجريبية حتى يتم التحقق منه.");
  const cols = [
    { h: "ما هو موجود", e: "EXISTS IN CODE", c: TEAL, tag: "موجود", items: ["لوحات تحكم حسب الدور: لاعب، مدرب، كشاف، منظمات", "ملف اللاعب ونموذج تقييم المدرب", "رفع الفيديو ومساحة عمل المدرب", "بحث الكشاف وتصفية المراكز", "واجهة عربية RTL"] },
    { h: "ما هو مثبت تشغيلياً", e: "OPERATIONALLY PROVEN", c: AMBER, tag: "محدود", items: ["5 ملفات profiles و5 لاعبين و1 مدرب في القاعدة الحية", "31 سجلاً في sport_identities", "2 سجل في football_coach_players", "لا توجد مباريات أو تقارير أو تحليلات فيديو مسجّلة (0)"] },
    { h: "ما لم يُتحقق منه", e: "NOT VERIFIED", c: RED, tag: "غير مثبت", items: ["خط YOLO / FastAPI في بيئة الإنتاج", "سجل تقييم يعمل على القاعدة الحية", "تطوّر اللاعب عبر الزمن", "عزل بيانات الأكاديميات (Tenant Isolation)", "دقة أي مخرجات AI مقابل Ground Truth"] },
  ];
  const cw = (CW - 0.6) / 3;
  cols.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.3, y = 1.75;
    rect(s, x, y, cw, 3.9, PANEL, { line: c.c, lw: 1 });
    en(s, c.e, { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.3, fontSize: 10, color: c.c, bold: true });
    t(s, c.h, { x: x + 0.3, y: y + 0.55, w: cw - 0.6, h: 0.5, fontSize: 20, bold: true });
    s.addText(c.items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < c.items.length - 1 } })),
      Object.assign({}, AR, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 3.1, fontSize: 14, color: SOFT, paraSpaceAfter: 6 }));
  });
  foot(s, SRC_REPORT + " · لقطة Supabase بتاريخ 2 نوفمبر 2026 · " + SRC_CODE);
}

// 3 — Executive summary (six questions)
{
  const s = slide(S1, "01 · EXECUTIVE SUMMARY", "الملخص التنفيذي — إجابات الأسئلة الستة",
    "هذه الشريحة تلخّص العرض كاملاً في ست إجابات. إذا لم يتوفر وقت إلا لشريحة واحدة فهذه هي.\n" +
    "النقطة الجوهرية: المنافسون الخمسة ليسوا من فئة واحدة، وVeo تحديداً يقدّم بالفعل تحليل فيديو وتتبع AI للأكاديميات؛ لذلك لا يمكن لـ Ada2AI التميّز بمجرد رفع الفيديو أو مصطلحات الذكاء الاصطناعي.\n" +
    "مساحة الفوز المقترحة: تشغيل تطوير اللاعبين في الأكاديميات بالعربية أولاً — ربط ملف اللاعب بتقييم المدرب ودليل الفيديو والتطور عبر الزمن.\n" +
    "القرار: الموافقة على أولوية الأمان والهوية قبل أي توسع، وتشغيل تجربة مع أكاديمية واحدة.");
  const rows = [
    ["كيف نقارن بالمنافسين؟", "المنافسون يغطّون فئات مختلفة؛ Ada2AI أقرب إلى «عمليات الأكاديمية» لكنها لم تصل لنضج أي منهم في فئته."],
    ["ما نضج لوحات التحكم؟", "هيكل حسب الدور موجود في الكود؛ التشغيل الفعلي محدود جداً في القاعدة الحية."],
    ["ما الذي نملكه فعلاً اليوم؟", "ملفات لاعبين، نموذج تقييم بشري، بحث كشاف، مساحة عمل مدرب، واجهة عربية."],
    ["ما الفجوات الحرجة؟", "تعرّض بيانات عبر سياسات عامة، عدم تطابق الهوية في الرفع، غياب جدول evaluations."],
    ["أين يمكن أن نتميّز؟", "تطوير اللاعب في الأكاديمية بالعربية: تقييم + دليل فيديو + سجل تطور."],
    ["ماذا نقرّر؟", "أمان أولاً، إصلاح عقود الهوية والتقييم، CV تجريبي، تجربة أكاديمية واحدة، مسار نشر واحد."],
  ];
  rows.forEach((r, i) => {
    const y = 1.7 + i * 0.78;
    rect(s, M, y, CW, 0.66, PANEL);
    en(s, String(i + 1).padStart(2, "0"), { x: W - M - 0.7, y, w: 0.5, h: 0.66, fontSize: 16, bold: true, valign: "middle" });
    t(s, r[0], { x: W - M - 4.0, y, w: 3.2, h: 0.66, fontSize: 15, bold: true, valign: "middle" });
    t(s, r[1], { x: M + 0.25, y, w: CW - 4.6, h: 0.66, fontSize: 14, color: SOFT, valign: "middle" });
  });
  foot(s, SRC_REPORT);
}

// 4 — Five critical discoveries
{
  const s = slide(S1, "01 · FIVE CRITICAL DISCOVERIES", "خمسة اكتشافات حرجة",
    "الاكتشافات الخمسة مرتبة حسب الخطورة.\n" +
    "1) جدول evaluations غير موجود في القاعدة الحية رغم أن الكود يستدعيه — أي أن سجل التقييم لا يمكن أن يعمل كما هو مصمم.\n" +
    "2) عدم تطابق الهوية في رفع الفيديو: المسار يستخدم players.id بينما سياسة التخزين تتوقع auth.uid().\n" +
    "3) حاوية player-media عامة مع سياسات قراءة وكتابة واسعة. هذا تعرّض محتمل ناتج عن الإعدادات، وليس اختراقاً مؤكداً — يجب أن نكون دقيقين في هذا التعبير.\n" +
    "4) المقارنة بين لاعبين وتصدير PDF غير مكتملين.\n" +
    "5) لا يوجد دليل تشغيل مستقل لخط YOLO/FastAPI في الإنتاج.\n" +
    "ملاحظة: مستويات الخطورة هنا هي تقدير هذا العرض بناءً على الأثر الموصوف في التقرير.\n" +
    "القرار: البندان 2 و3 يجب إغلاقهما قبل أي عرض تجاري أو توسع.");
  const items = [
    ["CRITICAL", RED, "جدول evaluations غير موجود في القاعدة الحية", "الكود يسترجع التقييمات، لكن الجدول غير موجود في Supabase — لا سجل تقييم فعلي."],
    ["CRITICAL", RED, "عدم تطابق هوية Player / Profile / Auth في رفع الفيديو", "الملف قد يُرفع بينما لا يُسجَّل التحليل — فشل صامت."],
    ["CRITICAL", RED, "حاوية player-media عامة وسياسات وصول واسعة", "تعرّض محتمل من الإعدادات — ليس اختراقاً مؤكداً."],
    ["HIGH", AMBER, "لا تحقق مستقل من خط YOLO / FastAPI في الإنتاج", "لا يجوز تسويق قدرات CV كقدرات تشغيلية."],
    ["MEDIUM", GREY, "مقارنة اللاعبين وتصدير PDF غير مكتملين", "مسار /compare غير مسجّل، وزر PDF يعرض «قريباً»."],
  ];
  items.forEach((it, i) => {
    const y = 1.68 + i * 0.95;
    rect(s, M, y, CW, 0.82, PANEL);
    en(s, String(i + 1), { x: W - M - 0.65, y, w: 0.45, h: 0.82, fontSize: 24, bold: true, valign: "middle", color: it[1] });
    t(s, it[2], { x: W - M - 7.4, y: y + 0.08, w: 6.6, h: 0.38, fontSize: 16, bold: true });
    t(s, it[3], { x: W - M - 7.4, y: y + 0.44, w: 6.6, h: 0.32, fontSize: 13, color: SOFT });
    pill(s, it[0], M + 0.3, y + 0.25, 1.4, it[1], { font: "Orbitron", size: 10 });
  });
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/App.tsx · src/hooks/useMediaUpload.ts · src/pages/ScoutDashboard.tsx) · الخطورة: تقدير هذا العرض");
}

// ═══════════════════ SECTION 02 — COMPETITIVE LANDSCAPE ═══════════════════
const S2 = "02 · المشهد التنافسي";
pres.addSection({ title: S2 });

// 5 — Ecosystem
{
  const s = slide(S2, "02 · COMPETITIVE ECOSYSTEM", "خمسة مراجع — خمس فئات منتجات مختلفة",
    "الفكرة الأساسية: المراجع الخمسة ليست منتجات متطابقة، ولا يصح ترتيبها في قائمة واحدة.\n" +
    "Wyscout للكشف والاستقطاب الاحترافي، DataMB للذكاء الإحصائي، Grintafy لاكتشاف المواهب والمشاركة، Grinta Rush صيغة تقييم ميداني، وVeo تحليل الفيديو للأكاديميات.\n" +
    "الأهمية: كل مرجع يعلّمنا درساً مختلفاً، والمقارنة يجب أن تكون حسب الفئة لا حسب ترتيب عام.\n" +
    "التطبيق على Ada2AI: علينا اختيار فئة نفوز فيها بدل محاولة تقليد الجميع.");
  const comps = [
    ["Hudl Wyscout", "الكشف والاستقطاب الاحترافي", "Professional Scouting"],
    ["DataMB", "الذكاء الإحصائي الكروي", "Statistical Intelligence"],
    ["Grintafy", "اكتشاف المواهب والمشاركة", "Talent Discovery"],
    ["Grinta Rush", "تجربة تقييم ميداني", "Field-Based Assessment"],
    ["Veo", "تحليلات الأكاديمية عبر الفيديو", "Video-First Academy Analytics"],
  ];
  const cw = (CW - 4 * 0.25) / 5;
  comps.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.25, y = 1.9;
    rect(s, x, y, cw, 3.6, PANEL, { line: HEX.line });
    s.addShape(pres.shapes.OVAL, { x: x + cw / 2 - 0.35, y: y + 0.35, w: 0.7, h: 0.7, fill: { color: TEAL, transparency: 85 }, line: { color: TEAL, width: 1 } });
    en(s, String(i + 1).padStart(2, "0"), { x: x + cw / 2 - 0.35, y: y + 0.35, w: 0.7, h: 0.7, fontSize: 14, bold: true, align: "center", valign: "middle" });
    en(s, c[0], { x: x + 0.15, y: y + 1.3, w: cw - 0.3, h: 0.45, fontSize: 14, bold: true, color: WHITE, align: "center" });
    t(s, c[1], { x: x + 0.15, y: y + 1.85, w: cw - 0.3, h: 0.8, fontSize: 15, bold: true, align: "center", color: SOFT });
    en(s, c[2], { x: x + 0.15, y: y + 2.75, w: cw - 0.3, h: 0.5, fontSize: 9, align: "center", color: TEAL });
  });
  rect(s, M, 5.8, CW, 0.62, TEAL, { tr: 88, line: TEAL });
  t(s, "لا نرتّب هذه المنتجات في تصنيف واحد — كل منها يُقاس ضمن فئته", { x: M + 0.3, y: 5.8, w: CW - 0.6, h: 0.62, fontSize: 16, bold: true, valign: "middle", align: "center", color: TEAL });
  foot(s, SRC_REPORT + " · المواد الرسمية العامة للمنافسين كما وردت في سجل مصادر التقرير");
}

// Competitor profile helper
function competitor(kicker, name, positionAr, positionEn, features, lesson, notes, extra) {
  const s = slide(S2, kicker, name + " — " + positionAr, notes);
  en(s, positionEn.toUpperCase(), { x: M, y: 1.5, w: CW, h: 0.3, fontSize: 11, color: GREY });
  // features grid on the right (RTL reading start)
  const gx = W - M - 7.2, gw = 7.2, cols = 2, cellW = (gw - 0.25) / cols, cellH = 0.62;
  features.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = gx + gw - (col + 1) * cellW - col * 0.25, y = 2.0 + row * (cellH + 0.18);
    rect(s, x, y, cellW, cellH, PANEL, { line: HEX.line });
    s.addShape(pres.shapes.OVAL, { x: x + cellW - 0.38, y: y + cellH / 2 - 0.09, w: 0.18, h: 0.18, fill: { color: TEAL }, line: { type: "none" } });
    t(s, f, { x: x + 0.2, y, w: cellW - 0.7, h: cellH, fontSize: 14, valign: "middle" });
  });
  // lesson panel on the left
  const lx = M, lw = CW - gw - 0.4;
  rect(s, lx, 2.0, lw, extra ? 2.6 : 4.2, TEAL, { tr: 90, line: TEAL });
  en(s, "KEY LESSON", { x: lx + 0.3, y: 2.25, w: lw - 0.6, h: 0.3, fontSize: 10, bold: true });
  t(s, lesson, { x: lx + 0.3, y: 2.65, w: lw - 0.6, h: extra ? 1.8 : 3.3, fontSize: 18, bold: true });
  if (extra) extra(s, lx, lw);
  return s;
}

// 6 — Wyscout
{
  const s = competitor("02 · BENCHMARK 01", "Hudl Wyscout", "الكشف والاستقطاب الاحترافي", "Professional Scouting & Recruitment Intelligence",
    ["مكتبة فيديو عالمية", "بحث عن اللاعبين والفرق", "فيديو موسوم بالأحداث (Event-tagged)", "قوائم مختصرة (Shortlists)", "تقارير كشفية", "سير عمل الاستقطاب", "API وتكاملات"],
    "القيمة ليست في أي ميزة منفردة، بل في سير العمل المتصل: من البحث عن اللاعب ← إلى دليل الفيديو ← إلى قرار الاستقطاب.",
    "Wyscout هو المرجع في الكشف الاحترافي. قوته في ربط البحث بالفيديو الموسوم بالأحداث ثم بالقوائم المختصرة والتقارير وصولاً لقرار التعاقد.\n" +
    "الدليل: المواد الرسمية العامة كما وردت في التقرير؛ لم نختبر المنتج من الداخل.\n" +
    "الدرس لـ Ada2AI: لا تبنِ شاشات منفصلة؛ ابنِ سلسلة متصلة من الدليل إلى القرار. هذا ما نقترحه لاحقاً: دليل ← تقييم ← تطوير ← قرار.\n" +
    "لا نقترح منافسة Wyscout في سوق الكشف الاحترافي العالمي.",
    (s, lx, lw) => { rect(s, lx, 4.85, lw, 1.35, PANEL, { line: HEX.line }); t(s, "لـ Ada2AI: لا ننافس في الكشف الاحترافي العالمي — نتعلّم ربط الدليل بالقرار", { x: lx + 0.3, y: 4.85, w: lw - 0.6, h: 1.35, fontSize: 14, bold: true, valign: "middle", color: SOFT }); });
  foot(s, SRC_REPORT + " · المواد الرسمية لـ Hudl Wyscout (hudl.com) — وفق سجل مصادر التقرير");
}

// 7 — DataMB
{
  const s = competitor("02 · BENCHMARK 02", "DataMB", "الذكاء الإحصائي الكروي", "Statistical Football Intelligence",
    ["Radar", "Rank", "Plot", "Index", "أدوات الكشف (Scout tools)", "DataMB Chat"],
    "المقياس لا يكون مفيداً إلا إذا كان تعريفه وسياقه وحجم العينة ومجموعة المقارنة واضحة.",
    "DataMB نموذج للذكاء الإحصائي: تغطية واسعة ومقاييس كثيرة وأدوات عرض مثل Radar وRank وPlot وIndex.\n" +
    "الأرقام: 55 دوري، أكثر من 120 مقياس، وأكثر من 5 ملايين نقطة بيانات — كما وردت في الدليل الرسمي للشركة، ولم نتحقق منها بشكل مستقل.\n" +
    "الدرس لـ Ada2AI: أي رقم نعرضه للمدرب أو الكشاف يجب أن يحمل تعريفاً ومصدراً وسياقاً. وهذا يقودنا إلى مبدأ «مصدر المقياس» (Metric Provenance) في لوحة المدرب.",
    (s, lx, lw) => {
      const stats = [["55", "دوري"], ["120+", "مقياس"], ["5M+", "نقطة بيانات"]];
      const sw = (lw - 0.4) / 3;
      stats.forEach((st, i) => {
        const x = lx + lw - (i + 1) * sw - i * 0.2;
        rect(s, x, 4.85, sw, 1.35, PANEL);
        en(s, st[0], { x, y: 4.95, w: sw, h: 0.7, fontSize: 28, bold: true, align: "center" });
        t(s, st[1], { x, y: 5.65, w: sw, h: 0.4, fontSize: 13, align: "center", color: SOFT });
      });
    });
  foot(s, SRC_REPORT + " · الأرقام كما وردت في الدليل الرسمي لـ DataMB — غير متحقق منها بشكل مستقل");
}

// 8 — Grintafy
{
  const s = competitor("02 · BENCHMARK 03", "Grintafy", "اكتشاف المواهب والمشاركة", "Talent Discovery & Participation",
    ["ملفات اللاعبين", "فيديوهات المهارات", "اختبارات الأداء (Tryouts)", "السيرة الكروية (Football CV)", "التحديات (Challenges)", "مشاركة اللاعبين", "اكتشاف الكشافين للمواهب"],
    "الوصول إلى اللاعبين والمشاركة المتكررة يصنعان قيمة تتجاوز التحليلات.",
    "Grintafy يبني قيمته على الوصول للاعبين ومشاركتهم المتكررة: ملفات، فيديوهات مهارات، تحديات، واختبارات أداء يكتشف عبرها الكشافون المواهب.\n" +
    "الأهمية: الشبكة والمشاركة أصل تنافسي بحد ذاته، وليس فقط جودة التحليل.\n" +
    "التطبيق على Ada2AI: الأكاديمية هي قناة الوصول الطبيعية للاعبين. الاستخدام المتكرر داخل الأكاديمية أهم من قاعدة لاعبين عالمية. لذلك نؤجل «قاعدة اللاعبين العالمية» و«الشبكة الاجتماعية».",
    (s, lx, lw) => { rect(s, lx, 4.85, lw, 1.35, PANEL, { line: HEX.line }); t(s, "لـ Ada2AI: الأكاديمية هي قناة الوصول للاعبين — الاستخدام المتكرر قبل قاعدة عالمية", { x: lx + 0.3, y: 4.85, w: lw - 0.6, h: 1.35, fontSize: 14, bold: true, valign: "middle", color: SOFT }); });
  foot(s, SRC_REPORT + " · المواد الرسمية لـ Grintafy — وفق سجل مصادر التقرير");
}

// 9 — Grinta Rush
{
  const s = competitor("02 · BENCHMARK 04", "Grinta Rush", "تجربة تقييم ميداني", "Field-Based Assessment Experience",
    ["بيئة تنافسية", "مواقف مباراة متغيرة", "قياس القدرة على التكيّف", "اتخاذ القرار", "مشاركة الأكاديميات"],
    "التقييم في سياق تنافسي حقيقي يكشف ما لا تكشفه الإحصاءات وحدها.",
    "Grinta Rush صيغة تقييم ميداني ضمن فعالية: بيئة تنافسية ومواقف متغيرة تقيس التكيّف واتخاذ القرار، بمشاركة الأكاديميات.\n" +
    "تنبيه مهم: هذه صيغة فعالية/تقييم، وليست منصة SaaS تحليلية مستقلة متحقق منها. لذلك لا نقارنها بالبرمجيات في كل الأبعاد، وتظهر بعض خاناتها في المصفوفة كـ N/A.\n" +
    "الدرس لـ Ada2AI: يمكن أن تكون Ada2AI طبقة التوثيق والتقييم لما يحدث في مثل هذه الفعاليات، لا بديلاً عنها.",
    (s, lx, lw) => {
      rect(s, lx, 4.85, lw, 1.35, AMBER, { tr: 88, line: AMBER });
      t(s, "صيغة فعالية وتقييم — وليست منصة SaaS تحليلية مستقلة متحقق منها", { x: lx + 0.3, y: 4.85, w: lw - 0.6, h: 1.35, fontSize: 15, bold: true, color: AMBER, valign: "middle" });
    });
  foot(s, SRC_REPORT + " · المواد العامة لـ Grinta Rush — وفق سجل مصادر التقرير");
}

// 10 — Veo
{
  const s = competitor("02 · BENCHMARK 05", "Veo", "تحليلات الأكاديمية عبر الفيديو", "Video-First Academy Analytics",
    ["مساحة عمل قائمة على الفيديو", "تسجيل المباريات", "مقاطع الفيديو", "تغذية الأحداث (Events feed)", "تحليلات الفريق واللاعب", "تتبع بالذكاء الاصطناعي (AI tracking)", "مقاييس الأداء البدني", "خرائط حرارية وخرائط تسديد", "Analytics Studio", "اتجاهات عبر عدة مباريات"],
    "تحليل الفيديو وتتبع AI قدرات قائمة ومثبتة في برمجيات الأكاديميات اليوم.",
    "Veo هو المنافس الأقرب لما قد يتصوره البعض عن Ada2AI، ولذلك يستحق اهتماماً خاصاً.\n" +
    "Veo يقدم بالفعل للأكاديميات: تسجيل المباريات، المقاطع، تغذية الأحداث، تتبع AI، مقاييس بدنية، خرائط حرارية وخرائط تسديد، Analytics Studio، واتجاهات عبر عدة مباريات.\n" +
    "الاستنتاج الاستراتيجي: لا يمكن لـ Ada2AI أن تتميّز بمجرد رفع الفيديو أو الخرائط الحرارية أو مصطلحات AI؛ هذه أصبحت قدرات متوقعة.\n" +
    "القرار: تميّزنا يجب أن يكون في ربط التقييم البشري بالدليل وسجل التطوير، بالعربية، داخل عمليات الأكاديمية.",
    (s, lx, lw) => {
      rect(s, lx, 4.85, lw, 1.35, RED, { tr: 88, line: RED });
      t(s, "التبعة على Ada2AI: لا تميّز عبر رفع الفيديو أو الخرائط الحرارية أو مصطلحات AI وحدها", { x: lx + 0.3, y: 4.85, w: lw - 0.6, h: 1.35, fontSize: 15, bold: true, valign: "middle" });
    });
  foot(s, SRC_REPORT + " · المواد الرسمية لـ Veo (veo.co) — وفق سجل مصادر التقرير");
}

// 11 — Positioning map
{
  const s = slide(S2, "02 · COMPETITIVE POSITIONING MAP", "خريطة التموضع — ست فئات مستقلة، دون ترتيب عام",
    "هذه الخريطة نوعية وليست تقييماً رقمياً. كل منتج له فئة أساسية واحدة، وقدرات مجاورة كما تظهر في المواد العامة.\n" +
    "لاحظوا أن «عمليات الأكاديمية» ليست فئة أساسية لأي من المنافسين الخمسة، وإن كان Veo وGrinta Rush يقتربان منها.\n" +
    "صف Ada2AI يمثل التموضع المستهدف المقترح، وليس قدرة حالية مثبتة.\n" +
    "القرار: اعتماد «عمليات تطوير اللاعب في الأكاديمية بالعربية أولاً» كمساحة تموضع.");
  const dims = ["الكشف الاحترافي", "الذكاء الإحصائي", "اكتشاف المواهب", "التقييم الميداني", "عمليات الأكاديمية", "ذكاء الفيديو"];
  const map = {
    "Hudl Wyscout": [2, 0, 0, 0, 0, 1],
    "DataMB": [1, 2, 0, 0, 0, 0],
    "Grintafy": [1, 0, 2, 0, 0, 1],
    "Grinta Rush": [0, 0, 1, 2, 1, 0],
    "Veo": [0, 0, 0, 0, 1, 2],
  };
  const sym = (v) => (v === 2 ? "●" : v === 1 ? "◐" : "—");
  const hdr = [{ text: "", options: {} }].concat(dims.map((d) => ({ text: d, options: { bold: true, color: TEAL, fontSize: 13 } }))).reverse();
  const body = Object.entries(map).map(([n, v]) => [{ text: n, options: { fontFace: "Orbitron", bold: true, fontSize: 12, color: WHITE } }]
    .concat(v.map((x) => ({ text: sym(x), options: { fontSize: 20, color: x === 2 ? TEAL : x === 1 ? MTEAL : GREY, align: "center" } }))).reverse());
  body.push([{ text: "Ada2AI (مستهدف)", options: { bold: true, fontSize: 13, color: AMBER } }]
    .concat([0, 0, 0, 0, 2, 1].map((x) => ({ text: x === 2 ? "◎" : x === 1 ? "◌" : "—", options: { fontSize: 20, color: x ? AMBER : GREY, align: "center" } }))).reverse());
  s.addTable([hdr, ...body], {
    x: M, y: 1.7, w: CW, colW: [1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 2.03], rowH: 0.62,
    fontFace: "Cairo", fontSize: 13, color: WHITE, align: "center", valign: "middle",
    fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg },
  });
  t(s, "●  الفئة الأساسية     ◐  قدرة مجاورة في المواد العامة     —  ليست محور المنتج     ◎ / ◌  تموضع Ada2AI المستهدف (مقترح)", { x: M, y: 6.15, w: CW, h: 0.35, fontSize: 12, color: SOFT });
  foot(s, "تصنيف نوعي مشتق من أوصاف الفئات في " + SRC_REPORT + " — ليس تقييماً رقمياً");
}

// ═══════════════════ SECTION 03 — DASHBOARD AUDIT ═══════════════════
const S3 = "03 · تدقيق لوحات التحكم";
pres.addSection({ title: S3 });

// 12 — Dashboard comparison matrix
{
  const s = slide(S3, "03 · DASHBOARD COMPARISON", "مقارنة لوحات التحكم — المرجع السوقي مقابل حالة Ada2AI",
    "هذه المصفوفة تقارن كل بُعد بأقرب مرجع في السوق، ثم تحدد حالة Ada2AI حسب نوع الدليل المتاح.\n" +
    "قيد جوهري: لم تتوفر جلسة مصادَق عليها للوحة Ada2AI أثناء التدقيق، لذلك الحالة مبنية على فحص الكود ولقطة قاعدة البيانات، لا على مشاهدة الشاشات الحية. وبيانات المنافسين مبنية على موادهم العامة.\n" +
    "أبرز ما يظهر: البحث والملفات وهيكل الأدوار موجودة؛ التقييم والفيديو والتقارير والتطور عبر الزمن غير مثبتة تشغيلياً؛ تجربة الجوال لم تُقيّم.\n" +
    "القرار: إغلاق الأبعاد الحمراء التي تخص التقييم والفيديو قبل إضافة أي ميزة جديدة.");
  const ST = { ok: ["موجود في الكود", TEAL], part: ["جزئي", AMBER], no: ["غير مثبت", RED], na: ["لم يُقيَّم", GREY] };
  const rows = [
    ["هيكل لوحة التحكم", "Veo · Wyscout", "لوحات حسب الدور: لاعب، مدرب، كشاف، منظمات", "ok"],
    ["هرمية المعلومات", "—", "تحتاج إعادة ترتيب (مقترح في الشريحة 14)", "part"],
    ["ملفات اللاعبين", "Wyscout · Grintafy", "مسار /player/:id وملف اللاعب", "ok"],
    ["الإحصاءات", "DataMB", "مقاييس يدخلها المدرب، بلا وسم للمصدر", "part"],
    ["سير عمل الفيديو", "Veo", "رفع موجود؛ عدم تطابق هوية؛ 0 تحليلات مسجلة", "no"],
    ["التقييم", "—", "النموذج موجود؛ جدول evaluations غائب في القاعدة الحية", "no"],
    ["الكشف", "Wyscout", "بحث، تصفية مراكز، ترقيم صفحات", "ok"],
    ["سجل التطور", "Veo (Multi-match trends)", "غير مثبت على البيانات الحية", "no"],
    ["التقارير", "Wyscout (Scouting reports)", "زر التقرير يعرض «قريباً»؛ جدول التقارير فارغ", "no"],
    ["التعاون", "Wyscout (Shortlists)", "مشاركة من لوحة الكشاف فقط", "part"],
    ["الإدارة", "—", "لوحة منظمات بلا عضوية أو عزل", "part"],
    ["تجربة الجوال", "—", "لم تُقيَّم — لا جلسة مصادَق عليها", "na"],
  ];
  const hdr = ["الحالة", "Ada2AI — الدليل المتاح", "المرجع السوقي", "البُعد"].map((h) => ({ text: h, options: { bold: true, color: TEAL, fontSize: 12 } }));
  const body = rows.map((r) => [
    { text: ST[r[3]][0], options: { bold: true, color: ST[r[3]][1] } },
    { text: r[2], options: { color: SOFT } },
    { text: r[1], options: { color: GREY } },
    { text: r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], {
    x: M, y: 1.62, w: CW, colW: [1.9, 5.6, 2.6, 2.033], rowH: 0.36,
    fontFace: "Cairo", fontSize: 12, color: WHITE, align: "right", valign: "middle", rtlMode: true,
    fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.1, 0, 0.1],
  });
  foot(s, "قيد الدليل: لا جلسة مصادَق عليها للوحة Ada2AI أثناء التدقيق · الحالة من الكود (" + SRC_CODE + ") ولقطة Supabase · المنافسون من المواد العامة");
}

// 13 — Product architecture
{
  const s = slide(S3, "03 · PRODUCT ARCHITECTURE", "معمارية منتج Ada2AI — المسارات الفعلية حسب الدور",
    "هذه هي المسارات الفعلية المسجّلة في ملف App.tsx في الفرع main.\n" +
    "أربع مناطق: اللاعب (لوحة، ملف، رفع، تحليل فيديو)، المدرب (لوحة، مساحة عمل، نموذج تقييم)، الكشاف (لوحة وبحث ونقطة دخول للمقارنة)، والإدارة (منظمات، تصنيفات، لوحة نادٍ).\n" +
    "ملاحظة جوهرية: زر المقارنة موجود في لوحة الكشاف، لكن مسار /compare غير مسجّل في App.tsx.\n" +
    "الأهمية: وجود المسار لا يعني تشغيل الوظيفة؛ كل هذه المسارات تعتمد على Supabase، وجزء من جداولها فارغ.");
  const groups = [
    ["اللاعب", "PLAYER", [["لوحة اللاعب", "/player/dashboard"], ["ملف اللاعب", "/player/:id"], ["رفع الفيديو", "/player/upload"], ["تحليل الفيديو", "/video-analysis"]]],
    ["المدرب", "COACH", [["لوحة المدرب", "/coach"], ["مساحة عمل المدرب", "/coach/workspace"], ["نموذج التقييم", "/coach/evaluate/:playerId"]]],
    ["الكشاف", "SCOUT", [["لوحة الكشاف", "/scout"], ["بحث اللاعبين", "/scout (search)"], ["نقطة دخول المقارنة", "/compare (not registered)", true]]],
    ["الإدارة", "ADMINISTRATION", [["لوحة المنظمات", "/organizations"], ["التصنيفات", "/rankings"], ["لوحة النادي", "/club/rawdha"]]],
  ];
  const gw = (CW - 3 * 0.25) / 4;
  groups.forEach((g, i) => {
    const x = W - M - (i + 1) * gw - i * 0.25, y = 1.65;
    rect(s, x, y, gw, 3.95, PANEL, { line: HEX.line });
    en(s, g[1], { x: x + 0.2, y: y + 0.18, w: gw - 0.4, h: 0.28, fontSize: 10, bold: true });
    t(s, g[0], { x: x + 0.2, y: y + 0.45, w: gw - 0.4, h: 0.45, fontSize: 19, bold: true });
    g[2].forEach((r, k) => {
      const ry = y + 1.05 + k * 0.7;
      rect(s, x + 0.18, ry, gw - 0.36, 0.6, HEX.bg, { line: r[2] ? RED : HEX.line });
      t(s, r[0], { x: x + 0.3, y: ry + 0.02, w: gw - 0.6, h: 0.3, fontSize: 13, bold: true });
      s.addText(r[1], { isTextBox: true, x: x + 0.3, y: ry + 0.31, w: gw - 0.6, h: 0.26, fontFace: "Cairo", fontSize: 10, color: r[2] ? RED : GREY, align: "right", margin: 0, rtlMode: false });
    });
  });
  rect(s, M, 5.8, CW, 0.6, TEAL, { tr: 88, line: TEAL });
  t(s, "طبقة البيانات: Supabase (Auth · Postgres · Storage) — المصدر الوحيد المتحقق منه للقراءة والكتابة", { x: M + 0.3, y: 5.8, w: CW - 0.6, h: 0.6, fontSize: 14, bold: true, align: "center", valign: "middle", color: TEAL });
  foot(s, SRC_CODE + " · src/App.tsx · " + SRC_REPORT);
}

// 14 — Player dashboard
{
  const s = slide(S3, "03 · PLAYER DASHBOARD AUDIT", "لوحة اللاعب — ما هو موجود، وما لم يثبت",
    "ما هو موجود في الكود: معلومات اللاعب، استرجاع التقييمات برمجياً، التنقل إلى رفع الفيديو، وتجربة ملف اللاعب.\n" +
    "ما لم يثبت: سجل التقييم على القاعدة الحية — لأن جدول evaluations غير موجود؛ التطور عبر الزمن؛ وأي «رؤى مؤتمتة».\n" +
    "المقترح: إعادة ترتيب الهرمية لتبدأ بهوية اللاعب، ثم آخر تقييم، ثم الدليل، ثم سجل التطور، ثم الإجراء التالي.\n" +
    "تنبيه: هذا مفهوم مقترح، وليس شاشة إنتاج حالية. لا يجوز عرضه على عميل كأنه منتج قائم.");
  const half = (CW - 0.4) / 2;
  const blk = (x, title, en_, c, items) => {
    rect(s, x, 1.65, half, 2.35, PANEL, { line: c });
    en(s, en_, { x: x + 0.3, y: 1.8, w: half - 0.6, h: 0.28, fontSize: 10, bold: true, color: c });
    t(s, title, { x: x + 0.3, y: 2.08, w: half - 0.6, h: 0.42, fontSize: 18, bold: true });
    s.addText(items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } })), Object.assign({}, AR, { x: x + 0.3, y: 2.55, w: half - 0.6, h: 1.35, fontSize: 14, color: SOFT, paraSpaceAfter: 3 }));
  };
  blk(W - M - half, "موجود في الكود", "EXISTS", TEAL, ["معلومات اللاعب وتجربة الملف", "استرجاع التقييمات برمجياً", "التنقل إلى رفع الفيديو"]);
  blk(M, "غير مثبت", "NOT PROVEN", RED, ["سجل تقييم يعمل على القاعدة الحية", "تقدّم موثوق عبر الزمن", "رؤى مؤتمتة متحقق منها"]);
  // proposed hierarchy
  rect(s, M, 4.25, CW, 2.2, HEX.bg, { line: AMBER, lw: 1 });
  en(s, "PROPOSED CONCEPT — NOT CURRENT PRODUCTION FUNCTIONALITY", { x: M + 0.3, y: 4.35, w: CW - 0.6, h: 0.28, fontSize: 9, bold: true, color: AMBER });
  t(s, "الهرمية المقترحة — مفهوم مقترح وليس وظيفة إنتاج حالية", { x: M + 0.3, y: 4.62, w: CW - 0.6, h: 0.35, fontSize: 14, bold: true, color: AMBER });
  const steps = ["هوية اللاعب", "آخر تقييم", "الدليل", "سجل التطور", "الإجراء التالي"];
  const sw = 2.0, gap = (CW - 0.6 - 5 * sw) / 4;
  steps.forEach((st, i) => {
    const x = W - M - 0.3 - (i + 1) * sw - i * gap;
    rect(s, x, 5.2, sw, 0.85, PANEL, { line: AMBER });
    t(s, st, { x, y: 5.2, w: sw, h: 0.85, fontSize: 15, bold: true, align: "center", valign: "middle" });
    if (i < 4) arrowL(s, x - gap + 0.08, 5.625, gap - 0.16, AMBER);
  });
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/pages/player/Dashboard.tsx)");
}

// 15 — Coach dashboard & workspace
{
  const s = slide(S3, "03 · COACH DASHBOARD & WORKSPACE", "لوحة المدرب ومساحة العمل — المُدخل يدوياً ليس AI",
    "مساحة عمل المدرب هي أقوى أصل تشغيلي في المنتج: بيانات الفريق، إحصاءات المباريات، قائمة التحليلات المعلّقة، الملعب التفاعلي، إدخال النتائج يدوياً، وسجل التحليلات المكتملة.\n" +
    "النقطة الحرجة: كثير من المقاييس يدخلها المدرب يدوياً. عرضها بجوار مصطلحات AI دون وسم المصدر يضلل المستخدم والمستثمر.\n" +
    "المقترح: وسم كل مقياس بمصدره: أدخله المدرب، مولّد بالذكاء الاصطناعي، مستورد، أو غير متحقق منه.\n" +
    "القرار: اعتماد وسم المصدر (Metric Provenance) كمعيار إلزامي قبل أي عرض تجاري.");
  const feats = ["بيانات الفريق", "إحصاءات المباريات", "قائمة التحليلات المعلّقة", "الملعب التفاعلي", "إدخال النتائج يدوياً", "سجل التحليلات المكتملة"];
  const fw = (CW - 2 * 0.25) / 3;
  feats.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = W - M - (col + 1) * fw - col * 0.25, y = 1.65 + row * 0.82;
    rect(s, x, y, fw, 0.65, PANEL, { line: HEX.line });
    t(s, f, { x: x + 0.25, y, w: fw - 0.5, h: 0.65, fontSize: 15, valign: "middle" });
  });
  rect(s, M, 3.5, CW, 1.25, RED, { tr: 90, line: RED });
  s.addText([
    { text: "Coach-entered", options: { color: WHITE } }, { text: "  ≠  ", options: { color: RED } }, { text: "AI-generated", options: { color: TEAL } },
  ], { isTextBox: true, x: M, y: 3.55, w: CW, h: 0.7, fontFace: "Orbitron", fontSize: 28, bold: true, align: "center", valign: "middle", margin: 0 });
  t(s, "السرعة التي يُدخلها المدرب يدوياً ليست مقياس سرعة مشتقاً من AI", { x: M, y: 4.22, w: CW, h: 0.4, fontSize: 14, align: "center", color: SOFT });
  t(s, "وسوم المصدر المقترحة لكل مقياس:", { x: M, y: 5.0, w: CW, h: 0.4, fontSize: 15, bold: true });
  const tags = [["أدخله المدرب · Coach-entered", TEAL], ["مولّد بـ AI · AI-generated", BLUE], ["مستورد · Imported", GREY], ["غير متحقق منه · Unverified", AMBER]];
  const tw = (CW - 3 * 0.25) / 4;
  tags.forEach((tg, i) => pill(s, tg[0], W - M - (i + 1) * tw - i * 0.25, 5.55, tw, tg[1], { h: 0.5, size: 13 }));
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/pages/coach/Workspace.tsx)");
}

// 16 — Scout dashboard
{
  const s = slide(S3, "03 · SCOUT DASHBOARD AUDIT", "لوحة الكشاف — أساس جيد مع ميزتين غير مكتملتين",
    "لوحة الكشاف تحتوي: البحث، تصفية المراكز، ترقيم الصفحات، التنقل إلى ملف اللاعب، المشاركة، واختيار لاعبين للمقارنة.\n" +
    "ميزتان غير مكتملتين بالدليل من الكود: مسار /compare غير مسجّل في App.tsx رغم وجود زر المقارنة؛ وزر PDF يعرض رسالة «تقارير PDF قريباً».\n" +
    "الحكم: نحتفظ بالبحث والتصفية (KEEP)، ونحسّن مسار المقارنة والتقرير (IMPROVE) — إما إكمالهما أو إخفاؤهما حتى يكتملا.\n" +
    "لا يجوز عرض زر لا يعمل أمام أكاديمية أو مستثمر.");
  const feats = ["بحث اللاعبين", "تصفية المراكز", "ترقيم الصفحات", "التنقل لملف اللاعب", "المشاركة", "اختيار لاعبَين للمقارنة"];
  const fw = 3.4;
  feats.forEach((f, i) => {
    const y = 1.65 + i * 0.6;
    rect(s, W - M - fw, y, fw, 0.5, PANEL);
    s.addShape(pres.shapes.OVAL, { x: W - M - 0.38, y: y + 0.16, w: 0.18, h: 0.18, fill: { color: TEAL }, line: { type: "none" } });
    t(s, f, { x: W - M - fw + 0.2, y, w: fw - 0.7, h: 0.5, fontSize: 14, valign: "middle" });
  });
  const ix = M + 3.6, iw = CW - fw - 3.6 - 0.4;
  const inc = [["مسار /compare غير مسجّل في App.tsx", "زر المقارنة يقود إلى مسار غير موجود"], ["تحميل PDF يعرض «قريباً»", "toast: «تقارير PDF قريباً»"]];
  inc.forEach((it, i) => {
    const y = 1.65 + i * 1.75;
    rect(s, ix, y, iw, 1.5, PANEL, { line: RED });
    en(s, "INCOMPLETE", { x: ix + 0.25, y: y + 0.15, w: iw - 0.5, h: 0.26, fontSize: 9, bold: true, color: RED });
    t(s, it[0], { x: ix + 0.25, y: y + 0.42, w: iw - 0.5, h: 0.45, fontSize: 16, bold: true });
    t(s, it[1], { x: ix + 0.25, y: y + 0.92, w: iw - 0.5, h: 0.4, fontSize: 13, color: SOFT });
  });
  // verdict column
  const vx = M, vw = 3.3;
  rect(s, vx, 1.65, vw, 2.0, TEAL, { tr: 88, line: TEAL });
  en(s, "KEEP", { x: vx + 0.25, y: 1.8, w: vw - 0.5, h: 0.45, fontSize: 22, bold: true });
  t(s, "البحث، التصفية، الترقيم، التنقل للملف", { x: vx + 0.25, y: 2.35, w: vw - 0.5, h: 1.1, fontSize: 14 });
  rect(s, vx, 3.9, vw, 2.0, AMBER, { tr: 88, line: AMBER });
  en(s, "IMPROVE", { x: vx + 0.25, y: 4.05, w: vw - 0.5, h: 0.45, fontSize: 22, bold: true, color: AMBER });
  t(s, "إكمال المقارنة والتقرير — أو إخفاؤهما حتى يعملا", { x: vx + 0.25, y: 4.6, w: vw - 0.5, h: 1.1, fontSize: 14 });
  foot(s, SRC_CODE + " · src/App.tsx (لا مسار /compare) · src/pages/ScoutDashboard.tsx (toast «تقارير PDF قريباً») · " + SRC_REPORT);
}

// 17 — Organizations
{
  const s = slide(S3, "03 · ORGANIZATIONS & ACADEMY MANAGEMENT", "لوحة المنظمات ليست نظام أكاديميات متعدد المستأجرين",
    "المنفّذ: قائمة المنظمات، عدد المنظمات، عدد اللاعبين، حالة التوثيق، ومتوسط التقييم.\n" +
    "غير المثبت: عضوية المنظمة، عزل المستأجرين، ملكية المنظمة للاعبيها، وإدارة الصلاحيات الخاصة بكل أكاديمية.\n" +
    "ولاحظوا أن جدول organizations يحتوي 0 صفوف في القاعدة الحية.\n" +
    "الأهمية: الأكاديمية التي تدفع تحتاج ضماناً بأن بيانات لاعبيها لا تراها أكاديمية أخرى. هذا شرط بيع، وليس ميزة إضافية.\n" +
    "القرار: بناء عضوية المنظمة والعزل قبل ضم أكاديمية ثانية.");
  const half = (CW - 1.2) / 2;
  const col = (x, title, en_, c, items) => {
    rect(s, x, 1.65, half, 3.6, PANEL, { line: c });
    en(s, en_, { x: x + 0.3, y: 1.82, w: half - 0.6, h: 0.28, fontSize: 10, bold: true, color: c });
    t(s, title, { x: x + 0.3, y: 2.1, w: half - 0.6, h: 0.45, fontSize: 19, bold: true });
    items.forEach((it, k) => {
      const y = 2.75 + k * 0.48;
      s.addShape(pres.shapes.OVAL, { x: x + half - 0.5, y: y + 0.12, w: 0.18, h: 0.18, fill: { color: c }, line: { type: "none" } });
      t(s, it, { x: x + 0.3, y, w: half - 0.95, h: 0.42, fontSize: 15, valign: "middle" });
    });
  };
  col(W - M - half, "منفّذ في الواجهة", "IMPLEMENTED", TEAL, ["قائمة المنظمات", "عدد المنظمات", "عدد اللاعبين", "حالة التوثيق", "متوسط التقييم"]);
  col(M, "غير مثبت", "NOT ESTABLISHED", RED, ["عضوية المنظمة", "عزل المستأجرين (Tenant Isolation)", "ملكية المنظمة للاعبيها", "صلاحيات خاصة بكل أكاديمية"]);
  s.addShape(pres.shapes.OVAL, { x: W / 2 - 0.4, y: 3.05, w: 0.8, h: 0.8, fill: { color: BG }, line: { color: AMBER, width: 1.5 } });
  en(s, "≠", { x: W / 2 - 0.4, y: 3.05, w: 0.8, h: 0.8, fontSize: 26, bold: true, color: AMBER, align: "center", valign: "middle" });
  rect(s, M, 5.5, CW, 0.85, AMBER, { tr: 88, line: AMBER });
  t(s, "Organizations Dashboard  ≠  Multi-Tenant Academy Management System  ·  جدول organizations = 0 صفوف حالياً", { x: M + 0.3, y: 5.5, w: CW - 0.6, h: 0.85, fontSize: 15, bold: true, align: "center", valign: "middle", color: AMBER });
  foot(s, SRC_REPORT + " · لقطة Supabase بتاريخ 2 نوفمبر 2026");
}

// ═══════════════════ SECTION 04 — TECHNICAL REALITY & SECURITY ═══════════════════
const S4 = "04 · الواقع التقني والأمان";
pres.addSection({ title: S4 });

// 18 — Live DB reality
{
  const s = slide(S4, "04 · LIVE DATABASE REALITY", "واقع قاعدة البيانات الحية — وجود الجدول لا يثبت الاستخدام",
    "هذه لقطة فعلية لعدد الصفوف في Supabase بتاريخ 2 نوفمبر 2026.\n" +
    "6 من أصل 11 جدولاً فارغة تماماً، بما فيها matches وvideo_analyses وreports وorganizations. وجدول evaluations غير موجود أصلاً.\n" +
    "الأهمية: وجود الجدول في المخطط لا يثبت الاستخدام التشغيلي. لا يوجد حتى الآن دليل على أكاديمية تستخدم المنتج بانتظام.\n" +
    "التطبيق: أي ادعاء عن «تحليلات» أو «تقارير» يجب أن يُقرأ في ضوء أن الجداول المعنية فارغة.\n" +
    "القرار: قياس التقدم بعدد السجلات الفعلية المتكررة، لا بعدد الشاشات.");
  const data = [["profiles", 5], ["players", 5], ["coaches", 1], ["scouts", 0], ["matches", 0], ["organizations", 0], ["video_analyses", 0], ["reports", 0], ["video_analysis_player_links", 0], ["football_coach_players", 2], ["sport_identities", 31]];
  const tw = 5.0;
  const hdr = [{ text: "Rows", options: { bold: true, color: TEAL, align: "right" } }, { text: "Table", options: { bold: true, color: TEAL, align: "left" } }];
  const body = data.map((d) => [
    { text: String(d[1]), options: { fontFace: "Orbitron", bold: true, color: d[1] === 0 ? RED : WHITE, align: "right" } },
    { text: d[0], options: { fontFace: "Consolas", color: SOFT, align: "left" } },
  ]);
  s.addTable([hdr, ...body], { x: W - M - tw, y: 1.6, w: tw, colW: [1.2, tw - 1.2], rowH: 0.38, fontFace: "Cairo", fontSize: 12, color: WHITE, valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  const lx = M, lw = CW - tw - 0.5;
  const stats = [["6 / 11", "جداول بصفر صفوف"], ["0", "تحليلات فيديو مسجّلة"], ["غائب", "جدول evaluations"]];
  const sw = (lw - 0.5) / 3;
  stats.forEach((st, i) => {
    const x = lx + lw - (i + 1) * sw - i * 0.25;
    rect(s, x, 1.6, sw, 1.55, PANEL, { line: RED });
    s.addText(st[0], { isTextBox: true, x, y: 1.72, w: sw, h: 0.8, fontFace: i === 2 ? "Cairo" : "Orbitron", fontSize: i === 2 ? 26 : 30, bold: true, color: RED, align: "center", valign: "middle", margin: 0, rtlMode: i === 2 });
    t(s, st[1], { x: x + 0.1, y: 2.55, w: sw - 0.2, h: 0.45, fontSize: 13, align: "center", color: SOFT });
  });
  s.addChart(pres.charts.BAR, [{ name: "Rows", labels: data.map((d) => d[0]).reverse(), values: data.map((d) => d[1]).reverse() }], {
    x: lx, y: 3.4, w: lw, h: 3.05, barDir: "bar", chartColors: ["00DCC8"], showValue: true, dataLabelPosition: "outEnd",
    dataLabelColor: "EEEFEE", dataLabelFontSize: 9, dataLabelFontFace: "+mn-lt", catAxisLabelColor: "EEEFEE", catAxisLabelFontSize: 9, catAxisLabelFontFace: "+mn-lt",
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "عدد الصفوف لكل جدول — 2 نوفمبر 2026", titleColor: "EEEFEE", titleFontSize: 11, titleFontFace: "+mn-lt", barGapWidthPct: 40,
  });
  foot(s, "لقطة Supabase الحية بتاريخ 2 نوفمبر 2026 — " + SRC_REPORT);
}

// 19 — Data contract failure
{
  const s = slide(S4, "04 · CRITICAL DATA CONTRACT FAILURE", "فشل عقد البيانات — نجاح رفع الملف لا يعني تسجيل التحليل",
    "هذه السلسلة المتوقعة من هوية المستخدم إلى دليل اللاعب. في كل حلقة يُستخدم معرّف مختلف.\n" +
    "الملاحظ في الكود: مسار التخزين يبدأ بـ players.id؛ بينما سياسة التخزين تتوقع auth.uid() في المجلد الأول؛ وحقل uploaded_by يشير إلى profiles.id؛ وفشل إنشاء سجل التحليل يُعامل كخطأ «غير قاتل» ويُكتفى بتسجيل تحذير.\n" +
    "النتيجة: قد يرى المستخدم «تم الرفع بنجاح» بينما لم يُسجَّل أي تحليل. وهذا يتسق مع وجود 0 سجلات في video_analyses.\n" +
    "القرار: توحيد عقد الهوية واختبار الرفع من البداية للنهاية كبوابة أولى قبل التجربة مع الأكاديمية.");
  const chain = ["Auth User ID", "Profile ID", "Player ID", "Storage Path", "Video Analysis Record", "Player Evidence"];
  const bw = 1.75, gap = (CW - 6 * bw) / 5, y = 1.85;
  chain.forEach((c, i) => {
    const x = W - M - (i + 1) * bw - i * gap;
    const bad = i === 3 || i === 4;
    rect(s, x, y, bw, 0.95, PANEL, { line: bad ? RED : TEAL, lw: 1.5 });
    en(s, c, { x: x + 0.05, y, w: bw - 0.1, h: 0.95, fontSize: 11, bold: true, align: "center", valign: "middle", color: bad ? RED : WHITE });
    if (i < 5) arrowL(s, x - gap + 0.06, y + 0.475, gap - 0.12, bad ? RED : TEAL);
  });
  const obs = [
    ["مسار الرفع", "يستخدم players.id في مسار التخزين", "${playerId}/<timestamp>_<file>"],
    ["سياسة التخزين", "تتوقع auth.uid() في المجلد الأول", "players.id ≠ auth.uid()"],
    ["uploaded_by", "يشير إلى profiles.id", "profiles.id ≠ players.id"],
    ["سجل التحليل", "فشل الإنشاء يُعامل كخطأ غير قاتل", "console.warn(… non-fatal)"],
  ];
  const ow = (CW - 3 * 0.25) / 4;
  obs.forEach((o, i) => {
    const x = W - M - (i + 1) * ow - i * 0.25, oy = 3.2;
    rect(s, x, oy, ow, 1.85, PANEL, { line: RED });
    en(s, "0" + (i + 1), { x: x + 0.2, y: oy + 0.15, w: ow - 0.4, h: 0.3, fontSize: 12, bold: true, color: RED });
    t(s, o[0], { x: x + 0.2, y: oy + 0.45, w: ow - 0.4, h: 0.38, fontSize: 15, bold: true });
    t(s, o[1], { x: x + 0.2, y: oy + 0.85, w: ow - 0.4, h: 0.5, fontSize: 13, color: SOFT });
    s.addText(o[2], { isTextBox: true, x: x + 0.2, y: oy + 1.4, w: ow - 0.4, h: 0.3, fontFace: "Consolas", fontSize: 10, color: AMBER, align: "left", margin: 0 });
  });
  rect(s, M, 5.35, CW, 0.95, RED, { tr: 88, line: RED });
  t(s, "النتيجة: قد يظهر «تم الرفع» بينما لا يُسجَّل أي تحليل — وهذا يتسق مع video_analyses = 0", { x: M + 0.3, y: 5.35, w: CW - 0.6, h: 0.95, fontSize: 17, bold: true, align: "center", valign: "middle" });
  foot(s, SRC_CODE + " · src/hooks/useMediaUpload.ts · سياسة التخزين وuploaded_by وفق " + SRC_REPORT);
}

// 20 — AI reality check
{
  const s = slide(S4, "04 · AI REALITY CHECK", "فحص واقع AI — ثلاثة مستويات غير مثبتة في الإنتاج",
    "نميّز بين ثلاثة مستويات: الكشف البصري (Detection)، ثم التتبع والقياس (Tracking & Measurement)، ثم التفسير التكتيكي (Tactical Interpretation). كل مستوى أصعب من الذي قبله ويحتاج تحققاً مستقلاً.\n" +
    "الواقع: لا يوجد دليل تنفيذ مستقل لخط YOLO/FastAPI في الإنتاج، ولا Ground Truth لقياس الدقة. وجدول video_analyses فارغ.\n" +
    "فروق جوهرية: صناديق الإحاطة ليست أداء لاعب؛ معرّفات التتبع ليست ذكاءً تكتيكياً؛ الخريطة الحرارية ليست تموضعاً متحققاً منه تلقائياً؛ والسرعة المُدخلة يدوياً ليست مقياساً مشتقاً من AI.\n" +
    "القرار: تصنيف كل قدرات الرؤية الحاسوبية كتجريبية حتى تجتاز اختبار دقة موثقاً على بيانات أكاديمية حقيقية.");
  const lv = [["1", "Computer Vision Detection", "الكشف البصري", "كشف اللاعبين والكرة في الإطار"], ["2", "Tracking & Measurement", "التتبع والقياس", "تتبع عبر الزمن وقياس المسافة والسرعة"], ["3", "Tactical Interpretation", "التفسير التكتيكي", "فهم المواقف والقرارات والأنماط"]];
  lv.forEach((l, i) => {
    const y = 1.7 + i * 1.08, w = 6.2 - i * 0.6, x = W - M - w;
    rect(s, x, y, w, 0.92, PANEL, { line: HEX.line });
    en(s, l[0], { x: x + w - 0.65, y, w: 0.45, h: 0.92, fontSize: 26, bold: true, valign: "middle", align: "center" });
    t(s, l[2], { x: x + 1.9, y: y + 0.08, w: w - 2.6, h: 0.4, fontSize: 16, bold: true });
    t(s, l[3], { x: x + 1.9, y: y + 0.48, w: w - 2.6, h: 0.36, fontSize: 12, color: SOFT });
    pill(s, "غير متحقق في الإنتاج", x + 0.15, y + 0.3, 1.65, RED, { size: 10 });
  });
  en(s, "Ground Truth: NONE", { x: W - M - 6.2, y: 5.0, w: 6.2, h: 0.4, fontSize: 14, bold: true, color: RED });
  t(s, "لا يوجد دليل تنفيذ مستقل لـ YOLO / FastAPI في الإنتاج، ولا ادعاء دقة بلا بيانات مرجعية", { x: W - M - 6.2, y: 5.4, w: 6.2, h: 0.7, fontSize: 13, color: SOFT });
  const dx = M, dw = CW - 6.2 - 0.5;
  const ds = [["Bounding boxes", "أداء اللاعب"], ["Track IDs", "ذكاء تكتيكي"], ["Heatmap", "تموضع متحقق منه"], ["سرعة مُدخلة يدوياً", "مقياس سرعة من AI"]];
  t(s, "فروق لا يجوز طمسها", { x: dx, y: 1.7, w: dw, h: 0.4, fontSize: 16, bold: true, color: TEAL });
  ds.forEach((d, i) => {
    const y = 2.25 + i * 1.0;
    rect(s, dx, y, dw, 0.82, PANEL);
    s.addText(d[0], { isTextBox: true, x: dx + dw / 2 + 0.3, y, w: dw / 2 - 0.45, h: 0.82, fontFace: /[a-z]/i.test(d[0]) ? "Orbitron" : "Cairo", fontSize: 12, bold: true, color: WHITE, align: "right", valign: "middle", margin: 0, rtlMode: !/[a-z]/i.test(d[0]) });
    en(s, "≠", { x: dx + dw / 2 - 0.3, y, w: 0.6, h: 0.82, fontSize: 22, bold: true, color: RED, align: "center", valign: "middle" });
    t(s, d[1], { x: dx + 0.15, y, w: dw / 2 - 0.45, h: 0.82, fontSize: 14, valign: "middle", align: "left", color: SOFT });
  });
  foot(s, SRC_REPORT + " · لا توجد أدلة تنفيذ مستقلة لخط CV في الإنتاج حتى تاريخ التقييم");
}

// 21 — Security & privacy P0
{
  const s = slide(S4, "04 · SECURITY & PRIVACY — P0", "الأمان والخصوصية: أولوية قصوى (P0)",
    "هذه أهم شريحة في الجانب التقني.\n" +
    "النتائج متحقق منها على مستوى الإعدادات: حاوية player-media عامة، وتوجد سياسة SELECT عامة عليها؛ قراءة عامة لـ video_analyses؛ سياسات كتابة واسعة لأي مستخدم مصادَق عليه على جداول كرة القدم؛ قراءة واسعة للتقارير؛ Views في الـ API تحتاج تحققاً أمنياً أدق؛ وعزل المنظمات غير قائم.\n" +
    "دقة التعبير مهمة: هذه نتائج إعدادات تشير إلى تعرّض محتمل، وليست اختراقاً مؤكداً. لا يوجد في التقرير دليل على وصول غير مصرّح به فعلياً.\n" +
    "الأهمية: نحن نتعامل مع بيانات وفيديوهات لاعبين ناشئين. الأكاديميات وأولياء الأمور لن يقبلوا بيانات عامة افتراضياً.\n" +
    "القرار: إغلاق بنود P0 قبل أي عرض أو تجربة أو نمو. ملاحظة: تصنيف الخطورة هنا تقدير هذا العرض.");
  const rows = [
    ["حاوية player-media عامة (Public)", "Storage", "CRITICAL", "P0"],
    ["سياسة SELECT عامة على player-media", "Storage Policy", "CRITICAL", "P0"],
    ["سياسة قراءة عامة على video_analyses", "RLS", "CRITICAL", "P0"],
    ["سياسات كتابة واسعة للمصادَق عليهم على جداول كرة القدم", "RLS", "HIGH", "P0"],
    ["قراءة واسعة للتقارير لأي مستخدم مصادَق عليه", "RLS", "HIGH", "P0"],
    ["Views في الـ API تحتاج تحققاً أمنياً أدق", "API Views", "HIGH", "P1"],
    ["عزل البيانات على مستوى المنظمة غير قائم", "Tenancy", "HIGH", "P0"],
  ];
  const sc = (v) => (v === "CRITICAL" ? RED : AMBER);
  const hdr = ["الأولوية", "الخطورة", "الطبقة", "النتيجة (إعدادات)"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const body = rows.map((r) => [
    { text: r[3], options: { fontFace: "Orbitron", bold: true, color: r[3] === "P0" ? RED : AMBER, align: "center" } },
    { text: r[2], options: { fontFace: "Orbitron", bold: true, color: sc(r[2]), align: "center", fontSize: 10 } },
    { text: r[1], options: { fontFace: "Orbitron", color: GREY, align: "center", fontSize: 10 } },
    { text: r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], { x: M + 4.2, y: 1.6, w: CW - 4.2, colW: [1.0, 1.35, 1.5, CW - 4.2 - 3.85], rowH: 0.5, fontFace: "Cairo", fontSize: 13, color: WHITE, align: "right", valign: "middle", rtlMode: true, fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  rect(s, M, 1.6, 3.9, 3.0, RED, { tr: 85, line: RED, lw: 1.5 });
  t(s, "فيديوهات اللاعبين والتقارير الكشفية وبيانات الرياضيين الناشئين يجب ألا تُعامل كمعلومات عامة افتراضياً", { x: M + 0.25, y: 1.8, w: 3.4, h: 2.6, fontSize: 18, bold: true, valign: "middle" });
  rect(s, M, 4.8, 3.9, 1.3, PANEL, { line: AMBER });
  en(s, "CONFIGURATION FINDINGS", { x: M + 0.25, y: 4.92, w: 3.4, h: 0.26, fontSize: 9, bold: true, color: AMBER });
  t(s, "نتائج إعدادات تشير لتعرّض محتمل — ليست اختراقاً مؤكداً بشكل مستقل", { x: M + 0.25, y: 5.2, w: 3.4, h: 0.8, fontSize: 13, color: SOFT });
  foot(s, SRC_REPORT + " · سياسات Supabase الحية (Storage / RLS) · تصنيف الخطورة والأولوية: تقدير هذا العرض");
}

// 22 — Auth & deployment drift
{
  const s = slide(S4, "04 · AUTHENTICATION & DEPLOYMENT DRIFT", "انجراف المصادقة والنشر — نحتاج «مصدر حقيقة» واحداً",
    "يوجد أكثر من مسار نشر محتمل: الفرع main على GitHub، فرع إصلاح المصادقة (fix/auth-profile-late-response) المرتبط بـ PR #2 في مستودع Ada2AI، ادعاءات نشر على EC2/Nginx، عدة مشاريع على Vercel، مرجع مشروع Supabase، ونقطة FastAPI غير متحقق منها في الإنتاج.\n" +
    "لا ندّعي أن الموقع متوقف؛ المشكلة أننا لا نستطيع الجزم بأي نسخة من الكود تعمل في الإنتاج الآن.\n" +
    "الأهمية: بدون مصدر حقيقة واحد، أي إصلاح أمني قد لا يصل للإنتاج، وأي اختبار قد يجري على نسخة خاطئة.\n" +
    "القرار: اعتماد سلسلة واحدة موثقة: النطاق ← الاستضافة ← SHA النشر ← فرع Git ← مشروع Supabase ← نقطة الـ Backend.");
  const cur = [["GitHub main", "الفرع الافتراضي"], ["fix/auth-profile-late-response", "إصلاح المصادقة · PR #2"], ["EC2 / Nginx", "ادعاءات نشر — غير محسومة"], ["Vercel ×N", "عدة مشاريع"], ["Supabase project ref", "مرجع المشروع"], ["FastAPI endpoint", "غير متحقق في الإنتاج"]];
  t(s, "الوضع الحالي: عناصر متعددة غير مربوطة", { x: M, y: 1.6, w: CW, h: 0.4, fontSize: 16, bold: true, color: AMBER });
  const cw = (CW - 5 * 0.2) / 6;
  cur.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.2;
    rect(s, x, 2.1, cw, 1.15, PANEL, { line: i === 5 ? RED : AMBER });
    en(s, c[0], { x: x + 0.1, y: 2.18, w: cw - 0.2, h: 0.55, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle" });
    t(s, c[1], { x: x + 0.1, y: 2.75, w: cw - 0.2, h: 0.42, fontSize: 11, color: SOFT, align: "center" });
  });
  arrowD(s, W / 2, 3.45, 0.55, TEAL);
  t(s, "المطلوب: سلسلة مصدر حقيقة واحدة وموثقة", { x: M, y: 4.1, w: CW, h: 0.4, fontSize: 16, bold: true, color: TEAL });
  const req = ["Production Domain", "Hosting", "Deployment SHA", "Git Branch", "Supabase Project", "Backend Endpoint"];
  const rw = 1.7, gap = (CW - 6 * rw) / 5;
  req.forEach((r, i) => {
    const x = W - M - (i + 1) * rw - i * gap;
    rect(s, x, 4.65, rw, 0.95, TEAL, { tr: 85, line: TEAL });
    en(s, r, { x: x + 0.05, y: 4.65, w: rw - 0.1, h: 0.95, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle" });
    if (i < 5) arrowL(s, x - gap + 0.05, 5.125, gap - 0.1, TEAL);
  });
  t(s, "لا ندّعي أن موقع الإنتاج متوقف — المشكلة غياب اليقين بشأن النسخة التي تعمل فعلياً", { x: M, y: 5.85, w: CW, h: 0.45, fontSize: 14, color: SOFT, align: "center" });
  foot(s, SRC_REPORT + " · GitHub fahdoshstore-droid/Ada2AI (main، fix/auth-profile-late-response، PR #2)");
}

// ═══════════════════ SECTION 05 — CAPABILITY BENCHMARK & STRATEGY ═══════════════════
const S5 = "05 · مقارنة القدرات والاستراتيجية";
pres.addSection({ title: S5 });

// 23 — Capability matrix heatmap
{
  const s = slide(S5, "05 · CAPABILITY MATRIX (0–5)", "مصفوفة القدرات — درجات 0–5 من التقرير",
    (SCORES_AVAILABLE
      ? "هذه الدرجات منقولة حرفياً من التقرير على مقياس 0 إلى 5، مع الحفاظ على N/A (لا ينطبق) وU (غير معروف/غير متحقق).\n"
      : "تنبيه للمقدّم: ملف التقرير المصدر لم يكن متاحاً عند إعداد هذه النسخة، لذلك خانات الدرجات فارغة عمداً. لم نقدّر أي درجة. يجب نسخ الدرجات من التقرير كما هي، بما فيها N/A وU، قبل استخدام العرض.\n") +
    "طريقة القراءة: كل صف بُعد قدرة، وكل عمود منتج. لا نجمع الدرجات في ترتيب عام لأن المنتجات من فئات مختلفة.\n" +
    "النقطة المتوقعة للنقاش: أين تتقدم Ada2AI فعلاً (مثل التجربة العربية أولاً) وأين تتأخر (الفيديو والتتبع والتكاملات).\n" +
    "القرار: لا تُعدّل أي درجة لتجميل موقع Ada2AI.");
  const colors = ["1B2A31", "1E3E40", "1F5752", "247066", "2BA597", "00DCC8"];
  const cell = (v) => {
    if (v === null) return { text: "·", options: { color: GREY, fill: { color: PANEL }, align: "center" } };
    if (v === "N/A" || v === "U") return { text: v, options: { color: GREY, fill: { color: PANEL }, align: "center", fontFace: "Orbitron", fontSize: 9 } };
    return { text: String(v), options: { color: v >= 4 ? HEX.bg : "FFFFFF", bold: true, fill: { color: colors[v] }, align: "center", fontFace: "Orbitron" } };
  };
  const hdr = PRODUCTS.map((p) => ({ text: p, options: { bold: true, color: p === "Ada2AI" ? AMBER : TEAL, fontFace: "Orbitron", fontSize: 9, align: "center" } })).reverse()
    .concat([{ text: "Capability", options: { bold: true, color: TEAL, fontFace: "Orbitron", fontSize: 9, align: "right" } }]);
  const body = DIMENSIONS.map((d) => SCORES[d].map(cell).reverse().concat([{ text: d, options: { color: WHITE, align: "right", fontFace: "Cairo" } }]));
  const tx = SCORES_AVAILABLE ? M : M + 3.7;
  const tW = W - M - tx;
  s.addTable([hdr, ...body], { x: tx, y: 1.55, w: tW, colW: [...Array(6).fill((tW - 2.75) / 6), 2.75], rowH: 0.3, fontFace: "Cairo", fontSize: 11, color: WHITE, valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 1, color: HEX.bg }, margin: [0, 0.08, 0, 0.08] });
  if (!SCORES_AVAILABLE) {
    rect(s, M, 1.55, 3.4, 4.85, AMBER, { tr: 88, line: AMBER, lw: 1.5 });
    en(s, "SCORES PENDING", { x: M + 0.25, y: 1.75, w: 2.9, h: 0.3, fontSize: 11, bold: true, color: AMBER });
    t(s, "الدرجات بانتظار ملف التقرير المصدر", { x: M + 0.25, y: 2.1, w: 2.9, h: 0.8, fontSize: 17, bold: true });
    t(s, "لم يكن الملف متاحاً عند إعداد هذه النسخة. لم تُقدَّر أي درجة. تُنسخ الدرجات كما هي في التقرير، بما فيها N/A وU.", { x: M + 0.25, y: 3.0, w: 2.9, h: 1.9, fontSize: 13, color: SOFT });
    t(s, "المقياس: 0 (غائب) ← 5 (متقدم)", { x: M + 0.25, y: 5.0, w: 2.9, h: 0.35, fontSize: 12, color: SOFT });
    colors.forEach((c, i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: M + 3.15 - (i + 1) * 0.45, y: 5.5, w: 0.4, h: 0.32, fill: { color: c }, line: { type: "none" } });
      en(s, String(i), { x: M + 3.15 - (i + 1) * 0.45, y: 5.5, w: 0.4, h: 0.32, fontSize: 9, bold: true, align: "center", valign: "middle", color: i >= 4 ? BG : WHITE });
    });
  }
  foot(s, SRC_REPORT + " — مقياس 0–5 · N/A = لا ينطبق · U = غير معروف/غير متحقق");
}

// 24 — Gap analysis
{
  const s = slide(S5, "05 · COMPETITIVE GAP ANALYSIS", "تحليل الفجوات — من الفجوة إلى الإجراء",
    "خمس فجوات مرتبة حسب أثرها على قدرتنا على البيع لأكاديمية.\n" +
    "الخصوصية وعزل المستأجرين أولاً لأنها شرط بيع وثقة. ثم ثبات التقييم لأنه قلب القيمة المقترحة. ثم عقد هوية الرفع لأنه يربط الدليل باللاعب. ثم التحقق من خط الفيديو المؤتمت. وأخيراً المقارنة والتقارير.\n" +
    "الأهمية: كل فجوة لها أثر مباشر على العميل وخطر تجاري واضح.\n" +
    "القرار: اعتماد الإجراءات الخمسة كنطاق عمل أول 35 يوماً.");
  const hdr = ["الإجراء الموصى به", "الخطر التجاري", "الأثر على العميل", "الفجوة"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const rows = [
    ["الخصوصية وعزل المستأجرين", "بيانات لاعبين ناشئين قد تكون مكشوفة", "فقدان الثقة ورفض الأكاديميات", "حاوية خاصة وتشديد سياسات الوصول وعضوية المنظمة"],
    ["ثبات التقييم", "لا يُحفظ سجل تقييم فعلي", "القيمة الأساسية لا تعمل", "إنشاء جدول التقييمات واختبار الحفظ والاسترجاع"],
    ["عقد هوية رفع الفيديو", "فيديو مرفوع بلا تحليل مسجّل", "فشل صامت وفقدان الدليل", "توحيد المعرّفات وجعل فشل السجل خطأً ظاهراً"],
    ["التحقق من خط الفيديو المؤتمت", "لا دليل على عمل CV في الإنتاج", "ادعاءات قد تُعدّ مضللة", "اختبار مستقل وبيانات مرجعية قبل أي ادعاء"],
    ["المقارنة والتقارير", "أزرار لا تعمل", "تجربة غير مكتملة أمام العميل", "تسجيل مسار المقارنة وبناء التقرير أو إخفاؤهما"],
  ];
  const body = rows.map((r, i) => [
    { text: r[3], options: { color: TEAL, bold: true } },
    { text: r[2], options: { color: AMBER } },
    { text: r[1], options: { color: SOFT } },
    { text: (i + 1) + ". " + r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], { x: M, y: 1.65, w: CW, colW: [3.6, 2.6, 2.9, 3.033], rowH: 0.8, fontFace: "Cairo", fontSize: 13, color: WHITE, align: "right", valign: "middle", rtlMode: true, fill: { color: PANEL }, border: { type: "solid", pt: 1, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  foot(s, SRC_REPORT);
}

// 25 — KEEP / IMPROVE / BUILD / DEFER
{
  const s = slide(S5, "05 · KEEP / IMPROVE / BUILD / DEFER", "احتفظ · حسّن · ابنِ · أجّل",
    "هذا ملخص قرارات المنتج.\n" +
    "احتفظ: ما يعمل ويشكّل أساس التميّز — لوحات الأدوار، ملفات اللاعبين، تصفية الكشاف، مساحة عمل المدرب، التقييم البشري، والواجهة العربية.\n" +
    "حسّن: الأمان، اتساق الهوية، ثبات التقييم، الرفع، مسار المقارنة، مصدر المقاييس، وهرمية المعلومات.\n" +
    "ابنِ بعد التحقق: التقييم المدعوم بالدليل، تطور اللاعب عبر الزمن، تقارير الأكاديمية، وعضوية المنظمة.\n" +
    "أجّل: كل ما هو طموح AI قبل إثبات الأساس — Player DNA، محرك التشابه، مساعد كشف ذاتي، قاعدة لاعبين عالمية، AI تكتيكي كامل، شبكة اجتماعية، سوق، ومقاييس بدنية مؤتمتة غير متحقق منها.\n" +
    "القرار: الموافقة على قائمة «أجّل» صراحةً، فهي التي تحمي التركيز.");
  const q = [
    ["KEEP", "احتفظ", TEAL, ["لوحات التحكم حسب الدور", "ملفات اللاعبين", "تصفية الكشاف", "مساحة عمل المدرب", "التقييم البشري", "الواجهة العربية RTL"]],
    ["IMPROVE", "حسّن", AMBER, ["الأمان", "اتساق الهوية", "ثبات التقييم", "سير رفع الفيديو", "مسار المقارنة", "مصدر المقاييس", "هرمية المعلومات"]],
    ["BUILD — after validation", "ابنِ بعد التحقق", BLUE, ["تقييم مدعوم بالدليل", "تطور اللاعب عبر الزمن", "تقارير الأكاديمية", "عضوية المنظمة"]],
    ["DEFER", "أجّل", GREY, ["Player DNA AI", "Similarity Engine", "Autonomous Scouting Copilot", "قاعدة لاعبين عالمية", "AI تكتيكي كامل", "شبكة اجتماعية", "Marketplace", "مقاييس بدنية مؤتمتة غير متحقق منها"]],
  ];
  const qw = (CW - 0.3) / 2, qh = 2.4;
  q.forEach((qq, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - M - (col + 1) * qw - col * 0.3, y = 1.6 + row * (qh + 0.25);
    rect(s, x, y, qw, qh, PANEL, { line: qq[2], lw: 1.25 });
    en(s, qq[0], { x: x + 0.3, y: y + 0.18, w: qw - 0.6, h: 0.32, fontSize: 13, bold: true, color: qq[2] });
    t(s, qq[1], { x: x + 0.3, y: y + 0.5, w: qw - 0.6, h: 0.4, fontSize: 17, bold: true });
    const half = Math.ceil(qq[3].length / 2);
    [qq[3].slice(0, half), qq[3].slice(half)].forEach((list, k) => {
      if (!list.length) return;
      s.addText(list.map((it, j) => ({ text: it, options: { bullet: true, breakLine: j < list.length - 1 } })),
        Object.assign({}, AR, { x: x + qw - 0.3 - (k + 1) * ((qw - 0.6) / 2), y: y + 0.98, w: (qw - 0.6) / 2 - 0.1, h: qh - 1.1, fontSize: 13, color: SOFT, paraSpaceAfter: 2 }));
    });
  });
  foot(s, SRC_REPORT);
}

// ═══════════════════ SECTION 06 — DECISIONS & EXECUTION ═══════════════════
const S6 = "06 · القرارات والتنفيذ";
pres.addSection({ title: S6 });

// 26 — MVP for first paying academy
{
  const s = slide(S6, "06 · MVP FOR FIRST PAYING ACADEMY", "الحد الأدنى من المنتج لأول أكاديمية تدفع",
    "هذا منتج عملي وليس منصة طموحة. سبع خطوات تمثل سير العمل الأسبوعي للأكاديمية: إعداد الأكاديمية، قائمة الفريق واللاعبين، مباراة أو تدريب، تقييم المدرب، دليل الفيديو، سجل التطور، وتقرير اللاعب.\n" +
    "كل الخطوات تقوم على صلاحيات منظمة آمنة؛ بدونها لا يمكن البيع.\n" +
    "الأهمية: هذا السير يحوّل الأجزاء الموجودة (ملف اللاعب، نموذج التقييم، الرفع) إلى قيمة متصلة يدفع مقابلها العميل.\n" +
    "مؤشر النجاح: أكاديمية تستخدم السير كاملاً بشكل متكرر، لا عدد الميزات.\n" +
    "ملاحظة: هذا سير عمل مقترح، وليس وظيفة إنتاج قائمة حالياً.");
  const steps = ["إعداد الأكاديمية", "قائمة الفريق واللاعبين", "مباراة / تدريب", "تقييم المدرب", "دليل الفيديو", "سجل التطور", "تقرير اللاعب"];
  const sw = 1.5, gap = (CW - 7 * sw) / 6, y = 2.0;
  steps.forEach((st, i) => {
    const x = W - M - (i + 1) * sw - i * gap;
    s.addShape(pres.shapes.OVAL, { x: x + sw / 2 - 0.35, y, w: 0.7, h: 0.7, fill: { color: TEAL, transparency: 80 }, line: { color: TEAL, width: 1.25 } });
    en(s, String(i + 1), { x: x + sw / 2 - 0.35, y, w: 0.7, h: 0.7, fontSize: 16, bold: true, align: "center", valign: "middle" });
    t(s, st, { x, y: y + 0.85, w: sw, h: 0.75, fontSize: 14, bold: true, align: "center" });
    if (i < 6) arrowL(s, x - gap + 0.05, y + 0.35, gap - 0.1 + 0.4, TEAL);
  });
  rect(s, M, 4.0, CW, 0.75, RED, { tr: 88, line: RED });
  t(s, "الأساس الإلزامي: صلاحيات منظمة آمنة وعزل بيانات كل أكاديمية", { x: M + 0.3, y: 4.0, w: CW - 0.6, h: 0.75, fontSize: 17, bold: true, align: "center", valign: "middle" });
  const crit = [["ما ليس ضمن الـ MVP", "تحليل CV مؤتمت، AI تكتيكي، قاعدة لاعبين عالمية، سوق"], ["مؤشر النجاح", "أكاديمية واحدة تستخدم السير كاملاً بشكل متكرر"]];
  const cw = (CW - 0.3) / 2;
  crit.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.3;
    rect(s, x, 5.0, cw, 1.3, PANEL);
    t(s, c[0], { x: x + 0.3, y: 5.12, w: cw - 0.6, h: 0.4, fontSize: 15, bold: true, color: i ? TEAL : GREY });
    t(s, c[1], { x: x + 0.3, y: 5.55, w: cw - 0.6, h: 0.65, fontSize: 14, color: SOFT });
  });
  foot(s, "سير عمل مقترح — Proposed Concept, Not Current Production Functionality · " + SRC_REPORT);
}

// 27 — 90-day roadmap
{
  const s = slide(S6, "06 · 90-DAY ROADMAP", "خارطة طريق 90 يوماً — أربع مراحل وأربع بوابات",
    "أربع مراحل، كل منها تنتهي ببوابة قرار لا ننتقل بعدها إلا بدليل.\n" +
    "الأيام 1–15: الثقة وحقيقة الإنتاج — إغلاق P0 الأمني وتوحيد الهوية ومصدر حقيقة النشر. البوابة: نجاح اختبارات الأمان والهوية والرفع.\n" +
    "الأيام 16–35: توحيد MVP الأكاديمية. البوابة: المدرب يدير ويقيّم ويسترجع السجل.\n" +
    "الأيام 36–65: تجربة مع أكاديمية واحدة. البوابة: استخدام متكرر للسير.\n" +
    "الأيام 66–90: التحويل المدفوع والتحقق من الذكاء. البوابة: دليل على الطلب والاستعداد للدفع.\n" +
    "القرار: عدم الانتقال لأي مرحلة دون اجتياز بوابتها.");
  const ph = [
    ["DAYS 1–15", "الثقة وحقيقة الإنتاج", "Gate 1", "نجاح اختبارات الأمان والهوية والرفع"],
    ["DAYS 16–35", "توحيد MVP الأكاديمية", "Gate 2", "المدرب يدير ويقيّم ويسترجع السجل"],
    ["DAYS 36–65", "تجربة مع أكاديمية واحدة", "Gate 3", "أكاديمية تستخدم السير بشكل متكرر"],
    ["DAYS 66–90", "التحويل المدفوع والتحقق من الذكاء", "Gate 4", "دليل على الطلب والاستعداد للدفع"],
  ];
  const pw = (CW - 3 * 0.25) / 4;
  s.addShape(pres.shapes.LINE, { x: M, y: 3.15, w: CW, h: 0, line: { color: HEX.line, width: 2 } });
  ph.forEach((p, i) => {
    const x = W - M - (i + 1) * pw - i * 0.25;
    rect(s, x, 1.65, pw, 1.25, PANEL, { line: TEAL });
    en(s, p[0], { x: x + 0.2, y: 1.78, w: pw - 0.4, h: 0.3, fontSize: 12, bold: true });
    t(s, p[1], { x: x + 0.2, y: 2.1, w: pw - 0.4, h: 0.7, fontSize: 15, bold: true });
    s.addShape(pres.shapes.DIAMOND, { x: x + pw / 2 - 0.2, y: 2.95, w: 0.4, h: 0.4, fill: { color: AMBER }, line: { type: "none" } });
    rect(s, x, 3.6, pw, 1.6, AMBER, { tr: 90, line: AMBER });
    en(s, p[2].toUpperCase(), { x: x + 0.2, y: 3.72, w: pw - 0.4, h: 0.3, fontSize: 12, bold: true, color: AMBER });
    t(s, p[3], { x: x + 0.2, y: 4.05, w: pw - 0.4, h: 1.05, fontSize: 14 });
  });
  rect(s, M, 5.45, CW, 0.85, PANEL);
  t(s, "قاعدة البوابة: لا انتقال إلى المرحلة التالية دون دليل موثّق على اجتياز البوابة", { x: M + 0.3, y: 5.45, w: CW - 0.6, h: 0.85, fontSize: 16, bold: true, align: "center", valign: "middle", color: TEAL });
  foot(s, SRC_REPORT);
}

// 28 — Founder & CTO decisions
{
  const s = slide(S6, "06 · FOUNDER & CTO DECISION BRIEF", "خمسة قرارات مطلوبة اليوم",
    "نطلب الموافقة على خمسة قرارات مباشرة:\n" +
    "1) الأمان قبل النمو: لا عروض ولا تجارب قبل إغلاق P0.\n" +
    "2) إصلاح عقود الهوية والتقييم: معرّف واحد متسق وجدول evaluations فعلي.\n" +
    "3) الرؤية الحاسوبية تجريبية حتى يثبت العكس بـ Ground Truth.\n" +
    "4) التجربة مع أكاديمية واحدة بدل التوسع.\n" +
    "5) مسار نشر إنتاج واحد معتمد.\n" +
    "هذه القرارات لا تتطلب ميزانية كبيرة، لكنها تتطلب انضباطاً في الأولويات.");
  const ds = [
    ["أصلحوا الأمان قبل النمو", "لا عروض ولا تجارب قبل إغلاق بنود P0"],
    ["أصلحوا عقود الهوية والتقييم", "معرّف متسق من Auth إلى الدليل، وجدول evaluations فعلي"],
    ["عاملوا الرؤية الحاسوبية كتجربة", "لا ادعاءات رؤية حاسوبية قبل تحقق مستقل وبيانات مرجعية"],
    ["جرّبوا مع أكاديمية واحدة", "عمق الاستخدام قبل عدد العملاء"],
    ["اعتمدوا مسار نشر واحداً", "النطاق ← الاستضافة ← نسخة النشر ← الفرع ← قاعدة البيانات ← الخادم"],
  ];
  ds.forEach((d, i) => {
    const y = 1.65 + i * 0.95;
    rect(s, M, y, CW, 0.8, PANEL);
    s.addShape(pres.shapes.OVAL, { x: W - M - 0.85, y: y + 0.1, w: 0.6, h: 0.6, fill: { color: TEAL }, line: { type: "none" } });
    en(s, String(i + 1), { x: W - M - 0.85, y: y + 0.1, w: 0.6, h: 0.6, fontSize: 16, bold: true, color: BG, align: "center", valign: "middle" });
    t(s, d[0], { x: W - M - 6.2, y, w: 5.1, h: 0.8, fontSize: 19, bold: true, valign: "middle" });
    t(s, d[1], { x: M + 0.3, y, w: CW - 6.9, h: 0.8, fontSize: 14, color: SOFT, valign: "middle" });
  });
  foot(s, SRC_REPORT);
}

// 29 — Closing
{
  const s = pres.addSlide({ masterName: "HERO", sectionTitle: S6 });
  s.addNotes(
    "الخلاصة: البوصلة الاستراتيجية هي سلسلة واحدة: الدليل ← التقييم ← التطوير ← القرار.\n" +
    "لا نبني منصة تدّعي الذكاء، بل منصة تثبت كيف يتحسّن اللاعبون وتساعد المدربين على اتخاذ قرارات أفضل.\n" +
    "ثلاث قواعد نلتزم بها: الدليل قبل التوسع، وثقة المنتج قبل طموح الذكاء الاصطناعي، والتحقق من العميل قبل التوسع.\n" +
    "نفتح الآن النقاش حول القرارات الخمسة.");
  en(s, "STRATEGIC NORTH STAR", { x: M, y: 0.9, w: CW, h: 0.4, fontSize: 14, bold: true, align: "center" });
  const ch = ["EVIDENCE", "EVALUATION", "DEVELOPMENT", "DECISION"];
  const ar = ["الدليل", "التقييم", "التطوير", "القرار"];
  const bw = 2.6, gap = (CW - 4 * bw) / 3;
  ch.forEach((c, i) => {
    const x = M + i * (bw + gap);
    rect(s, x, 1.9, bw, 1.5, BG, { line: TEAL, lw: 1.5, tr: 20 });
    en(s, c, { x, y: 2.0, w: bw, h: 0.7, fontSize: 18, bold: true, align: "center", valign: "middle", color: WHITE });
    t(s, ar[i], { x, y: 2.7, w: bw, h: 0.5, fontSize: 16, align: "center", color: TEAL });
    if (i < 3) { s.addShape(pres.shapes.LINE, { x: x + bw + 0.05, y: 2.65, w: gap - 0.1, h: 0, line: { color: TEAL, width: 2, endArrowType: "triangle" } }); }
  });
  t(s, "ابنوا منصة تثبت كيف يتحسّن اللاعبون، وتساعد المدربين على اتخاذ قرارات أفضل", { x: M + 0.5, y: 3.9, w: CW - 1, h: 0.9, fontSize: 24, bold: true, align: "center", color: WHITE });
  en(s, "Evidence Before Expansion  ·  Product Trust Before AI Ambition  ·  Customer Validation Before Scale", { x: M, y: 5.0, w: CW, h: 0.4, fontSize: 12, align: "center", color: SOFT });
  s.addImage({ path: LOGO, x: W / 2 - 1.25, y: 5.95, w: 0.55, h: 0.55 });
  s.addText([{ text: "ADA", options: { color: WHITE } }, { text: "2", options: { color: TEAL } }, { text: "AI", options: { color: WHITE } }], { isTextBox: true, x: W / 2 - 0.6, y: 5.95, w: 2, h: 0.55, fontFace: "Orbitron", fontSize: 24, bold: true, valign: "middle", margin: 0 });
}

// ═══════════════════ APPENDIX ═══════════════════
const SA = "ملحق · الأدلة";
pres.addSection({ title: SA });

// A1 — Source register
{
  const s = slide(SA, "APPENDIX A · SOURCE REGISTER", "سجل المصادر",
    "هذا سجل المصادر الذي يستند إليه العرض.\n" +
    "المصدر الأساسي هو التقرير. تم التحقق من نتائج الكود المذكورة مباشرة في المستودع العام عند commit 31a060b.\n" +
    "لم يتم الوصول المباشر لمواقع المنافسين أثناء إعداد هذه النسخة، لذلك روابطها مرجعية ويجب مطابقتها مع سجل المصادر الكامل في التقرير.\n" +
    "لم تُستخدم أي لقطات شاشة لـ Ada2AI أو للمنافسين في هذا العرض.");
  const hdr = ["حالة التحقق في هذا العرض", "ما يدعمه", "المصدر"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const rows = [
    ["ADA2AI_Dashboard_Capability_Benchmark_2026-11-02.md", "المصدر الأساسي لكل النتائج والدرجات", "الملف لم يكن متاحاً في جلسة الإعداد — المحتوى من موجز العرض المعتمد", AMBER],
    ["github.com/fahdoshstore-droid/Ada2AI — main @31a060b", "المسارات، مسار الرفع، «قريباً»، غياب /compare", "تم التحقق مباشرة من الكود", TEAL],
    ["src/App.tsx · src/hooks/useMediaUpload.ts", "الشرائح 4، 13، 16، 19", "تم التحقق مباشرة من الكود", TEAL],
    ["src/pages/ScoutDashboard.tsx · coach/Workspace.tsx", "الشرائح 15، 16", "تم التحقق مباشرة من الكود", TEAL],
    ["لقطة Supabase الحية — 2 نوفمبر 2026", "عدد الصفوف، السياسات، الحاويات", "وفق التقرير — لم يُعد الاستعلام", AMBER],
    ["Hudl Wyscout — hudl.com/products/wyscout", "الشريحة 6", "مرجعي — طابقوا مع سجل التقرير", GREY],
    ["DataMB — datamb.football (الدليل الرسمي)", "الشريحة 7 (55 / 120+ / 5M+)", "مرجعي — طابقوا مع سجل التقرير", GREY],
    ["Grintafy — grintafy.com", "الشريحة 8", "مرجعي — طابقوا مع سجل التقرير", GREY],
    ["Grinta Rush — مواد الفعالية العامة", "الشريحة 9", "وفق التقرير", GREY],
    ["Veo — veo.co", "الشريحة 10", "مرجعي — طابقوا مع سجل التقرير", GREY],
  ];
  const body = rows.map((r) => [{ text: r[2], options: { color: r[3] } }, { text: r[1], options: { color: SOFT } }, { text: r[0], options: { bold: true, fontSize: 11 } }]);
  s.addTable([hdr, ...body], { x: M, y: 1.6, w: CW, colW: [3.8, 3.6, 4.733], rowH: 0.43, fontFace: "Cairo", fontSize: 11, color: WHITE, align: "right", valign: "middle", rtlMode: true, fill: { color: PANEL }, border: { type: "solid", pt: 1, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  foot(s, "تاريخ التقييم: 2 نوفمبر 2026");
}

// A2 — Evidence limitations & method
{
  const s = slide(SA, "APPENDIX B · EVIDENCE LIMITATIONS", "حدود الأدلة ومنهجية القراءة",
    "هذه الشريحة تحمي مصداقية العرض. نوضح ما يمكن وما لا يمكن استنتاجه.\n" +
    "لم تتوفر جلسة مصادَق عليها للوحة Ada2AI أثناء التدقيق، فلم نعرض أي لقطات شاشة للمنتج. ووجود الكود لا يعني التنفيذ في الإنتاج. ونتائج الأمان إعدادات وليست اختراقاً. ولا توجد ادعاءات دقة AI بلا Ground Truth.\n" +
    "مستويات الخطورة في هذا العرض تقديرية بناءً على الأثر الموصوف، ويجب مطابقتها مع تصنيف التقرير إن وُجد.");
  const lim = [
    ["لا جلسة مصادَق عليها", "لم تتوفر جلسة دخول للوحة Ada2AI أثناء التدقيق — لا لقطات شاشة للمنتج في هذا العرض."],
    ["الكود ≠ التنفيذ", "وجود الكود أو المسار لا يثبت عمل الوظيفة في الإنتاج."],
    ["المخطط ≠ السلوك", "وجود جدول في المخطط لا يثبت الاستخدام؛ نعتمد على عدد الصفوف الفعلي."],
    ["إعدادات ≠ اختراق", "نتائج الأمان إعدادات تشير لتعرّض محتمل، دون دليل على وصول غير مصرّح به."],
    ["لا Ground Truth", "لا ادعاء لدقة أي مخرجات AI أو CV."],
    ["المنافسون من المواد العامة", "لم تُختبر منتجات المنافسين من الداخل؛ الأرقام كما نشرتها الشركات."],
  ];
  const cw = (CW - 0.3) / 2;
  lim.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - M - (col + 1) * cw - col * 0.3, y = 1.65 + row * 1.5;
    rect(s, x, y, cw, 1.3, PANEL, { line: HEX.line });
    t(s, l[0], { x: x + 0.3, y: y + 0.15, w: cw - 0.6, h: 0.42, fontSize: 16, bold: true, color: TEAL });
    t(s, l[1], { x: x + 0.3, y: y + 0.58, w: cw - 0.6, h: 0.65, fontSize: 13, color: SOFT });
  });
  foot(s, SRC_REPORT + " · تصنيفات الخطورة في هذا العرض تقديرية");
}

(async () => {
  const out = process.argv[2] || "ADA2AI_Executive_Benchmark_2026-11-02.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out, "scores available:", SCORES_AVAILABLE);
})();
