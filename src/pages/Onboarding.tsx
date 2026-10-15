import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Icon, Wordmark } from '../components/ui';
import { LangPicker } from './Auth';
import Auth from './Auth';

type Mode = 'residential' | 'commercial' | 'both';

export default function Onboarding() {
  const { t, tErr, lang, refresh, session } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('residential');
  const [solo, setSolo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError('');
    let utm: Record<string, string> = {};
    try { utm = JSON.parse(localStorage.getItem('tidyo.utm') || '{}'); } catch { /* ignore */ }
    const { error } = await supabase.rpc('create_company', {
      p_name: name.trim(), p_mode: mode, p_language: lang,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', p_solo: solo, p_utm: utm,
    });
    if (error) { setError(tErr(error.message)); setBusy(false); return; }
    await refresh();
    nav('/app', { replace: true });
  };

  if (!session) return <Auth initial="signup" />;

  const modes: { v: Mode; icon: string; title: string; hint: string }[] = [
    { v: 'residential', icon: 'home', title: t('ob.res'), hint: t('ob.resHint') },
    { v: 'commercial', icon: 'building', title: t('ob.com'), hint: t('ob.comHint') },
    { v: 'both', icon: 'users', title: t('ob.both'), hint: `${t('ob.res')} + ${t('ob.com')}` },
  ];

  return (
    <main className="auth-wrap">
      <Wordmark />
      <h1>{t('ob.title')}</h1>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <Field label={t('ob.company')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <div className="stack" role="radiogroup" aria-label={t('ob.mode')}>
          <span className="label">{t('ob.mode')}</span>
          {modes.map((m) => (
            <button type="button" key={m.v} role="radio" aria-checked={mode === m.v} onClick={() => setMode(m.v)} className="item"
              style={mode === m.v ? { borderColor: 'var(--action)', boxShadow: 'var(--focus-ring)' } : undefined}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: mode === m.v ? 'var(--brand-dark)' : 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Icon name={m.icon} color={mode === m.v ? '#5FD4C1' : 'var(--brand-dark)'} size={20} />
              </span>
              <span className="body"><span className="title">{m.title}</span><span className="small muted">{m.hint}</span></span>
            </button>
          ))}
        </div>
        {mode !== 'commercial' && (
          <label className="check"><input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} />{t('ob.solo')}</label>
        )}
        <div className="stack"><span className="label">{t('ob.lang')}</span><LangPicker /></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>{t('ob.start')}</button>
        <p className="hint" style={{ margin: 0, textAlign: 'center' }}>{t('ob.noCard')}</p>
      </form>
    </main>
  );
}

export function AcceptInvite() {
  const { t, tErr, session, refresh } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('t') || '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (token) { try { sessionStorage.setItem('tidyo.invite', token); } catch { /* ignore */ } } }, [token]);

  if (!session) return <Auth initial="signup" title={t('inv2.title')} subtitle={t('inv2.text')} />;

  const accept = async () => {
    setBusy(true); setError('');
    const tk = token || (() => { try { return sessionStorage.getItem('tidyo.invite') || ''; } catch { return ''; } })();
    const { error } = await supabase.rpc('accept_invite', { p_token: tk });
    setBusy(false);
    if (error) { setError(tErr(error.message)); return; }
    try { sessionStorage.removeItem('tidyo.invite'); } catch { /* ignore */ }
    await refresh();
    nav('/', { replace: true });
  };

  return (
    <main className="auth-wrap">
      <Wordmark />
      <h1>{t('inv2.title')}</h1>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" onClick={accept} disabled={busy}>{t('inv2.accept')}</button>
      <LangPicker />
    </main>
  );
}
