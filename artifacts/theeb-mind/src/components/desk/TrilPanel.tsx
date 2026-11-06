// ============================================================
// TRIL panel — T (Time) · R (Raid) · I (Inversion) · L (Liquidity)
// T is read from the clock (Mon/Tue/Thu, 09:30–12:10 America/New_York).
// R, I and L are marked by the trader and stored on this device only.
// No count, verdict, score, weight or signal is produced here.
// Isolated from the legacy scoring engines.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import './desk.css';
import { evaluateTrilTime, formatOffset, TRIL_TIME, WEEKDAY_LABELS_EN, nyParts } from '../../lib/tril-time';
import {
  browserStorage, createMarkStore, TIMEFRAMES,
  type MarkType, type TrilMark, type Timeframe, type MarkInput,
} from '../../lib/tril-marks';

const FACTORS: { type: MarkType; letter: string; ar: string; en: string; hint: string }[] = [
  { type: 'raid', letter: 'R', ar: 'الغارة', en: 'RAID', hint: 'المستوى الذي سُحب' },
  { type: 'inversion', letter: 'I', ar: 'الانعكاس', en: 'INVERSION', hint: 'منطقة الانعكاس' },
  { type: 'liquidity', letter: 'L', ar: 'السيولة', en: 'LIQUIDITY', hint: 'هدف السيولة' },
];

const ERR_AR: Record<string, string> = {
  instrument: 'الأداة مطلوبة', date: 'التاريخ غير صالح', time: 'الوقت غير صالح (HH:MM)', timeframe: 'الإطار الزمني غير صالح',
  type: 'نوع العلامة غير صالح', price: 'السعر مطلوب', priceHigh: 'الحد الأعلى غير صالح', zoneOrder: 'الحد الأعلى أقل من الأدنى',
  note: 'الملاحظة غير صالحة', notFound: 'العلامة غير موجودة',
};

function fmtPrice(m: TrilMark) {
  const f = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return m.priceHigh !== null ? `${f(m.priceLow)}–${f(m.priceHigh)}` : f(m.priceLow);
}

interface Draft { id?: string; type: MarkType; date: string; time: string; timeframe: Timeframe; priceLow: string; priceHigh: string; note: string }

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}

export default function TrilPanel({ instrument = 'NQ', defaultTimeframe = '15m', embedded = false }:
  { instrument?: string; defaultTimeframe?: Timeframe; embedded?: boolean }) {
  const now = useNow();
  const time = evaluateTrilTime(now);
  const store = useMemo(() => createMarkStore(browserStorage()), []);
  const [version, setVersion] = useState(0);
  const [viewDate, setViewDate] = useState(() => nyParts(Date.now()).date);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const marks = useMemo(() => store.list({ instrument, date: viewDate }), [store, instrument, viewDate, version]);

  const startAdd = (type: MarkType) => {
    const p = nyParts(Date.now());
    setErrors([]);
    setDraft({ type, date: viewDate, time: p.time, timeframe: defaultTimeframe, priceLow: '', priceHigh: '', note: '' });
  };
  const startEdit = (m: TrilMark) => {
    setErrors([]);
    setDraft({ id: m.id, type: m.type, date: m.date, time: m.time, timeframe: m.timeframe,
      priceLow: String(m.priceLow), priceHigh: m.priceHigh === null ? '' : String(m.priceHigh), note: m.note });
  };
  const save = () => {
    if (!draft) return;
    const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/,/g, '')));
    const input: MarkInput = {
      instrument, type: draft.type, date: draft.date, time: draft.time, timeframe: draft.timeframe,
      priceLow: toNum(draft.priceLow), priceHigh: draft.priceHigh.trim() === '' ? null : toNum(draft.priceHigh), note: draft.note,
    };
    const r = draft.id ? store.update(draft.id, input) : store.add(input);
    if (!r.ok) { setErrors(r.errors); return; }
    setDraft(null); setErrors([]); setVersion((v) => v + 1);
    if (r.value.date !== viewDate) setViewDate(r.value.date);
  };
  const remove = (id: string) => { store.remove(id); setVersion((v) => v + 1); if (draft?.id === id) setDraft(null); };

  const timeLine = (() => {
    switch (time.status) {
      case 'IN_WINDOW': return { tag: 'IN WINDOW', cls: 'tag in', ar: 'داخل نافذة NY AM', ev: `متبقٍ ${time.minutesRemaining} دقيقة` };
      case 'BEFORE_WINDOW': return { tag: 'BEFORE WINDOW', cls: 'tag', ar: 'قبل النافذة', ev: `تبدأ بعد ${time.minutesUntilStart} دقيقة` };
      case 'AFTER_WINDOW': return { tag: 'AFTER WINDOW', cls: 'tag', ar: 'انتهت نافذة اليوم', ev: 'النافذة التالية في يوم مسموح' };
      default: return { tag: 'DAY NOT ALLOWED', cls: 'tag', ar: 'يوم غير مسموح', ev: 'الأيام المسموحة: الاثنين، الثلاثاء، الخميس' };
    }
  })();

  return (
    <div className={embedded ? 'desk desk-embed' : ''} data-testid="tril-panel">
      <div className="ph"><b>TRIL</b><span>قراءتك للشارت</span><span className="end mono ltr" style={{ color: 'var(--d-t3)', fontSize: 10 }}>YOUR READ · NO SIGNAL</span></div>

      {/* T — Time */}
      <div className="tf" data-testid="tril-time" data-status={time.status}>
        <div className={'L' + (time.inWindow ? '' : ' off')}>T</div>
        <div className="nm"><b>الوقت</b><span>TIME</span></div>
        <div className="stt"><span className="tag">AUTO · CLOCK</span><span className={timeLine.cls}>{timeLine.tag}</span><span>{timeLine.ar}</span></div>
        <div className="ev">
          <span className="num">{time.time}</span> نيويورك · <span className="num">{TRIL_TIME.label}</span> · <span className="num">{TRIL_TIME.timeZone} ({formatOffset(time.utcOffsetMinutes)})</span>
          <br />{timeLine.ev}
          <div className="days" style={{ marginTop: 4 }}>
            {[1, 2, 3, 4, 5].map((d) => (
              <span key={d} className={(TRIL_TIME.allowedWeekdays.includes(d) ? 'ok' : 'x') + (time.weekday === d ? ' today' : '')}>{WEEKDAY_LABELS_EN[d]}</span>
            ))}
          </div>
        </div>
      </div>

      {/* R, I, L — manual marks */}
      {FACTORS.map((f) => {
        const list = marks.filter((m) => m.type === f.type);
        return (
          <div className="tf" key={f.type} data-testid={'tril-' + f.type}>
            <div className={'L' + (list.length ? '' : ' off')}>{f.letter}</div>
            <div className="nm"><b>{f.ar}</b><span>{f.en}</span></div>
            <div className="stt">
              <span className={list.length ? 'tag mk' : 'tag'}>{list.length ? `MARKED · ${list.length}` : 'NOT MARKED'}</span>
              <button type="button" className="linkbtn" onClick={() => startAdd(f.type)}>+ أضف علامة</button>
            </div>
            <div className="marks">
              {list.map((m) => (
                <div className="mark" key={m.id}>
                  <span className="meta">{m.time} · {m.timeframe} · {fmtPrice(m)}</span>
                  <span className="acts">
                    <button type="button" className="linkbtn" onClick={() => startEdit(m)}>تعديل</button>
                    <button type="button" className="linkbtn danger" onClick={() => remove(m.id)}>حذف</button>
                  </span>
                  {m.note && <span className="note">{m.note}</span>}
                </div>
              ))}
              {draft && draft.type === f.type && (
                <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }} aria-label={`علامة ${f.ar}`}>
                  <div className="g2">
                    <label>التاريخ (نيويورك)<input id={`tm-date-${f.type}`} type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
                    <label>الوقت (نيويورك)<input id={`tm-time-${f.type}`} type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
                  </div>
                  <div className="g2">
                    <label>الإطار الزمني
                      <select id={`tm-tf-${f.type}`} value={draft.timeframe} onChange={(e) => setDraft({ ...draft, timeframe: e.target.value as Timeframe })}>
                        {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    <label>الأداة<input value={instrument} readOnly /></label>
                  </div>
                  <div className="g2">
                    <label>السعر{' / '}الحد الأدنى<input id={`tm-lo-${f.type}`} className="num" inputMode="decimal" value={draft.priceLow} placeholder={f.hint} onChange={(e) => setDraft({ ...draft, priceLow: e.target.value })} /></label>
                    <label>الحد الأعلى (للمنطقة، اختياري)<input id={`tm-hi-${f.type}`} className="num" inputMode="decimal" value={draft.priceHigh} onChange={(e) => setDraft({ ...draft, priceHigh: e.target.value })} /></label>
                  </div>
                  <label>ملاحظتك<textarea id={`tm-note-${f.type}`} rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
                  {errors.length > 0 && <div className="err" role="alert">{errors.map((e) => ERR_AR[e] ?? e).join(' · ')}</div>}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" className="btn">{draft.id ? 'احفظ التعديل' : 'احفظ العلامة'}</button>
                    <button type="button" className="btn ghost" onClick={() => { setDraft(null); setErrors([]); }}>إلغاء</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })}

      <div className="device">
        <span className="chip mute">DEVICE-LOCAL</span>
        <span>العلامات محفوظة على هذا الجهاز فقط ولا تُرسل للخادم. لا تُرسم على الشارت.</span>
      </div>
      <div className="device" style={{ borderBottom: 0 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>عرض علامات يوم
          <input id="tril-view-date" type="date" value={viewDate} onChange={(e) => e.target.value && setViewDate(e.target.value)}
            style={{ background: 'var(--d-p)', border: '1px solid var(--d-line2)', color: 'var(--d-txt)', padding: '2px 6px' }} />
        </label>
        {store.storageError() && <span className="chip na">STORAGE ERROR</span>}
      </div>
      <div className="tril-note">TRIL يسجّل ما تراه أنت. لا يعدّ العوامل، ولا يعطي درجة أو حكماً، ولا يقترح دخولاً. لندن ليست نافذة مؤهلة للوقت.</div>
    </div>
  );
}
