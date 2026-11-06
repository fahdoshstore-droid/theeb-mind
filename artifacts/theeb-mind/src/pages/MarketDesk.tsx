// ============================================================
// THEEB MIND — Market Desk (/market)
// NQ preparation workstation. The TradingView widget is display only.
// Every panel shows its source, its integration stage and its data
// state. Nothing here invents, substitutes or scores data.
// ============================================================
import { useEffect, useRef, useState, type ReactNode } from 'react';
import '../components/desk/desk.css';
import TrilPanel from '../components/desk/TrilPanel';
import CotLegacyPanel from '../components/desk/CotLegacyPanel';
import { StateChip, SourceStage } from '../components/desk/StateChip';
import { getLiveMarket, getMacroNarrative, setMacroNarrative, getWeeklyBias, setWeeklyBias } from '../lib/api';
import type { LiveTick, MacroNarrative, WeeklyBias } from '../lib/types';
import { evaluateTrilTime, TRIL_TIME } from '../lib/tril-time';

const USER_ID = 'user-1';
const BIAS_INSTRUMENTS = ['NAS', 'GOLD', 'DXY', 'EUR', 'GBP'];
const CHART_SYMBOLS: { id: string; label: string; note: string }[] = [
  { id: 'CME_MINI:NQ1!', label: 'NQ1!', note: 'CME E-mini Nasdaq-100 continuous (as shown by TradingView)' },
  { id: 'OANDA:NAS100USD', label: 'NAS100', note: 'CFD proxy, not the futures contract' },
];
const INTERVALS: { id: string; label: string }[] = [
  { id: '5', label: '5m' }, { id: '15', label: '15m' }, { id: '60', label: '1h' }, { id: 'D', label: '1D' },
];

function ageText(iso: string, nowMs: number) {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 90) return `${s}s`;
  if (s < 5400) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}
const fmtPrice = (p: number) => p.toLocaleString('en-US', { maximumFractionDigits: p >= 100 ? 2 : 4 });

function ThesisStrip() {
  const [narr, setNarr] = useState<MacroNarrative | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bias, setBias] = useState<WeeklyBias[]>([]);
  const [biasSaving, setBiasSaving] = useState<string | null>(null);
  const [biasError, setBiasError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getMacroNarrative(USER_ID).then((n) => { setNarr(n); setText(n?.narrativeText ?? ''); }).catch(() => {}).finally(() => setLoaded(true));
    getWeeklyBias(USER_ID).then(setBias).catch(() => setBiasError(true));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const saveNarr = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const u = await setMacroNarrative(USER_ID, text);
      setNarr(u); setEditing(false); setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    } catch { /* keep the editor open */ } finally { setSaving(false); }
  };
  const current = (inst: string) => bias.find((b) => b.instrument === inst)?.bias ?? null;
  const saveBias = async (inst: string, b: 'bullish' | 'bearish' | 'neutral') => {
    setBiasSaving(inst);
    try {
      await setWeeklyBias(USER_ID, { instrument: inst, bias: b, notes: bias.find((x) => x.instrument === inst)?.notes ?? '' });
      setBias((prev) => prev.some((x) => x.instrument === inst)
        ? prev.map((x) => (x.instrument === inst ? { ...x, bias: b } : x))
        : [...prev, { id: '', userId: USER_ID, instrument: inst, bias: b, weekKey: '', notes: undefined }]);
    } catch { setBiasError(true); } finally { setBiasSaving(null); }
  };

  return (
    <div className="thesis">
      <div style={{ minWidth: 0 }}>
        <div className="k">WEEKLY THESIS · USER{narr?.weekKey ? ' · ' + narr.weekKey : ''}</div>
        {editing ? (
          <>
            <textarea id="desk-thesis" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="أطروحتك لهذا الأسبوع…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" className="btn" disabled={saving || !text.trim()} onClick={saveNarr}>{saving ? 'جاري الحفظ…' : 'احفظ الأطروحة'}</button>
              <button type="button" className="btn ghost" onClick={() => { setEditing(false); setText(narr?.narrativeText ?? ''); }}>إلغاء</button>
            </div>
          </>
        ) : (
          <>
            <p className={'text' + (narr?.narrativeText ? '' : ' empty')}>
              {narr?.narrativeText || (loaded ? 'لم تُكتب أطروحة هذا الأسبوع بعد.' : '…')}
            </p>
            <button type="button" className="linkbtn" onClick={() => setEditing(true)}>{narr?.narrativeText ? 'تعديل' : 'اكتب الأطروحة'}</button>
            {saved && <span className="chip ok" style={{ marginInlineStart: 10 }}>SAVED</span>}
          </>
        )}
      </div>
      <div className="bias" aria-label="الميل الأسبوعي">
        <div className="k" style={{ textAlign: 'left' }}>WEEKLY BIAS · USER</div>
        {BIAS_INSTRUMENTS.map((inst) => (
          <div className="row" key={inst}>
            <b>{inst}</b>
            <div className="seg" role="group" aria-label={inst}>
              {(['bullish', 'neutral', 'bearish'] as const).map((b) => (
                <button key={b} type="button" aria-pressed={current(inst) === b} disabled={biasSaving === inst} onClick={() => saveBias(inst, b)}>
                  {b === 'bullish' ? 'صعودي' : b === 'bearish' ? 'هبوطي' : 'محايد'}
                </button>
              ))}
            </div>
          </div>
        ))}
        {biasError && <span className="chip na">BIAS UNAVAILABLE</span>}
      </div>
    </div>
  );
}

function Unavailable({ children }: { children: ReactNode }) {
  return <div className="na-box">{children}</div>;
}

function OtherMarkets() {
  const [ticks, setTicks] = useState<LiveTick[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const load = () => getLiveMarket().then((t) => { setTicks(t); setFailed(false); }).catch(() => setFailed(true)).finally(() => setNow(Date.now()));
    load();
    const t = setInterval(load, 60_000);
    const c = setInterval(() => setNow(Date.now()), 15_000);
    return () => { clearInterval(t); clearInterval(c); };
  }, []);
  return (
    <div className="rb" data-testid="other-markets">
      <div className="rh"><h3 style={{ fontSize: 17 }}>أسواق أخرى</h3><span className="code">BTC · ETH · XAU · EUR/USD</span></div>
      <div className="prov"><span><b>Binance → CoinGecko · ECB</b></span><SourceStage entry="otherMarkets" /></div>
      {failed && (!ticks || ticks.length === 0) ? (
        <Unavailable><StateChip state="UNAVAILABLE" /><span>تعذّر جلب الأسعار. لا تُعرض قيم سابقة.</span></Unavailable>
      ) : !ticks ? <p className="cap">…</p> : (
        <div className="rows">
          {ticks.map((t) => (
            <div className="r" key={t.symbol}>
              <span className="s">{t.symbol}</span>
              {t.source === 'ECB' ? <StateChip state="DELAYED" detail="DAILY REF" /> : <StateChip state="LIVE" detail={ageText(t.updatedAt, now)} />}
              <span className="num">{fmtPrice(t.price)}{t.changePct !== null && <span className={t.changePct >= 0 ? 'up' : 'dn'} style={{ marginLeft: 8, fontSize: 11 }}>{t.changePct > 0 ? '+' : ''}{t.changePct.toFixed(2)}%</span>}</span>
            </div>
          ))}
          {ticks.length < 4 && <p className="cap">بعض الرموز غير متاحة حالياً ولا تُعرض.</p>}
        </div>
      )}
    </div>
  );
}

function TimeStrip() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const t = evaluateTrilTime(now);
  const status = t.status === 'IN_WINDOW' ? 'داخل النافذة' : t.status === 'BEFORE_WINDOW' ? 'قبل النافذة' : t.status === 'AFTER_WINDOW' ? 'بعد النافذة' : 'يوم غير مسموح';
  return (
    <div className="strip">
      <div>
        <span className="lbl">TRIL TIME</span>
        <span><span className="num">{TRIL_TIME.label}</span> · <span className="num">MON TUE THU</span> · <span className="num">{TRIL_TIME.timeZone}</span> — الآن <span className="num">{t.time}</span> · {status}</span>
      </div>
      <div>
        <span className="lbl">CALENDAR</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <StateChip state="UNAVAILABLE" /><SourceStage entry="calendar" />
          <span style={{ color: 'var(--d-t2)' }}>غير متصل في هذه المرحلة. لا تُعرض أحداث البذرة كتقويم حقيقي.</span>
        </span>
      </div>
      <div>
        <span className="lbl">NEWS</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <StateChip state="UNAVAILABLE" /><SourceStage entry="news" />
          <span style={{ color: 'var(--d-t2)' }}>لا يوجد مصدر أخبار متصل.</span>
        </span>
      </div>
    </div>
  );
}

export default function MarketDesk() {
  const [symbol, setSymbol] = useState(CHART_SYMBOLS[0].id);
  const [ivl, setIvl] = useState('15');
  const sym = CHART_SYMBOLS.find((s) => s.id === symbol)!;
  const src = 'https://www.tradingview.com/widgetembed/?frameElementId=tv&symbol=' + encodeURIComponent(symbol)
    + '&interval=' + ivl + '&theme=dark&style=1&locale=ar&toolbar_bg=0b0d0f&hide_side_toolbar=0&allow_symbol_change=0&save_image=0&timezone=America%2FNew_York';

  return (
    <div className="desk" dir="rtl" data-testid="market-desk">
      <div className="srcbar" aria-label="حالة المصادر">
        <span><span className="k">CHART</span><span className="chip mute">DISPLAY ONLY</span></span>
        <span><span className="k">NQ OHLC</span><StateChip state="UNAVAILABLE" /></span>
        <span><span className="k">YIELDS</span><StateChip state="UNAVAILABLE" /></span>
        <span><span className="k">COT</span><span className="chip mute">SEE PANEL</span></span>
        <span><span className="k">CAL / NEWS</span><StateChip state="UNAVAILABLE" /></span>
        <span><span className="k">IPDA</span><StateChip state="METHODOLOGY_PENDING" /></span>
        <span><span className="k">DXY · VIX</span><StateChip state="NO_SOURCE" /></span>
      </div>

      <ThesisStrip />

      <div className="main">
        {/* Research */}
        <div className="col">
          <div className="ph"><b>الأبحاث الخارجية</b><span>COT · السندات · السياق</span><span className="end mono ltr" style={{ color: 'var(--d-t3)', fontSize: 10 }}>EXTERNAL RESEARCH</span></div>
          <CotLegacyPanel />

          <div className="rb" data-testid="bonds">
            <div className="rh"><h3>السندات والعوائد</h3><span className="code">US TREASURIES</span></div>
            <div className="prov"><span><b>TradingView MCP</b></span><SourceStage entry="us10y" /></div>
            <div className="rows">
              {(['US02Y', 'US10Y'] as const).map((s) => (
                <div className="r" key={s}><span className="s">{s}</span><StateChip state="UNAVAILABLE" /><span className="num" style={{ color: 'var(--d-t3)' }}>—</span>
                  <span className="why">TradingView MCP غير متصل بالتطبيق في هذه المرحلة.</span></div>
              ))}
              <div className="r"><span className="s">US30Y</span><StateChip state="NOT_APPROVED" /><span className="num" style={{ color: 'var(--d-t3)' }}>—</span>
                <span className="why">لم يُعتمد كمصدر مباشر حتى يُتحقق منه.</span></div>
            </div>
          </div>

          <div className="rb" data-testid="context">
            <div className="rh"><h3>السياق</h3><span className="code">DXY · VIX</span></div>
            <div className="rows">
              {(['DXY', 'VIX'] as const).map((s) => (
                <div className="r" key={s}><span className="s">{s}</span><StateChip state="NO_SOURCE" /><span className="num" style={{ color: 'var(--d-t3)' }}>—</span>
                  <span className="why">لا يوجد مصدر معتمد. قيم البذرة الحالية لا تُعرض.</span></div>
              ))}
            </div>
          </div>

          <div className="rb" data-testid="seasonality">
            <div className="rh"><h3 style={{ fontSize: 17 }}>الموسمية</h3><span className="code">SUPPLEMENTARY</span><StateChip state="UNAVAILABLE" /></div>
            <div className="prov"><span><b>MarketBulls</b></span><SourceStage entry="seasonality" /></div>
            <p className="cap">عامل مساند، خارج هذه المرحلة. لا تُعرض قيم.</p>
          </div>

          <OtherMarkets />
        </div>

        {/* Chart */}
        <div className="chartcol">
          <div className="ph">
            <b>NQ</b>
            <span className="seg" role="group" aria-label="الرمز">
              {CHART_SYMBOLS.map((s) => <button key={s.id} type="button" aria-pressed={symbol === s.id} onClick={() => setSymbol(s.id)}>{s.label}</button>)}
            </span>
            <span className="seg" role="group" aria-label="الإطار الزمني">
              {INTERVALS.map((i) => <button key={i.id} type="button" aria-pressed={ivl === i.id} onClick={() => setIvl(i.id)}>{i.label}</button>)}
            </span>
            <span className="chip mute">DISPLAY ONLY</span>
            <span className="end prov" style={{ justifyContent: 'flex-start' }}><span><b>TradingView widget</b> · {sym.note}</span></span>
          </div>
          <div className="chart-frame">
            <iframe key={src} src={src} title="NQ chart — TradingView widget, display only" />
          </div>
          <div className="ipda" data-testid="ipda">
            <b>IPDA — METHODOLOGY PENDING</b>
            <span style={{ color: 'var(--d-t2)', fontSize: 12 }}>المنهجية غير معتمدة. لا تُحسب نطاقات أو مستويات ولا تُعرض.</span>
          </div>
          <div className="ipda" style={{ paddingBlock: 8 }}>
            <span style={{ color: 'var(--d-t3)', fontSize: 11.5 }}>
              الشارت للعرض فقط: لا تُقرأ منه بيانات ولا تُرسم عليه علامات TRIL. العلامات تُسجَّل نصاً في لوحة TRIL.
            </span>
          </div>
          <TimeStrip />
        </div>

        {/* TRIL */}
        <div className="col tril-col">
          <TrilPanel instrument="NQ" defaultTimeframe="15m" />
        </div>
      </div>
    </div>
  );
}
