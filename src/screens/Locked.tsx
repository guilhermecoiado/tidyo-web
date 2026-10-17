// Shown instead of the app when the trial ended or the account is paused/canceled. Data stays saved.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm } from '../components/ui';
import { ByYehi, C, LogoMark, display } from '../components/kit';

export default function Locked() {
  const { t, access, isStaff, membership, company } = useApp();
  const [owner, setOwner] = useState('');
  const [askOut, setAskOut] = useState(false);
  useEffect(() => {
    if (!isStaff && membership) supabase.rpc('owner_info', { cid: membership.company_id }).then(({ data }) => setOwner((((data || []) as { display_name: string }[])[0]?.display_name || '').split(' ')[0]));
  }, [isStaff, membership]);
  const owner_ = membership?.role === 'owner';
  const title = isStaff ? t(`lock.${access}`) : t('lock.helperTitle');
  const text = owner_ ? t('lock.ownerText') : isStaff ? t('lock.staffText') : t('lock.helperText', { company: company?.name || '', owner: owner || t('lock.theOwner') });
  return (
    <div className="k-screen" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <main className="k-page" style={{ gap: 18, maxWidth: 440, alignItems: 'stretch', paddingTop: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}><LogoMark size={56} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
          <h1 style={{ ...display, fontSize: 26, lineHeight: 1.15, margin: 0 }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.muted }}>{text}</p>
        </div>
        <div className="k-card" style={{ gap: 6, padding: 14, background: '#E3F1EE', borderColor: '#C9E4DE' }}>
          <b style={{ fontSize: 14, color: '#0B6B5F' }}>{t('lock.safeTitle')}</b>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: '#2F4A45' }}>{t('lock.safeText')}</span>
        </div>
        {owner_ ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link to="/ajuda" className="k-btn k-btn-fill" style={{ width: '100%' }}>{t('lock.talk')}</Link>
            <Link to="/app/conta" className="k-btn k-btn-line" style={{ width: '100%' }}>{t('lock.plans')}</Link>
            <Link to="/app/mais/seguranca" className="k-link" style={{ alignSelf: 'center', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>{t('lock.export')}</Link>
          </div>
        ) : isStaff ? (
          <Link to="/ajuda" className="k-btn k-btn-line" style={{ width: '100%' }}>{t('lock.talk')}</Link>
        ) : null}
        <button className="k-link" style={{ alignSelf: 'center', minHeight: 44, color: C.muted }} onClick={() => setAskOut(true)}>{t('auth.signout')}</button>
        <div style={{ display: 'flex', justifyContent: 'center' }}><ByYehi /></div>
      </main>
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)} onConfirm={async () => { await supabase.auth.signOut(); window.location.replace('/'); }} />}
    </div>
  );
}
