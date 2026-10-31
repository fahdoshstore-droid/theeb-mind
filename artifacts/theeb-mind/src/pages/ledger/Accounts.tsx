import { useState } from 'react';
import { api, fmtUsd } from '../../lib/ledger-api';
import { LedgerShell, Card, Badge, Notice, C, Field, useAsync, Loading, ErrorBox, Empty, statusTone } from '../../components/ledger/ui';

const PHASES = [['personal', 'Personal / live'], ['challenge', 'Challenge'], ['funded_pre_payout', 'Funded — before first payout'], ['funded_post_payout', 'Funded — after first payout']];
const RULE_FIELDS: [string, string][] = [['accountSize', 'Account size'], ['maxDrawdownUsd', 'Max drawdown $'], ['dailyLossLimitUsd', 'Daily loss limit $'], ['profitTargetUsd', 'Profit target $'],
  ['consistencyMaxDayPct', 'Consistency: largest day ≤ %'], ['minProfitableDays', 'Min profitable days'], ['minProfitPerDayUsd', '"Profitable day" ≥ $'], ['minPayoutUsd', 'Min payout $'],
  ['maxPayoutPctOfProfit', 'Max payout % of profit'], ['minBufferAboveFloorUsd', 'Buffer to keep above floor $']];

function FirmForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState<any>({ name: '', sourceUrl: '', sourceCheckedAt: '', notes: '', rules: { drawdownModel: 'unknown' } });
  const [err, setErr] = useState<unknown>(null);
  const save = async () => {
    setErr(null);
    const rules: any = { drawdownModel: f.rules.drawdownModel, trailingStopsAtStart: f.rules.trailingStopsAtStart ?? null };
    for (const [k] of RULE_FIELDS) if (f.rules[k] !== undefined && f.rules[k] !== '') rules[k] = Number(f.rules[k]);
    try { await api.post('/ledger/firms', { name: f.name, sourceUrl: f.sourceUrl || null, sourceCheckedAt: f.sourceCheckedAt || null, notes: f.notes || null, rules }); onSaved(); setF({ ...f, name: '' }); } catch (e) { setErr(e); }
  };
  return (
    <Card title="Firm profile جديد (القواعد من مصدر رسمي تتحقق منه أنت)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        <Field label="الاسم"><input style={C.input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="رابط المصدر (https)"><input style={C.input} value={f.sourceUrl} onChange={(e) => setF({ ...f, sourceUrl: e.target.value })} /></Field>
        <Field label="تاريخ التحقق"><input type="date" style={C.input} value={f.sourceCheckedAt} onChange={(e) => setF({ ...f, sourceCheckedAt: e.target.value })} /></Field>
        <Field label="Drawdown model"><select style={C.input} value={f.rules.drawdownModel} onChange={(e) => setF({ ...f, rules: { ...f.rules, drawdownModel: e.target.value } })}>
          <option value="unknown">unknown</option><option value="static">static</option><option value="trailing_eod">trailing end-of-day</option><option value="trailing_intraday">trailing intraday</option></select></Field>
        {RULE_FIELDS.map(([k, l]) => <Field key={k} label={l}><input style={C.input} inputMode="decimal" value={f.rules[k] ?? ''} onChange={(e) => setF({ ...f, rules: { ...f.rules, [k]: e.target.value } })} placeholder="غير معروف" /></Field>)}
        <label style={{ fontSize: 12, alignSelf: 'end' }}><input type="checkbox" checked={Boolean(f.rules.trailingStopsAtStart)} onChange={(e) => setF({ ...f, rules: { ...f.rules, trailingStopsAtStart: e.target.checked } })} /> trailing floor يتوقف عند الرصيد الابتدائي</label>
      </div>
      <button style={{ ...C.btn, marginTop: 10 }} onClick={save} disabled={!f.name}>حفظ</button>
      {err != null && <ErrorBox error={err} />}
    </Card>
  );
}

function Planner({ accountId }: { accountId: string }) {
  const p = useAsync(() => api.get(`/ledger/planner/${accountId}`), [accountId]);
  const [pay, setPay] = useState<any>({ kind: 'submitted', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [eq, setEq] = useState<any>({ equity: '', asOf: new Date().toISOString().slice(0, 10) });
  if (p.loading) return <Loading />;
  if (p.error) return <ErrorBox error={p.error} />;
  const { plan, firm, firmRulesNote, payouts, account } = p.data;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={C.muted}>{firm ? <>Firm: <b>{firm.name}</b> — {firmRulesNote}</> : firmRulesNote}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        {[['Account equity', plan.equity.value, plan.equity.source], ['Drawdown floor', plan.floor.value, plan.floor.detail], ['Buffer', plan.buffer.value, plan.buffer.detail], ['Eligible payout', plan.eligibleAmount.value, plan.eligibleAmount.detail],
          ['Submitted', plan.payouts.submitted, 'payout records'], ['Approved', plan.payouts.approved, 'payout records'], ['Cash received', plan.payouts.received, 'payout records']].map(([l, v, s]: any) => (
          <div key={l} style={{ ...C.card, padding: 10 }}><div style={C.muted}>{l}</div><div style={{ fontSize: 17, fontWeight: 800 }}>{v == null ? <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>unknown</span> : fmtUsd(v)}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s}</div></div>
        ))}
      </div>
      <div><Badge tone={statusTone(plan.eligibility)}>{plan.eligibility.replace('_', ' ')}</Badge> {plan.checks.map((c: any) => <span key={c.key} style={{ marginInlineStart: 6 }}><Badge tone={statusTone(c.status)}>{c.label}: {c.status}</Badge> <span style={C.muted}>{c.detail}</span></span>)}</div>
      {plan.warnings.map((w: string, i: number) => <Notice key={i}>{w}</Notice>)}
      {plan.riskSuggestion && <Notice tone="neutral">اقتراح مخاطرة للمرحلة: ${plan.riskSuggestion.min}–${plan.riskSuggestion.max} لكل صفقة — {plan.riskSuggestion.note}<br /><span style={{ fontSize: 11 }}>{plan.riskSuggestion.source}</span></Notice>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'end' }}>
        <Field label="سجل payout"><select style={C.input} value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value })}><option value="submitted">submitted</option><option value="approved">approved</option><option value="received">received (cash)</option><option value="rejected">rejected</option></select></Field>
        <Field label="المبلغ"><input style={{ ...C.input, width: 100 }} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
        <Field label="التاريخ"><input type="date" style={C.input} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
        <button style={C.btnGhost} disabled={account.isDemo} onClick={async () => { await api.post(`/ledger/planner/${accountId}/payouts`, { ...pay, amount: Number(pay.amount) }); p.reload(); }}>إضافة</button>
        <Field label="Equity من لوحة الشركة"><input style={{ ...C.input, width: 110 }} value={eq.equity} onChange={(e) => setEq({ ...eq, equity: e.target.value })} /></Field>
        <Field label="كما في"><input type="date" style={C.input} value={eq.asOf} onChange={(e) => setEq({ ...eq, asOf: e.target.value })} /></Field>
        <button style={C.btnGhost} onClick={async () => { await api.post(`/ledger/planner/${accountId}/equity`, { equity: Number(eq.equity), asOf: eq.asOf }); p.reload(); }}>حفظ equity</button>
      </div>
      {payouts.length > 0 && <div style={C.muted}>{payouts.map((x: any, i: number) => <div key={i}>{x.date} · {x.kind} · {fmtUsd(x.amount)}</div>)}</div>}
    </div>
  );
}

export default function Accounts() {
  const accounts = useAsync(() => api.get<any[]>('/ledger/accounts'), []);
  const firms = useAsync(() => api.get<any[]>('/ledger/firms'), []);
  const [sel, setSel] = useState<string | null>(null);
  const [na, setNa] = useState<any>({ name: '', phase: 'personal', startingBalance: '', firmProfileId: '' });
  const [err, setErr] = useState<unknown>(null);
  const update = async (id: string, patch: any) => { setErr(null); try { await api.patch(`/ledger/accounts/${id}`, patch); accounts.reload(); } catch (e) { setErr(e); } };
  return (
    <LedgerShell title="Accounts & Funded Payout Planner" subtitle="فصل واضح: account equity · eligible payout · submitted · cash received. أرقام الفيديو اقتراحات وليست شروط شركة.">
      {err != null && <ErrorBox error={err} />}
      <Card title="الحسابات">
        {accounts.loading ? <Loading /> : !accounts.data?.length ? <Empty>لا توجد حسابات — تُنشأ تلقائياً عند الاستيراد أو من هنا.</Empty> : accounts.data.map((a) => (
          <div key={a.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <b>{a.name}</b>{a.is_demo ? <Badge tone="demo">DEMO</Badge> : null}
              <select style={C.input} value={a.phase} disabled={Boolean(a.is_demo)} onChange={(e) => update(a.id, { phase: e.target.value })}>{PHASES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}{a.is_demo ? <option value="demo">demo</option> : null}</select>
              <select style={C.input} value={a.firm_profile_id ?? ''} onChange={(e) => update(a.id, { firmProfileId: e.target.value || null })}><option value="">بدون firm profile</option>{(firms.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <input style={{ ...C.input, width: 120 }} placeholder="starting balance" defaultValue={a.starting_balance ?? ''} onBlur={(e) => e.target.value !== String(a.starting_balance ?? '') && update(a.id, { startingBalance: e.target.value ? Number(e.target.value) : null })} />
              <button style={C.btnGhost} onClick={() => setSel(sel === a.id ? null : a.id)}>{sel === a.id ? 'إخفاء' : 'Planner'}</button>
            </div>
            {sel === a.id && <div style={{ marginTop: 10 }}><Planner accountId={a.id} /></div>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'end' }}>
          <Field label="حساب جديد"><input style={C.input} value={na.name} onChange={(e) => setNa({ ...na, name: e.target.value })} /></Field>
          <Field label="المرحلة"><select style={C.input} value={na.phase} onChange={(e) => setNa({ ...na, phase: e.target.value })}>{PHASES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Starting balance"><input style={{ ...C.input, width: 110 }} value={na.startingBalance} onChange={(e) => setNa({ ...na, startingBalance: e.target.value })} /></Field>
          <button style={C.btn} disabled={!na.name} onClick={async () => { setErr(null); try { await api.post('/ledger/accounts', { name: na.name, phase: na.phase, startingBalance: na.startingBalance ? Number(na.startingBalance) : null, firmProfileId: na.firmProfileId || null }); setNa({ ...na, name: '' }); accounts.reload(); } catch (e) { setErr(e); } }}>إضافة</button>
        </div>
      </Card>
      <Card title="Firm profiles">
        {firms.loading ? <Loading /> : !firms.data?.length ? <Empty>لا توجد. أدخل شروط الشركة يدوياً مع رابط المصدر وتاريخ التحقق.</Empty> : firms.data.map((f) => (
          <div key={f.id} style={{ fontSize: 12, padding: '4px 0' }}><b>{f.name}</b> · {f.sourceUrl ? <a href={f.sourceUrl} target="_blank" rel="noreferrer noopener" style={{ color: 'var(--gold-bright)' }}>{f.sourceUrl}</a> : <Badge tone="warn">بلا مصدر</Badge>} · checked {f.sourceCheckedAt ?? '—'} · <span style={C.mono}>{JSON.stringify(f.rules)}</span></div>
        ))}
      </Card>
      <FirmForm onSaved={firms.reload} />
    </LedgerShell>
  );
}
