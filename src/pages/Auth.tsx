import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Wordmark, Segmented } from '../components/ui';
import { LANG_LABEL, type Lang } from '../lib/i18n';

type Mode = 'login' | 'signup' | 'reset' | 'sent' | 'resetSent';

export function LangPicker() {
  const { lang, setLang } = useApp();
  return (
    <Segmented<Lang> label="Idioma / Language" value={lang} onChange={setLang}
      options={(['pt-BR', 'en', 'es'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
  );
}

export default function Auth({ initial = 'login', title, subtitle }: { initial?: Mode; title?: string; subtitle?: string }) {
  const { t, tErr, lang } = useApp();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if ((mode === 'login' || mode === 'signup') && password.length < 8) { setError(t('auth.weak')); return; }
    setBusy(true);
    const redirect = window.location.origin + window.location.pathname + window.location.search;
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(tErr(error.message));
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: redirect, data: { full_name: name.trim(), language: lang, marketing_opt_in: marketing } },
      });
      if (error) setError(tErr(error.message));
      else if (!data.session) setMode('sent');
    } else if (mode === 'reset') {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/nova-senha' });
      setMode('resetSent');
    }
    setBusy(false);
  };

  return (
    <main className="auth-wrap">
      <Wordmark />
      <div className="stack" style={{ gap: 6 }}>
        <h1>{title || t('auth.welcome')}</h1>
        <p className="muted" style={{ margin: 0 }}>{subtitle || t('auth.sub')}</p>
      </div>

      {(mode === 'sent' || mode === 'resetSent') ? (
        <div className="card stack" role="status">
          {mode === 'sent'
            ? <p style={{ margin: 0 }}>{t('auth.checkEmail')} <b>{email}</b>. {t('auth.checkEmail2')}</p>
            : <p style={{ margin: 0 }}>{t('auth.resetSent')}</p>}
          <button className="btn btn-secondary" onClick={() => setMode('login')}>{t('auth.back')}</button>
        </div>
      ) : (
        <form className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
          {mode !== 'reset' && (
            <Segmented<Mode> label={t('auth.login')} value={mode} onChange={(m) => { setMode(m); setError(''); }}
              options={[{ value: 'login', label: t('auth.login') }, { value: 'signup', label: t('auth.signup') }]} />
          )}
          {mode === 'signup' && (
            <Field label={t('auth.name')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></Field>
          )}
          <Field label={t('auth.email')}>
            <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          {mode !== 'reset' && (
            <Field label={t('auth.password')} hint={mode === 'signup' ? t('auth.passwordHint') : undefined}>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required />
            </Field>
          )}
          {mode === 'signup' && (
            <label className="check"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />{t('auth.marketing')}</label>
          )}
          {error && <p className="error-text" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !email}>
            {mode === 'login' ? t('auth.login') : mode === 'signup' ? t('auth.signup') : t('auth.sendReset')}
          </button>
          {mode === 'login' && <button type="button" className="link-btn" onClick={() => setMode('reset')}>{t('auth.forgot')}</button>}
          {mode === 'reset' && <button type="button" className="link-btn" onClick={() => setMode('login')}>{t('auth.back')}</button>}
          {mode === 'signup' && <p className="hint" style={{ margin: 0 }}>{t('auth.terms')}</p>}
        </form>
      )}
      <LangPicker />
    </main>
  );
}

export function NewPassword() {
  const { t, tErr, toast } = useApp();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError(t('auth.weak')); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(tErr(error.message));
    else { toast(t('c.saved')); window.location.replace('/'); }
  };
  return (
    <main className="auth-wrap">
      <Wordmark />
      <h1>{t('auth.newPassword')}</h1>
      <form className="stack" onSubmit={submit}>
        <Field label={t('auth.newPassword')} hint={t('auth.passwordHint')}>
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{t('auth.savePassword')}</button>
      </form>
    </main>
  );
}
