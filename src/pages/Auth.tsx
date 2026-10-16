// Entrar (canvas "Login"): sign in, sign up, email link, verification code, password reset — PT/EN/ES
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Select } from '../components/pickers';
import { type Lang } from '../lib/i18n';

type Mode = 'login' | 'signup' | 'reset' | 'sent' | 'resetSent' | 'link' | 'linkSent';

export const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const ink = '#0F1F1C', brand = '#0A3D35', accent = '#0B7C6E', muted = '#566965', line = '#DFE7E5';
const input = { minHeight: 50, boxSizing: 'border-box', borderRadius: 14, border: `1px solid ${line}`, background: '#FFFFFF', padding: '0 14px', fontSize: 16, color: ink, width: '100%', fontFamily: 'inherit' } as const;
const btn = (bg: string) => ({ minHeight: 52, borderRadius: 15, border: 0, background: bg, color: '#FFFFFF', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', width: '100%' }) as const;
const link = { minHeight: 40, border: 0, background: 'transparent', color: accent, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', padding: '0 4px' } as const;

/** Language chips on the green header (also used by other public screens) */
export function LangPicker({ light = false }: { light?: boolean }) {
  const { lang, setLang } = useApp();
  return (
    <div role="group" aria-label="Idioma / Language" style={{ display: 'flex', gap: 2, background: light ? '#E4ECEA' : '#FFFFFF', borderRadius: 10, padding: 3, flex: 'none' }}>
      {([['pt-BR', 'PT'], ['en', 'EN'], ['es', 'ES']] as [Lang, string][]).map(([l, code]) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          style={{ minWidth: 34, minHeight: 32, borderRadius: 8, border: 0, background: lang === l ? (light ? '#FFFFFF' : brand) : 'transparent', color: lang === l ? (light ? ink : '#FFFFFF') : light ? muted : '#2F5B54', fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>{code}</button>
      ))}
    </div>
  );
}

/** Green top band with logo, language and title — shared by every sign-in step */
export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F7F6', color: ink, fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: 14, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#D4F1E9', borderRadius: '0 0 28px 28px', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="40" height="40" viewBox="0 0 64 64" role="img" aria-label="Tidyo" style={{ flex: 'none' }}><rect width="64" height="64" rx="17" fill="#FFFFFF" /><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill={brand} /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke={brand} strokeWidth="7" strokeLinecap="round" /></g></svg>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 800, letterSpacing: '-0.035em', color: brand, flex: 1 }}>tidyo</span>
            <LangPicker />
          </div>
          <h1 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: brand, textWrap: 'balance' } as CSSProperties}>{title}</h1>
          {sub && <p style={{ margin: 0, fontSize: 14, color: '#2F5B54', lineHeight: 1.5 }}>{sub}</p>}
        </div>
      </div>
      <div style={{ flex: 1, width: '100%', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box', padding: '22px 20px calc(24px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
        <span style={{ marginTop: 'auto', paddingTop: 12, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#7F9692' }}>Tidyo by YEHI · Developed by YEHI</span>
      </div>
    </div>
  );
}

function F({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 800, minWidth: 0 }}>
      {label}{children}{hint && <span style={{ fontSize: 12, fontWeight: 600, color: muted }}>{hint}</span>}
    </label>
  );
}

export default function Auth({ initial = 'login', title, subtitle }: { initial?: Mode; title?: string; subtitle?: string }) {
  const { t, tErr, lang } = useApp();
  const [mode, setMode] = useState<Mode>(initial);
  const [f, setF] = useState({ email: '', password: '', first: '', last: '', phone: '', state: 'CT', city: '' });
  const [show, setShow] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const go = (m: Mode) => { setMode(m); setError(''); };
  const redirect = window.location.origin + window.location.pathname + window.location.search;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const email = f.email.trim();
    if (!email) { setError(t('li.needEmail')); return; }
    if ((mode === 'login' || mode === 'signup') && f.password.length < 8) { setError(t('auth.weak')); return; }
    if (mode === 'signup' && !f.first.trim()) { setError(t('li.needName')); return; }
    setBusy(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: f.password });
      if (error) setError(tErr(error.message));
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email, password: f.password,
        options: { emailRedirectTo: redirect, data: { full_name: `${f.first.trim()} ${f.last.trim()}`.trim(), phone: f.phone.trim(), state: f.state, city: f.city.trim(), language: lang, marketing_opt_in: marketing } },
      });
      if (error) setError(tErr(error.message));
      else if (!data.session) setMode('sent');
    } else if (mode === 'link') {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: false } });
      if (error) setError(tErr(error.message)); else setMode('linkSent');
    } else if (mode === 'reset') {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/nova-senha' });
      setMode('resetSent');
    }
    setBusy(false);
  };

  const T: Record<Mode, [string, string]> = {
    login: [title || t('li.welcome'), subtitle || t('li.welcomeSub')],
    signup: [title || t('li.signupT'), subtitle || t('li.signupSub')],
    link: [t('li.linkT'), t('li.linkSub')],
    linkSent: [t('li.checkT'), t('li.linkSentSub')],
    reset: [t('li.resetT'), t('li.resetSub')],
    resetSent: [t('li.checkT'), t('li.resetSentSub')],
    sent: [t('li.checkT'), t('li.confirmSub')],
  };
  const err = error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>;

  return (
    <AuthShell title={T[mode][0]} sub={T[mode][1]}>
      {mode === 'login' && (
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button type="button" onClick={() => go('link')} style={btn(brand)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z" /><path d="M3 7l9 6 9-6" /></svg>
            {t('li.withLink')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8AA19C', fontSize: 12, fontWeight: 700 }}><span style={{ flex: 1, height: 1, background: line }} />{t('li.orEmail')}<span style={{ flex: 1, height: 1, background: line }} /></div>
          <F label="Email"><input style={input} type="email" inputMode="email" autoComplete="email" placeholder={t('li.emailPh')} value={f.email} onChange={up('email')} /></F>
          <F label={t('auth.password')}>
            <span style={{ position: 'relative', display: 'block' }}>
              <input style={{ ...input, paddingRight: 56 }} type={show ? 'text' : 'password'} autoComplete="current-password" placeholder={t('li.passPh')} value={f.password} onChange={up('password')} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? t('li.hide') : t('li.show')} style={{ position: 'absolute', right: 4, top: 3, width: 44, height: 44, borderRadius: 12, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{show && <path d="M4 4l16 16" />}</svg>
              </button>
            </span>
          </F>
          <button type="button" onClick={() => go('reset')} style={{ ...link, alignSelf: 'flex-end' }}>{t('li.forgot')}</button>
          {err}
          <button type="submit" disabled={busy} style={btn(accent)}>{t('auth.login')}</button>
          <span style={{ textAlign: 'center', fontSize: 13.5, color: muted }}>{t('li.noAccount')} <button type="button" onClick={() => go('signup')} style={{ ...link, minHeight: 32, padding: 0 }}>{t('li.createFree')}</button></span>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <F label={t('li.first')}><input style={{ ...input, minHeight: 48 }} autoComplete="given-name" value={f.first} onChange={up('first')} /></F>
            <F label={t('li.last')}><input style={{ ...input, minHeight: 48 }} autoComplete="family-name" value={f.last} onChange={up('last')} /></F>
          </div>
          <F label={t('li.phone')}><input style={{ ...input, minHeight: 48 }} type="tel" autoComplete="tel" placeholder="(555) 000-0000" value={f.phone} onChange={up('phone')} /></F>
          <F label="Email"><input style={{ ...input, minHeight: 48 }} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={up('email')} /></F>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <F label={t('li.state')}><Select value={f.state} onChange={(v) => setF({ ...f, state: v })} label={t('li.state')}>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></F>
            <F label={t('li.city')}><input style={{ ...input, minHeight: 48 }} autoComplete="address-level2" value={f.city} onChange={up('city')} /></F>
          </div>
          <F label={t('li.newPass')} hint={t('auth.passwordHint')}><input style={{ ...input, minHeight: 48 }} type="password" autoComplete="new-password" value={f.password} onChange={up('password')} /></F>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: '#3E4F4C', lineHeight: 1.45, cursor: 'pointer' }}>
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} style={{ width: 20, height: 20, accentColor: accent, flex: 'none', margin: 0 }} />
            {t('li.marketing')}
          </label>
          {err}
          <button type="submit" disabled={busy} style={btn(accent)}>{t('li.createStart')}</button>
          <span style={{ fontSize: 12, color: muted, textAlign: 'center', lineHeight: 1.5 }}>{t('li.terms1')} <a href="/termos" target="_blank" rel="noreferrer" style={{ color: accent, fontWeight: 700 }}>{t('li.terms')}</a> {t('li.and')} <a href="/privacidade" target="_blank" rel="noreferrer" style={{ color: accent, fontWeight: 700 }}>{t('li.privacy')}</a>.</span>
          <button type="button" onClick={() => go('login')} style={link}>{t('li.haveAccount')}</button>
        </form>
      )}

      {(mode === 'link' || mode === 'reset') && (
        <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <F label={t('li.accountEmail')}><input style={input} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={up('email')} autoFocus /></F>
          {err}
          <button type="submit" disabled={busy} style={btn(accent)}>{t('auth.sendReset')}</button>
          <button type="button" onClick={() => go('login')} style={link}>{t('auth.back')}</button>
        </form>
      )}

      {(mode === 'sent' || mode === 'resetSent' || mode === 'linkSent') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }} role="status">
          <span style={{ width: 52, height: 52, borderRadius: 52, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18v12H3z" /><path d="M3 7l9 6 9-6" /></svg></span>
          <span style={{ fontSize: 14.5, color: '#3E4F4C', lineHeight: 1.55 }}>{mode === 'sent' ? t('li.confirmText', { email: f.email }) : mode === 'linkSent' ? t('li.linkText') : t('li.resetText')}</span>
          <button onClick={() => go('login')} style={btn(accent)}>{t('auth.back')}</button>
        </div>
      )}
    </AuthShell>
  );
}

/** Six boxes for a verification code; pastes and backspace work across boxes */
export function CodeBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useApp();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, d: string) => {
    const digits = d.replace(/\D/g, '');
    if (digits.length > 1) { const v = (value.slice(0, i) + digits).slice(0, 6); onChange(v); refs.current[Math.min(5, v.length)]?.focus(); return; }
    const arr = value.padEnd(6, ' ').split(''); arr[i] = digits || ' ';
    onChange(arr.join('').replace(/\s+$/, ''));
    if (digits && i < 5) refs.current[i + 1]?.focus();
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} aria-label={t('li.digit', { n: i + 1 })} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1}
          value={(value[i] || '').trim()} onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !(value[i] || '').trim() && i > 0) refs.current[i - 1]?.focus(); }}
          style={{ minHeight: 56, width: '100%', boxSizing: 'border-box', borderRadius: 14, border: `1.5px solid ${i === Math.min(5, value.trim().length) ? accent : line}`, background: '#FFFFFF', textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: ink, padding: 0 }} />
      ))}
    </div>
  );
}

/** Second step when two-step verification is on (authenticator app) */
export function MfaPrompt({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(''); setBusy(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const fac = data?.totp?.find((x) => x.status === 'verified');
    if (!fac) { setBusy(false); onDone(); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fac.id, code: code.trim() });
    setBusy(false);
    if (error) { setError(t('sec.badCode')); setCode(''); } else onDone();
  };
  useEffect(() => { if (code.length === 6 && !busy) submit(); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <AuthShell title={t('li.codeT')} sub={t('li.codeSub')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CodeBoxes value={code} onChange={setCode} />
        {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
        <button type="submit" disabled={code.length !== 6 || busy} style={btn(accent)}>{t('li.confirm')}</button>
        <button type="button" style={link} onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
      </form>
    </AuthShell>
  );
}

export function NewPassword({ forced = false }: { forced?: boolean }) {
  const { t, tErr, toast } = useApp();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('auth.weak')); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setBusy(false);
    if (error) setError(tErr(error.message));
    else { toast(t('c.saved')); window.location.replace('/'); }
  };
  return (
    <AuthShell title={forced ? t('pw.forcedT') : t('auth.newPassword')} sub={forced ? t('pw.forcedS') : t('li.newPassSub')}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <F label={t('auth.newPassword')} hint={t('auth.passwordHint')}><input style={input} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></F>
        {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
        <button type="submit" disabled={busy} style={btn(accent)}>{t('auth.savePassword')}</button>
      </form>
    </AuthShell>
  );
}
