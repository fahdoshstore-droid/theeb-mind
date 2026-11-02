// ADA2AI — Dashboard & Capability Competitive Benchmark — executive deck generator (ENGLISH, LTR)
// Geometry mirrors the Arabic (RTL) deck: every slide is laid out in RTL coordinates and
// mirrored to LTR by wrapSlide(), so both language versions stay structurally identical.
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
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.32, w: CW, h: 0.3, fontFace: "Orbitron", fontSize: 10, bold: true, color: "00DCC8", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.62, w: CW, h: 0.8, fontFace: "Cairo", fontSize: 30, bold: true, color: "FFFFFF", align: "left", valign: "top", margin: 0, lang: "en-US" }, text: "" } },
  ],
  slideNumber: { x: W - M - 0.6, y: 6.98, w: 0.6, h: 0.26, fontFace: "Orbitron", fontSize: 8, color: "7F8C92", align: "right" },
});
pres.defineSlideMaster({ title: "HERO", background: { path: PITCH }, objects: [] });

// ───────────────────────── RTL → LTR MIRROR ─────────────────────────
const flip = (a) => (a === "right" ? "left" : a === "left" ? "right" : a);
function mx(o) { if (o && typeof o.x === "number" && typeof o.w === "number") o.x = W - o.x - o.w; }
function wrapSlide(s) {
  const at = s.addText.bind(s), as = s.addShape.bind(s), ai = s.addImage.bind(s), atb = s.addTable.bind(s), ac = s.addChart.bind(s);
  s.addText = (text, o = {}) => {
    if (o.placeholder) return at(text, o);
    o = Object.assign({}, o); mx(o);
    if (o.align) o.align = flip(o.align);
    o.rtlMode = false; o.lang = "en-US";
    return at(text, o);
  };
  s.addShape = (type, o = {}) => {
    o = Object.assign({}, o); mx(o);
    if (o.line && (o.line.beginArrowType || o.line.endArrowType) && o.h === 0) {
      const l = Object.assign({}, o.line), b = l.beginArrowType, e = l.endArrowType;
      delete l.beginArrowType; delete l.endArrowType;
      if (b) l.endArrowType = b; if (e) l.beginArrowType = e;
      o.line = l;
    }
    return as(type, o);
  };
  s.addImage = (o) => { o = Object.assign({}, o); mx(o); return ai(o); };
  s.addChart = (type, data, o) => { o = Object.assign({}, o); mx(o); return ac(type, data, o); };
  s.addTable = (rows, o) => {
    o = Object.assign({}, o); mx(o);
    if (o.colW) o.colW = o.colW.slice().reverse();
    if (o.align) o.align = o.align === "right" ? "left" : o.align;
    o.rtlMode = false;
    rows = rows.map((r) => r.slice().reverse().map((c) => {
      const opt = Object.assign({}, c.options || {});
      if (opt.align === "right") opt.align = "left";
      return { text: c.text, options: opt };
    }));
    return atb(rows, o);
  };
  return s;
}

// ───────────────────────── HELPERS (RTL coordinates; mirrored on output) ─────────────────────────
const TX = { align: "right", valign: "top", margin: 0, isTextBox: true, fontFace: "Cairo" };
function t(s, text, o) { s.addText(text, Object.assign({}, TX, { fontSize: 14, color: WHITE }, o)); }
function en(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: "Orbitron", fontSize: 14, color: TEAL, align: "right", valign: "top" }, o)); }
function rect(s, x, y, w, h, fill, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: fill, transparency: o.tr || 0 }, line: o.line ? { color: o.line, width: o.lw || 1 } : { type: "none" } });
}
function pill(s, text, x, y, w, color, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: o.h || 0.32, rectRadius: 0.16, fill: { color, transparency: o.tr ?? 82 }, line: { color, width: 1 } });
  s.addText(text, Object.assign({}, TX, { x, y, w, h: o.h || 0.32, align: "center", valign: "middle", fontSize: o.size || 11, bold: true, color: o.tc || color, fontFace: o.font || "Cairo" }));
}
function foot(s, text) { t(s, text, { x: M, y: 6.55, w: CW, h: 0.34, fontSize: 10, color: GREY, valign: "bottom" }); }
function arrowL(s, x, y, w, color = TEAL) { s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width: 1.5, beginArrowType: "triangle" } }); }
function arrowD(s, x, y, h, color = TEAL) { s.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color, width: 1.5, endArrowType: "triangle" } }); }
function slide(section, kicker, title, notes) {
  const s = wrapSlide(pres.addSlide({ masterName: "CONTENT", sectionTitle: section }));
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  s.addNotes(notes);
  return s;
}
const bullets = (items) => items.map((it, k) => ({ text: it, options: { bullet: true, breakLine: k < items.length - 1 } }));
const SRC_REPORT = "Source: ADA2AI_Dashboard_Capability_Benchmark_2026-11-02.md";
const SRC_CODE = "Ada2AI GitHub main @31a060b";

// ═══════════════════ SECTION 01 — EXECUTIVE VERDICT ═══════════════════
const S1 = "01 · Executive Verdict";
pres.addSection({ title: S1 });

// 1 — Cover
{
  const s = wrapSlide(pres.addSlide({ masterName: "HERO", sectionTitle: S1 }));
  s.addImage({ path: LOGO, x: W - M - 0.9, y: 0.7, w: 0.9, h: 0.9 });
  s.addText([{ text: "ADA", options: { color: WHITE } }, { text: "2", options: { color: TEAL } }, { text: "AI", options: { color: WHITE } }],
    { isTextBox: true, x: M, y: 1.8, w: CW, h: 1.1, fontFace: "Orbitron", fontSize: 66, bold: true, align: "right", margin: 0 });
  en(s, "Dashboard & Capability Competitive Benchmark", { x: M, y: 3.0, w: CW, h: 0.6, fontSize: 26, color: WHITE, bold: true });
  en(s, "Executive Product & Technology Assessment", { x: M, y: 3.6, w: CW, h: 0.45, fontSize: 16, color: TEAL });
  t(s, "How Ada2AI's dashboards and capabilities compare with five market benchmarks", { x: M, y: 4.2, w: CW, h: 0.5, fontSize: 18, color: SOFT });
  en(s, "2 NOVEMBER 2026", { x: M, y: 6.3, w: 5, h: 0.35, fontSize: 12, color: GREY, align: "left" });
  t(s, "Executive decision document — not marketing material", { x: W - M - 6, y: 6.3, w: 6, h: 0.35, fontSize: 12, color: GREY, align: "right" });
  s.addNotes(
    "Opening: this is an executive assessment of Ada2AI against five market benchmarks, dated 2 November 2026.\n" +
    "The purpose is not to make Ada2AI look stronger than it is. It is to show exactly where it stands, where it can win, what threatens its credibility, and which decisions come next.\n" +
    "The primary source is the report ADA2AI_Dashboard_Capability_Benchmark_2026-11-02, together with code inspection and a live database snapshot.\n" +
    "At the end we will ask for approval of five clear decisions."
  );
}

// 2 — Executive verdict
{
  const s = slide(S1, "01 · EXECUTIVE VERDICT", "Usable foundation — automated Football Intelligence not yet established",
    "Main message: Ada2AI has a real product foundation to build on, but its status as a fully automated Football Intelligence platform has not been established.\n" +
    "Evidence: the code contains role-based dashboards (player, coach, scout, organizations), an evaluation form and video upload. But the live database snapshot of 2 November 2026 shows 0 rows in video_analyses, reports and matches; the evaluations table does not exist in the live database; and there is no independent execution evidence for the YOLO/FastAPI pipeline.\n" +
    "Why it matters: confusing 'exists in code' with 'operationally proven' is the biggest credibility risk with investors and academies.\n" +
    "Recommended decision: communicate externally only what is proven, and label everything else experimental until verified.");
  const cols = [
    { h: "What exists", e: "EXISTS IN CODE", c: TEAL, items: ["Role-based dashboards: player, coach, scout, organizations", "Player profile and coach evaluation form", "Video upload and Coach Workspace", "Scout search and position filters", "Arabic RTL interface"] },
    { h: "Operationally proven", e: "OPERATIONALLY PROVEN", c: AMBER, items: ["5 profiles, 5 players and 1 coach in the live database", "31 rows in sport_identities", "2 rows in football_coach_players", "No matches, reports or video analyses recorded (0)"] },
    { h: "Not verified", e: "NOT VERIFIED", c: RED, items: ["YOLO / FastAPI pipeline in production", "Working evaluation history on the live database", "Player development over time", "Academy data isolation (tenant isolation)", "Accuracy of any AI output against ground truth"] },
  ];
  const cw = (CW - 0.6) / 3;
  cols.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.3, y = 2.0;
    rect(s, x, y, cw, 3.9, PANEL, { line: c.c, lw: 1 });
    en(s, c.e, { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.3, fontSize: 10, color: c.c, bold: true });
    t(s, c.h, { x: x + 0.3, y: y + 0.55, w: cw - 0.6, h: 0.5, fontSize: 20, bold: true });
    s.addText(bullets(c.items), Object.assign({}, TX, { x: x + 0.3, y: y + 1.2, w: cw - 0.6, h: 2.6, fontSize: 14, color: SOFT, paraSpaceAfter: 6 }));
  });
  foot(s, SRC_REPORT + " · Supabase snapshot, 2 Nov 2026 · " + SRC_CODE);
}

// 3 — Executive summary
{
  const s = slide(S1, "01 · EXECUTIVE SUMMARY", "Executive summary — answers to the six questions",
    "This slide summarises the whole deck in six answers. If there is time for only one slide, it is this one.\n" +
    "Key point: the five benchmarks are not one product category, and Veo in particular already offers video analysis and AI tracking to academies. Ada2AI cannot differentiate through video upload or AI terminology alone.\n" +
    "Proposed winning space: Arabic-first academy player development operations — connecting player profiles, coach evaluation, video evidence and longitudinal development.\n" +
    "Decision: approve security and identity as the priority before any growth, and run a one-academy pilot.");
  const rows = [
    ["How do we compare?", "Benchmarks cover different categories; Ada2AI sits closest to academy operations but has not reached any of them in maturity."],
    ["How mature are the dashboards?", "A role-based structure exists in code; actual usage in the live database is very limited."],
    ["What do we genuinely have today?", "Player profiles, human evaluation form, scout search, Coach Workspace, Arabic interface."],
    ["What are the critical gaps?", "Data exposure via public policies, upload identity mismatch, missing evaluations table."],
    ["Where can we win?", "Arabic-first academy player development: evaluation + video evidence + development history."],
    ["What should we decide?", "Security first, fix identity and evaluation contracts, CV experimental, one-academy pilot, one deployment path."],
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
  const s = slide(S1, "01 · FIVE CRITICAL DISCOVERIES", "Five critical discoveries",
    "The five discoveries are ordered by severity.\n" +
    "1) The evaluations table does not exist in the live database although the code queries it — evaluation history cannot work as designed.\n" +
    "2) Identity mismatch in video upload: the storage path uses players.id while the storage policy expects auth.uid().\n" +
    "3) The player-media bucket is public, with broad read and write policies. This is a potential exposure arising from configuration — not a confirmed breach. We must be precise about this wording.\n" +
    "4) Player comparison and PDF export are incomplete.\n" +
    "5) There is no independent execution evidence for the YOLO/FastAPI pipeline in production.\n" +
    "Note: severity levels are this deck's assessment, based on the impact described in the report.\n" +
    "Decision: items 2 and 3 must be closed before any commercial demo or growth.");
  const items = [
    ["CRITICAL", RED, "The evaluations table does not exist in the live database", "The code retrieves evaluations, but the table is missing in Supabase — no real evaluation history."],
    ["CRITICAL", RED, "Player / Profile / Auth identity mismatch in video upload", "A file can upload while the analysis is never registered — a silent failure."],
    ["CRITICAL", RED, "Public player-media bucket and overly broad access policies", "Potential exposure from configuration — not a confirmed breach."],
    ["HIGH", AMBER, "No independently verified YOLO / FastAPI production pipeline", "CV capabilities must not be marketed as operational."],
    ["MEDIUM", GREY, "Player comparison workflow and PDF export incomplete", "/compare route is not registered; PDF button shows \"coming soon\"."],
  ];
  items.forEach((it, i) => {
    const y = 1.68 + i * 0.95;
    rect(s, M, y, CW, 0.82, PANEL);
    en(s, String(i + 1), { x: W - M - 0.65, y, w: 0.45, h: 0.82, fontSize: 24, bold: true, valign: "middle", color: it[1] });
    t(s, it[2], { x: W - M - 8.4, y: y + 0.08, w: 7.6, h: 0.38, fontSize: 16, bold: true });
    t(s, it[3], { x: W - M - 8.4, y: y + 0.44, w: 7.6, h: 0.32, fontSize: 13, color: SOFT });
    pill(s, it[0], M + 0.3, y + 0.25, 1.4, it[1], { font: "Orbitron", size: 10 });
  });
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/App.tsx · src/hooks/useMediaUpload.ts · src/pages/ScoutDashboard.tsx) · Severity: this deck's assessment");
}

// ═══════════════════ SECTION 02 — COMPETITIVE LANDSCAPE ═══════════════════
const S2 = "02 · Competitive Landscape";
pres.addSection({ title: S2 });

// 5 — Ecosystem
{
  const s = slide(S2, "02 · COMPETITIVE ECOSYSTEM", "Five benchmarks — five different product categories",
    "Key idea: the five benchmarks are not identical products and should not be forced into one ranking.\n" +
    "Wyscout is professional scouting and recruitment, DataMB is statistical intelligence, Grintafy is talent discovery and participation, Grinta Rush is a field-based assessment format, and Veo is video-first academy analytics.\n" +
    "Why it matters: each benchmark teaches a different lesson, and comparison must be by category, not an overall ranking.\n" +
    "Implication for Ada2AI: we must pick a category where we can win, rather than trying to imitate everyone.");
  const comps = [
    ["Hudl Wyscout", "Professional scouting & recruitment"],
    ["DataMB", "Statistical football intelligence"],
    ["Grintafy", "Talent discovery & participation"],
    ["Grinta Rush", "Field-based assessment"],
    ["Veo", "Video-first academy analytics"],
  ];
  const cw = (CW - 4 * 0.25) / 5;
  comps.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.25, y = 1.9;
    rect(s, x, y, cw, 3.6, PANEL, { line: HEX.line });
    s.addShape(pres.shapes.OVAL, { x: x + cw / 2 - 0.35, y: y + 0.35, w: 0.7, h: 0.7, fill: { color: TEAL, transparency: 85 }, line: { color: TEAL, width: 1 } });
    en(s, String(i + 1).padStart(2, "0"), { x: x + cw / 2 - 0.35, y: y + 0.35, w: 0.7, h: 0.7, fontSize: 14, bold: true, align: "center", valign: "middle" });
    en(s, c[0], { x: x + 0.15, y: y + 1.3, w: cw - 0.3, h: 0.45, fontSize: 14, bold: true, color: WHITE, align: "center" });
    t(s, c[1], { x: x + 0.15, y: y + 1.95, w: cw - 0.3, h: 1.2, fontSize: 15, bold: true, align: "center", color: SOFT });
  });
  rect(s, M, 5.8, CW, 0.62, TEAL, { tr: 88, line: TEAL });
  t(s, "We do not rank these products on one scale — each is measured within its own category", { x: M + 0.3, y: 5.8, w: CW - 0.6, h: 0.62, fontSize: 16, bold: true, valign: "middle", align: "center", color: TEAL });
  foot(s, SRC_REPORT + " · Competitors' official public material as listed in the report's source register");
}

function competitor(kicker, name, positionEn, features, lesson, notes, extra) {
  const s = slide(S2, kicker, name + " — " + positionEn, notes);
  const gx = W - M - 7.2, gw = 7.2, cols = 2, cellW = (gw - 0.25) / cols, cellH = 0.62;
  features.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = gx + gw - (col + 1) * cellW - col * 0.25, y = 1.75 + row * (cellH + 0.18);
    rect(s, x, y, cellW, cellH, PANEL, { line: HEX.line });
    s.addShape(pres.shapes.OVAL, { x: x + cellW - 0.38, y: y + cellH / 2 - 0.09, w: 0.18, h: 0.18, fill: { color: TEAL }, line: { type: "none" } });
    t(s, f, { x: x + 0.2, y, w: cellW - 0.7, h: cellH, fontSize: 14, valign: "middle" });
  });
  const lx = M, lw = CW - gw - 0.4;
  rect(s, lx, 1.75, lw, 2.85, TEAL, { tr: 90, line: TEAL });
  en(s, "KEY LESSON", { x: lx + 0.3, y: 2.0, w: lw - 0.6, h: 0.3, fontSize: 10, bold: true });
  t(s, lesson, { x: lx + 0.3, y: 2.4, w: lw - 0.6, h: 2.0, fontSize: 18, bold: true });
  if (extra) extra(s, lx, lw);
  return s;
}
const implBox = (txt, color) => (s, lx, lw) => {
  rect(s, lx, 4.85, lw, 1.35, color || PANEL, color ? { tr: 88, line: color } : { line: HEX.line });
  t(s, txt, { x: lx + 0.3, y: 4.85, w: lw - 0.6, h: 1.35, fontSize: 15, bold: true, valign: "middle", color: color === AMBER ? AMBER : color ? WHITE : SOFT });
};

// 6 — Wyscout
{
  const s = competitor("02 · BENCHMARK 01", "Hudl Wyscout", "Professional Scouting & Recruitment",
    ["Global video library", "Player and team search", "Event-tagged video", "Shortlists", "Scouting reports", "Recruitment workflow", "API and integrations"],
    "The value is not any single feature but the connected workflow: player search → video evidence → recruitment decision.",
    "Wyscout is the reference for professional scouting. Its strength is linking search to event-tagged video, then to shortlists and reports, and finally to a recruitment decision.\n" +
    "Evidence: official public material as cited in the report; we did not test the product from the inside.\n" +
    "Lesson for Ada2AI: do not build disconnected screens; build one connected chain from evidence to decision. This is what we propose later: Evidence → Evaluation → Development → Decision.\n" +
    "We do not propose competing with Wyscout in global professional scouting.",
    implBox("For Ada2AI: don't compete in global pro scouting — learn to connect evidence to decision"));
  foot(s, SRC_REPORT + " · Hudl Wyscout official material (hudl.com) — per the report's source register");
}

// 7 — DataMB
{
  const s = competitor("02 · BENCHMARK 02", "DataMB", "Statistical Football Intelligence",
    ["Radar", "Rank", "Plot", "Index", "Scout tools", "DataMB Chat"],
    "A metric is useful only when its definition, context, sample and comparison group are clear.",
    "DataMB is a model of statistical intelligence: broad coverage, many metrics, and views such as Radar, Rank, Plot and Index.\n" +
    "Figures: 55 leagues, 120+ metrics and 5M+ data points — as reported in DataMB's official guide; not independently verified.\n" +
    "Lesson for Ada2AI: every number shown to a coach or scout must carry a definition, a source and context. This leads to the metric provenance principle on the coach dashboard.",
    (s, lx, lw) => {
      const stats = [["55", "leagues"], ["120+", "metrics"], ["5M+", "data points"]];
      const sw = (lw - 0.4) / 3;
      stats.forEach((st, i) => {
        const x = lx + lw - (i + 1) * sw - i * 0.2;
        rect(s, x, 4.85, sw, 1.35, PANEL);
        en(s, st[0], { x, y: 4.95, w: sw, h: 0.7, fontSize: 28, bold: true, align: "center" });
        t(s, st[1], { x, y: 5.65, w: sw, h: 0.4, fontSize: 13, align: "center", color: SOFT });
      });
    });
  foot(s, SRC_REPORT + " · Figures as reported in DataMB's official guide — not independently verified");
}

// 8 — Grintafy
{
  const s = competitor("02 · BENCHMARK 03", "Grintafy", "Talent Discovery & Participation",
    ["Player profiles", "Skills videos", "Tryouts", "Football CV", "Challenges", "Player participation", "Scout discovery"],
    "Access to players and recurring participation create value beyond analytics.",
    "Grintafy builds value on access to players and their recurring participation: profiles, skills videos, challenges and tryouts through which scouts discover talent.\n" +
    "Why it matters: the network and participation are competitive assets in themselves, not just analysis quality.\n" +
    "For Ada2AI: the academy is the natural access channel to players. Repeat use inside the academy matters more than a global player database — which is why we defer the global database and social network.",
    implBox("For Ada2AI: the academy is the access channel — repeat use before a global database"));
  foot(s, SRC_REPORT + " · Grintafy official material — per the report's source register");
}

// 9 — Grinta Rush
{
  const s = competitor("02 · BENCHMARK 04", "Grinta Rush", "Field-Based Assessment Experience",
    ["Competitive environment", "Changing match situations", "Adaptability", "Decision-making", "Academy participation"],
    "Assessment in a real competitive context reveals what statistics alone cannot.",
    "Grinta Rush is a field-based assessment within an event: a competitive environment and changing match situations that test adaptability and decision-making, with academies taking part.\n" +
    "Important: this is an assessment/event format, not a verified standalone SaaS analytics platform. That is why we do not compare it with software on every dimension, and some of its cells in the matrix may be N/A.\n" +
    "Lesson for Ada2AI: Ada2AI could be the documentation and evaluation layer for events like this, not a substitute for them.",
    implBox("An assessment / event format — not a verified standalone SaaS analytics platform", AMBER));
  foot(s, SRC_REPORT + " · Grinta Rush public event material — per the report's source register");
}

// 10 — Veo
{
  const s = competitor("02 · BENCHMARK 05", "Veo", "Video-First Academy Analytics",
    ["Video-first workspace", "Match recording", "Video clips", "Events feed", "Team and player analytics", "AI tracking", "Physical performance metrics", "Heatmaps and shot maps", "Analytics Studio", "Multi-match trends"],
    "Video analytics and AI tracking are already established capabilities in academy software.",
    "Veo is the closest to what some may imagine Ada2AI to be, so it deserves dedicated attention.\n" +
    "Veo already offers academies: match recording, clips, an events feed, AI tracking, physical metrics, heatmaps and shot maps, Analytics Studio, and multi-match trends.\n" +
    "Strategic conclusion: Ada2AI cannot differentiate merely through video upload, heatmaps or AI terminology — these are now table stakes.\n" +
    "Decision: our differentiation must come from linking human evaluation to evidence and development history, in Arabic, inside academy operations.",
    implBox("For Ada2AI: no differentiation through video upload, heatmaps or AI terminology alone", RED));
  foot(s, SRC_REPORT + " · Veo official material (veo.co) — per the report's source register");
}

// 11 — Positioning map
{
  const s = slide(S2, "02 · COMPETITIVE POSITIONING MAP", "Positioning map — six separate dimensions, no overall ranking",
    "This map is qualitative, not a score. Each product has one core category plus adjacent capabilities as shown in its public material.\n" +
    "Note that academy operations is not the core category of any of the five benchmarks, although Veo and Grinta Rush come close.\n" +
    "The Ada2AI row shows the proposed target position, not a proven current capability.\n" +
    "Decision: adopt Arabic-first academy player development operations as the positioning space.");
  const dims = ["Professional Scouting", "Statistical Intelligence", "Talent Discovery", "Field Assessment", "Academy Operations", "Video Intelligence"];
  const map = { "Hudl Wyscout": [2, 0, 0, 0, 0, 1], "DataMB": [1, 2, 0, 0, 0, 0], "Grintafy": [1, 0, 2, 0, 0, 1], "Grinta Rush": [0, 0, 1, 2, 1, 0], "Veo": [0, 0, 0, 0, 1, 2] };
  const sym = (v) => (v === 2 ? "●" : v === 1 ? "◐" : "—");
  const hdr = [{ text: "", options: {} }].concat(dims.map((d) => ({ text: d, options: { bold: true, color: TEAL, fontSize: 12 } }))).reverse();
  const body = Object.entries(map).map(([n, v]) => [{ text: n, options: { fontFace: "Orbitron", bold: true, fontSize: 12, color: WHITE, align: "right" } }]
    .concat(v.map((x) => ({ text: sym(x), options: { fontSize: 20, color: x === 2 ? TEAL : x === 1 ? MTEAL : GREY, align: "center" } }))).reverse());
  body.push([{ text: "Ada2AI (target)", options: { bold: true, fontSize: 13, color: AMBER, align: "right" } }]
    .concat([0, 0, 0, 0, 2, 1].map((x) => ({ text: x === 2 ? "◎" : x === 1 ? "◌" : "—", options: { fontSize: 20, color: x ? AMBER : GREY, align: "center" } }))).reverse());
  s.addTable([hdr, ...body], { x: M, y: 1.7, w: CW, colW: [1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 2.03], rowH: 0.62, fontFace: "Cairo", fontSize: 13, color: WHITE, align: "center", valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  t(s, "●  Core category     ◐  Adjacent capability in public material     —  Not a product focus     ◎ / ◌  Ada2AI target position (proposed)", { x: M, y: 6.15, w: CW, h: 0.35, fontSize: 12, color: SOFT });
  foot(s, "Qualitative mapping derived from the category descriptions in the report — not a score · " + SRC_REPORT);
}

// ═══════════════════ SECTION 03 — DASHBOARD AUDIT ═══════════════════
const S3 = "03 · Dashboard Audit";
pres.addSection({ title: S3 });

// 12 — Dashboard comparison
{
  const s = slide(S3, "03 · DASHBOARD COMPARISON", "Dashboard comparison — market reference vs. Ada2AI status",
    "This matrix compares each dimension with the nearest market reference, then classifies Ada2AI's status by the type of evidence available.\n" +
    "Key limitation: no authenticated Ada2AI dashboard session was available during the audit, so status is based on code inspection and the database snapshot, not on viewing live screens. Competitor data comes from public material.\n" +
    "What stands out: search, profiles and the role structure exist; evaluation, video, reporting and development history are not operationally proven; mobile was not assessed.\n" +
    "Decision: close the red evaluation and video dimensions before adding any new feature.");
  const ST = { ok: ["Exists in code", TEAL], part: ["Partial", AMBER], no: ["Not proven", RED], na: ["Not assessed", GREY] };
  const rows = [
    ["Dashboard structure", "Veo · Wyscout", "Role-based dashboards: player, coach, scout, organizations", "ok"],
    ["Information hierarchy", "—", "Needs restructuring (proposal on slide 14)", "part"],
    ["Player profiles", "Wyscout · Grintafy", "/player/:id route and player profile", "ok"],
    ["Statistics", "DataMB", "Coach-entered metrics without source labels", "part"],
    ["Video workflow", "Veo", "Upload exists; identity mismatch; 0 analyses recorded", "no"],
    ["Evaluation", "—", "Form exists; evaluations table missing in live DB", "no"],
    ["Scouting", "Wyscout", "Search, position filters, pagination", "ok"],
    ["Development history", "Veo (multi-match trends)", "Not proven on live data", "no"],
    ["Reporting", "Wyscout (scouting reports)", "PDF shows \"coming soon\"; reports = 0", "no"],
    ["Collaboration", "Wyscout (shortlists)", "Sharing from scout dashboard only", "part"],
    ["Administration", "—", "Organizations dashboard without membership or isolation", "part"],
    ["Mobile experience", "—", "Not assessed — no authenticated session", "na"],
  ];
  const hdr = ["Status", "Ada2AI — available evidence", "Market reference", "Dimension"].map((h) => ({ text: h, options: { bold: true, color: TEAL, fontSize: 12 } }));
  const body = rows.map((r) => [
    { text: ST[r[3]][0], options: { bold: true, color: ST[r[3]][1] } },
    { text: r[2], options: { color: SOFT } },
    { text: r[1], options: { color: GREY } },
    { text: r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], { x: M, y: 1.62, w: CW, colW: [1.7, 5.8, 2.6, 2.033], rowH: 0.36, fontFace: "Cairo", fontSize: 12, color: WHITE, align: "right", valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.1, 0, 0.1] });
  foot(s, "Evidence limitation: no authenticated Ada2AI session during the audit · Status from code (" + SRC_CODE + ") and Supabase snapshot · Competitors from public material");
}

// 13 — Product architecture
{
  const s = slide(S3, "03 · PRODUCT ARCHITECTURE", "Ada2AI product architecture — actual routes by role",
    "These are the actual routes registered in App.tsx on the main branch.\n" +
    "Four areas: Player (dashboard, profile, upload, video analysis), Coach (dashboard, workspace, evaluation form), Scout (dashboard, search and a comparison entry point), and Administration (organizations, rankings, club dashboard).\n" +
    "Key note: the compare button exists on the scout dashboard, but the /compare route is not registered in App.tsx.\n" +
    "Why it matters: a route existing does not mean the function works; all routes depend on Supabase, and several of its tables are empty.");
  const groups = [
    ["Player", "PLAYER", [["Player Dashboard", "/player/dashboard"], ["Player Profile", "/player/:id"], ["Video Upload", "/player/upload"], ["Video Analysis", "/video-analysis"]]],
    ["Coach", "COACH", [["Coach Dashboard", "/coach"], ["Coach Workspace", "/coach/workspace"], ["Evaluation Form", "/coach/evaluate/:playerId"]]],
    ["Scout", "SCOUT", [["Scout Dashboard", "/scout"], ["Player Search", "/scout (search)"], ["Comparison entry", "/compare (not registered)", true]]],
    ["Administration", "ADMIN", [["Organizations", "/organizations"], ["Rankings", "/rankings"], ["Club Dashboard", "/club/rawdha"]]],
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
      t(s, r[1], { x: x + 0.3, y: ry + 0.31, w: gw - 0.6, h: 0.26, fontSize: 10, color: r[2] ? RED : GREY });
    });
  });
  rect(s, M, 5.8, CW, 0.6, TEAL, { tr: 88, line: TEAL });
  t(s, "Data layer: Supabase (Auth · Postgres · Storage) — the only verified read/write backend", { x: M + 0.3, y: 5.8, w: CW - 0.6, h: 0.6, fontSize: 14, bold: true, align: "center", valign: "middle", color: TEAL });
  foot(s, SRC_CODE + " · src/App.tsx · " + SRC_REPORT);
}

// 14 — Player dashboard
{
  const s = slide(S3, "03 · PLAYER DASHBOARD AUDIT", "Player dashboard — what exists, and what is not proven",
    "What exists in code: player information, evaluation retrieval, navigation to video upload, and the player profile experience.\n" +
    "Not proven: evaluation history on the live database — because the evaluations table does not exist; development over time; and any 'automated insights'.\n" +
    "Proposal: reorder the hierarchy to start with player identity, then latest evaluation, then evidence, then development history, then next action.\n" +
    "Caution: this is a proposed concept, not a current production screen. It must not be shown to a customer as an existing product.");
  const half = (CW - 0.4) / 2;
  const blk = (x, title, en_, c, items) => {
    rect(s, x, 1.65, half, 2.35, PANEL, { line: c });
    en(s, en_, { x: x + 0.3, y: 1.8, w: half - 0.6, h: 0.28, fontSize: 10, bold: true, color: c });
    t(s, title, { x: x + 0.3, y: 2.08, w: half - 0.6, h: 0.42, fontSize: 18, bold: true });
    s.addText(bullets(items), Object.assign({}, TX, { x: x + 0.3, y: 2.55, w: half - 0.6, h: 1.35, fontSize: 14, color: SOFT, paraSpaceAfter: 3 }));
  };
  blk(W - M - half, "Exists in code", "EXISTS", TEAL, ["Player information and profile experience", "Evaluation retrieval in code", "Navigation to video upload"]);
  blk(M, "Not proven", "NOT PROVEN", RED, ["Working evaluation history on the live database", "Reliable longitudinal progress", "Verified automated insights"]);
  rect(s, M, 4.25, CW, 2.2, HEX.bg, { line: AMBER, lw: 1 });
  en(s, "PROPOSED CONCEPT — NOT CURRENT PRODUCTION FUNCTIONALITY", { x: M + 0.3, y: 4.38, w: CW - 0.6, h: 0.28, fontSize: 10, bold: true, color: AMBER });
  t(s, "Proposed information hierarchy", { x: M + 0.3, y: 4.66, w: CW - 0.6, h: 0.35, fontSize: 14, bold: true, color: AMBER });
  const steps = ["Player Identity", "Latest Evaluation", "Evidence", "Development History", "Next Action"];
  const sw = 2.0, gap = (CW - 0.6 - 5 * sw) / 4;
  steps.forEach((st, i) => {
    const x = W - M - 0.3 - (i + 1) * sw - i * gap;
    rect(s, x, 5.2, sw, 0.85, PANEL, { line: AMBER });
    t(s, st, { x, y: 5.2, w: sw, h: 0.85, fontSize: 15, bold: true, align: "center", valign: "middle" });
    if (i < 4) arrowL(s, x - gap + 0.08, 5.625, gap - 0.16, AMBER);
  });
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/pages/player/Dashboard.tsx)");
}

// 15 — Coach
{
  const s = slide(S3, "03 · COACH DASHBOARD & WORKSPACE", "Coach dashboard & workspace — coach-entered is not AI",
    "The Coach Workspace is the strongest operational asset in the product: squad data, match statistics, pending analysis queue, interactive pitch, manual result entry, and completed analysis history.\n" +
    "Critical point: many metrics are entered manually by the coach. Showing them next to AI terminology without a source label misleads users and investors.\n" +
    "Proposal: label every metric with its source: coach-entered, AI-generated, imported, or unverified.\n" +
    "Decision: make metric provenance labelling mandatory before any commercial demo.");
  const feats = ["Squad data", "Match statistics", "Pending analysis queue", "Interactive pitch", "Manual result entry", "Completed analysis history"];
  const fw = (CW - 2 * 0.25) / 3;
  feats.forEach((f, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = W - M - (col + 1) * fw - col * 0.25, y = 1.65 + row * 0.82;
    rect(s, x, y, fw, 0.65, PANEL, { line: HEX.line });
    t(s, f, { x: x + 0.25, y, w: fw - 0.5, h: 0.65, fontSize: 15, valign: "middle" });
  });
  rect(s, M, 3.5, CW, 1.25, RED, { tr: 90, line: RED });
  s.addText([{ text: "Coach-entered", options: { color: WHITE } }, { text: "  ≠  ", options: { color: RED } }, { text: "AI-generated", options: { color: TEAL } }],
    { isTextBox: true, x: M, y: 3.55, w: CW, h: 0.7, fontFace: "Orbitron", fontSize: 28, bold: true, align: "center", valign: "middle", margin: 0 });
  t(s, "A speed value typed in by a coach is not an AI-derived speed metric", { x: M, y: 4.22, w: CW, h: 0.4, fontSize: 14, align: "center", color: SOFT });
  t(s, "Proposed source labels for every metric:", { x: M, y: 5.0, w: CW, h: 0.4, fontSize: 15, bold: true });
  const tags = [["Coach-entered", TEAL], ["AI-generated", BLUE], ["Imported", GREY], ["Unverified", AMBER]];
  const tw = (CW - 3 * 0.25) / 4;
  tags.forEach((tg, i) => pill(s, tg[0], W - M - (i + 1) * tw - i * 0.25, 5.55, tw, tg[1], { h: 0.5, size: 14 }));
  foot(s, SRC_REPORT + " · " + SRC_CODE + " (src/pages/coach/Workspace.tsx)");
}

// 16 — Scout
{
  const s = slide(S3, "03 · SCOUT DASHBOARD AUDIT", "Scout dashboard — a solid base with two incomplete features",
    "The scout dashboard includes: search, position filters, pagination, navigation to player profiles, sharing, and selecting two players for comparison.\n" +
    "Two incomplete features, confirmed in code: the /compare route is not registered in App.tsx despite the compare button; and the PDF button shows a 'PDF reports coming soon' message.\n" +
    "Verdict: KEEP search and filters; IMPROVE comparison and reporting — either complete them or hide them until they work.\n" +
    "A button that does not work must never be shown to an academy or an investor.");
  const feats = ["Player search", "Position filters", "Pagination", "Player profile navigation", "Sharing", "Two-player comparison selection"];
  const fw = 3.4;
  feats.forEach((f, i) => {
    const y = 1.65 + i * 0.6;
    rect(s, W - M - fw, y, fw, 0.5, PANEL);
    s.addShape(pres.shapes.OVAL, { x: W - M - 0.38, y: y + 0.16, w: 0.18, h: 0.18, fill: { color: TEAL }, line: { type: "none" } });
    t(s, f, { x: W - M - fw + 0.2, y, w: fw - 0.7, h: 0.5, fontSize: 14, valign: "middle" });
  });
  const ix = M + 3.6, iw = CW - fw - 3.6 - 0.4;
  const inc = [["/compare route not registered in App.tsx", "The compare button leads to a route that does not exist"], ["PDF download shows \"coming soon\"", "Toast message: \"PDF reports coming soon\" (تقارير PDF قريباً)"]];
  inc.forEach((it, i) => {
    const y = 1.65 + i * 1.75;
    rect(s, ix, y, iw, 1.5, PANEL, { line: RED });
    en(s, "INCOMPLETE", { x: ix + 0.25, y: y + 0.15, w: iw - 0.5, h: 0.26, fontSize: 9, bold: true, color: RED });
    t(s, it[0], { x: ix + 0.25, y: y + 0.42, w: iw - 0.5, h: 0.45, fontSize: 16, bold: true });
    t(s, it[1], { x: ix + 0.25, y: y + 0.92, w: iw - 0.5, h: 0.4, fontSize: 13, color: SOFT });
  });
  const vx = M, vw = 3.3;
  rect(s, vx, 1.65, vw, 2.0, TEAL, { tr: 88, line: TEAL });
  en(s, "KEEP", { x: vx + 0.25, y: 1.8, w: vw - 0.5, h: 0.45, fontSize: 22, bold: true });
  t(s, "Search, filters, pagination, profile navigation", { x: vx + 0.25, y: 2.35, w: vw - 0.5, h: 1.1, fontSize: 14 });
  rect(s, vx, 3.9, vw, 2.0, AMBER, { tr: 88, line: AMBER });
  en(s, "IMPROVE", { x: vx + 0.25, y: 4.05, w: vw - 0.5, h: 0.45, fontSize: 22, bold: true, color: AMBER });
  t(s, "Complete comparison and reporting — or hide them until they work", { x: vx + 0.25, y: 4.6, w: vw - 0.5, h: 1.1, fontSize: 14 });
  foot(s, SRC_CODE + " · src/App.tsx (no /compare route) · src/pages/ScoutDashboard.tsx (\"coming soon\" toast) · " + SRC_REPORT);
}

// 17 — Organizations
{
  const s = slide(S3, "03 · ORGANIZATIONS & ACADEMY MANAGEMENT", "An Organizations Dashboard is not a multi-tenant academy system",
    "Implemented: organization listing, organization count, player count, verification status, and average rating.\n" +
    "Not established: organization membership, tenant isolation, organization-level player ownership, and academy-specific permission management.\n" +
    "Note also that the organizations table has 0 rows in the live database.\n" +
    "Why it matters: a paying academy needs assurance that another academy cannot see its players' data. That is a condition of sale, not an add-on.\n" +
    "Decision: build organization membership and isolation before onboarding a second academy.");
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
  col(W - M - half, "Implemented in the UI", "IMPLEMENTED", TEAL, ["Organization listing", "Organization count", "Player count", "Verification status", "Average rating"]);
  col(M, "Not established", "NOT ESTABLISHED", RED, ["Organization membership", "Tenant isolation", "Organization-level player ownership", "Academy-specific permissions"]);
  s.addShape(pres.shapes.OVAL, { x: W / 2 - 0.4, y: 3.05, w: 0.8, h: 0.8, fill: { color: BG }, line: { color: AMBER, width: 1.5 } });
  en(s, "≠", { x: W / 2 - 0.4, y: 3.05, w: 0.8, h: 0.8, fontSize: 26, bold: true, color: AMBER, align: "center", valign: "middle" });
  rect(s, M, 5.5, CW, 0.85, AMBER, { tr: 88, line: AMBER });
  t(s, "Organizations Dashboard  ≠  Multi-Tenant Academy Management System  ·  organizations table = 0 rows today", { x: M + 0.3, y: 5.5, w: CW - 0.6, h: 0.85, fontSize: 15, bold: true, align: "center", valign: "middle", color: AMBER });
  foot(s, SRC_REPORT + " · Supabase snapshot, 2 Nov 2026");
}

// ═══════════════════ SECTION 04 — TECHNICAL REALITY & SECURITY ═══════════════════
const S4 = "04 · Technical Reality & Security";
pres.addSection({ title: S4 });

// 18 — Live DB
{
  const s = slide(S4, "04 · LIVE DATABASE REALITY", "Live database reality — a table existing does not prove usage",
    "This is the actual row count snapshot from Supabase on 2 November 2026.\n" +
    "6 of 11 tables are completely empty, including matches, video_analyses, reports and organizations. The evaluations table does not exist at all.\n" +
    "Why it matters: a table in the schema does not prove operational usage. There is no evidence yet of an academy using the product regularly.\n" +
    "Implication: any claim about 'analytics' or 'reports' must be read in light of these tables being empty.\n" +
    "Decision: measure progress by real, recurring records — not by the number of screens.");
  const data = [["profiles", 5], ["players", 5], ["coaches", 1], ["scouts", 0], ["matches", 0], ["organizations", 0], ["video_analyses", 0], ["reports", 0], ["video_analysis_player_links", 0], ["football_coach_players", 2], ["sport_identities", 31]];
  const tw = 5.0;
  const hdr = [{ text: "Rows", options: { bold: true, color: TEAL, align: "center" } }, { text: "Table", options: { bold: true, color: TEAL, align: "left" } }];
  const body = data.map((d) => [
    { text: String(d[1]), options: { fontFace: "Orbitron", bold: true, color: d[1] === 0 ? RED : WHITE, align: "center" } },
    { text: d[0], options: { fontFace: "Consolas", color: SOFT, align: "left" } },
  ]);
  s.addTable([hdr, ...body], { x: W - M - tw, y: 1.6, w: tw, colW: [1.2, tw - 1.2], rowH: 0.38, fontFace: "Cairo", fontSize: 12, color: WHITE, valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  const lx = M, lw = CW - tw - 0.5;
  const stats = [["6 / 11", "tables with zero rows"], ["0", "video analyses recorded"], ["MISSING", "evaluations table"]];
  const sw = (lw - 0.5) / 3;
  stats.forEach((st, i) => {
    const x = lx + lw - (i + 1) * sw - i * 0.25;
    rect(s, x, 1.6, sw, 1.55, PANEL, { line: RED });
    en(s, st[0], { x, y: 1.72, w: sw, h: 0.8, fontSize: i === 2 ? 20 : 30, bold: true, color: RED, align: "center", valign: "middle" });
    t(s, st[1], { x: x + 0.1, y: 2.55, w: sw - 0.2, h: 0.45, fontSize: 13, align: "center", color: SOFT });
  });
  s.addChart(pres.charts.BAR, [{ name: "Rows", labels: data.map((d) => d[0]).reverse(), values: data.map((d) => d[1]).reverse() }], {
    x: lx, y: 3.4, w: lw, h: 3.05, barDir: "bar", chartColors: ["00DCC8"], showValue: true, dataLabelPosition: "outEnd",
    dataLabelColor: "EEEFEE", dataLabelFontSize: 9, dataLabelFontFace: "+mn-lt", catAxisLabelColor: "EEEFEE", catAxisLabelFontSize: 9, catAxisLabelFontFace: "+mn-lt",
    valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false,
    showTitle: true, title: "Rows per table — 2 Nov 2026", titleColor: "EEEFEE", titleFontSize: 11, titleFontFace: "+mn-lt", barGapWidthPct: 40,
  });
  foot(s, "Live Supabase snapshot, 2 Nov 2026 — " + SRC_REPORT);
}

// 19 — Data contract failure
{
  const s = slide(S4, "04 · CRITICAL DATA CONTRACT FAILURE", "Data contract failure — upload success ≠ registered analysis",
    "This is the expected chain from the user's identity to player evidence. A different identifier is used at each link.\n" +
    "Observed in code: the storage path starts with players.id; the storage policy expects auth.uid() in the first folder; uploaded_by references profiles.id; and a failure to create the analysis record is treated as non-fatal and only logged as a warning.\n" +
    "Result: the user may see 'upload successful' while no analysis is registered. This is consistent with 0 rows in video_analyses.\n" +
    "Decision: unify the identity contract and pass an end-to-end upload test as Gate 1 before the academy pilot.");
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
    ["Upload path", "Uses players.id in the storage path", "${playerId}/<timestamp>_<file>"],
    ["Storage policy", "Expects auth.uid() as the first folder", "players.id ≠ auth.uid()"],
    ["uploaded_by", "References profiles.id", "profiles.id ≠ players.id"],
    ["Analysis record", "Creation failure handled as non-fatal", "console.warn(… non-fatal)"],
  ];
  const ow = (CW - 3 * 0.25) / 4;
  obs.forEach((o, i) => {
    const x = W - M - (i + 1) * ow - i * 0.25, oy = 3.2;
    rect(s, x, oy, ow, 1.85, PANEL, { line: RED });
    en(s, "0" + (i + 1), { x: x + 0.2, y: oy + 0.15, w: ow - 0.4, h: 0.3, fontSize: 12, bold: true, color: RED });
    t(s, o[0], { x: x + 0.2, y: oy + 0.45, w: ow - 0.4, h: 0.38, fontSize: 15, bold: true });
    t(s, o[1], { x: x + 0.2, y: oy + 0.85, w: ow - 0.4, h: 0.5, fontSize: 13, color: SOFT });
    s.addText(o[2], { isTextBox: true, x: x + 0.2, y: oy + 1.4, w: ow - 0.4, h: 0.3, fontFace: "Consolas", fontSize: 10, color: AMBER, align: "right", margin: 0 });
  });
  rect(s, M, 5.35, CW, 0.95, RED, { tr: 88, line: RED });
  t(s, "Result: \"upload successful\" can appear while no analysis is registered — consistent with video_analyses = 0", { x: M + 0.3, y: 5.35, w: CW - 0.6, h: 0.95, fontSize: 17, bold: true, align: "center", valign: "middle" });
  foot(s, SRC_CODE + " · src/hooks/useMediaUpload.ts · storage policy and uploaded_by per " + SRC_REPORT);
}

// 20 — AI reality check
{
  const s = slide(S4, "04 · AI REALITY CHECK", "AI reality check — three levels, none verified in production",
    "We distinguish three levels: computer vision detection, then tracking and measurement, then tactical interpretation. Each is harder than the last and needs independent verification.\n" +
    "Reality: there is no independent execution evidence for the YOLO/FastAPI pipeline in production, and no ground truth to measure accuracy. The video_analyses table is empty.\n" +
    "Key distinctions: bounding boxes are not player performance; track IDs are not tactical intelligence; heatmaps are not automatically validated positioning; manually entered speed is not an AI-derived metric.\n" +
    "Decision: classify all computer vision capability as experimental until it passes a documented accuracy test on real academy data.");
  const lv = [["1", "Computer Vision Detection", "Detect players and ball in the frame"], ["2", "Tracking & Measurement", "Track over time; distance & speed"], ["3", "Tactical Interpretation", "Situations, decisions, patterns"]];
  lv.forEach((l, i) => {
    const y = 1.7 + i * 1.08, w = 6.2 - i * 0.6, x = W - M - w;
    rect(s, x, y, w, 0.92, PANEL, { line: HEX.line });
    en(s, l[0], { x: x + w - 0.65, y, w: 0.45, h: 0.92, fontSize: 26, bold: true, valign: "middle", align: "center" });
    t(s, l[1], { x: x + 1.9, y: y + 0.08, w: w - 2.6, h: 0.4, fontSize: 16, bold: true });
    t(s, l[2], { x: x + 1.9, y: y + 0.48, w: w - 2.6, h: 0.36, fontSize: 12, color: SOFT });
    pill(s, "Not verified in prod", x + 0.15, y + 0.3, 1.65, RED, { size: 10 });
  });
  en(s, "Ground Truth: NONE", { x: W - M - 6.2, y: 5.0, w: 6.2, h: 0.4, fontSize: 14, bold: true, color: RED });
  t(s, "No independent execution evidence for YOLO / FastAPI in production, and no accuracy claim without reference data", { x: W - M - 6.2, y: 5.4, w: 6.2, h: 0.7, fontSize: 13, color: SOFT });
  const dx = M, dw = CW - 6.2 - 0.5;
  const ds = [["Bounding boxes", "Player performance"], ["Track IDs", "Tactical intelligence"], ["Heatmap", "Validated positioning"], ["Manual speed", "AI-derived speed"]];
  t(s, "Distinctions that must not be blurred", { x: dx, y: 1.7, w: dw, h: 0.4, fontSize: 16, bold: true, color: TEAL });
  ds.forEach((d, i) => {
    const y = 2.25 + i * 1.0;
    rect(s, dx, y, dw, 0.82, PANEL);
    en(s, d[0], { x: dx + dw / 2 + 0.3, y, w: dw / 2 - 0.45, h: 0.82, fontSize: 12, bold: true, color: WHITE, valign: "middle" });
    en(s, "≠", { x: dx + dw / 2 - 0.3, y, w: 0.6, h: 0.82, fontSize: 22, bold: true, color: RED, align: "center", valign: "middle" });
    t(s, d[1], { x: dx + 0.15, y, w: dw / 2 - 0.45, h: 0.82, fontSize: 14, valign: "middle", align: "left", color: SOFT });
  });
  foot(s, SRC_REPORT + " · No independent CV pipeline execution evidence as of the assessment date");
}

// 21 — Security
{
  const s = slide(S4, "04 · SECURITY & PRIVACY — P0", "Security & privacy: top priority (P0)",
    "This is the most important technical slide.\n" +
    "Findings are verified at configuration level: the player-media bucket is public with a public SELECT policy; video_analyses has a public read policy; broad authenticated write policies exist on football tables; reports have broad authenticated read access; API views need closer security validation; and organization-level isolation is not established.\n" +
    "Precise wording matters: these are configuration findings indicating potential exposure, not a confirmed breach. The report contains no evidence of actual unauthorised access.\n" +
    "Why it matters: this is youth athlete data and video. Academies and parents will not accept data that is public by default.\n" +
    "Decision: close the P0 items before any demo, pilot or growth. Note: severity and priority ratings are this deck's assessment.");
  const rows = [
    ["player-media bucket is Public", "Storage", "CRITICAL", "P0"],
    ["Public SELECT policy on player-media", "Storage Policy", "CRITICAL", "P0"],
    ["Public read policy on video_analyses", "RLS", "CRITICAL", "P0"],
    ["Broad authenticated write policies on football tables", "RLS", "HIGH", "P0"],
    ["Broad authenticated read access to reports", "RLS", "HIGH", "P0"],
    ["API views require closer security validation", "API Views", "HIGH", "P1"],
    ["Organization-level isolation not established", "Tenancy", "HIGH", "P0"],
  ];
  const sc = (v) => (v === "CRITICAL" ? RED : AMBER);
  const hdr = ["Priority", "Severity", "Layer", "Finding (configuration)"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const body = rows.map((r) => [
    { text: r[3], options: { fontFace: "Orbitron", bold: true, color: r[3] === "P0" ? RED : AMBER, align: "center" } },
    { text: r[2], options: { fontFace: "Orbitron", bold: true, color: sc(r[2]), align: "center", fontSize: 10 } },
    { text: r[1], options: { fontFace: "Orbitron", color: GREY, align: "center", fontSize: 10 } },
    { text: r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], { x: M + 4.2, y: 1.6, w: CW - 4.2, colW: [1.0, 1.35, 1.5, CW - 4.2 - 3.85], rowH: 0.5, fontFace: "Cairo", fontSize: 13, color: WHITE, align: "right", valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 0.75, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  rect(s, M, 1.6, 3.9, 3.0, RED, { tr: 85, line: RED, lw: 1.5 });
  t(s, "Player videos, scouting reports, and youth athlete data must not be treated as public information by default.", { x: M + 0.25, y: 1.8, w: 3.4, h: 2.6, fontSize: 18, bold: true, valign: "middle" });
  rect(s, M, 4.8, 3.9, 1.3, PANEL, { line: AMBER });
  en(s, "CONFIGURATION FINDINGS", { x: M + 0.25, y: 4.92, w: 3.4, h: 0.26, fontSize: 9, bold: true, color: AMBER });
  t(s, "Potential exposure from configuration — not an independently confirmed breach", { x: M + 0.25, y: 5.2, w: 3.4, h: 0.8, fontSize: 13, color: SOFT });
  foot(s, SRC_REPORT + " · Live Supabase policies (Storage / RLS) · Severity and priority: this deck's assessment");
}

// 22 — Deployment drift
{
  const s = slide(S4, "04 · AUTHENTICATION & DEPLOYMENT DRIFT", "Authentication & deployment drift — we need one source of truth",
    "There is more than one possible deployment path: GitHub main, the authentication fix branch (fix/auth-profile-late-response) linked to PR #2 in the Ada2AI repository, EC2/Nginx deployment claims, multiple Vercel projects, a Supabase project reference, and an unverified FastAPI production endpoint.\n" +
    "We do not claim the site is down; the problem is that we cannot say with certainty which version of the code is running in production.\n" +
    "Why it matters: without one source of truth, a security fix may never reach production, and tests may run against the wrong version.\n" +
    "Decision: adopt one documented chain: domain → hosting → deployment SHA → Git branch → Supabase project → backend endpoint.");
  const cur = [["GitHub main", "Default branch"], ["fix/auth-profile-late-response", "Auth fix · PR #2"], ["EC2 / Nginx", "Deployment claims — unresolved"], ["Vercel ×N", "Multiple projects"], ["Supabase project ref", "Project reference"], ["FastAPI endpoint", "Unverified in production"]];
  t(s, "Today: multiple elements, not linked", { x: M, y: 1.6, w: CW, h: 0.4, fontSize: 16, bold: true, color: AMBER });
  const cw = (CW - 5 * 0.2) / 6;
  cur.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.2;
    rect(s, x, 2.1, cw, 1.15, PANEL, { line: i === 5 ? RED : AMBER });
    en(s, c[0], { x: x + 0.1, y: 2.18, w: cw - 0.2, h: 0.55, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle" });
    t(s, c[1], { x: x + 0.1, y: 2.75, w: cw - 0.2, h: 0.42, fontSize: 11, color: SOFT, align: "center" });
  });
  arrowD(s, W / 2, 3.45, 0.55, TEAL);
  t(s, "Required: one documented source-of-truth chain", { x: M, y: 4.1, w: CW, h: 0.4, fontSize: 16, bold: true, color: TEAL });
  const req = ["Production Domain", "Hosting", "Deployment SHA", "Git Branch", "Supabase Project", "Backend Endpoint"];
  const rw = 1.7, gap = (CW - 6 * rw) / 5;
  req.forEach((r, i) => {
    const x = W - M - (i + 1) * rw - i * gap;
    rect(s, x, 4.65, rw, 0.95, TEAL, { tr: 85, line: TEAL });
    en(s, r, { x: x + 0.05, y: 4.65, w: rw - 0.1, h: 0.95, fontSize: 10, bold: true, color: WHITE, align: "center", valign: "middle" });
    if (i < 5) arrowL(s, x - gap + 0.05, 5.125, gap - 0.1, TEAL);
  });
  t(s, "We do not claim the production site is down — the issue is uncertainty about which version is actually running", { x: M, y: 5.85, w: CW, h: 0.45, fontSize: 14, color: SOFT, align: "center" });
  foot(s, SRC_REPORT + " · GitHub fahdoshstore-droid/Ada2AI (main, fix/auth-profile-late-response, PR #2)");
}

// ═══════════════════ SECTION 05 — CAPABILITY BENCHMARK & STRATEGY ═══════════════════
const S5 = "05 · Capability Benchmark & Strategy";
pres.addSection({ title: S5 });

// 23 — Capability matrix
{
  const s = slide(S5, "05 · CAPABILITY MATRIX (0–5)", "Capability matrix — 0–5 scores from the report",
    (SCORES_AVAILABLE
      ? "These scores are copied verbatim from the report on a 0–5 scale, preserving N/A (not applicable) and U (unknown/unverified).\n"
      : "Presenter note: the source report file was not available when this version was prepared, so the score cells are intentionally empty. No score has been estimated. The scores must be copied from the report exactly, including N/A and U, before this deck is used.\n") +
    "How to read it: each row is a capability, each column a product. We do not sum scores into an overall ranking because the products belong to different categories.\n" +
    "Expected discussion: where Ada2AI genuinely leads (e.g. Arabic-first experience) and where it lags (video, tracking, integrations).\n" +
    "Decision: no score is adjusted to flatter Ada2AI.");
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
    t(s, "Scores await the source report file", { x: M + 0.25, y: 2.1, w: 2.9, h: 0.8, fontSize: 17, bold: true });
    t(s, "The file was not available when this version was prepared. No score has been estimated. Scores are to be copied exactly as in the report, including N/A and U.", { x: M + 0.25, y: 3.0, w: 2.9, h: 1.9, fontSize: 13, color: SOFT });
    t(s, "Scale: 0 (absent) → 5 (advanced)", { x: M + 0.25, y: 5.0, w: 2.9, h: 0.35, fontSize: 12, color: SOFT });
    colors.forEach((c, i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: M + 3.15 - (i + 1) * 0.45, y: 5.5, w: 0.4, h: 0.32, fill: { color: c }, line: { type: "none" } });
      en(s, String(i), { x: M + 3.15 - (i + 1) * 0.45, y: 5.5, w: 0.4, h: 0.32, fontSize: 9, bold: true, align: "center", valign: "middle", color: i >= 4 ? BG : WHITE });
    });
  }
  foot(s, SRC_REPORT + " — 0–5 scale · N/A = not applicable · U = unknown / unverified");
}

// 24 — Gap analysis
{
  const s = slide(S5, "05 · COMPETITIVE GAP ANALYSIS", "Competitive gap analysis — from gap to action",
    "Five gaps, ordered by their impact on our ability to sell to an academy.\n" +
    "Privacy and tenant isolation first, because it is a condition of sale and trust. Then evaluation persistence, the heart of the value proposition. Then the upload identity contract, which links evidence to the player. Then verification of the automated video pipeline. Finally comparison and reporting.\n" +
    "Each gap has a direct customer impact and a clear business risk.\n" +
    "Decision: adopt the five actions as the scope of work for the first 35 days.");
  const hdr = ["Recommended action", "Business risk", "Customer impact", "Gap"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const rows = [
    ["Privacy & tenant isolation", "Youth player data may be exposed", "Loss of trust; academies decline", "Private bucket, tightened RLS, organization membership"],
    ["Evaluation persistence", "No real evaluation history is saved", "The core value does not work", "Create evaluations table; test save and retrieval"],
    ["Video upload identity contract", "Uploaded video with no registered analysis", "Silent failure; lost evidence", "Unify identifiers; make record failure visible"],
    ["Automated video pipeline verification", "No evidence CV works in production", "Claims may be seen as misleading", "Independent test and ground truth before any claim"],
    ["Comparison & reporting workflow", "Buttons that do not work", "Incomplete experience in front of customers", "Register /compare and build PDF — or hide both"],
  ];
  const body = rows.map((r, i) => [
    { text: r[3], options: { color: TEAL, bold: true } },
    { text: r[2], options: { color: AMBER } },
    { text: r[1], options: { color: SOFT } },
    { text: (i + 1) + ". " + r[0], options: { bold: true } },
  ]);
  s.addTable([hdr, ...body], { x: M, y: 1.65, w: CW, colW: [3.6, 2.6, 2.9, 3.033], rowH: 0.8, fontFace: "Cairo", fontSize: 13, color: WHITE, align: "right", valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 1, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  foot(s, SRC_REPORT);
}

// 25 — KEEP / IMPROVE / BUILD / DEFER
{
  const s = slide(S5, "05 · KEEP / IMPROVE / BUILD / DEFER", "Keep · Improve · Build · Defer",
    "This is the summary of product decisions.\n" +
    "KEEP: what works and forms the basis of differentiation — role-based dashboards, player profiles, scout filtering, Coach Workspace, human evaluation, Arabic RTL.\n" +
    "IMPROVE: security, identity consistency, evaluation persistence, video upload, the comparison route, metric provenance, and dashboard information hierarchy.\n" +
    "BUILD after validation: evidence-backed evaluation, longitudinal player development, academy reports, and organization membership.\n" +
    "DEFER: all AI ambition before the foundation is proven — Player DNA, similarity engine, autonomous scouting copilot, global player database, full tactical AI, social network, marketplace, and unvalidated automated physical metrics.\n" +
    "Decision: explicitly approve the DEFER list — it is what protects focus.");
  const q = [
    ["KEEP", "Keep", TEAL, ["Role-based dashboards", "Player profiles", "Scout filtering", "Coach Workspace", "Human evaluation", "Arabic RTL"]],
    ["IMPROVE", "Improve", AMBER, ["Security", "Identity consistency", "Evaluation persistence", "Video upload workflow", "Comparison route", "Metric provenance", "Information hierarchy"]],
    ["BUILD — after validation", "Build after validation", BLUE, ["Evidence-backed evaluation", "Longitudinal player development", "Academy reports", "Organization membership"]],
    ["DEFER", "Defer", GREY, ["Player DNA AI", "Similarity Engine", "Autonomous Scouting Copilot", "Global Player Database", "Full Tactical AI", "Social Network", "Marketplace", "Unvalidated physical metrics"]],
  ];
  const qw = (CW - 0.3) / 2, qh = 2.4;
  q.forEach((qq, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - M - (col + 1) * qw - col * 0.3, y = 1.6 + row * (qh + 0.25);
    rect(s, x, y, qw, qh, PANEL, { line: qq[2], lw: 1.25 });
    en(s, qq[0], { x: x + 0.3, y: y + 0.18, w: qw - 0.6, h: 0.32, fontSize: 13, bold: true, color: qq[2] });
    const half = Math.ceil(qq[3].length / 2);
    [qq[3].slice(0, half), qq[3].slice(half)].forEach((list, k) => {
      if (!list.length) return;
      s.addText(bullets(list), Object.assign({}, TX, { x: x + qw - 0.3 - (k + 1) * ((qw - 0.6) / 2), y: y + 0.65, w: (qw - 0.6) / 2 - 0.1, h: qh - 0.8, fontSize: 14, color: SOFT, paraSpaceAfter: 4 }));
    });
  });
  foot(s, SRC_REPORT);
}

// ═══════════════════ SECTION 06 — DECISIONS & EXECUTION ═══════════════════
const S6 = "06 · Decisions & Execution";
pres.addSection({ title: S6 });

// 26 — MVP
{
  const s = slide(S6, "06 · MVP FOR FIRST PAYING ACADEMY", "Minimum viable product for the first paying academy",
    "This is a practical product, not an aspirational platform. Seven steps represent the academy's weekly workflow: academy setup, team and player roster, match or training, coach evaluation, video evidence, development history, and player report.\n" +
    "Every step rests on secure organization permissions; without them we cannot sell.\n" +
    "Why it matters: this workflow turns existing pieces (player profile, evaluation form, upload) into connected value a customer will pay for.\n" +
    "Success metric: one academy using the full workflow repeatedly — not the number of features.\n" +
    "Note: this is a proposed workflow, not current production functionality.");
  const steps = ["Academy Setup", "Team & Player Roster", "Match / Training", "Coach Evaluation", "Video Evidence", "Development History", "Player Report"];
  const sw = 1.5, gap = (CW - 7 * sw) / 6, y = 2.0;
  steps.forEach((st, i) => {
    const x = W - M - (i + 1) * sw - i * gap;
    s.addShape(pres.shapes.OVAL, { x: x + sw / 2 - 0.35, y, w: 0.7, h: 0.7, fill: { color: TEAL, transparency: 80 }, line: { color: TEAL, width: 1.25 } });
    en(s, String(i + 1), { x: x + sw / 2 - 0.35, y, w: 0.7, h: 0.7, fontSize: 16, bold: true, align: "center", valign: "middle" });
    t(s, st, { x, y: y + 0.85, w: sw, h: 0.75, fontSize: 14, bold: true, align: "center" });
    if (i < 6) arrowL(s, x - gap + 0.05, y + 0.35, gap - 0.1 + 0.4, TEAL);
  });
  rect(s, M, 4.0, CW, 0.75, RED, { tr: 88, line: RED });
  t(s, "Mandatory foundation: secure organization permissions and per-academy data isolation", { x: M + 0.3, y: 4.0, w: CW - 0.6, h: 0.75, fontSize: 17, bold: true, align: "center", valign: "middle" });
  const crit = [["Not in the MVP", "Automated CV analysis, tactical AI, global player database, marketplace"], ["Success metric", "One academy using the full workflow repeatedly"]];
  const cw = (CW - 0.3) / 2;
  crit.forEach((c, i) => {
    const x = W - M - (i + 1) * cw - i * 0.3;
    rect(s, x, 5.0, cw, 1.3, PANEL);
    t(s, c[0], { x: x + 0.3, y: 5.12, w: cw - 0.6, h: 0.4, fontSize: 15, bold: true, color: i ? TEAL : GREY });
    t(s, c[1], { x: x + 0.3, y: 5.55, w: cw - 0.6, h: 0.65, fontSize: 14, color: SOFT });
  });
  foot(s, "Proposed Concept — Not Current Production Functionality · " + SRC_REPORT);
}

// 27 — Roadmap
{
  const s = slide(S6, "06 · 90-DAY ROADMAP", "90-day roadmap — four phases, four gates",
    "Four phases, each ending in a decision gate we pass only with evidence.\n" +
    "Days 1–15: Trust & Production Truth — close P0 security, unify identity, establish the deployment source of truth. Gate: security, identity and upload tests pass.\n" +
    "Days 16–35: Academy MVP consolidation. Gate: a coach can manage, evaluate and retrieve history.\n" +
    "Days 36–65: One-academy pilot. Gate: repeated use of the workflow.\n" +
    "Days 66–90: Paid conversion and intelligence validation. Gate: evidence of demand and willingness to pay.\n" +
    "Decision: no phase starts without passing the previous gate.");
  const ph = [
    ["DAYS 1–15", "Trust & Production Truth", "Gate 1", "Security, identity and upload tests pass"],
    ["DAYS 16–35", "Academy MVP Consolidation", "Gate 2", "Coach can manage, evaluate and retrieve history"],
    ["DAYS 36–65", "One-Academy Pilot", "Gate 3", "An academy uses the workflow repeatedly"],
    ["DAYS 66–90", "Paid Conversion & Intelligence Validation", "Gate 4", "Commercial demand and willingness to pay evidenced"],
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
  t(s, "Gate rule: no move to the next phase without documented evidence that the gate has been passed", { x: M + 0.3, y: 5.45, w: CW - 0.6, h: 0.85, fontSize: 16, bold: true, align: "center", valign: "middle", color: TEAL });
  foot(s, SRC_REPORT);
}

// 28 — Decisions
{
  const s = slide(S6, "06 · FOUNDER & CTO DECISION BRIEF", "Five decisions required today",
    "We ask for approval of five direct decisions:\n" +
    "1) Security before growth: no demos and no pilots before P0 is closed.\n" +
    "2) Fix identity and evaluation contracts: one consistent identifier and a real evaluations table.\n" +
    "3) Computer vision is experimental until proven against ground truth.\n" +
    "4) Pilot with one academy instead of expanding.\n" +
    "5) One approved production deployment path.\n" +
    "These decisions do not require a large budget, but they do require discipline in priorities.");
  const ds = [
    ["Fix security before growth", "No demos or pilots until P0 items are closed"],
    ["Fix identity and evaluation contracts", "One consistent ID from Auth to evidence; a real evaluations table"],
    ["Treat CV as experimental until validated", "No CV claims without independent verification and ground truth"],
    ["Pilot with one academy", "Depth of usage before number of customers"],
    ["Select one canonical production path", "Domain → Hosting → SHA → Branch → Supabase → Backend"],
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

// 29 — Closing (built LTR natively — not mirrored)
{
  const s = pres.addSlide({ masterName: "HERO", sectionTitle: S6 });
  s.addNotes(
    "Conclusion: the strategic north star is one chain: Evidence → Evaluation → Development → Decision.\n" +
    "We are not building a platform that claims intelligence, but one that proves how players improve and helps coaches make better decisions.\n" +
    "Three rules we commit to: evidence before expansion, product trust before AI ambition, and customer validation before scale.\n" +
    "We now open the discussion on the five decisions."
  );
  const E = { isTextBox: true, margin: 0, fontFace: "Orbitron", color: TEAL, align: "center", valign: "middle" };
  s.addText("STRATEGIC NORTH STAR", Object.assign({}, E, { x: M, y: 0.9, w: CW, h: 0.4, fontSize: 14, bold: true }));
  const ch = ["EVIDENCE", "EVALUATION", "DEVELOPMENT", "DECISION"];
  const bw = 2.6, gap = (CW - 4 * bw) / 3;
  ch.forEach((c, i) => {
    const x = M + i * (bw + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.9, w: bw, h: 1.3, rectRadius: 0.06, fill: { color: BG, transparency: 20 }, line: { color: TEAL, width: 1.5 } });
    s.addText(c, Object.assign({}, E, { x, y: 1.9, w: bw, h: 1.3, fontSize: 18, bold: true, color: WHITE }));
    if (i < 3) s.addShape(pres.shapes.LINE, { x: x + bw + 0.05, y: 2.55, w: gap - 0.1, h: 0, line: { color: TEAL, width: 2, endArrowType: "triangle" } });
  });
  s.addText("Build a platform that proves how players improve, and helps coaches make better decisions.", { isTextBox: true, x: M + 0.5, y: 3.7, w: CW - 1, h: 1.0, fontFace: "Cairo", fontSize: 26, bold: true, align: "center", valign: "middle", color: WHITE, margin: 0 });
  s.addText("Evidence Before Expansion  ·  Product Trust Before AI Ambition  ·  Customer Validation Before Scale", Object.assign({}, E, { x: M, y: 5.0, w: CW, h: 0.4, fontSize: 12, color: SOFT }));
  s.addImage({ path: LOGO, x: W / 2 - 1.25, y: 5.95, w: 0.55, h: 0.55 });
  s.addText([{ text: "ADA", options: { color: WHITE } }, { text: "2", options: { color: TEAL } }, { text: "AI", options: { color: WHITE } }], { isTextBox: true, x: W / 2 - 0.6, y: 5.95, w: 2, h: 0.55, fontFace: "Orbitron", fontSize: 24, bold: true, valign: "middle", margin: 0 });
}

// ═══════════════════ APPENDIX ═══════════════════
const SA = "Appendix · Evidence";
pres.addSection({ title: SA });

// A1 — Source register
{
  const s = slide(SA, "APPENDIX A · SOURCE REGISTER", "Source register",
    "This is the source register behind the deck.\n" +
    "The primary source is the report. Code findings cited in the deck were verified directly in the public repository at commit 31a060b.\n" +
    "Competitor websites could not be reached while preparing this version, so their links are references and must be matched against the full source register in the report.\n" +
    "No Ada2AI or competitor screenshots are used in this deck.");
  const hdr = ["Verification status in this deck", "Supports", "Source"].map((h) => ({ text: h, options: { bold: true, color: TEAL } }));
  const rows = [
    ["ADA2AI_Dashboard_Capability_Benchmark_2026-11-02.md", "Primary source for all findings and scores", "File not available in the build session — content from the approved deck brief", AMBER],
    ["github.com/fahdoshstore-droid/Ada2AI — main @31a060b", "Routes, upload path, \"coming soon\", missing /compare", "Verified directly in code", TEAL],
    ["src/App.tsx · src/hooks/useMediaUpload.ts", "Slides 4, 13, 16, 19", "Verified directly in code", TEAL],
    ["src/pages/ScoutDashboard.tsx · coach/Workspace.tsx", "Slides 15, 16", "Verified directly in code", TEAL],
    ["Live Supabase snapshot — 2 Nov 2026", "Row counts, policies, buckets", "Per the report — query not re-run", AMBER],
    ["Hudl Wyscout — hudl.com/products/wyscout", "Slide 6", "Reference — match against report register", GREY],
    ["DataMB — datamb.football (official guide)", "Slide 7 (55 / 120+ / 5M+)", "Reference — match against report register", GREY],
    ["Grintafy — grintafy.com", "Slide 8", "Reference — match against report register", GREY],
    ["Grinta Rush — public event material", "Slide 9", "Per the report", GREY],
    ["Veo — veo.co", "Slide 10", "Reference — match against report register", GREY],
  ];
  const body = rows.map((r) => [{ text: r[2], options: { color: r[3] } }, { text: r[1], options: { color: SOFT } }, { text: r[0], options: { bold: true, fontSize: 11 } }]);
  s.addTable([hdr, ...body], { x: M, y: 1.6, w: CW, colW: [3.8, 3.6, 4.733], rowH: 0.43, fontFace: "Cairo", fontSize: 11, color: WHITE, align: "right", valign: "middle", fill: { color: PANEL }, border: { type: "solid", pt: 1, color: HEX.bg }, margin: [0, 0.12, 0, 0.12] });
  foot(s, "Assessment date: 2 November 2026");
}

// A2 — Evidence limitations
{
  const s = slide(SA, "APPENDIX B · EVIDENCE LIMITATIONS", "Evidence limitations and how to read this deck",
    "This slide protects the deck's credibility by stating what can and cannot be concluded.\n" +
    "No authenticated Ada2AI dashboard session was available during the audit, so no product screenshots are shown. Code existence does not prove production execution. Security findings are configuration findings, not a breach. No AI accuracy claims are made without ground truth.\n" +
    "Severity levels in this deck are assessments based on described impact and should be matched against the report's own ratings, if any.");
  const lim = [
    ["No authenticated session", "No logged-in Ada2AI dashboard session was available during the audit — no product screenshots in this deck."],
    ["Code ≠ execution", "Code or a route existing does not prove the function works in production."],
    ["Schema ≠ behaviour", "A table in the schema does not prove usage; we rely on actual row counts."],
    ["Configuration ≠ breach", "Security findings are configuration-level potential exposure, with no evidence of unauthorised access."],
    ["No ground truth", "No accuracy claim is made for any AI or CV output."],
    ["Competitors from public material", "Competitor products were not tested from inside; figures are as published by the companies."],
  ];
  const cw = (CW - 0.3) / 2;
  lim.forEach((l, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = W - M - (col + 1) * cw - col * 0.3, y = 1.65 + row * 1.5;
    rect(s, x, y, cw, 1.3, PANEL, { line: HEX.line });
    t(s, l[0], { x: x + 0.3, y: y + 0.15, w: cw - 0.6, h: 0.42, fontSize: 16, bold: true, color: TEAL });
    t(s, l[1], { x: x + 0.3, y: y + 0.58, w: cw - 0.6, h: 0.65, fontSize: 13, color: SOFT });
  });
  foot(s, SRC_REPORT + " · Severity ratings in this deck are assessments");
}

(async () => {
  const out = process.argv[2] || "ADA2AI_Executive_Benchmark_2026-11-02_EN.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out, "scores available:", SCORES_AVAILABLE);
})();
