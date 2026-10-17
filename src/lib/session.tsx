import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { detectLang, translate, type Lang } from './i18n';
import { errorKey } from './errors';
import { gKey, guessGender, type Gender } from './gender';

export type Membership = { id: string; company_id: string; role: 'owner' | 'manager' | 'helper'; status: string; display_name: string; language: Lang; gender?: 'f' | 'm' | null };
export type Company = { id: string; name: string; mode: 'residential' | 'commercial' | 'both'; solo: boolean; allow_push_team: boolean; allow_push_clients: boolean; default_language: Lang;
  timezone?: string; created_at?: string; address?: string | null; state?: string | null; logo_path?: string | null; is_demo_data?: boolean; pricing?: Record<string, number>; auto_messages?: Record<string, boolean>;
  cancellation_fee_cents?: number; cancellation_window_hours?: number; payment_info?: Record<string, string>; lat?: number | null; lng?: number | null; google_review_url?: string | null };
export type Subscription = { plan: string; status: string; trial_ends_at: string; has_commercial: boolean; commercial_tier: number | null; interval?: 'month' | 'year'; cancel_at_period_end?: boolean; current_period_end?: string | null };
export type PortalClient = { client_id: string; company_id: string; name: string; language: Lang; company_name: string };
export type Profile = { id: string; full_name: string; language: Lang };

type Toast = { text: string; action?: { label: string; run: () => void } } | null;

type Ctx = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  membership: Membership | null;
  company: Company | null;
  sub: Subscription | null;
  access: 'ok' | 'trial_over' | 'paused' | 'canceled';
  portal: PortalClient | null;
  /** asked to join a team through a link and waiting for the owner */
  pendingJoin: { company_name: string; role: string } | null;
  isAdmin: boolean;
  needsMfa: boolean;
  lang: Lang;
  isStaff: boolean;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tErr: (message?: string | null) => string;
  refresh: () => Promise<void>;
  toast: (text: string, action?: { label: string; run: () => void }) => void;
  /** how the business owner is addressed (Dono/Dona); 'u' when unknown */
  ownerG: Gender;
  /** translate a gendered key: base = feminine, `.m` masculine, `.u` neutral */
  tg: (key: string, g?: Gender, params?: Record<string, string | number>) => string;
};

const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [access, setAccess] = useState<'ok' | 'trial_over' | 'paused' | 'canceled'>('ok');
  const [portal, setPortal] = useState<PortalClient | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<Ctx['pendingJoin']>(null);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [ownerG, setOwnerG] = useState<Gender>('u');
  const [lang, setLangState] = useState<Lang>(detectLang());
  const [toastState, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setPendingJoin(null); setProfile(null); setMembership(null); setCompany(null); setSub(null); setAccess('ok'); setPortal(null); setIsAdmin(false); setReady(true); return; }
    const [{ data: p }, { data: ms }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, language').eq('id', s.user.id).maybeSingle(),
      supabase.from('memberships').select('id, company_id, role, status, display_name, language, gender').eq('user_id', s.user.id).eq('status', 'active'),
    ]);
    setProfile(p as Profile | null);
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setNeedsMfa(aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2');
    supabase.rpc('is_platform_admin').then(({ data }) => setIsAdmin(!!data));
    if (p?.language) { setLangState(p.language as Lang); try { localStorage.setItem('tidyo.lang', p.language); } catch { /* ignore */ } }
    const list = (ms || []) as Membership[];
    const m = list.find((x) => x.role !== 'helper') || list[0] || null;
    setMembership(m);
    if (m) {
      const [{ data: c }, { data: sb }, { data: acc }] = await Promise.all([
        supabase.from('companies').select('id, name, mode, solo, allow_push_team, allow_push_clients, default_language, timezone, address, state, logo_path, is_demo_data, pricing, auto_messages, cancellation_fee_cents, cancellation_window_hours, payment_info, lat, lng, created_at, google_review_url').eq('id', m.company_id).maybeSingle(),
        supabase.from('subscriptions').select('plan, status, trial_ends_at, has_commercial, commercial_tier, interval, cancel_at_period_end, current_period_end').eq('company_id', m.company_id).maybeSingle(),
        supabase.rpc('company_access_state', { p_company: m.company_id }),
      ]);
      setAccess((['trial_over', 'paused', 'canceled'].includes(acc as string) ? acc : 'ok') as 'ok' | 'trial_over' | 'paused' | 'canceled');
      setCompany(c as Company | null);
      setSub(sb as Subscription | null);
      setPortal(null); setPendingJoin(null);
    } else {
      setCompany(null); setSub(null);
      const [{ data: pc }, { data: jr }] = await Promise.all([supabase.rpc('portal_me'), supabase.rpc('my_join_requests')]);
      setPendingJoin(((jr || []) as { company_name: string; role: string }[])[0] || null);
      const pcl = ((pc || []) as PortalClient[])[0] || null;
      setPortal(pcl);
      if (pcl) supabase.rpc('owner_info', { cid: pcl.company_id }).then(({ data }) => {
        const o = ((data || []) as { display_name: string; gender: 'f' | 'm' | null }[])[0];
        if (o) setOwnerG((o.gender as Gender) || guessGender(o.display_name));
      });
    }
    const cid = m?.company_id;
    if (m?.role === 'owner') setOwnerG(m.gender || guessGender(m.display_name || p?.full_name));
    else setOwnerG('u');
    setReady(true);
    if (cid && m?.role !== 'owner') {
      supabase.rpc('owner_info', { cid }).then(({ data }) => {
        const o = ((data || []) as { display_name: string; gender: 'f' | 'm' | null }[])[0];
        if (o) setOwnerG((o.gender as Gender) || guessGender(o.display_name));
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') load(s);
      else setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('tidyo.lang', l); } catch { /* ignore */ }
    document.documentElement.lang = l;
    if (session) supabase.from('profiles').update({ language: l }).eq('id', session.user.id).then(() => undefined);
  }, [session]);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => translate(lang, key, params), [lang]);
  const tErr = useCallback((message?: string | null) => { const e = errorKey(message); return translate(lang, e.key, e.params); }, [lang]);

  const tg = useCallback((key: string, g?: Gender, params?: Record<string, string | number>) => translate(lang, gKey(key, g ?? ownerG), params), [lang, ownerG]);

  const toast = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2600);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, session, profile, membership, company, sub, access, portal, pendingJoin, isAdmin, needsMfa, lang,
    isStaff: membership?.role === 'owner' || membership?.role === 'manager',
    setLang, t, tg, ownerG, tErr, refresh: async () => { const { data } = await supabase.auth.getSession(); await load(data.session); }, toast,
  }), [ready, session, profile, membership, company, sub, access, portal, pendingJoin, isAdmin, needsMfa, lang, setLang, t, tErr, load, toast, tg, ownerG]);

  return (
    <SessionCtx.Provider value={value}>
      {children}
      {toastState && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toastState.text}</span>
          {toastState.action && (
            <button className="link-btn" style={{ color: '#5FD4C1' }} onClick={() => { toastState.action!.run(); setToast(null); }}>
              {toastState.action.label}
            </button>
          )}
        </div>
      )}
    </SessionCtx.Provider>
  );
}
