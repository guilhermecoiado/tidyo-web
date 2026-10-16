// Superadmin (canvas "SuperAssinantes", "SuperComunicacao", "SuporteAdmin"): desktop layout with a dark sidebar
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { Select, DateField } from '../components/pickers';
import { C, initials } from '../components/kit';
import { mediaUrl } from '../components/Ad';
import { SecuritySection } from './Security';
import type { Lang } from '../lib/i18n';
import { COMBO, perMonth } from '../lib/pricing';

// ── data ──
type Sub = { id: string; name: string; mode: string; created_at: string; state: string | null; language: Lang; plan: 'essencial' | 'pro' | 'comercial' | null; has_commercial: boolean | null; commercial_tier: number | null;
  billing: 'month' | 'year' | null; status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | null; trial_ends_at: string | null; cancel_at_period_end: boolean | null; discount_pct: number | null; updated_at: string | null;
  owner_name: string | null; owner_email: string | null; users: number; houses: number; contracts: number; utm: Record<string, string> };
type Ticket = { id: string; number: number | null; subject: string; topic: string | null; status: 'open' | 'waiting_customer' | 'resolved'; language: Lang; created_at: string; updated_at: string; last_from_staff: boolean; staff_replied: boolean;
  company_id: string | null; company_name: string | null; company_state: string | null; company_mode: string | null; company_since: string | null; plan: string | null; has_commercial: boolean | null; opener_name: string | null; opener_email: string };
type Ad = { id: string; name: string; format: 'top_banner' | 'cta_card' | 'popup' | 'fullscreen'; status: 'draft' | 'scheduled' | 'running' | 'paused' | 'ended'; media_type: string; media_path: string | null;
  content: Record<string, { title?: string; cta?: string }>; cta_url: string | null; utm: Record<string, string>; targeting: { plans?: string[]; languages?: string[]; frequency?: string }; starts_at: string | null; ends_at: string | null; created_at: string };

const TIER_PRICE: Record<number, number> = { 1: 49, 2: 99, 3: 179 };
/** Monthly revenue of one subscriber (combo Pro + Comercial has 20% off; yearly = whole-dollar price; admin discount on top) */
export function mrrOf(s: Sub) {
  if (s.status !== 'active' || !s.plan) return 0;
  const com = s.plan === 'comercial' || s.has_commercial ? TIER_PRICE[s.commercial_tier || 1] || 0 : 0;
  let v = s.plan === 'comercial' ? com : (s.plan === 'essencial' ? 29 : 69) + com;
  if (s.plan === 'pro' && s.has_commercial) v = (s.commercial_tier || 1) === 1 ? COMBO : Math.floor(v * 0.8);
  if (s.billing === 'year') v = perMonth(v, true);
  return v * (1 - (s.discount_pct || 0) / 100);
}
const money = (v: number, d = 2) => `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const STC: Record<string, [string, string]> = { active: ['#E3F1EE', '#0B6B5F'], trialing: ['#E3EAFB', '#1C3D8F'], past_due: ['#FDE8E6', '#9F1F14'], paused: ['#FDF0DC', '#8A4B05'], canceled: ['#EEF1F0', '#3E4F4C'] };
const chip = (on: boolean, dark = C.ink): CSSProperties => ({ minHeight: 36, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? dark : C.line}`, background: on ? dark : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' });
const card: CSSProperties = { background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18 };
const kpiLabel: CSSProperties = { fontSize: 11.5, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' };
const field: CSSProperties = { minHeight: 42, borderRadius: 11, border: `1px solid ${C.line}`, padding: '0 10px', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', color: C.ink, width: '100%', boxSizing: 'border-box', background: '#FFFFFF' };

function Kpi({ label, value, note, color = C.ink }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div style={{ ...card, borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={kpiLabel}>{label}</span>
      <span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 800, color }}>{value}</span>
      {note && <span style={{ fontSize: 12, color: C.muted }}>{note}</span>}
    </div>
  );
}

// ── shell ──
const SECTIONS = ['visao', 'assinantes', 'planos', 'comunicacao', 'suporte', 'config'] as const;
type Section = typeof SECTIONS[number];

export default function Admin() {
  const { t } = useApp();
  const { section = 'assinantes' } = useParams();
  const s = (SECTIONS as readonly string[]).includes(section) ? (section as Section) : 'assinantes';
  const [openTickets, setOpenTickets] = useState(0);
  useEffect(() => { supabase.rpc('admin_support').then(({ data }) => setOpenTickets(((data || []) as Ticket[]).filter((x) => x.status === 'open').length)); }, [s]);
  const label: Record<Section, string> = { visao: t('sa.nav.overview'), assinantes: t('sa.nav.subs'), planos: t('sa.nav.plans'), comunicacao: t('sa.nav.comms'), suporte: t('sa.nav.support'), config: t('sa.nav.settings') };
  return (
    <div style={{ minHeight: '100dvh', background: '#F4F7F6', color: C.ink, fontFamily: "Manrope, 'Segoe UI', sans-serif", fontSize: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
      <nav aria-label="Superadmin" className="sa-nav"><div className="sa-nav-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 18px' }}>
          <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none' }}><rect width="64" height="64" rx="17" fill="#D4F1E9" /><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" /></g></svg>
          <span style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 15 }}>Tidyo</span><span style={{ fontSize: 11.5 }}>Superadmin</span></span>
        </div>
        <div className="sa-links">
          {SECTIONS.map((k) => (
            <Link key={k} to={`/admin/${k}`} aria-current={k === s ? 'page' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 42, padding: '0 10px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13.5, background: k === s ? '#1E3A36' : 'transparent', color: k === s ? '#FFFFFF' : '#C7D8D4', whiteSpace: 'nowrap' }}>
              {label[k]}{k === 'suporte' && openTickets > 0 && <span className="num" style={{ fontSize: 11, fontWeight: 800, background: '#D9480F', color: '#FFFFFF', borderRadius: 999, padding: '1px 7px' }}>{openTickets}</span>}
            </Link>
          ))}
        </div>
        <Link to="/" style={{ marginTop: 'auto', color: '#9DB5B0', fontSize: 12.5, fontWeight: 700, padding: '12px 10px 0', textDecoration: 'none' }} className="sa-exit">{t('sa.exit')}</Link>
      </div></nav>
      <main className="sa-main" style={{ flex: '999 1 300px', minWidth: 0, boxSizing: 'border-box', padding: '22px 24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {s === 'assinantes' && <Subscribers />}
        {s === 'visao' && <Overview />}
        {s === 'planos' && <Plans />}
        {s === 'comunicacao' && <Comms />}
        {s === 'suporte' && <Support onChanged={(n) => setOpenTickets(n)} />}
        {s === 'config' && <Config />}
      </main>
    </div>
  );
}

function useSubs() {
  const [list, setList] = useState<Sub[] | null>(null);
  const load = useCallback(() => { supabase.rpc('admin_subscribers').then(({ data }) => setList((data || []) as Sub[])); }, []);
  useEffect(() => { load(); }, [load]);
  return { list, load };
}

function subStats(l: Sub[]) {
  const now = Date.now(), day = 864e5;
  const active = l.filter((s) => s.status === 'active');
  const trial = l.filter((s) => s.status === 'trialing');
  const cohort = l.filter((s) => now - +new Date(s.created_at) > 14 * day && now - +new Date(s.created_at) < 90 * day);
  const canceled30 = l.filter((s) => s.status === 'canceled' && s.updated_at && now - +new Date(s.updated_at) < 30 * day).length;
  const newPaid30 = active.filter((s) => now - +new Date(s.created_at) < 45 * day).length;
  return {
    mrr: active.reduce((a, s) => a + mrrOf(s), 0), paying: active.length, newPaid30,
    trial: trial.length, endingWeek: trial.filter((s) => s.trial_ends_at && +new Date(s.trial_ends_at) - now < 7 * day).length,
    conv: cohort.length ? cohort.filter((s) => s.status === 'active').length / cohort.length : null,
    churn: active.length + canceled30 ? canceled30 / (active.length + canceled30) : 0,
  };
}

function Head({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h1 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 800 }}>{title}</h1>
        {sub && <span style={{ fontSize: 13, color: C.muted }}>{sub}</span>}
      </div>
      {right}
    </div>
  );
}

// ── Assinantes ──
function Subscribers() {
  const { t, lang } = useApp();
  const { list, load } = useSubs();
  const [f, setF] = useState<'all' | 'active' | 'trialing' | 'past_due' | 'canceled'>('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [act, setAct] = useState<'extend_trial' | 'discount' | 'suspend' | 'reactivate' | null>(null);
  const [at] = useState(new Date());
  const st = useMemo(() => subStats(list || []), [list]);
  const rows = (list || []).filter((s) => (f === 'all' || s.status === f || (f === 'canceled' && s.status === 'paused')) && (!q.trim() || `${s.name} ${s.owner_email || ''} ${s.state || ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  const cur = (list || []).find((s) => s.id === sel) || rows[0] || null;
  const planText = (s: Sub) => !s.plan ? '—' : s.plan === 'comercial' ? `${t('sa.plan.comercial')} ${tierText(s.commercial_tier)}` : `${t(`sa.plan.${s.plan}`)}${s.has_commercial ? ` + ${t('sa.plan.comercial')}` : ''}`;
  const tierText = (n: number | null) => ({ 1: t('sa.tier1'), 2: '6–15', 3: '16–40', 4: '40+' } as Record<number, string>)[n || 1];
  const since = (d: string) => new Date(d).toLocaleDateString(lang, { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', ' ');
  const statusText = (s: Sub) => t(`sa.st.${s.status || 'trialing'}`);
  const sources = useMemo(() => {
    const m: Record<string, { signups: number; paid: number }> = {};
    for (const s of list || []) {
      if (Date.now() - +new Date(s.created_at) > 30 * 864e5) continue;
      const k = s.utm?.utm_source ? `${s.utm.utm_source}${s.utm.utm_campaign ? `_${s.utm.utm_campaign}` : ''}`.slice(0, 24) : t('sa.direct');
      m[k] = m[k] || { signups: 0, paid: 0 }; m[k].signups++; if (s.status === 'active') m[k].paid++;
    }
    const arr = Object.entries(m).sort((a, b) => b[1].signups - a[1].signups).slice(0, 6);
    const max = Math.max(1, ...arr.map(([, v]) => v.signups));
    return arr.map(([name, v]) => ({ name, ...v, w1: (v.signups / max) * 100, w2: (v.paid / max) * 100 }));
  }, [list, t]);

  return (
    <>
      <Head title={t('sa.nav.subs')} sub={t('sa.updated', { t: at.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) })}
        right={<label style={{ display: 'block', flex: '0 1 300px' }}><span className="sr-only">{t('sa.search')}</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sa.search')} style={{ ...field, minHeight: 44, borderRadius: 12, padding: '0 14px' }} /></label>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Kpi label="MRR" value={money(st.mrr, 0)} note={t('sa.mrrNote')} />
        <Kpi label={t('sa.paying')} value={String(st.paying)} note={t('sa.newMonth', { n: st.newPaid30 })} color="#0B6B5F" />
        <Kpi label={t('sa.trialing')} value={String(st.trial)} note={t('sa.endWeek', { n: st.endingWeek })} />
        <Kpi label={t('sa.conv')} value={st.conv == null ? '—' : `${Math.round(st.conv * 100)}%`} note={t('sa.last90')} />
        <Kpi label={t('sa.churn')} value={`${(st.churn * 100).toLocaleString(lang, { maximumFractionDigits: 1 })}%`} note={t('sa.perMonth')} color="#8A4B05" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '3 1 520px', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 14px', borderBottom: '1px solid #EEF2F1' }}>
            {([['all', t('inv.all')], ['active', t('sa.f.active')], ['trialing', t('sa.trialing')], ['past_due', t('sa.st.past_due')], ['canceled', t('sa.f.canceled')]] as const).map(([id, l]) => <button key={id} aria-pressed={f === id} onClick={() => setF(id)} style={chip(f === id)}>{l}</button>)}
          </div>
          <div style={{ overflowX: 'auto' }}>
            {list === null ? <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 200, borderRadius: 12 }} /></div> : rows.length === 0 ? <div style={{ padding: 24, color: C.muted, fontSize: 13.5 }}>{t('sa.none')}</div> : (
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', ...kpiLabel }}>
                  {[t('sa.th.company'), t('sa.th.plan'), t('sa.th.state'), t('sa.th.lang'), t('sa.th.source'), t('sa.th.status')].map((h, i) => <th key={h} style={{ padding: i ? '10px 8px' : '10px 14px', fontWeight: 800 }}>{h}</th>)}
                  <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>MRR</th>
                </tr></thead>
                <tbody>
                  {rows.map((s) => {
                    const on = cur?.id === s.id;
                    const sc = STC[s.status || 'trialing'];
                    const m = mrrOf(s);
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid #EEF2F1', background: on ? '#F0F9F7' : '#FFFFFF' }}>
                        <td style={{ padding: '6px 8px' }}><button onClick={() => setSel(s.id)} style={{ minHeight: 44, width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '0 6px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: C.ink, fontFamily: 'inherit' }}><span style={{ fontWeight: 800, fontSize: 13 }}>{s.name}</span><span style={{ fontSize: 11.5, color: C.muted }}>{s.owner_name}</span></button></td>
                        <td style={{ padding: '11px 8px', fontWeight: 700 }}>{planText(s)}</td>
                        <td style={{ padding: '11px 8px' }}>{s.state || '—'}</td>
                        <td style={{ padding: '11px 8px' }}>{s.language === 'pt-BR' ? 'PT' : s.language.toUpperCase()}</td>
                        <td style={{ padding: '11px 8px', color: C.muted }}>{s.utm?.utm_source || t('sa.direct')}</td>
                        <td style={{ padding: '11px 8px' }}><span className="nw" style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 8px', background: sc[0], color: sc[1] }}>{statusText(s)}</span></td>
                        <td className="num" style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 800 }}>{m ? money(m) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cur && (
            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{cur.name}</span>
              <span style={{ fontSize: 12.5, color: C.muted, overflowWrap: 'anywhere' }}>{cur.owner_name} · {cur.owner_email}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                {[[t('sa.th.plan'), `${planText(cur)}${cur.billing === 'year' ? ` · ${t('sa.yearly')}` : ''}${cur.discount_pct ? ` · −${cur.discount_pct}%` : ''}`], [t('sa.mode'), t(`sa.m.${cur.mode}`)],
                  [t('sa.usage'), [t('sa.users', { n: cur.users }), cur.mode !== 'commercial' ? t('sa.houses', { n: cur.houses }) : '', cur.mode !== 'residential' ? t('sa.contracts', { n: cur.contracts }) : ''].filter(Boolean).join(' · ')],
                  [t('sa.since'), since(cur.created_at)], ...(cur.status === 'trialing' && cur.trial_ends_at ? [[t('sa.trialUntil'), new Date(cur.trial_ends_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })]] : []), [t('sa.th.source'), cur.utm?.utm_source || t('sa.direct')]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: C.muted }}>{k}</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span></div>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
                <button onClick={() => setAct('extend_trial')} style={{ ...chip(false), borderRadius: 11, minHeight: 38 }}>{t('sa.extend')}</button>
                <button onClick={() => setAct('discount')} style={{ ...chip(false), borderRadius: 11, minHeight: 38 }}>{t('sa.discount')}</button>
                {cur.status === 'paused'
                  ? <button onClick={() => setAct('reactivate')} style={{ ...chip(false), borderRadius: 11, minHeight: 38 }}>{t('sa.reactivate')}</button>
                  : <button onClick={() => setAct('suspend')} style={{ ...chip(false), borderRadius: 11, minHeight: 38, borderColor: '#F5D3C2', color: '#8F2F08' }}>{t('sa.suspend')}</button>}
              </div>
              <span style={{ fontSize: 11.5, color: C.muted }}>{t('sa.auditNote')}</span>
            </div>
          )}
          <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>{t('sa.sources')}</span>
            {sources.length === 0 ? <span style={{ fontSize: 13, color: C.muted }}>{t('sa.noSignups')}</span> : sources.map((s) => (
              <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}><span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span><span className="num nw" style={{ color: C.muted }}>{t('sa.signupsPaid', { s: s.signups, p: s.paid })}</span></div>
                <div style={{ height: 7, borderRadius: 7, background: '#E4ECEA', overflow: 'hidden', position: 'relative' }}><div style={{ position: 'absolute', left: 0, top: 0, height: 7, width: `${s.w1}%`, background: '#B9DCD4' }} /><div style={{ position: 'absolute', left: 0, top: 0, height: 7, width: `${s.w2}%`, background: C.accent }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {act && cur && <ActionDialog sub={cur} action={act} onClose={() => setAct(null)} onDone={() => { setAct(null); load(); }} />}
    </>
  );
}

function ActionDialog({ sub, action, onClose, onDone }: { sub: Sub; action: 'extend_trial' | 'discount' | 'suspend' | 'reactivate'; onClose: () => void; onDone: () => void }) {
  const { t, tErr, toast } = useApp();
  const [reason, setReason] = useState('');
  const [value, setValue] = useState(action === 'extend_trial' ? '7' : action === 'discount' ? String(sub.discount_pct || 20) : '0');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('admin_action', { p_company: sub.id, p_action: action, p_value: Number(value) || 0, p_reason: reason.trim() });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onDone(); }
  };
  return (
    <Sheet title={`${t(`sa.a.${action}`)} · ${sub.name}`} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('sa.auditText')}</span>
      {(action === 'extend_trial' || action === 'discount') && (
        <label className="k-field"><span>{action === 'extend_trial' ? t('sa.days') : t('sa.pct')}</span><input className="k-input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 3))} /></label>
      )}
      <label className="k-field"><span>{t('sa.reason')}</span><input className="k-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('sa.reasonPh')} /></label>
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={onClose}>{t('c.cancel')}</button>
        <button className="k-btn" style={{ background: C.ink, color: '#FFFFFF', border: 0 }} disabled={busy || !reason.trim()} onClick={run}>{t('c.confirm')}</button>
      </div>
    </Sheet>
  );
}

// ── Visão geral ──
function Overview() {
  const { t } = useApp();
  const { list } = useSubs();
  const [tk, setTk] = useState<Ticket[]>([]);
  useEffect(() => { supabase.rpc('admin_support').then(({ data }) => setTk((data || []) as Ticket[])); }, []);
  const st = subStats(list || []);
  const waiting = tk.filter((x) => x.status === 'open').length;
  return (
    <>
      <Head title={t('sa.nav.overview')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Kpi label="MRR" value={money(st.mrr, 0)} note={t('sa.mrrNote')} />
        <Kpi label={t('sa.paying')} value={String(st.paying)} color="#0B6B5F" />
        <Kpi label={t('sa.trialing')} value={String(st.trial)} note={t('sa.endWeek', { n: st.endingWeek })} />
        <Kpi label={t('sa.companies')} value={String((list || []).length)} />
        <Kpi label={t('sa.waitingYou')} value={String(waiting)} color={waiting ? '#8A4B05' : C.ink} />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="k-btn k-btn-line" to="/admin/assinantes">{t('sa.nav.subs')}</Link>
        <Link className="k-btn k-btn-line" to="/admin/suporte">{t('sa.nav.support')}</Link>
        <Link className="k-btn k-btn-line" to="/admin/comunicacao">{t('sa.nav.comms')}</Link>
      </div>
    </>
  );
}

// ── Planos e limites ──
function Plans() {
  const { t } = useApp();
  const rows: [string, string, string, string, string][] = [
    [t('sa.plan.essencial'), '$29', t('sa.lim.users', { n: 3 }), t('sa.lim.houses', { n: 30 }), '—'],
    [t('sa.plan.pro'), '$69', t('sa.lim.users', { n: 15 }), t('sa.lim.unlimited'), '—'],
    [`${t('sa.plan.comercial')} ${t('sa.tier1')}`, '$49', t('sa.lim.users', { n: 15 }), '—', t('sa.lim.contracts', { n: 5 })],
    [`${t('sa.plan.comercial')} 6–15`, '$99', t('sa.lim.users', { n: 15 }), '—', t('sa.lim.contracts', { n: 15 })],
    [`${t('sa.plan.comercial')} 16–40`, '$179', t('sa.lim.users', { n: 15 }), '—', t('sa.lim.contracts', { n: 40 })],
    [`${t('sa.plan.comercial')} 40+`, t('sa.custom'), t('sa.lim.users', { n: 15 }), '—', t('sa.lim.unlimited')],
  ];
  return (
    <>
      <Head title={t('sa.nav.plans')} sub={t('sa.plansSub')} />
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead><tr style={{ textAlign: 'left', ...kpiLabel }}>{[t('sa.th.plan'), t('sa.price'), t('sa.lim.usersH'), t('sa.lim.housesH'), t('sa.lim.contractsH')].map((h, i) => <th key={h} style={{ padding: i ? '10px 8px' : '10px 14px' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]} style={{ borderTop: '1px solid #EEF2F1' }}>{r.map((c, i) => <td key={i} className={i === 1 ? 'num' : undefined} style={{ padding: i ? '12px 8px' : '12px 14px', fontWeight: i < 2 ? 800 : 500 }}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{t('sa.plansNote')}</span>
    </>
  );
}

// ── Configurações ──
function Config() {
  const { t, session } = useApp();
  return (
    <>
      <Head title={t('sa.nav.settings')} sub={session?.user.email || ''} />
      <div style={{ maxWidth: 560 }}><SecuritySection /></div>
      <button className="k-btn k-btn-line" style={{ alignSelf: 'flex-start', color: '#9F1F14' }} onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
    </>
  );
}

// ── Suporte ──
type Msg = { id: string; body: string; from_staff: boolean; attachment_path: string | null; created_at: string; internal?: boolean };
function Support({ onChanged }: { onChanged: (open: number) => void }) {
  const { t, lang, session, toast, tErr } = useApp();
  const [list, setList] = useState<Ticket[] | null>(null);
  const [stats, setStats] = useState<{ first_reply_minutes: number | null; resolved_7d: number; new_today: number } | null>(null);
  const [f, setF] = useState<'open' | 'waiting' | 'closed' | 'all'>('open');
  const [sel, setSel] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const load = useCallback(async () => {
    const [{ data }, { data: s }] = await Promise.all([supabase.rpc('admin_support'), supabase.rpc('admin_support_stats')]);
    const l = (data || []) as Ticket[];
    setList(l); onChanged(l.filter((x) => x.status === 'open').length);
    setStats(((s || []) as typeof stats[])[0] || null);
  }, [onChanged]);
  useEffect(() => { load(); }, [load]);
  const view = (x: Ticket): 'new' | 'waiting' | 'answered' | 'resolved' => (x.status === 'resolved' ? 'resolved' : x.status === 'waiting_customer' ? 'answered' : x.staff_replied ? 'waiting' : 'new');
  const VS: Record<string, [string, string]> = { new: ['#FDE8E6', '#9F1F14'], waiting: ['#FDF0DC', '#8A4B05'], answered: ['#DDF1EC', '#0B6B5F'], resolved: ['#EEF1F0', '#3E4F4C'] };
  const shown = (list || []).filter((x) => f === 'all' || (f === 'open' ? x.status === 'open' : f === 'waiting' ? x.status === 'open' : x.status !== 'open'));
  const cur = (list || []).find((x) => x.id === sel) || shown[0] || null;

  const loadThread = useCallback(async (id: string) => {
    setMsgs(null);
    const [{ data: m }, { data: n }] = await Promise.all([
      supabase.from('support_messages').select('id, body, from_staff, attachment_path, created_at').eq('ticket_id', id).order('created_at'),
      supabase.from('support_notes').select('id, body, created_at').eq('ticket_id', id).order('created_at'),
    ]);
    const all = [...((m || []) as Msg[]), ...((n || []) as { id: string; body: string; created_at: string }[]).map((x) => ({ ...x, from_staff: true, attachment_path: null, internal: true }))].sort((a, b) => a.created_at.localeCompare(b.created_at));
    setMsgs(all);
    const paths = all.map((x) => x.attachment_path).filter((p): p is string => !!p);
    if (paths.length) supabase.storage.from('support-files').createSignedUrls(paths, 3600).then(({ data }) => data && setUrls(Object.fromEntries(data.filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl]))));
  }, []);
  useEffect(() => { if (cur) loadThread(cur.id); }, [cur?.id, loadThread]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!cur || !session || !reply.trim()) return;
    const { error } = internal
      ? await supabase.from('support_notes').insert({ ticket_id: cur.id, author_id: session.user.id, body: reply.trim() })
      : await supabase.from('support_messages').insert({ ticket_id: cur.id, sender_id: session.user.id, body: reply.trim(), from_staff: true });
    if (error) { toast(tErr(error.message)); return; }
    setReply(''); loadThread(cur.id); if (!internal) load();
  };
  const setStatus = async (v: string) => {
    if (!cur) return;
    const { error } = await supabase.from('support_tickets').update({ status: v }).eq('id', cur.id);
    if (error) toast(tErr(error.message)); else load();
  };
  const canned: [string, string][] = [[t('sa.c1'), t('sa.c1t')], [t('sa.c2'), t('sa.c2t')], [t('sa.c3'), t('sa.c3t')]];
  const ago = (iso: string) => { const m = Math.round((Date.now() - +new Date(iso)) / 60000); return m < 60 ? `${Math.max(1, m)} min` : m < 1440 ? `${Math.round(m / 60)} h` : m < 2880 ? t('ce.yesterday').toLowerCase() : t('sa.days_n', { n: Math.round(m / 1440) }); };
  const openN = (list || []).filter((x) => x.status === 'open');
  const waitingN = openN.filter((x) => x.staff_replied || !x.last_from_staff);
  const oldest = waitingN.reduce<string | null>((o, x) => (!o || x.updated_at < o ? x.updated_at : o), null);
  const fr = stats?.first_reply_minutes;

  return (
    <>
      <Head title={t('sa.supportT')} sub={t('sa.supportSub')}
        right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{([['open', t('sa.f.open')], ['waiting', t('sa.waitingYou')], ['closed', t('sa.f.closed')], ['all', t('inv.all')]] as const).map(([id, l]) => <button key={id} aria-pressed={f === id} onClick={() => setF(id)} style={{ ...chip(f === id), minHeight: 38, padding: '0 14px' }}>{l}</button>)}</div>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Kpi label={t('sa.f.open')} value={String(openN.length)} note={t('sa.newToday', { n: stats?.new_today || 0 })} />
        <Kpi label={t('sa.waitingYou')} value={String(waitingN.length)} note={oldest ? t('sa.oldest', { d: ago(oldest) }) : '—'} color="#8A4B05" />
        <Kpi label={t('sa.firstReply')} value={fr == null ? '—' : fr < 60 ? `${fr} min` : `${Math.floor(fr / 60)}h${String(fr % 60).padStart(2, '0')}`} note={t('sa.avg7')} />
        <Kpi label={t('sa.resolved')} value={String(stats?.resolved_7d || 0)} note={t('sa.last7')} color="#0B6B5F" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '1 1 300px', minWidth: 0, overflow: 'hidden' }}>
          {list === null ? <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 160, borderRadius: 12 }} /></div> : shown.length === 0 ? <div style={{ padding: 20, color: C.muted, fontSize: 13.5 }}>{t('sa.noTickets')}</div> : shown.map((x, i) => {
            const on = cur?.id === x.id, v = view(x);
            return (
              <button key={x.id} aria-pressed={on} onClick={() => { setSel(x.id); setReply(''); }} style={{ width: '100%', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 5, padding: '14px 16px', border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, borderLeft: `3px solid ${on ? C.accent : 'transparent'}`, background: on ? '#F0F9F7' : '#FFFFFF', cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.subject}</span>
                  <span className="nw" style={{ fontSize: 11.5, color: C.muted, flex: 'none' }}>{ago(x.updated_at)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{x.company_name || x.opener_email}{x.number ? ` · TDY-${x.number}` : ''}</span>
                  <span className="nw" style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: VS[v][0], color: VS[v][1] }}>{t(`sa.v.${v}`)}</span>
                  {x.topic && <span className="nw" style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, border: `1px solid ${C.line}`, color: '#3E4F4C' }}>{t(`hl.${x.topic}`)}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {cur && (
          <div style={{ flex: '2 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...card, padding: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              <span style={{ width: 44, height: 44, borderRadius: 12, background: '#DDF1EC', color: '#0B6B5F', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(cur.company_name || cur.opener_email)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 200px', minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{cur.company_name || '—'}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>{[cur.opener_name || cur.opener_email, cur.company_state, cur.company_since ? t('sa.clientSince', { d: new Date(cur.company_since).toLocaleDateString(lang, { month: 'short', year: 'numeric' }).replace('.', '').replace(' de ', ' ') }) : ''].filter(Boolean).join(' · ')}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {cur.plan && <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: C.ink, color: '#FFFFFF' }}>{t(`sa.plan.${cur.plan}`)}{cur.has_commercial && cur.plan !== 'comercial' ? ` + ${t('sa.plan.comercial')}` : ''}</span>}
                {cur.company_mode && <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.line}` }}>{t(`sa.m.${cur.company_mode}`)}</span>}
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, border: `1px solid ${C.line}` }}>{t('sa.langTag', { l: cur.language === 'pt-BR' ? 'PT' : cur.language.toUpperCase() })}</span>
              </div>
            </div>
            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700, flex: '1 1 240px' }}>{cur.subject}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{t('sa.status')}</span>
                <div style={{ width: 200 }}><Select value={cur.status} onChange={setStatus} label={t('sa.status')}><option value="open">{t('sa.v.waiting')}</option><option value="waiting_customer">{t('sa.v.answered')}</option><option value="resolved">{t('sa.v.resolved')}</option></Select></div>
              </div>
              {!msgs ? <div className="skeleton" style={{ height: 60, borderRadius: 12 }} /> : msgs.map((m) => {
                const mine = m.from_staff;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>{m.internal ? t('sa.internalNote') : mine ? t('hp.team') : cur.opener_name || cur.opener_email} · {new Date(m.created_at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    <div style={{ maxWidth: '80%', borderRadius: 14, padding: '10px 12px', background: m.internal ? '#FDF0DC' : mine ? C.accent : '#F4F7F6', color: m.internal ? '#6B3A04' : mine ? '#FFFFFF' : C.ink, border: mine ? 0 : `1px solid ${C.line}`, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {m.body}
                      {m.attachment_path && urls[m.attachment_path] && <a href={urls[m.attachment_path]} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8 }}><img src={urls[m.attachment_path]} alt={t('hl.attach')} style={{ maxWidth: 260, width: '100%', borderRadius: 10 }} /></a>}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid #EEF2F1' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, alignSelf: 'center', marginRight: 4 }}>{t('sa.canned')}</span>
                {canned.map(([l, text]) => <button key={l} onClick={() => setReply(text)} style={{ minHeight: 34, padding: '0 12px', borderRadius: 999, border: `1px solid ${C.line}`, background: '#F4F7F6', fontWeight: 700, fontSize: 12.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
              </div>
              <label><span className="sr-only">{t('sa.reply')}</span>
                <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('sa.replyPh')} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, border: `1px solid ${C.line}`, background: internal ? '#FFF8EC' : '#F4F7F6', padding: 12, fontFamily: 'inherit', fontSize: 15, color: C.ink, resize: 'vertical' }} />
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, minHeight: 40, cursor: 'pointer', flex: 1 }}>
                  <input type="checkbox" checked={internal} onChange={() => setInternal(!internal)} style={{ width: 18, height: 18, accentColor: C.accent }} />{t('sa.internal')}
                </label>
                <button className="k-btn k-btn-fill" disabled={!reply.trim()} onClick={send}>{internal ? t('sa.saveNote') : t('sa.answer')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Anúncios e push ──
const FORMATS: [Ad['format'], string, string][] = [['top_banner', 'sa.fmt.banner', 'banner'], ['cta_card', 'sa.fmt.card', 'card'], ['popup', 'sa.fmt.popup', 'popup'], ['fullscreen', 'sa.fmt.full', 'fullscreen']];
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);

async function translateTexts(texts: string[], targets: string[]): Promise<Record<string, string[]> | null> {
  if (!targets.length) return {};
  const { data, error } = await supabase.functions.invoke('translate-text', { body: { texts, targets } });
  if (error || !data?.translations) return null;
  return data.translations as Record<string, string[]>;
}

function Comms() {
  const { t } = useApp();
  const [tab, setTab] = useState<'ads' | 'push'>('ads');
  return (
    <>
      <Head title={t('sa.nav.comms')} right={
        <div role="tablist" aria-label={t('ce.sections')} style={{ display: 'flex', background: '#E4ECEA', borderRadius: 12, padding: 4, gap: 4 }}>
          {([['ads', t('sa.tabAds')], ['push', t('sa.tabPush')]] as const).map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ minHeight: 40, padding: '0 16px', borderRadius: 9, border: 0, background: tab === id ? '#FFFFFF' : 'transparent', color: tab === id ? C.ink : C.muted, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
        </div>} />
      {tab === 'ads' ? <Ads /> : <Push />}
    </>
  );
}

function Ads() {
  const { t, lang, session, toast, tErr } = useApp();
  const { list: subs } = useSubs();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [stats, setStats] = useState<Record<string, { impressions: number; clicks: number }>>({});
  const [fmt, setFmt] = useState<Ad['format']>('cta_card');
  const [title, setTitle] = useState('');
  const [cta, setCta] = useState('');
  const [url, setUrl] = useState('');
  const [media, setMedia] = useState<{ path: string; type: 'image' | 'video'; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tg, setTg] = useState<Record<string, boolean>>({ essencial: true, pro: true, comercial: false, 'pt-BR': true, es: true, en: false });
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [freq, setFreq] = useState('daily');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from('ad_campaigns').select('id, name, format, status, media_type, media_path, content, cta_url, utm, targeting, starts_at, ends_at, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.rpc('admin_ad_stats'),
    ]);
    setAds((data || []) as Ad[]);
    setStats(Object.fromEntries(((s || []) as { campaign_id: string; impressions: number; clicks: number }[]).map((x) => [x.campaign_id, x])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const medium = FORMATS.find((f) => f[0] === fmt)![2];
  const campaign = `${slug(title) || 'campanha'}_${new Date(start + 'T12:00').toLocaleDateString('en-US', { month: 'short' }).toLowerCase()}${String(new Date(start + 'T12:00').getFullYear()).slice(2)}`;
  const plans = ['essencial', 'pro', 'comercial'].filter((p) => tg[p]);
  const langs = (['pt-BR', 'es', 'en'] as const).filter((l) => tg[l]);
  const reach = (subs || []).filter((s) => (s.status === 'active' || s.status === 'trialing') && (!plans.length || plans.includes(s.plan || '') || (s.has_commercial && plans.includes('comercial'))) && (!langs.length || (langs as readonly string[]).includes(s.language))).length;

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast(t('sa.tooBig')); return; }
    setUploading(true);
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('ad-media').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) { toast(tErr(error.message)); return; }
    setMedia({ path, type: file.type.startsWith('video') ? 'video' : 'image', url: mediaUrl(path) });
  };

  const publish = async () => {
    if (!session || !title.trim()) return;
    setBusy(true);
    const content: Record<string, { title: string; cta: string }> = { 'pt-BR': { title: title.trim(), cta: cta.trim() || t('sa.ctaDefault') } };
    const others = langs.filter((l) => l !== 'pt-BR');
    const tr = await translateTexts([title.trim(), cta.trim() || t('sa.ctaDefault')], others);
    for (const l of others) content[l] = tr?.[l] ? { title: tr[l][0], cta: tr[l][1] } : content['pt-BR'];
    const starts = new Date(start + 'T00:00').toISOString(), ends = new Date(end + 'T23:59').toISOString();
    const { error } = await supabase.from('ad_campaigns').insert({
      name: title.trim(), format: fmt, status: start > today ? 'scheduled' : 'running', media_type: media?.type || 'image', media_path: media?.path || null,
      content, cta_url: url.trim() || null, utm: { utm_source: 'tidyo_app', utm_medium: medium, utm_campaign: campaign },
      close_after_seconds: fmt === 'fullscreen' ? 5 : null, targeting: { plans, languages: langs, frequency: freq }, starts_at: starts, ends_at: ends, created_by: session.user.id,
    });
    setBusy(false);
    if (error) { toast(tErr(error.message)); return; }
    toast(tr === null && others.length ? t('sa.publishedNoTr') : t('sa.published'));
    setTitle(''); setCta(''); setUrl(''); setMedia(null); load();
  };
  const setStatus = async (a: Ad, status: Ad['status']) => {
    const { error } = await supabase.from('ad_campaigns').update({ status }).eq('id', a.id);
    if (error) toast(tErr(error.message)); else load();
  };
  const ST: Record<string, [string, string]> = { running: ['#E3F1EE', '#0B6B5F'], scheduled: ['#E3EAFB', '#1C3D8F'], paused: ['#FDF0DC', '#8A4B05'], ended: ['#EEF1F0', '#3E4F4C'], draft: ['#EEF1F0', '#3E4F4C'] };
  const pvTitle = title || t('sa.pvTitle'), pvCta = cta || t('sa.ctaDefault');
  const pvMedia = (h: number, r = 0) => <div style={{ height: h, borderRadius: r, background: media ? `#15306E url(${media.type === 'image' ? media.url : ''}) center/cover` : '#15306E' }} />;
  const label = (s: string) => <span style={{ fontSize: 12.5, fontWeight: 800 }}>{s}</span>;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '3 1 460px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{t('sa.newCampaign')}</span>
          {label(t('sa.format'))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{FORMATS.map(([id, k]) => <button key={id} aria-pressed={fmt === id} onClick={() => setFmt(id)} style={{ ...chip(fmt === id), minHeight: 38 }}>{t(k)}</button>)}</div>
          <label style={{ minHeight: 76, borderRadius: 14, border: '1.5px dashed #9DB5B0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: C.accent, fontWeight: 800, fontSize: 13, cursor: 'pointer', textAlign: 'center', padding: 8, opacity: uploading ? 0.6 : 1 }}>
            {media ? t('sa.mediaOk') : uploading ? t('ck.uploading') : t('sa.upload')}
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted }}>{t('sa.uploadHint')}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.title'))}<input style={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.ctaText'))}<input style={field} value={cta} onChange={(e) => setCta(e.target.value)} maxLength={24} placeholder={t('sa.ctaDefault')} /></label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.link'))}<input style={field} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></label>
          <div style={{ background: '#F4F7F6', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: C.muted }}>{t('sa.utm')}</span>
            <code style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, wordBreak: 'break-all', userSelect: 'all' }}>?utm_source=tidyo_app&utm_medium={medium}&utm_campaign={campaign}</code>
          </div>
          {label(t('sa.who'))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {([['essencial', t('sa.plan.essencial')], ['pro', t('sa.plan.pro')], ['comercial', t('sa.plan.comercial')], ['pt-BR', 'Português'], ['es', 'Español'], ['en', 'English']] as const).map(([k, l]) => <button key={k} aria-pressed={!!tg[k]} onClick={() => setTg({ ...tg, [k]: !tg[k] })} style={chip(!!tg[k])}>{l}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.from'))}<DateField value={start} onChange={setStart} min={today} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.to'))}<DateField value={end} onChange={setEnd} min={start} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{label(t('sa.freq'))}<Select value={freq} onChange={setFreq} label={t('sa.freq')}><option value="daily">{t('sa.freqDaily')}</option><option value="once">{t('sa.freqOnce')}</option><option value="always">{t('sa.freqAlways')}</option></Select></div>
          </div>
          <span style={{ fontSize: 12.5, color: C.muted }}>{t('sa.reach', { n: reach })}</span>
          <button className="k-btn k-btn-fill" style={{ alignSelf: 'flex-start', padding: '0 20px' }} disabled={busy || !title.trim()} onClick={publish}>{start > today ? t('sa.schedule') : t('sa.publish')}</button>
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: C.muted, alignSelf: 'flex-start' }}>{t('sa.preview')}</span>
          <div style={{ width: 250, height: 500, boxSizing: 'border-box', borderRadius: 36, background: '#0A3D35', padding: 8 }} aria-hidden="true">
            <div style={{ width: '100%', height: '100%', borderRadius: 29, background: '#F4F7F6', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 10px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 22, height: 22, borderRadius: 7, background: '#D4F1E9' }} /><span style={{ width: 90, height: 10, borderRadius: 5, background: '#DCE5E3' }} /></div>
              {fmt === 'top_banner' && <div style={{ height: 58, borderRadius: 11, background: '#15306E', color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 10px', gap: 2 }}><span style={{ fontSize: 7, fontWeight: 800, color: '#F7B733' }}>{t('sa.sponsored')}</span><span style={{ fontSize: 11, fontWeight: 800 }}>{pvTitle}</span></div>}
              {fmt === 'cta_card' && <div style={{ borderRadius: 12, background: '#FFFFFF', border: `1px solid ${C.line}`, overflow: 'hidden' }}>{pvMedia(62)}<div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 11, fontWeight: 800 }}>{pvTitle}</span><span style={{ height: 24, borderRadius: 7, background: '#15306E', color: '#FFFFFF', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pvCta}</span></div></div>}
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 50, borderRadius: 10, background: '#FFFFFF', border: `1px solid ${C.line}` }} />)}
              {fmt === 'popup' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,20,18,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}><div style={{ width: '100%', borderRadius: 14, background: '#FFFFFF', overflow: 'hidden' }}>{pvMedia(90)}<div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ fontSize: 12, fontWeight: 800 }}>{pvTitle}</span><span style={{ height: 28, borderRadius: 8, background: '#15306E', color: '#FFFFFF', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pvCta}</span><span style={{ fontSize: 9, textAlign: 'center', color: C.muted, fontWeight: 700 }}>{t('sa.notNow')}</span></div></div></div>}
              {fmt === 'fullscreen' && <div style={{ position: 'absolute', inset: 0, background: media?.type === 'image' ? `#15306E url(${media.url}) center/cover` : '#15306E', color: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '18px 14px', gap: 8 }}><span style={{ position: 'absolute', top: 14, right: 12, fontSize: 9.5, fontWeight: 800, background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '4px 8px' }}>{t('sa.skipIn')}</span><span style={{ fontSize: 8, fontWeight: 800, color: '#F7B733' }}>{t('sa.sponsored')}</span><span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800 }}>{pvTitle}</span><span style={{ height: 32, borderRadius: 9, background: '#F7B733', color: '#15306E', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pvCta}</span></div>}
            </div>
          </div>
        </div>
      </div>
      <div style={{ ...card, overflowX: 'auto' }}>
        {ads === null ? <div style={{ padding: 16 }}><div className="skeleton" style={{ height: 80, borderRadius: 12 }} /></div> : ads.length === 0 ? <div style={{ padding: 20, fontSize: 13.5, color: C.muted }}>{t('sa.noAds')}</div> : (
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', ...kpiLabel }}><th style={{ padding: '10px 14px' }}>{t('sa.campaign')}</th><th style={{ padding: '10px 8px' }}>{t('sa.format')}</th><th style={{ padding: '10px 8px', textAlign: 'right' }}>{t('sa.impr')}</th><th style={{ padding: '10px 8px', textAlign: 'right' }}>{t('sa.clicks')}</th><th style={{ padding: '10px 8px', textAlign: 'right' }}>CTR</th><th style={{ padding: '10px 14px' }}>{t('sa.status')}</th><th /></tr></thead>
            <tbody>{ads.map((a) => {
              const s = stats[a.id], imp = Number(s?.impressions || 0), clk = Number(s?.clicks || 0);
              const live = a.status === 'running' && a.ends_at && new Date(a.ends_at) < new Date() ? 'ended' : a.status;
              return (
                <tr key={a.id} style={{ borderTop: '1px solid #EEF2F1' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 800 }}>{a.name}<div style={{ fontSize: 11.5, fontWeight: 500, color: C.muted }}>{[a.starts_at, a.ends_at].filter(Boolean).map((d) => new Date(d!).toLocaleDateString(lang, { day: 'numeric', month: 'short' })).join(' – ')}</div></td>
                  <td style={{ padding: '11px 8px' }}>{t(FORMATS.find((f) => f[0] === a.format)?.[1] || '')}</td>
                  <td className="num" style={{ padding: '11px 8px', textAlign: 'right' }}>{imp ? imp.toLocaleString('en-US') : '—'}</td>
                  <td className="num" style={{ padding: '11px 8px', textAlign: 'right' }}>{clk ? clk.toLocaleString('en-US') : '—'}</td>
                  <td className="num" style={{ padding: '11px 8px', textAlign: 'right', fontWeight: 800 }}>{imp ? `${((clk / imp) * 100).toLocaleString(lang, { maximumFractionDigits: 1 })}%` : '—'}</td>
                  <td style={{ padding: '11px 14px' }}><span className="nw" style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '3px 8px', background: ST[live][0], color: ST[live][1] }}>{t(`sa.as.${live}`)}</span></td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    {(live === 'running' || live === 'scheduled') && <button onClick={() => setStatus(a, 'paused')} style={{ ...chip(false), minHeight: 32, fontSize: 12 }}>{t('sa.pause')}</button>}
                    {live === 'paused' && <button onClick={() => setStatus(a, 'running')} style={{ ...chip(false), minHeight: 32, fontSize: 12 }}>{t('sa.resume')}</button>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Push() {
  const { t, toast, tErr } = useApp();
  const [counts, setCounts] = useState<{ owners: number; team: number; clients: number } | null>(null);
  const [aud, setAud] = useState({ owners: true, team: false, clients: false });
  const [ext, setExt] = useState(false);
  const [title, setTitle] = useState('Tidyo');
  const [msg, setMsg] = useState('');
  const [tr, setTr] = useState<Record<string, string[]> | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => { supabase.rpc('admin_push_counts').then(({ data }) => setCounts(((data || []) as { owners: number; team: number; clients: number }[])[0] || null)); }, []);
  // translations follow the text (debounced)
  useEffect(() => {
    if (!msg.trim()) { setTr(undefined); return; }
    const h = window.setTimeout(() => { translateTexts([title, msg], ['en', 'es']).then(setTr); }, 900);
    return () => window.clearTimeout(h);
  }, [msg, title]);
  const n = (aud.owners ? Number(counts?.owners || 0) : 0) + (ext && aud.team ? Number(counts?.team || 0) : 0) + (ext && aud.clients ? Number(counts?.clients || 0) : 0);
  const send = async () => {
    setAsk(false); setBusy(true);
    const content = { 'pt-BR': { title, body: msg.trim() }, en: { title: tr?.en?.[0] || title, body: tr?.en?.[1] || msg.trim() }, es: { title: tr?.es?.[0] || title, body: tr?.es?.[1] || msg.trim() } };
    const { data, error } = await supabase.rpc('admin_push', { p_owners: aud.owners, p_team: ext && aud.team, p_clients: ext && aud.clients, p_content: content, p_link: null });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('sa.pushSent', { n: Number(data) || 0 })); setMsg(''); }
  };
  const rows: [keyof typeof aud, string, string, boolean][] = [
    ['owners', t('sa.aud.owners'), t('sa.aud.ownersSub', { n: counts?.owners ?? '…' }), false],
    ['team', t('sa.aud.team'), ext ? t('sa.aud.open', { n: counts?.team ?? '…' }) : t('sa.aud.locked'), !ext],
    ['clients', t('sa.aud.clients'), ext ? t('sa.aud.open', { n: counts?.clients ?? '…' }) : t('sa.aud.locked'), !ext],
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
      <div style={{ ...card, flex: '3 1 460px', minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span style={{ fontWeight: 800, fontSize: 16 }}>{t('sa.newPush')}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('sa.forWhom')}</span>
        {rows.map(([k, l, sub, locked]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, border: `1px solid ${C.line}`, borderRadius: 14, padding: '0 14px', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.55 : 1 }}>
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14 }}>{l}</span><span style={{ fontSize: 12, color: C.muted }}>{sub}</span></span>
            <input type="checkbox" checked={aud[k] && !locked} disabled={locked} onChange={() => setAud({ ...aud, [k]: !aud[k] })} style={{ width: 22, height: 22, accentColor: C.accent, margin: 0 }} />
          </label>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={ext} onChange={() => setExt(!ext)} style={{ width: 20, height: 20, accentColor: '#B8400C', margin: 0, flex: 'none' }} />{t('sa.allowExt')}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 800 }}>{t('sa.pushTitle')}<input style={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 800 }}>{t('sa.pushMsg')}
          <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={240} style={{ borderRadius: 12, border: `1px solid ${C.line}`, padding: 10, fontSize: 14, fontWeight: 500, resize: 'vertical', fontFamily: 'inherit', color: C.ink }} placeholder={t('sa.pushPh')} />
        </label>
        <button className="k-btn k-btn-fill" style={{ alignSelf: 'flex-start', padding: '0 20px' }} disabled={busy || !msg.trim() || n === 0} onClick={() => setAsk(true)}>{t('sa.sendNow')}</button>
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.muted }}>{t('sa.pushPreview')}</span>
        {([['Português', title, msg], ['Español', tr?.es?.[0] || title, tr?.es?.[1] || msg], ['English', tr?.en?.[0] || title, tr?.en?.[1] || msg]] as const).map(([l, ti, b]) => (
          <div key={l} style={{ ...card, borderRadius: 16, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true" style={{ flex: 'none' }}><rect width="64" height="64" rx="17" fill="#D4F1E9" /><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" /></g></svg>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span style={{ fontSize: 11.5, fontWeight: 800, color: C.muted }}>{ti} · {l}</span><span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{b || t('sa.pushEmpty')}</span></span>
          </div>
        ))}
        {msg.trim() && tr === null && <span style={{ fontSize: 12, color: '#8A4B05' }}>{t('sa.noTranslate')}</span>}
      </div>
      {ask && (
        <Sheet title={t('sa.pushAsk', { n })} onClose={() => setAsk(false)}>
          <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{msg}</span>
          <div className="k-pair"><button className="k-btn k-btn-line" onClick={() => setAsk(false)}>{t('c.cancel')}</button><button className="k-btn k-btn-fill" onClick={send}>{t('sa.sendNow')}</button></div>
        </Sheet>
      )}
    </div>
  );
}
