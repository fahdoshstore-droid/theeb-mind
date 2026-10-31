import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, fmtUsd } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, Field, useAsync, Loading, ErrorBox, statusTone, Empty, TradeLink } from '../../components/ledger/ui';

type Item = { state?: string | null; source?: string | null; note?: string | null; ref?: string | null; confirmedByUser?: boolean | null; level?: string | null };
const STATES = [['', '—'], ['yes', 'yes'], ['no', 'no'], ['unclear', 'unclear'], ['na', 'not applicable']];
const SOURCES = [['', 'مصدر الدليل…'], ['manual', 'manual'], ['screenshot', 'screenshot'], ['market_data', 'market data'], ['ai_assisted', 'AI-assisted']];

function EvidenceRow({ label, value, onChange, extra }: { label: string; value: Item | undefined; onChange: (v: Item) => void; extra?: React.ReactNode }) {
  const v = value ?? {};
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1.3fr) 110px 140px minmax(120px, 2fr)', gap: 6, alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <select aria-label={`${label} state`} style={C.input} value={v.state ?? ''} onChange={(e) => onChange({ ...v, state: e.target.value || null })}>{STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select aria-label={`${label} source`} style={C.input} value={v.source ?? ''} onChange={(e) => onChange({ ...v, source: e.target.value || null })}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {extra}
        <input style={{ ...C.input, flex: 1 }} placeholder="ملاحظة / رابط الشارت" value={v.note ?? ''} onChange={(e) => onChange({ ...v, note: e.target.value })} />
        {v.source === 'ai_assisted' && <label style={{ fontSize: 11, whiteSpace: 'nowrap' }}><input type="checkbox" checked={Boolean(v.confirmedByUser)} onChange={(e) => onChange({ ...v, confirmedByUser: e.target.checked })} /> أكدته</label>}
      </div>
    </div>
  );
}

const nowLocal = () => { const d = new Date(); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function RiskCalculator() {
  const [r, setR] = useState<any>({ symbol: 'MNQ', side: 'long', entryPrice: '', stopPrice: '', targetPrice: '', quantity: 1, feesPerContractRoundTrip: '' });
  const [out, setOut] = useState<any>(null); const [err, setErr] = useState<unknown>(null);
  const run = async () => {
    setErr(null);
    try {
      setOut(await api.post('/ledger/risk/check', { symbol: r.symbol, side: r.side, entryPrice: Number(r.entryPrice), stopPrice: Number(r.stopPrice), targetPrice: r.targetPrice === '' ? null : Number(r.targetPrice),
        quantity: Number(r.quantity), feesPerContractRoundTrip: r.feesPerContractRoundTrip === '' ? null : Number(r.feesPerContractRoundTrip) }));
    } catch (e) { setErr(e); setOut(null); }
  };
  return (
    <Card title="حاسبة المخاطرة (من Entry / Stop / Qty / tick value)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        <Field label="Symbol"><input style={C.input} value={r.symbol} onChange={(e) => setR({ ...r, symbol: e.target.value })} /></Field>
        <Field label="Side"><select style={C.input} value={r.side} onChange={(e) => setR({ ...r, side: e.target.value })}><option>long</option><option>short</option></select></Field>
        {(['entryPrice', 'stopPrice', 'targetPrice', 'quantity', 'feesPerContractRoundTrip'] as const).map((k) => (
          <Field key={k} label={{ entryPrice: 'Entry', stopPrice: 'Stop', targetPrice: 'Target', quantity: 'Contracts', feesPerContractRoundTrip: 'Fees/contract RT' }[k]}>
            <input style={C.input} inputMode="decimal" value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} /></Field>
        ))}
      </div>
      <button style={{ ...C.btn, marginTop: 10 }} onClick={run}>احسب</button>
      {err != null && <div style={{ marginTop: 8 }}><ErrorBox error={err} /></div>}
      {out && (
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {!out.risk.valid && <Notice tone="bad">{out.risk.errors.join('؛ ')}</Notice>}
          <div style={{ fontSize: 13 }}>
            Risk <b>{fmtUsd(out.risk.riskUsd)}</b> ({out.risk.stopDistanceTicks} ticks × ${out.spec.tickValue}/tick × {r.quantity}){out.risk.feesUsd != null && <> + fees {fmtUsd(out.risk.feesUsd)} = <b>{fmtUsd(out.risk.totalRiskUsd)}</b></>}
            {out.risk.rrr != null && <> · RRR <b>{out.risk.rrr}</b>{out.risk.rrrAfterCosts != null && out.risk.feesUsd != null && <> (after costs {out.risk.rrrAfterCosts})</>}</>}
            {out.maxContractsByRisk != null && <> · أقصى عقود ضمن الحد: <b>{out.maxContractsByRisk}</b></>}
          </div>
          {out.checks.map((c: any) => <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}><Badge tone={statusTone(c.status)}>{c.status}</Badge><span>{c.label}: {c.detail}</span>{c.unconfirmed && <Badge tone="warn">قيمة غير مؤكدة في ملفك</Badge>}</div>)}
          <div style={C.muted}>Tick spec: {out.spec.tickSize} / ${out.spec.tickValue} — {out.spec.source}</div>
        </div>
      )}
    </Card>
  );
}

export default function TrilReview() {
  const [sp] = useSearchParams();
  const tradeId = sp.get('tradeId'); const openId = sp.get('id');
  const meta = useAsync(() => api.get('/ledger/meta'), []);
  const list = useAsync(() => api.get<any[]>('/ledger/tril'), []);
  const trades = useAsync(() => api.get<any[]>('/ledger/trades?limit=200'), []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'pre_trade' | 'post_trade'>(tradeId ? 'post_trade' : 'pre_trade');
  const [head, setHead] = useState<any>({ instrument: 'NQ', direction: 'long', decisionTime: nowLocal(), analysisText: '', readiness: '', emotion: '' });
  const [ev, setEv] = useState<any>({ time: {}, raid: {}, inversion: {}, liquidity: {}, topDown: {} });
  const [result, setResult] = useState<any>(null); const [err, setErr] = useState<unknown>(null); const [saved, setSaved] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState(tradeId ?? '');

  useEffect(() => {
    if (!openId) return;
    api.get(`/ledger/tril/${openId}`).then((r) => {
      setEditingId(r.id); setLocked(Boolean(r.lockedAt)); setPhase(r.phase); setEv({ time: {}, raid: {}, inversion: {}, liquidity: {}, topDown: {}, ...r.evidence });
      setHead({ instrument: r.instrument ?? '', direction: r.direction ?? 'long', decisionTime: r.decisionTime ? new Date(new Date(r.decisionTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '', analysisText: r.analysisText ?? '', readiness: r.readiness ?? '', emotion: r.emotion ?? '' });
      setResult(r.result); setLinkTo(r.tradeId ?? '');
    }).catch(setErr);
  }, [openId]);

  const payload = () => ({ phase, tradeId: phase === 'post_trade' ? linkTo || null : null, instrument: head.instrument || null, direction: head.direction || null,
    decisionTime: head.decisionTime ? new Date(head.decisionTime).toISOString() : null, analysisText: head.analysisText || null,
    readiness: head.readiness ? Number(head.readiness) : null, emotion: head.emotion || null, evidence: ev });
  useEffect(() => { const h = setTimeout(() => { api.post('/ledger/tril/evaluate', payload()).then(setResult).catch(() => undefined); }, 250); return () => clearTimeout(h); }, [JSON.stringify(ev), head.decisionTime]);

  const set = (sec: string, key: string, v: unknown) => setEv((p: any) => ({ ...p, [sec]: { ...(p[sec] ?? {}), [key]: v } }));
  const save = async () => {
    setErr(null); setSaved(null);
    try {
      const r = editingId ? await api.put(`/ledger/tril/${editingId}`, payload()) : await api.post('/ledger/tril', payload());
      setEditingId(r.id); setLocked(Boolean(r.lockedAt)); setResult(r.result); setSaved(`حُفظ ${r.phase} في ${r.recordedAt}`); list.reload();
    } catch (e) { setErr(e); }
  };
  const lock = async () => {
    if (!editingId) return;
    try { const r = await api.post(`/ledger/tril/${editingId}/lock`, { tradeId: linkTo || null }); setLocked(true); setSaved(`قُفل${r.tradeId ? ' ورُبط بالصفقة' : ''}${r.retrospective ? ' — retrospective: سُجّل بعد وقت الدخول' : ''}`); list.reload(); }
    catch (e) { setErr(e); }
  };
  const reset = () => { setEditingId(null); setLocked(false); setEv({ time: {}, raid: {}, inversion: {}, liquidity: {}, topDown: {} }); setHead({ ...head, decisionTime: nowLocal(), analysisText: '' }); setSaved(null); };

  const tz = meta.data?.tril;
  return (
    <LedgerShell title="TRIL Decision Review" subtitle={<>T Time · R Raid · I Inversion · L Liquidity — {tz?.methodologyVersion}. سجّل تحليلك أولاً؛ لا يوجد تعليق AI على هذه الشاشة.</>}>
      <Notice tone="neutral">
        المرجع: ملخصك لملف TRIL (الملف الأصلي PDF لم يكن متاحاً لهذا البناء). NY AM 09:30–12:10 · NY PM 13:30–16:10 (America/New_York مع DST) · Macro xx:50–xx:10 و xx:20–xx:40.
        {' '}غير مُفسَّر برمجياً: {tz?.notInterpreted?.join('، ')}. PASS يعني اكتمال الأدلة المسجلة وليس احتمال ربح.
      </Notice>
      {locked && <Notice>هذا السجل مقفل — ما كان معروفاً لحظة القرار لا يُعدّل. أضف Post-trade review للمعلومات اللاحقة.</Notice>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 14 }} className="tril-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <Card title="السياق" right={<div style={{ display: 'flex', gap: 6 }}><select style={C.input} value={phase} disabled={Boolean(editingId)} onChange={(e) => setPhase(e.target.value as any)}><option value="pre_trade">Pre-trade (قبل الدخول)</option><option value="post_trade">Post-trade review</option></select><button style={C.btnGhost} onClick={reset}>جديد</button></div>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Field label="Instrument"><input style={C.input} value={head.instrument} onChange={(e) => setHead({ ...head, instrument: e.target.value })} /></Field>
              <Field label="Direction"><select style={C.input} value={head.direction} onChange={(e) => setHead({ ...head, direction: e.target.value })}><option>long</option><option>short</option></select></Field>
              <Field label="وقت القرار (توقيت جهازك)" hint="يُحوّل إلى NY تلقائياً"><input type="datetime-local" style={C.input} value={head.decisionTime} onChange={(e) => setHead({ ...head, decisionTime: e.target.value })} /></Field>
              <Field label="الجاهزية النفسية 1–5"><select style={C.input} value={head.readiness} onChange={(e) => setHead({ ...head, readiness: e.target.value })}><option value="">not recorded</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Field>
              <Field label="الحالة"><input style={C.input} value={head.emotion} onChange={(e) => setHead({ ...head, emotion: e.target.value })} /></Field>
            </div>
            <Field label="تحليلك قبل الصفقة (بكلماتك)"><textarea style={{ ...C.input, minHeight: 80, marginTop: 8 }} value={head.analysisText} onChange={(e) => setHead({ ...head, analysisText: e.target.value })} /></Field>
            {phase === 'post_trade' && (
              <Field label="الصفقة المرتبطة"><select style={C.input} value={linkTo} onChange={(e) => setLinkTo(e.target.value)}><option value="">—</option>{(trades.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.entryNy} {t.symbol} {t.side} {t.netPnl ?? ''}</option>)}</select></Field>
            )}
          </Card>
          <Card title="T — Time">
            <div style={C.muted}>محسوب من وقت القرار وجلساتك المفعّلة (قواعد المخاطرة ← Enabled NY sessions).</div>
            <EvidenceRow label="استثناء: سحب سيولة رئيسي ثم PD Array مباشرة (خارج Macro)" value={ev.time?.macroExceptionRaidToPdArray} onChange={(v) => set('time', 'macroExceptionRaidToPdArray', v)} />
          </Card>
          <Card title="R — Raid">
            <EvidenceRow label="سحب سيولة قمة/قاع رئيسي" value={ev.raid?.liquiditySwept} onChange={(v) => set('raid', 'liquiditySwept', v)}
              extra={<input style={{ ...C.input, width: 110 }} placeholder="المستوى" value={ev.raid?.liquiditySwept?.level ?? ''} onChange={(e) => set('raid', 'liquiditySwept', { ...(ev.raid?.liquiditySwept ?? {}), level: e.target.value })} />} />
            <EvidenceRow label="SMT Divergence مقابل ES" value={ev.raid?.smtVsEs} onChange={(v) => set('raid', 'smtVsEs', v)} />
            <div style={C.muted}>التطبيق لا يكتشف SMT تلقائياً (لا توجد بيانات ES هنا). اختر unclear إن لم تتأكد.</div>
          </Card>
          <Card title="I — Inversion">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <Field label="النوع"><select style={C.input} value={ev.inversion?.type ?? ''} onChange={(e) => set('inversion', 'type', e.target.value || null)}><option value="">—</option><option value="ifvg">IFVG</option><option value="breaker">Breaker</option></select></Field>
              <Field label="الحالة"><select style={C.input} value={ev.inversion?.state ?? ''} onChange={(e) => set('inversion', 'state', e.target.value || null)}>
                <option value="">—</option><option value="none">none</option><option value="formed">formed</option><option value="confirmed">confirmed</option><option value="retest_seen">retest seen</option><option value="invalidated">invalidated</option></select></Field>
              <Field label="مصدر الدليل"><select style={C.input} value={ev.inversion?.source ?? ''} onChange={(e) => set('inversion', 'source', e.target.value || null)}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            </div>
            {ev.inversion?.source === 'ai_assisted' && <label style={{ fontSize: 12 }}><input type="checkbox" checked={Boolean(ev.inversion?.confirmedByUser)} onChange={(e) => set('inversion', 'confirmedByUser', e.target.checked)} /> أكدت الدليل بنفسي</label>}
            <EvidenceRow label="استثناء الـRetest: Raid واضح ثم PD Array مباشرة" value={ev.inversion?.directPdArrayAfterRaid} onChange={(v) => set('inversion', 'directPdArrayAfterRaid', v)} />
          </Card>
          <Card title="L — Liquidity">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              <Field label="Draw on Liquidity"><input style={C.input} value={ev.liquidity?.drawOnLiquidity ?? ''} onChange={(e) => set('liquidity', 'drawOnLiquidity', e.target.value)} /></Field>
              <Field label="ERL / IRL"><select style={C.input} value={ev.liquidity?.dolType ?? ''} onChange={(e) => set('liquidity', 'dolType', e.target.value || null)}><option value="">—</option><option>ERL</option><option>IRL</option></select></Field>
              <Field label="Target"><input style={C.input} value={ev.liquidity?.target ?? ''} onChange={(e) => set('liquidity', 'target', e.target.value)} /></Field>
              <Field label="Invalidation"><input style={C.input} value={ev.liquidity?.invalidation ?? ''} onChange={(e) => set('liquidity', 'invalidation', e.target.value)} /></Field>
              <Field label="مصدر"><select style={C.input} value={ev.liquidity?.source ?? ''} onChange={(e) => set('liquidity', 'source', e.target.value || null)}>{SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            </div>
            <EvidenceRow label="قصة ERL ↔ IRL واضحة" value={ev.liquidity?.erlIrlStoryClear} onChange={(v) => set('liquidity', 'erlIrlStoryClear', v)} />
          </Card>
          <Card title="Top-down HTF / MTF / LTF">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              <Field label="HTF bias"><select style={C.input} value={ev.topDown?.htfBias ?? ''} onChange={(e) => set('topDown', 'htfBias', e.target.value || null)}><option value="">—</option><option>bullish</option><option>bearish</option><option>neutral</option><option>unclear</option></select></Field>
              <Field label="MTF مقابل HTF"><select style={C.input} value={ev.topDown?.mtf ?? ''} onChange={(e) => set('topDown', 'mtf', e.target.value || null)}><option value="">—</option><option>aligned</option><option>conflict</option><option>unclear</option></select></Field>
            </div>
            <EvidenceRow label="نموذج دخول LTF" value={ev.topDown?.ltfModel} onChange={(v) => set('topDown', 'ltfModel', v)} />
          </Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button style={C.btn} onClick={save} disabled={locked}>{editingId ? 'تحديث السجل' : 'حفظ السجل'}</button>
            {editingId && !locked && phase === 'pre_trade' && <>
              <select style={C.input} value={linkTo} onChange={(e) => setLinkTo(e.target.value)}><option value="">قفل بدون ربط</option>{(trades.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.entryNy} {t.symbol} {t.side}</option>)}</select>
              <button style={C.btnGhost} onClick={lock}>قفل (ما عُرف لحظة القرار)</button></>}
            {saved && <Badge tone="good">{saved}</Badge>}
          </div>
          {err != null && <ErrorBox error={err} />}
        </div>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Card title="النتيجة">
            {!result ? <Loading /> : <>
              <div style={{ marginBottom: 8 }}><Badge tone={statusTone(result.overall)}>{result.overallLabel}</Badge></div>
              {result.timeContext && <div style={{ ...C.muted, marginBottom: 8 }}>{result.timeContext.nyDate} {result.timeContext.nyTime} NY (UTC{result.timeContext.utcOffsetMinutes / 60}) · KZ: {result.timeContext.sourceKillzone ?? 'none'} · Macro: {result.timeContext.macroWindow ?? 'none'}</div>}
              {result.components.map((c: any) => (
                <div key={c.key} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><b style={{ fontSize: 13 }}>{c.key === 'TOP_DOWN' ? 'Top-down' : `${c.key} — ${c.name}`}</b><Badge tone={statusTone(c.status)}>{c.status.replace('_', ' ')}</Badge></div>
                  {c.reasons.map((x: string, i: number) => <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>• {x}</div>)}
                  {c.missing.map((x: string, i: number) => <div key={i} style={{ fontSize: 11, color: 'var(--gold-bright)' }}>? {x}</div>)}
                  {c.evidenceSources.length > 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>sources: {c.evidenceSources.join(', ')}</div>}
                </div>
              ))}
              {result.notes.map((n: string, i: number) => <div key={i} style={{ marginTop: 6 }}><Notice tone="neutral">{n}</Notice></div>)}
              <div style={{ ...C.muted, marginTop: 8 }}>{result.disclaimer}</div>
              <div style={{ ...C.muted, marginTop: 8 }}>تُقيَّم بشكل منفصل: Setup quality (TRIL أعلاه) · Rule adherence (حاسبة المخاطرة) · Execution grade وحالة النفسية (صفحة الصفقة) · النتيجة المالية. لا يوجد score مجمّع.</div>
            </>}
          </Card>
          <RiskCalculator />
          <Card title="سجلات سابقة">
            {list.loading ? <Loading /> : !list.data?.length ? <Empty>لا توجد سجلات.</Empty> : list.data.slice(0, 30).map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '3px 0' }}>
                <Link to={`/ledger/review?id=${e.id}`} style={{ ...C.mono, color: 'var(--gold-bright)' }}>{e.recordedAt.slice(0, 16).replace('T', ' ')}</Link>
                <Badge>{e.phase === 'pre_trade' ? 'pre' : 'post'}</Badge><Badge tone={statusTone(e.overall)}>{e.overall.replace('_', ' ')}</Badge>
                {e.lockedAt && <Badge>locked</Badge>}{e.retrospective && <Badge tone="warn">retrospective</Badge>}{e.tradeId && <TradeLink id={e.tradeId} />}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </LedgerShell>
  );
}
