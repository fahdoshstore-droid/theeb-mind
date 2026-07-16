// ============================================
// THEEB MIND — Market Intelligence Page
// Macro context: DXY, VIX, US10Y, COT, Economic
// Calendar, Weekly Bias, Macro Narrative
// ============================================

import { useState, useEffect, useRef } from 'react';
import {
  getMarketSnapshots,
  getEconomicEvents,
  getWeeklyBias,
  setWeeklyBias,
  getMacroNarrative,
  setMacroNarrative,
  getCotData,
  type CotRow,
} from '../lib/api';
import type { MarketSnapshot, EconomicEvent, WeeklyBias, MacroNarrative } from '../lib/types';

const USER_ID = 'user-1';

const C = {
  bg: '#020B18',
  card: '#071628',
  border: 'rgba(0,214,143,0.08)',
  border2: 'rgba(255,255,255,0.05)',
  gold: '#C9A84C',
  green: '#1E8FFF',
  red: '#FF3B5C',
  amber: '#FBBF24',
  t1: '#E8F0F8',
  t2: '#7A90A8',
  t3: '#3A4F68',
} as const;

// COT_DATA is now fetched live from CFTC via /api/market/cot

// ── Helpers ───────────────────────────────────────────────────────────────────

function directionColor(d: 'bullish' | 'bearish' | 'neutral') {
  return d === 'bullish' ? C.green : d === 'bearish' ? C.red : C.amber;
}

function directionAr(d: 'bullish' | 'bearish' | 'neutral') {
  return d === 'bullish' ? '▲ صعودي' : d === 'bearish' ? '▼ هبوطي' : '◆ محايد';
}

function impactColor(impact: 'high' | 'medium' | 'low') {
  return impact === 'high' ? C.red : impact === 'medium' ? C.amber : C.t3;
}

function impactAr(impact: 'high' | 'medium' | 'low') {
  return impact === 'high' ? 'عالي' : impact === 'medium' ? 'متوسط' : 'منخفض';
}

function formatNumber(n: number) {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ── Snap gauge component ──────────────────────────────────────────────────────

function MacroGauge({ snap }: { snap: MarketSnapshot }) {
  const col = directionColor(snap.direction);
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${col}30`,
      borderRadius: 12,
      padding: '16px 18px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C.t3, letterSpacing: '.15em', marginBottom: 6 }}>
        {snap.instrument}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: C.t1, lineHeight: 1, marginBottom: 6 }}>
        {snap.value.toFixed(snap.metric === 'yield' ? 2 : 1)}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: col }}>
        {directionAr(snap.direction)}
      </div>
      {snap.note && (
        <div style={{ fontSize: 10, color: C.t3, marginTop: 6, lineHeight: 1.4 }}>{snap.note}</div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketIntelligence() {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [biasRows, setBiasRows] = useState<WeeklyBias[]>([]);
  const [narrative, setNarrative] = useState<MacroNarrative | null>(null);
  const [narrativeText, setNarrativeText] = useState('');
  const [narrativeSaving, setNarrativeSaving] = useState(false);
  const [narrativeSaved, setNarrativeSaved] = useState(false);
  const [biasSaving, setBiasSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cotRows, setCotRows] = useState<CotRow[]>([]);
  const [cotLoading, setCotLoading] = useState(true);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [snaps, evs, bias, narr] = await Promise.all([
        getMarketSnapshots(),
        getEconomicEvents(),
        getWeeklyBias(USER_ID),
        getMacroNarrative(USER_ID),
      ]);
      setSnapshots(snaps);
      setEvents(evs);
      setBiasRows(bias);
      setNarrative(narr);
      setNarrativeText(narr?.narrativeText ?? '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // COT fetch is independent — slower (CFTC download), runs separately
  const loadCot = async () => {
    setCotLoading(true);
    try {
      const rows = await getCotData();
      setCotRows(rows);
    } catch {
      // silently keep empty — fallback shown below
    } finally {
      setCotLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCot();
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // ── Macro snapshots: separate DXY/VIX/US10Y from others
  const macroGauges = snapshots.filter(s => ['DXY', 'VIX', 'US10Y'].includes(s.instrument));
  const otherSnaps = snapshots.filter(s => !['DXY', 'VIX', 'US10Y'].includes(s.instrument));

  // ── Bias helpers ─────────────────────────────────────────────────────────────
  const getBias = (instrument: string): 'bullish' | 'bearish' | 'neutral' =>
    biasRows.find(b => b.instrument === instrument)?.bias ?? 'neutral';

  const getBiasNotes = (instrument: string) =>
    biasRows.find(b => b.instrument === instrument)?.notes ?? '';

  const handleSetBias = async (instrument: string, bias: 'bullish' | 'bearish' | 'neutral') => {
    setBiasSaving(instrument);
    try {
      await setWeeklyBias(USER_ID, { instrument, bias, notes: getBiasNotes(instrument) });
      setBiasRows(prev => {
        const exists = prev.find(b => b.instrument === instrument);
        if (exists) return prev.map(b => b.instrument === instrument ? { ...b, bias } : b);
        return [...prev, { id: '', userId: USER_ID, instrument, bias, weekKey: '', notes: undefined }];
      });
    } catch {/* silent */ } finally {
      setBiasSaving(null);
    }
  };

  // ── Narrative save ────────────────────────────────────────────────────────────
  const handleSaveNarrative = async () => {
    if (!narrativeText.trim()) return;
    setNarrativeSaving(true);
    try {
      const updated = await setMacroNarrative(USER_ID, narrativeText);
      setNarrative(updated);
      setNarrativeSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setNarrativeSaved(false), 2500);
    } catch {/* silent */ } finally {
      setNarrativeSaving(false);
    }
  };

  // ── Instruments for weekly bias ───────────────────────────────────────────────
  const BIAS_INSTRUMENTS = ['GOLD', 'DXY', 'NAS', 'EUR', 'GBP'];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: C.t3 }}>
        جاري تحميل ذكاء السوق...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: C.red, textAlign: 'center' }}>
        <p>{error}</p>
        <button onClick={loadData} style={{ marginTop: 12, color: C.gold, background: 'none', border: `1px solid ${C.gold}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ padding: '24px 20px', maxWidth: 860, margin: '0 auto', fontFamily: 'Cairo, sans-serif' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28, textAlign: 'right' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t1, margin: 0 }}>ذكاء السوق</h1>
        <p style={{ fontSize: 13, color: C.t2, marginTop: 4 }}>السياق الكلي — DXY · VIX · US10Y · التقويم الاقتصادي · التحيز الأسبوعي</p>
      </div>

      {/* ── 1. MACRO GAUGES ─────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: C.t3, letterSpacing: '.12em', marginBottom: 12 }}>المقاييس الكلية</p>
        {macroGauges.length === 0 ? (
          <p style={{ color: C.t3, fontSize: 13 }}>لا توجد بيانات كلية</p>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {macroGauges.map(s => <MacroGauge key={s.id} snap={s} />)}
          </div>
        )}

        {/* Other instruments (Gold, NAS) */}
        {otherSnaps.length > 0 && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            {otherSnaps.map(s => <MacroGauge key={s.id} snap={s} />)}
          </div>
        )}
      </section>

      {/* ── 2. COT POSITIONING ──────────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: C.t3, letterSpacing: '.12em', margin: 0 }}>بيانات COT — مراكز المؤسسات (أسبوع)</p>
            {!cotLoading && cotRows.length > 0 && cotRows[0].reportDate !== 'fallback' && (
              <span style={{ fontSize: 10, color: C.gold, fontFamily: 'JetBrains Mono' }}>
                ✓ CFTC {cotRows[0].reportDate}
              </span>
            )}
            {!cotLoading && cotRows.length > 0 && cotRows[0].reportDate === 'fallback' && (
              <span style={{ fontSize: 10, color: C.amber }}>⚠ بيانات احتياطية</span>
            )}
          </div>

          {cotLoading ? (
            <div style={{ color: C.t3, fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              جاري تحميل بيانات CFTC...
            </div>
          ) : cotRows.length === 0 ? (
            <div style={{ color: C.t3, fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
              تعذّر تحميل بيانات COT
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.t3, fontSize: 11, textAlign: 'right' }}>
                  <th style={{ paddingBottom: 8, fontWeight: 400 }}>الأداة</th>
                  <th style={{ paddingBottom: 8, fontWeight: 400 }}>صافي المراكز</th>
                  <th style={{ paddingBottom: 8, fontWeight: 400 }}>التغيير الأسبوعي</th>
                  <th style={{ paddingBottom: 8, fontWeight: 400 }}>التحيز</th>
                </tr>
              </thead>
              <tbody>
                {cotRows.map(row => {
                  const col = directionColor(row.bias);
                  return (
                    <tr key={row.instrument} style={{ borderTop: `1px solid ${C.border2}` }}>
                      <td style={{ padding: '10px 0', fontFamily: 'JetBrains Mono', fontSize: 12, color: C.t1, fontWeight: 700 }}>
                        {row.instrument}
                      </td>
                      <td style={{ padding: '10px 0', color: row.netLong >= 0 ? C.green : C.red, fontFamily: 'JetBrains Mono' }}>
                        {row.netLong >= 0 ? '+' : ''}{formatNumber(row.netLong)}
                      </td>
                      <td style={{ padding: '10px 0', color: row.change >= 0 ? C.green : C.red, fontFamily: 'JetBrains Mono' }}>
                        {row.change >= 0 ? '+' : ''}{formatNumber(row.change)}
                      </td>
                      <td style={{ padding: '10px 0', color: col, fontWeight: 700 }}>
                        {directionAr(row.bias)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p style={{ fontSize: 10, color: C.t3, marginTop: 10, margin: '10px 0 0' }}>
            * مصدر البيانات: CFTC — تقرير الالتزامات بالعقود الآجلة، يُحدَّث كل جمعة
          </p>
        </div>
      </section>

      {/* ── 3. ECONOMIC CALENDAR ────────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <p style={{ fontSize: 11, color: C.t3, letterSpacing: '.12em', marginBottom: 14 }}>التقويم الاقتصادي — هذا الأسبوع</p>
          {events.length === 0 ? (
            <p style={{ color: C.t3, fontSize: 13 }}>لا توجد أحداث هذا الأسبوع</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => {
                const past = isPast(ev.eventDate);
                const today = isToday(ev.eventDate);
                const impCol = impactColor(ev.impact);
                return (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: today ? `${C.gold}10` : 'transparent',
                    border: today ? `1px solid ${C.gold}30` : `1px solid ${C.border2}`,
                    opacity: past && !today ? 0.5 : 1,
                  }}>
                    {/* Impact dot */}
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: impCol, flexShrink: 0 }} />
                    {/* Date */}
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: C.t3, flexShrink: 0, width: 70 }}>
                      {new Date(ev.eventDate).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                      {today && <span style={{ color: C.gold, marginRight: 4 }}>اليوم</span>}
                    </span>
                    {/* Currency */}
                    <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: impCol, fontWeight: 700, flexShrink: 0, width: 30 }}>
                      {ev.currency}
                    </span>
                    {/* Title */}
                    <span style={{ flex: 1, color: C.t1, fontSize: 13 }}>
                      {ev.titleAr || ev.title}
                    </span>
                    {/* Impact */}
                    <span style={{ fontSize: 10, color: impCol, fontWeight: 600, flexShrink: 0 }}>
                      {impactAr(ev.impact)}
                    </span>
                    {/* Forecast */}
                    {ev.forecast && (
                      <span style={{ fontSize: 10, color: C.t2, fontFamily: 'JetBrains Mono', flexShrink: 0 }}>
                        متوقع: {ev.forecast}
                      </span>
                    )}
                    {ev.actual && (
                      <span style={{ fontSize: 10, color: C.green, fontFamily: 'JetBrains Mono', flexShrink: 0 }}>
                        فعلي: {ev.actual}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── 4. WEEKLY BIAS ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <p style={{ fontSize: 11, color: C.t3, letterSpacing: '.12em', marginBottom: 14 }}>التحيز الأسبوعي — حدِّد ميلك لكل أداة</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {BIAS_INSTRUMENTS.map(inst => {
              const current = getBias(inst);
              const saving = biasSaving === inst;
              return (
                <div key={inst} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: C.t1, fontWeight: 700, width: 48, flexShrink: 0 }}>
                    {inst}
                  </span>
                  <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                    {(['bullish', 'neutral', 'bearish'] as const).map(b => {
                      const active = current === b;
                      const col = directionColor(b);
                      return (
                        <button
                          key={b}
                          disabled={saving}
                          onClick={() => handleSetBias(inst, b)}
                          style={{
                            flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${active ? col : C.border2}`,
                            background: active ? `${col}18` : 'transparent',
                            color: active ? col : C.t3, fontSize: 11, fontWeight: active ? 700 : 400,
                            cursor: saving ? 'wait' : 'pointer', transition: 'all .15s',
                          }}
                        >
                          {b === 'bullish' ? '▲ صعودي' : b === 'bearish' ? '▼ هبوطي' : '◆ محايد'}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ width: 16, flexShrink: 0, color: directionColor(current), fontSize: 12 }}>
                    {saving ? '⌛' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. MACRO NARRATIVE ──────────────────────────────────────────────── */}
      <section>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: C.t3, letterSpacing: '.12em', margin: 0 }}>السردية الكلية — هذا الأسبوع</p>
            {narrative?.weekKey && (
              <span style={{ fontSize: 10, color: C.t3, fontFamily: 'JetBrains Mono' }}>{narrative.weekKey}</span>
            )}
          </div>
          <textarea
            value={narrativeText}
            onChange={e => setNarrativeText(e.target.value)}
            placeholder="اكتب ملخصك الكلي لهذا الأسبوع... مثال: الدولار في ضغط بعد بيانات التضخم، الذهب يحافظ على دعم 2350، ترقب قرار الفيد الأربعاء..."
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0D1422', border: `1px solid ${C.border2}`,
              borderRadius: 10, padding: '12px 14px',
              color: C.t1, fontSize: 13, lineHeight: 1.6,
              resize: 'vertical', fontFamily: 'Cairo, sans-serif',
              outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = `${C.gold}50`}
            onBlur={e => e.target.style.borderColor = C.border2}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 10 }}>
            {narrativeSaved && (
              <span style={{ fontSize: 12, color: C.green }}>✓ تم الحفظ</span>
            )}
            <button
              onClick={handleSaveNarrative}
              disabled={narrativeSaving || !narrativeText.trim()}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: narrativeSaving ? C.t3 : C.gold,
                color: '#0A0A0A', fontWeight: 700, fontSize: 13,
                border: 'none', cursor: narrativeSaving ? 'wait' : 'pointer',
                opacity: !narrativeText.trim() ? 0.4 : 1,
              }}
            >
              {narrativeSaving ? 'جاري الحفظ...' : 'حفظ السردية'}
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
