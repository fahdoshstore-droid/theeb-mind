import { useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { auth, type AuthStatus } from '../../lib/ledger-api';
import { setSessionUser } from '../../lib/api';
import { C, Notice } from './ui';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<AuthStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [claim, setClaim] = useState(false); const [busy, setBusy] = useState(false); const [tok, setTok] = useState('');

  const refresh = () => auth.status().then((s) => { setSt(s); setSessionUser(s.user?.id ?? null); if (s.bootstrapRequired) setMode('register'); }).catch((e) => setErr(String(e.message || e)));
  useEffect(() => { refresh(); }, []);

  if (!st) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>{err ?? 'جارٍ التحقق من الجلسة…'}</div>;
  if (st.authenticated) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { mode === 'login' ? await auth.login(u, p) : await auth.register(u, p, claim, tok); await refresh(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div dir="rtl" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--void)', padding: 16, fontFamily: 'var(--font-body)' }}>
      <form onSubmit={submit} style={{ ...C.card, width: 'min(380px, 100%)', display: 'grid', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, color: 'var(--gold)' }}>THEEB MIND</h1>
        <div style={C.muted}>{st.bootstrapRequired ? 'إعداد أول حساب (مالك الخادم). بعدها يُغلق التسجيل.' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</div>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>اسم المستخدم<input autoComplete="username" style={C.input} value={u} onChange={(e) => setU(e.target.value)} required minLength={3} /></label>
        <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>كلمة المرور{mode === 'register' && ' (10 أحرف على الأقل)'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={C.input} value={p} onChange={(e) => setP(e.target.value)} required minLength={mode === 'register' ? 10 : 1} /></label>
        {st.bootstrapTokenRequired && <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>Bootstrap token (من متغير BOOTSTRAP_TOKEN على الخادم)<input type="password" style={C.input} value={tok} onChange={(e) => setTok(e.target.value)} required /></label>}
        {st.bootstrapRequired && (
          <label style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={claim} onChange={(e) => setClaim(e.target.checked)} />
            <span>ربط بيانات النسخة القديمة (المستخدم user-1) بهذا الحساب — فقط إن كانت بياناتك أنت</span>
          </label>
        )}
        {err && <Notice tone="bad">{err}</Notice>}
        <button style={C.btn} disabled={busy}>{busy ? '…' : mode === 'login' ? 'دخول' : 'إنشاء'}</button>
        {!st.bootstrapRequired && st.registrationOpen && (
          <button type="button" style={C.btnGhost} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'إنشاء حساب جديد' : 'لدي حساب'}</button>
        )}
      </form>
    </div>
  );
}
