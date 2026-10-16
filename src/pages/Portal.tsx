// Client portal invitation: create an account or sign in, then link it to the client
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import Auth, { AuthShell } from './Auth';

export function PortalInvite() {
  const { t, tErr, session, refresh } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('t') || '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (token) { try { sessionStorage.setItem('tidyo.portalInvite', token); } catch { /* ignore */ } } }, [token]);
  if (!session) return <Auth initial="signup" title={t('pt.joinTitle')} subtitle={t('pt.joinText')} />;
  const accept = async () => {
    setBusy(true); setError('');
    let tk = token;
    if (!tk) { try { tk = sessionStorage.getItem('tidyo.portalInvite') || ''; } catch { /* ignore */ } }
    const { error } = await supabase.rpc('accept_portal_invite', { p_token: tk });
    setBusy(false);
    if (error) { setError(tErr(error.message)); return; }
    try { sessionStorage.removeItem('tidyo.portalInvite'); } catch { /* ignore */ }
    await refresh();
    nav('/portal', { replace: true });
  };
  return (
    <AuthShell title={t('pt.joinTitle')} sub={t('pt.joinText')}>
      {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
      <button className="k-btn k-btn-fill k-btn-big" onClick={accept} disabled={busy}>{t('pt.join')}</button>
    </AuthShell>
  );
}
