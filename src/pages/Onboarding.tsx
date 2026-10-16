// Primeiro acesso (canvas "Onboarding"): 3 steps — business, how it works, language — then the 14-day trial starts
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Select } from '../components/pickers';
import { C, I, Svg } from '../components/kit';
import Auth, { AuthShell, LangPicker, US_STATES } from './Auth';
import type { Lang } from '../lib/i18n';

const input = { minHeight: 50, boxSizing: 'border-box', borderRadius: 14, border: `1px solid ${C.line}`, background: '#FFFFFF', padding: '0 14px', fontSize: 16, color: C.ink, width: '100%', fontFamily: 'inherit' } as const;
const chip = (on: boolean): CSSProperties => ({ minHeight: 48, borderRadius: 14, border: `1px solid ${on ? C.accent : C.line}`, background: on ? C.accent : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' });

export default function Onboarding() {
  const { t, tErr, lang, refresh, session } = useApp();
  const nav = useNavigate();
  const meta = (session?.user.user_metadata || {}) as { state?: string; city?: string };
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [state, setState] = useState(meta.state || 'CT');
  const [address, setAddress] = useState('');
  const [res, setRes] = useState(true);
  const [com, setCom] = useState(false);
  const [resMode, setResMode] = useState<'solo' | 'helpers'>('helpers');
  const [helpers, setHelpers] = useState(3);
  const [comMode, setComMode] = useState<'solo' | 'team'>('team');
  const [roles, setRoles] = useState<Record<string, boolean>>({ sup: true, tec: true });
  const [clientLang, setClientLang] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!session) return <Auth initial="signup" />;

  const finish = async () => {
    setBusy(true); setError('');
    let utm: Record<string, string> = {};
    try { utm = JSON.parse(localStorage.getItem('tidyo.utm') || '{}'); } catch { /* ignore */ }
    const mode = res && com ? 'both' : com ? 'commercial' : 'residential';
    const solo = (!res || resMode === 'solo') && (!com || comMode === 'solo');
    const { data: cid, error } = await supabase.rpc('create_company', {
      p_name: name.trim(), p_mode: mode, p_language: clientLang,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', p_solo: solo, p_utm: utm,
    });
    if (error) { setError(tErr(error.message)); setBusy(false); return; }
    await supabase.from('companies').update({ state, address: address.trim() || null }).eq('id', cid as string);
    if (address.trim()) supabase.functions.invoke('geocode', { body: { table: 'companies', ids: [cid], address: address.trim() } }).then(() => undefined).catch(() => undefined);
    supabase.auth.updateUser({ data: { onboarding: { helpers: res && resMode === 'helpers' ? helpers : 0, roles: com && comMode === 'team' ? Object.keys(roles).filter((k) => roles[k]) : [] } } }).then(() => undefined);
    await refresh();
    nav('/app', { replace: true });
  };

  const modes = [
    { key: 'res', on: res, set: setRes, icon: I.home, name: t('ob2.res'), desc: t('ob2.resDesc'), tags: [t('ob2.tagRecurring'), 'Helpers', t('rt.title')] },
    { key: 'com', on: com, set: setCom, icon: 'M4 3h16v18H4zM9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3', name: t('ob2.com'), desc: t('ob2.comDesc'), tags: [t('ob2.tagContracts'), 'Walkthrough', t('ob2.tagShifts')] },
  ];
  const roleDefs: [string, string][] = [['sup', t('ob2.rSup')], ['tec', t('ob2.rTec')], ['piso', t('ob2.rFloor')], ['jan', t('ob2.rWin')]];
  const canNext = step === 1 ? !!name.trim() : step === 2 ? res || com : true;

  return (
    <div style={{ minHeight: '100dvh', background: '#F4F7F6', color: C.ink, fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: 14 }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 'calc(16px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="k-iconbtn" aria-label={t('c.back')} disabled={step === 1} style={{ opacity: step === 1 ? 0.4 : 1 }} onClick={() => setStep(step - 1)}><Svg d={I.back} size={20} color={C.ink} /></button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{t('ob2.step', { n: step })}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>{[1, 2, 3].map((i) => <div key={i} style={{ height: 5, borderRadius: 5, background: i <= step ? C.accent : C.line }} />)}</div>
          </div>
          <LangPicker light />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 700, lineHeight: 1.15, textWrap: 'balance' } as CSSProperties}>{t(`ob2.t${step}`)}</h1>
          <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{t(`ob2.s${step}`)}</span>
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 800 }}>{t('ob.company')}<input style={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Sparkle Home Cleaning" /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 800 }}>{t('li.state')}<Select value={state} onChange={setState} label={t('li.state')}>{US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 800 }}>{t('ob2.address')}<input style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="120 Bank St, Waterbury, CT 06702" autoComplete="street-address" />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>{t('ob2.addressHint')}</span></label>
          </div>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modes.map((m) => (
                <button key={m.key} aria-pressed={m.on} onClick={() => m.set(!m.on)} style={{ textAlign: 'left', borderRadius: 20, border: `2px solid ${m.on ? C.accent : C.line}`, background: m.on ? '#F0F9F7' : '#FFFFFF', padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                  <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 16, background: m.on ? C.accent : '#EEF2F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={m.icon} size={26} color={m.on ? '#FFFFFF' : '#3E4F4C'} w={1.9} /></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 700, flex: 1 }}>{m.name}</span>
                      <span style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${m.on ? C.accent : '#B9C7C4'}`, background: m.on ? C.accent : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxSizing: 'border-box' }}>{m.on && <Svg d={I.check} size={14} color="#FFFFFF" w={3} />}</span>
                    </span>
                    <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.45 }}>{m.desc}</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{m.tags.map((tg) => <span key={tg} style={{ fontSize: 11.5, fontWeight: 700, color: '#3E4F4C', background: '#EEF2F1', borderRadius: 999, padding: '3px 9px' }}>{tg}</span>)}</span>
                  </span>
                </button>
              ))}
              <span style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{t('ob2.both')}</span>
            </div>
            {res && (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('ob2.qRes')}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <button aria-pressed={resMode === 'solo'} onClick={() => setResMode('solo')} style={chip(resMode === 'solo')}>{t('ob2.justMe')}</button>
                  <button aria-pressed={resMode === 'helpers'} onClick={() => setResMode('helpers')} style={chip(resMode === 'helpers')}>{t('ob2.withHelpers')}</button>
                </div>
                {resMode === 'helpers' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{t('ob2.howMany')}</span>
                    <button className="k-step" aria-label={t('ob2.less')} onClick={() => setHelpers(Math.max(1, helpers - 1))}>−</button>
                    <span className="num" style={{ minWidth: 28, textAlign: 'center', fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700 }}>{helpers}</span>
                    <button className="k-step" aria-label={t('ob2.more')} onClick={() => setHelpers(Math.min(50, helpers + 1))}>+</button>
                  </div>
                )}
              </div>
            )}
            {com && (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('ob2.qCom')}</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                  <button aria-pressed={comMode === 'solo'} onClick={() => setComMode('solo')} style={chip(comMode === 'solo')}>{t('ob2.justMe')}</button>
                  <button aria-pressed={comMode === 'team'} onClick={() => setComMode('team')} style={chip(comMode === 'team')}>{t('ob2.haveTeam')}</button>
                </div>
                {comMode === 'team' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: C.muted }}>{t('ob2.roles')}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {roleDefs.map(([k, label]) => <button key={k} aria-pressed={!!roles[k]} onClick={() => setRoles({ ...roles, [k]: !roles[k] })} style={{ ...chip(!!roles[k]), minHeight: 38, padding: '0 12px', borderRadius: 999, fontSize: 12.5 }}>{label}</button>)}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F0F9F7', borderRadius: 12, padding: '10px 12px' }}>
                  <Svg d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01" size={16} color="#0B6B5F" />
                  <span style={{ fontSize: 12.5, color: '#0B6B5F', lineHeight: 1.45, fontWeight: 600 }}>{t('ob2.comNote')}</span>
                </div>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('ob2.clientLang')}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {([['en', 'English'], ['es', 'Español'], ['pt-BR', 'Português']] as [Lang, string][]).map(([l, label]) => <button key={l} aria-pressed={clientLang === l} onClick={() => setClientLang(l)} style={chip(clientLang === l)}>{label}</button>)}
              </div>
              <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{t('ob2.clientLangHint', { lang: t(`lang.n.${lang}`) })}</span>
            </div>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 14px' }}>
              {[[t('ob.company'), name], [t('li.state'), state], [t('ob2.works'), [res ? t('ob2.res') : '', com ? t('ob2.com') : ''].filter(Boolean).join(' + ')]].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i ? '1px solid #EEF2F1' : 0 }}><span style={{ fontSize: 12.5, color: C.muted, width: 110, flex: 'none' }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 700 }}>{v}</span></div>
              ))}
            </div>
          </div>
        )}

        {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
        <button className="k-btn k-btn-fill k-btn-big" disabled={!canNext || busy} style={{ opacity: canNext ? 1 : 0.45 }} onClick={() => (step < 3 ? setStep(step + 1) : finish())}>{step < 3 ? t('ob2.next') : t('ob.start')}</button>
        <span style={{ fontSize: 12.5, color: C.muted, textAlign: 'center' }}>{step < 3 ? t('ob2.later') : t('ob.noCard')}</span>
      </div>
    </div>
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
    <AuthShell title={t('inv2.title')} sub={t('inv2.text')}>
      {error && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B8400C' }}>{error}</span>}
      <button className="k-btn k-btn-fill k-btn-big" onClick={accept} disabled={busy}>{t('inv2.accept')}</button>
    </AuthShell>
  );
}
