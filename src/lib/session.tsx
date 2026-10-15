import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { detectLang, translate, type Lang } from './i18n';
import { errorKey } from './errors';

export type Membership = { id: string; company_id: string; role: 'owner' | 'manager' | 'helper'; status: string; display_name: string; language: Lang };
export type Company = { id: string; name: string; mode: 'residential' | 'commercial' | 'both'; solo: boolean; allow_push_team: boolean; allow_push_clients: boolean; default_language: Lang };
export type Subscription = { plan: string; status: string; trial_ends_at: string; has_commercial: boolean; commercial_tier: number | null };
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
  portal: PortalClient | null;
  lang: Lang;
  isStaff: boolean;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tErr: (message?: string | null) => string;
  refresh: () => Promise<void>;
  toast: (text: string, action?: { label: string; run: () => void }) => void;
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
  const [portal, setPortal] = useState<PortalClient | null>(null);
  const [lang, setLangState] = useState<Lang>(detectLang());
  const [toastState, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) { setProfile(null); setMembership(null); setCompany(null); setSub(null); setPortal(null); setReady(true); return; }
    const [{ data: p }, { data: ms }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, language').eq('id', s.user.id).maybeSingle(),
      supabase.from('memberships').select('id, company_id, role, status, display_name, language').eq('user_id', s.user.id).eq('status', 'active'),
    ]);
    setProfile(p as Profile | null);
    if (p?.language) { setLangState(p.language as Lang); try { localStorage.setItem('tidyo.lang', p.language); } catch { /* ignore */ } }
    const list = (ms || []) as Membership[];
    const m = list.find((x) => x.role !== 'helper') || list[0] || null;
    setMembership(m);
    if (m) {
      const [{ data: c }, { data: sb }] = await Promise.all([
        supabase.from('companies').select('id, name, mode, solo, allow_push_team, allow_push_clients, default_language').eq('id', m.company_id).maybeSingle(),
        supabase.from('subscriptions').select('plan, status, trial_ends_at, has_commercial, commercial_tier').eq('company_id', m.company_id).maybeSingle(),
      ]);
      setCompany(c as Company | null);
      setSub(sb as Subscription | null);
      setPortal(null);
    } else {
      setCompany(null); setSub(null);
      const { data: pc } = await supabase.rpc('portal_me');
      setPortal(((pc || []) as PortalClient[])[0] || null);
    }
    setReady(true);
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

  const toast = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ text, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 5000 : 2600);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, session, profile, membership, company, sub, portal, lang,
    isStaff: membership?.role === 'owner' || membership?.role === 'manager',
    setLang, t, tErr, refresh: async () => { const { data } = await supabase.auth.getSession(); await load(data.session); }, toast,
  }), [ready, session, profile, membership, company, sub, portal, lang, setLang, t, tErr, load, toast]);

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
