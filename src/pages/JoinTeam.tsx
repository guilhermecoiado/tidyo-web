// Entrar na equipe pelo link (/equipe?t=…): see the company, create an account or sign in, ask to join; then wait for approval
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import Auth, { AuthShell } from './Auth';

const KEY = 'tidyo.teamLink';

export default function JoinTeam() {
  const { t, tg, tErr, lang, session, profile, membership, pendingJoin, refresh } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('t') || (() => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } })();
  const [info, setInfo] = useState<{ company_name: string; role: string } | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setInfo(null); return; }
    try { sessionStorage.setItem(KEY, token); } catch { /* ignore */ }
    supabase.rpc('team_link_info', { p_token: token }).then(({ data }) => setInfo(((data || []) as { company_name: string; role: string }[])[0] || null));
  }, [token]);
  useEffect(() => { if (profile?.full_name && !name) setName(profile.full_name); }, [profile, name]);
  useEffect(() => { if (membership) { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } nav('/', { replace: true }); } }, [membership, nav]);

  if (pendingJoin) return <PendingJoin />;
  if (info === undefined) return <AuthShell title="…"><div className="skeleton" style={{ height: 52, borderRadius: 15 }} /></AuthShell>;
  if (!info) return <AuthShell title={t('jt.invalidT')} sub={t('jt.invalidSub')}><button className="k-btn k-btn-line k-btn-big" onClick={() => nav('/')}>{t('c.back')}</button></AuthShell>;
  const role = tg(`team.${info.role}`, 'u');
  if (!session) return <Auth initial="signup" title={t('jt.title', { company: info.company_name })} subtitle={t('jt.sub', { role })} />;

  const ask = async () => {
    setBusy(true); setError('');
    const { error } = await supabase.rpc('request_join', { p_token: token, p_name: name.trim(), p_language: lang });
    setBusy(false);
    if (error) { setError(tErr(error.message)); return; }
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    await refresh();
  };
  return (
    <AuthShell title={t('jt.title', { company: info.company_name })} sub={t('jt.sub', { role })}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 800 }}>{t('jt.name')}
        <input className="k-input" style={{ minHeight: 50 }} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#566965' }}>{t('jt.nameHint')}</span>
      </label>
      {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
      <button className="k-btn k-btn-fill k-btn-big" disabled={busy || !name.trim()} onClick={ask}>{t('jt.ask')}</button>
    </AuthShell>
  );
}

export function PendingJoin() {
  const { t, tg, pendingJoin, refresh } = useApp();
  useEffect(() => { const i = window.setInterval(() => refresh(), 30000); return () => window.clearInterval(i); }, [refresh]);
  if (!pendingJoin) return null;
  return (
    <AuthShell title={t('jt.waitT')} sub={t('jt.waitSub', { company: pendingJoin.company_name, role: tg(`team.${pendingJoin.role}`, 'u') })}>
      <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FFFFFF', border: '1px solid #DFE7E5', borderRadius: 16, padding: '14px 16px' }}>
        <span style={{ width: 10, height: 10, borderRadius: 10, background: '#D99A06', flex: 'none' }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45 }}>{t('jt.waitNote')}</span>
      </div>
      <button className="k-btn k-btn-line k-btn-big" onClick={() => refresh()}>{t('jt.check')}</button>
      <button className="k-btn k-btn-line" style={{ color: '#9F1F14' }} onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
    </AuthShell>
  );
}
