// Início do dono — canvas: Main (residencial/ambos), InicioComercial (só comercial), PrimeirosPassos (conta nova)
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { Avatar, BELL, C, Empty, Fab, I, LogoMark, OwnerBar, Pill, SheetActions, SPARK, Svg, colorOf, compactMoney, dur, hm, jobTone, shortName, usd } from '../components/kit';
import { findConflicts, getClients, getInvoices, getJobs, getMembers, getServices, getUnbilled, isOverdue, jobMinutes, memberIndex, type Client, type Invoice, type Job, type Member } from '../lib/data';
import { addDays, startOfDay } from '../lib/format';
import { healthOf, healthReady, loadFinance, marginOf } from '../lib/finance';
import { optimize, total, driveMin, pt, type Pt } from '../lib/route';
import { useUnread } from '../pages/Inbox';
import { InlineAd, OverlayAd, useAd } from '../components/Ad';
import { InstallCard } from '../components/InstallCard';
import { gapVsRegion } from '../lib/regionPricing';
import { pricingOf } from './NewClient';
import { JobSheet } from './JobSheet';
import { getContracts, type Contract } from '../pages/Contracts';

const TAG: Record<string, [string, string]> = {
  conflict: ['#5A2416', '#FFB59C'], route: ['#173F3A', '#5FD4C1'], contract: ['#4A3510', '#F5C66B'], billing: ['#4A1A1A', '#FF9C9C'],
  team: ['#4A3510', '#F5C66B'], gps: ['#5A2416', '#FFB59C'], review: ['#173F3A', '#5FD4C1'], invoice: ['#173F3A', '#5FD4C1'],
  price: ['#4A3510', '#F5C66B'], cover: ['#5A2416', '#FFB59C'], punch: ['#4A3510', '#F5C66B'], hours: ['#173F3A', '#5FD4C1'], insp: ['#2B2A55', '#B9B3FF'],
};
export type Insight = { id: string; kind: keyof typeof TAG | string; title: string; detail?: string; cta?: string; act?: () => void; to?: string; toLabel?: string };

function greeting(t: (k: string) => string) {
  const h = new Date().getHours();
  return h < 12 ? t('home.morning') : h < 18 ? t('home.afternoon') : t('home.evening');
}
const dateLine = (lang: string) => {
  const d = new Date();
  const wd = d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '');
  const md = d.toLocaleDateString(lang, { day: 'numeric', month: 'long' });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${md}`;
};

/** Dark Tidy sheet, as in the canvas */
export function TidySheet({ title, sub, items, onClose }: { title: string; sub: string; items: Insight[]; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={title} onClose={onClose} dark>
      <span style={{ fontSize: 12, color: C.faint, marginTop: -10 }}>{sub}</span>
      {items.length === 0 ? <p style={{ margin: 0, color: C.faint }}>{t('tidy.none')}</p> : items.map((it) => {
        const [bg, fg] = TAG[it.kind] || TAG.review;
        return (
          <div key={it.id} className="k-tidy-item">
            <span className="k-tidy-tag" style={{ background: bg, color: fg }}>{t(`tidy.k.${it.kind}`)}</span>
            <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{it.title}</span>
            {it.detail && <span style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.4 }}>{it.detail}</span>}
            {it.to && <Link to={it.to} onClick={onClose} className="k-btn k-btn-sm k-btn-mint k-tidy-cta">{it.toLabel}</Link>}
            {it.act && <button onClick={it.act} className="k-btn k-btn-sm k-tidy-cta ghost">{it.cta}</button>}
          </div>
        );
      })}
    </Sheet>
  );
}

function TopBar({ sub, name, pending, onTidy }: { sub: string; name: string; pending?: number; onTidy?: () => void }) {
  const { t } = useApp();
  const unread = useUnread();
  return (
    <div className="k-hello">
      <LogoMark />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
        <span className="k-date">{sub}</span>
        <span className="k-name">{name}</span>
      </div>
      {onTidy && (
        <button className="k-iconbtn dark" onClick={onTidy} aria-label={pending ? t('tidy.pendingAria', { n: pending }) : t('tidy.allGood')}>
          <Svg d={SPARK} size={20} color={C.mint} />
          {!!pending && <span className="k-badge">{pending}</span>}
        </button>
      )}
      <Link to="/avisos" className="k-iconbtn" aria-label={t('cen.title')}>
        <Svg d={BELL} size={20} color={C.ink} w={1.8} />
        {unread > 0 && <span className="k-dotbadge" />}
      </Link>
    </div>
  );
}

export default function Home() {
  const { company, sub } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[] | null>(null);
  const [counts, setCounts] = useState<{ services: number; jobs: number } | null>(null);
  const reloadBase = useCallback(async () => {
    if (!company) return;
    const [m, c, s, j] = await Promise.all([
      getMembers(company.id), getClients(company.id), getServices(company.id),
      supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
    ]);
    setMembers(m); setClients(c); setCounts({ services: s.length, jobs: j.count || 0 });
  }, [company]);
  useEffect(() => { reloadBase(); }, [reloadBase]);
  if (!company || !clients || !counts) return <HomeSkeleton />;
  const fresh = clients.length === 0 || counts.jobs === 0;
  if (fresh) return <FirstSteps members={members} clients={clients} counts={counts} trialEnds={sub?.status === 'trialing' ? sub.trial_ends_at : null} />;
  if (company.mode === 'commercial') return <CommercialHome members={members} reloadBase={reloadBase} />;
  return <OwnerHome members={members} clients={clients} />;
}

/** Loading state (canvas "Esqueleto"): the shape of Hoje with a sweeping logo */
export function HomeSkeleton() {
  const sk = (w: number | string, h: number, r = 6, extra: CSSProperties = {}) => <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...extra }} />;
  return (
    <div className="k-screen"><main className="k-page top20" aria-busy="true" style={{ gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="36" height="36" viewBox="0 0 64 64" role="img" aria-label="…" style={{ flex: 'none' }}><rect width="64" height="64" rx="17" fill="#D4F1E9" /><g className="tidy-sweep"><g transform="translate(11 8.5) scale(0.7)"><rect x="12" y="9.5" width="36" height="4" rx="2" fill="#12A38F" /><rect x="10" y="12.5" width="40" height="10" rx="5" fill="#0A3D35" /><path d="M30 20 V 44 C 30 51.5, 34 55, 41.5 54" fill="none" stroke="#0A3D35" strokeWidth="7" strokeLinecap="round" /></g></g></svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>{sk(110, 11)}{sk(170, 18, 8)}</div>
        {sk(44, 44, 14)}{sk(44, 44, 14)}
      </div>
      {sk('100%', 52, 14)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>{sk('60%', 9, 5)}{sk('50%', 22, 7)}{sk('80%', 9, 5)}</div>)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>{sk(140, 16, 7)}{sk(56, 12)}</div>
      {[['62%', '84%'], ['48%', '70%'], ['70%', '76%'], ['55%', '66%']].map(([a, b], i) => (
        <div key={i} style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>{sk(38, 12)}{sk(22, 9, 5)}</div>
          <div style={{ width: 1, alignSelf: 'stretch', background: C.line }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>{sk(a, 12)}{sk(b, 9, 5)}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{sk(22, 22, 22)}{sk(64, 9, 5)}{sk(70, 20, 999, { marginLeft: 'auto' })}</div>
          </div>
        </div>
      ))}
    </main><OwnerBar /></div>
  );
}

/** Last 3 days of the trial: a quiet note so the lock screen never comes as a surprise */
function TrialSoon() {
  const { t, sub, membership } = useApp();
  if (membership?.role !== 'owner' || sub?.status !== 'trialing' || !sub.trial_ends_at) return null;
  const left = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / 864e5);
  if (left > 3 || left < 0) return null;
  return (
    <Link to="/ajuda" className="k-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFF8E6', borderColor: '#F3DFA8', textDecoration: 'none', color: '#6B4A04' }}>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{left <= 0 ? t('home.trialToday') : t('home.trialSoon', { n: left })}</span>
      <span className="nw" style={{ fontSize: 13, fontWeight: 800, color: '#0B6B5F' }}>{t('home.trialTalk')}</span>
    </Link>
  );
}

// ─────────────── Residencial / ambos ───────────────
function OwnerHome({ members, clients }: { members: Member[]; clients: Client[] }) {
  const { t, tErr, lang, company, profile, toast } = useApp();
  const nav = useNavigate();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [week, setWeek] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [health, setHealth] = useState<number | null | undefined>(undefined);
  const [extra, setExtra] = useState<{ contracts: Contract[]; pendingExp: number; uninvoiced: number; uninvoicedCents?: number; routeSave: { min: number; per: { name: string; min: number }[] } | null }>({ contracts: [], pendingExp: 0, uninvoiced: 0, routeSave: null });
  const [tidy, setTidy] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [open, setOpen] = useState<Job | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const { ad, close: closeAd, click: clickAd } = useAd();

  const load = useCallback(async () => {
    if (!company) return;
    const today = startOfDay(new Date());
    const [j, w, inv, fin] = await Promise.all([
      getJobs(company.id, today, addDays(today, 1)), getJobs(company.id, today, addDays(today, 8)), getInvoices(company.id),
      loadFinance(company.id, addDays(today, -30), addDays(today, 1)),
    ]);
    setJobs(j.filter((x) => x.status !== 'canceled')); setWeek(w); setInvoices(inv); setHealth(healthReady(company.created_at) ? healthOf(fin) : null);
    const [cts, exp, unbilled] = await Promise.all([
      company.mode !== 'residential' ? getContracts(company.id) : Promise.resolve([] as Contract[]),
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending'),
      getUnbilled(company.id),
    ]);
    // tomorrow's routes: how much driving the optimiser saves, per helper
    const tmr = w.filter((x) => x.status !== 'canceled' && startOfDay(new Date(x.scheduled_start)).getTime() === addDays(today, 1).getTime());
    const { data: plans } = await supabase.from('route_plans').select('membership_id').eq('company_id', company.id).eq('plan_date', addDays(today, 1).toISOString().slice(0, 10));
    const planned = new Set(((plans || []) as { membership_id: string }[]).map((p) => p.membership_id));
    const per: { name: string; min: number }[] = [];
    for (const m of members.filter((x) => x.status === 'active' && !planned.has(x.id))) {
      const mine = tmr.filter((x) => x.job_assignments.some((a) => a.membership_id === m.id)).map((x) => ({ lat: x.properties?.lat ?? null, lng: x.properties?.lng ?? null }));
      if (mine.filter((s) => pt(s)).length < 2) continue;
      const origin: Pt | null = null;
      const save = driveMin(total(origin, mine)) - driveMin(total(origin, optimize(origin, mine)));
      if (save >= 5) per.push({ name: m.display_name.split(' ')[0], min: save });
    }
    setExtra({
      contracts: cts, pendingExp: exp.count || 0,
      uninvoiced: unbilled.length, uninvoicedCents: unbilled.reduce((s, x) => s + x.price_cents, 0),
      routeSave: per.length ? { min: per.reduce((s, p) => s + p.min, 0), per } : null,
    });
  }, [company, members]);
  useEffect(() => { load(); }, [load]);

  const conflicts = useMemo(() => findConflicts(week), [week]);
  const conflict = conflicts.find((c) => !done[`c-${c.b.id}`]);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name || '';
  const weekday = (iso: string) => new Date(iso).toLocaleDateString(lang, { weekday: 'long' }).replace('-feira', '');
  const overdue = invoices.filter(isOverdue);
  const unassigned = week.filter((j) => j.status === 'scheduled' && j.job_assignments.length === 0 && new Date(j.scheduled_start) < addDays(startOfDay(new Date()), 2));
  const daysAgo = (d: string) => Math.max(1, Math.round((Date.now() - new Date(d + 'T12:00').getTime()) / 864e5));
  const days = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : 999);
  const months = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / (30.44 * 864e5)) : 0);

  const insights: Insight[] = [
    ...(conflict ? [{ id: `c-${conflict.b.id}`, kind: 'conflict', title: t('tidy.conflictT', { name: nameOf(conflict.memberId).split(' ')[0], time: hm(conflict.b.scheduled_start, lang), day: weekday(conflict.b.scheduled_start) }),
      detail: t('tidy.conflictD', { a: conflict.a.clients?.name || '', ca: conflict.a.properties?.city || '', b: conflict.b.clients?.name || '', cb: conflict.b.properties?.city || '' }),
      cta: t('tidy.resolve'), act: () => { setTidy(false); setConflictOpen(true); } }] : []),
    ...(extra.routeSave ? [{ id: 'route', kind: 'route', title: t('tidy.routeT', { n: extra.routeSave.min }), detail: extra.routeSave.per.map((p) => t('tidy.routeD', { name: p.name, n: p.min })).join(' · '), to: '/app/rotas', toLabel: t('tidy.seeRoute') }] : []),
    ...extra.contracts.filter((c) => c.status === 'active' && days(c.renews_on) <= 30).map((c) => ({ id: `r-${c.id}`, kind: 'contract', title: t('tidy.renewT', { name: c.clients?.name || '', n: Math.max(0, days(c.renews_on)) }),
      detail: months(c.last_adjusted_on || c.starts_on) >= 12 ? t('tidy.renewD', { n: months(c.last_adjusted_on || c.starts_on) }) : undefined, cta: t('tidy.prepAdjust'), act: () => nav('/app/contratos') })),
    ...(overdue.length ? [{ id: 'od', kind: 'billing', title: t('tidy.overdueT', { n: overdue.length, amount: usd(overdue.reduce((s, i) => s + i.total_cents - i.paid_cents, 0)) }),
      detail: (() => { const o = [...overdue].sort((a, b) => (a.due_on || '').localeCompare(b.due_on || ''))[0]; return t('tidy.overdueD', { name: o.clients?.name || '', n: daysAgo(o.due_on!) }); })(),
      cta: t('tidy.seeInvoices'), act: () => nav('/app/cobrancas') }] : []),
    ...(unassigned.length ? [{ id: 'un', kind: 'team', title: t('tidy.unassignedText', { n: unassigned.length }), cta: t('tidy.open'), act: () => { setTidy(false); setOpen(unassigned[0]); } }] : []),
    ...(extra.pendingExp ? [{ id: 'exp', kind: 'review', title: t('tidy.reviewText', { n: extra.pendingExp }), cta: t('tidy.open'), act: () => nav('/app/financas/despesas') }] : []),
    ...((() => { const g = company?.mode !== 'commercial' ? gapVsRegion(pricingOf(company?.pricing), company?.state) : null;
      return g && g.pct <= -15 ? [{ id: 'price', kind: 'price', title: t('tidy.priceLowT', { n: -g.pct, st: g.s.state }), detail: t('tidy.priceLowD', { mine: usd(g.mine), avg: usd(g.theirs) }), to: '/app/mais/precos', toLabel: t('tidy.seePrices') }] : []; })()),
    ...(extra.uninvoiced ? [{ id: 'ui', kind: 'invoice', title: t('tidy.uninvoicedText', { n: extra.uninvoiced }), detail: t('tidy.uninvoicedD', { v: usd(extra.uninvoicedCents || 0) }), cta: t('tidy.billNow'), act: () => nav('/app/cobrancas?tab=cobrar') }] : []),
  ];
  const pending = insights.length;

  const helpersOut = new Set((jobs || []).flatMap((j) => j.job_assignments.map((a) => a.membership_id))).size;
  const weekEnd = addDays(startOfDay(new Date()), 7 - new Date().getDay()).toISOString().slice(0, 10);
  const receivable = invoices.filter((i) => i.status === 'open' && (!i.due_on || i.due_on <= weekEnd)).reduce((s, i) => s + i.total_cents - i.paid_cents, 0);
  const first = (profile?.full_name || '').split(' ')[0];

  return (
    <div className="k-screen">
      <main className="k-page top20">
        <TopBar sub={dateLine(lang)} name={`${greeting(t)}${first ? `, ${first}` : ''}`} pending={pending} onTidy={() => setTidy(true)} />
        {ad && (ad.format === 'top_banner' || ad.format === 'cta_card') && <InlineAd ad={ad} close={closeAd} click={clickAd} />}
        <InstallCard />
        <TrialSoon />
        {conflict && (
          <div className="k-urgent" role="status">
            <Svg d={SPARK} size={18} color="#B8400C" />
            <span>{t('home.conflictBar', { name: nameOf(conflict.memberId).split(' ')[0], time: hm(conflict.b.scheduled_start, lang), day: weekday(conflict.b.scheduled_start) })}</span>
            <button className="k-btn k-btn-sm k-btn-danger" onClick={() => setConflictOpen(true)}>{t('tidy.resolve')}</button>
          </div>
        )}
        <div className="k-kpis">
          <div className="k-kpi"><span className="k-kpi-l">{t('home.kJobs')}</span><span className="k-kpi-v">{jobs ? jobs.length : '–'}</span><span className="k-kpi-n nw" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('home.kJobsN', { n: helpersOut })}</span></div>
          <div className="k-kpi"><span className="k-kpi-l">{t('home.receivable')}</span><span className="k-kpi-v">{compactMoney(receivable)}</span><span className="k-kpi-n">{t('home.thisWeek')}</span></div>
          <Link to="/app/financas" className="k-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="k-kpi-l">{t('home.kHealth')}</span>
            <span className="k-kpi-v" style={{ color: health == null ? C.muted : health >= 70 ? C.accent : health >= 45 ? '#8A4B05' : '#B8400C' }}>{health == null ? '–' : <>{health}<span style={{ fontSize: 13, color: C.muted }}>/100</span></>}</span>
            {health == null && !healthReady(company?.created_at) ? <span className="k-kpi-n">{t('home.healthSoon')}</span> : <div className="k-bar5"><div style={{ width: `${health || 0}%`, background: health == null || health >= 70 ? C.accent : health >= 45 ? '#E0A341' : '#B8400C' }} /></div>}
          </Link>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="k-sec"><span className="k-h2" style={{ textTransform: 'none', letterSpacing: 0, color: C.ink, fontSize: 18 }}>{t('home.agenda')}</span><Link className="k-link" to="/app/agenda">{t('home.seeAll')}</Link></div>
          {!jobs ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 86, borderRadius: 16 }} />) : jobs.length === 0 ? (
            <Empty title={t('home.freeDay')} text={t('home.freeDayText')} action={<Link className="k-btn k-btn-fill" style={{ minHeight: 44, fontSize: 13.5 }} to="/app/agenda/novo">{t('home.newJob')}</Link>} />
          ) : jobs.map((j) => <JobCard key={j.id} job={j} members={members} onOpen={() => setOpen(j)} />)}
        </section>
      </main>
      <Fab to="/app/agenda/novo" label={t('home.newJob')} />
      <OwnerBar />
      {ad && (ad.format === 'popup' || ad.format === 'fullscreen') && <OverlayAd ad={ad} close={closeAd} click={clickAd} />}
      {tidy && <TidySheet title={t('tidy.reviewedOps')} sub={`${t('c.today')} · ${pending ? t('tidy.pendingN', { n: pending }) : t('tidy.allGood')}`} items={insights} onClose={() => setTidy(false)} />}
      {conflictOpen && conflict && <ConflictSheet conflict={conflict} jobs={week} members={members} clients={clients} onClose={() => setConflictOpen(false)}
        onDone={(msg) => { setConflictOpen(false); setDone({ ...done, [`c-${conflict.b.id}`]: msg }); toast(msg); load(); }} tErr={tErr} />}
      {open && <JobSheet job={open} members={members} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}

export function JobCard({ job, members, onOpen }: { job: Job; members: Member[]; onOpen: () => void }) {
  const { t, lang } = useApp();
  const m = members.find((x) => x.id === job.job_assignments[0]?.membership_id);
  const color = m ? colorOf(memberIndex(members, m.id))[0] : '#9AA9A6';
  return (
    <button className="k-job" onClick={onOpen}>
      <div className="k-job-time"><b>{hm(job.scheduled_start, lang)}</b><span>{dur(jobMinutes(job))}</span></div>
      <div className="k-vr" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span className="k-ell" style={{ fontWeight: 700, fontSize: 14 }}>{job.clients?.name}</span>
          <span className="k-tag">{job.clients?.kind === 'commercial' ? t('home.tagCom') : t('home.tagRes')}</span>
        </div>
        <span className="k-ell k-s125 k-muted">{job.properties?.address_line1}, {job.properties?.city}{job.properties?.state ? `, ${job.properties.state}` : ''}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
          {m ? <Avatar name={m.display_name} color={color} /> : <span className="k-avatar" style={{ width: 22, height: 22, borderRadius: 22, background: '#EEF1F0', color: '#566965', fontSize: 12 }}>?</span>}
          <span className="k-ell" style={{ fontSize: 12.5, fontWeight: 600 }}>{m ? shortName(m.display_name) : t('c.unassigned')}</span>
          <Pill tone={jobTone(job.status)} style={{ marginLeft: 'auto' }}>{t(`status.${job.status}`)}</Pill>
        </div>
      </div>
    </button>
  );
}

// Who is free during the clashing job, nearest first
function freeHelpers(job: Job, jobs: Job[], members: Member[], exclude: string) {
  const s = new Date(job.scheduled_start).getTime(), e = new Date(job.scheduled_end).getTime();
  const sameDay = jobs.filter((j) => j.status !== 'canceled' && startOfDay(new Date(j.scheduled_start)).getTime() === startOfDay(new Date(job.scheduled_start)).getTime());
  const target = pt({ lat: job.properties?.lat ?? null, lng: job.properties?.lng ?? null });
  return members.filter((m) => m.status === 'active' && m.id !== exclude && m.role !== 'owner').map((m) => {
    const mine = sameDay.filter((j) => j.job_assignments.some((a) => a.membership_id === m.id));
    if (mine.some((j) => new Date(j.scheduled_start).getTime() < e && s < new Date(j.scheduled_end).getTime())) return null;
    const before = mine.filter((j) => new Date(j.scheduled_end).getTime() <= s).sort((a, b) => b.scheduled_end.localeCompare(a.scheduled_end))[0];
    const after = mine.filter((j) => new Date(j.scheduled_start).getTime() >= e).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start))[0];
    const from = before ? pt({ lat: before.properties?.lat ?? null, lng: before.properties?.lng ?? null }) : null;
    const min = target && from ? driveMin(total(from, [{ lat: target.lat, lng: target.lng }])) : null;
    return { m, freeFrom: before ? before.scheduled_end : null, freeTo: after ? after.scheduled_start : null, min };
  }).filter(Boolean).sort((a, b) => (a!.min ?? 999) - (b!.min ?? 999)) as { m: Member; freeFrom: string | null; freeTo: string | null; min: number | null }[];
}

function ConflictSheet({ conflict, jobs, members, onClose, onDone, tErr }: { conflict: { memberId: string; a: Job; b: Job }; jobs: Job[]; members: Member[]; clients: Client[]; onClose: () => void; onDone: (msg: string) => void; tErr: (m?: string | null) => string }) {
  const { t, lang, company, toast } = useApp();
  const options = useMemo(() => freeHelpers(conflict.b, jobs, members, conflict.memberId), [conflict, jobs, members]);
  const [pick, setPick] = useState(0);
  const [more, setMore] = useState(false);
  const busy = members.find((m) => m.id === conflict.memberId);
  const best = options[pick];
  const window = (o: (typeof options)[number]) => `${o.freeFrom ? hm(o.freeFrom, lang) : t('home.morningStart')}–${o.freeTo ? hm(o.freeTo, lang) : t('home.dayEnd')}`;
  const move = async () => {
    if (!best || !company) return;
    await supabase.from('job_assignments').delete().eq('job_id', conflict.b.id).eq('membership_id', conflict.memberId);
    const { error } = await supabase.from('job_assignments').insert({ job_id: conflict.b.id, membership_id: best.m.id, company_id: company.id, is_lead: true });
    if (error) { toast(tErr(error.message)); return; }
    onDone(t('home.movedTo', { client: conflict.b.clients?.name || '', name: best.m.display_name.split(' ')[0] }));
  };
  return (
    <Sheet title={t('home.conflictTitle', { name: busy?.display_name.split(' ')[0] || '' })} onClose={onClose}>
      <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
        {best ? t('home.conflictText', { name: busy?.display_name.split(' ')[0] || '', time: hm(conflict.b.scheduled_start, lang), client: conflict.b.clients?.name || '', to: best.m.display_name.split(' ')[0], min: best.min ?? '–' })
          : t('home.conflictNone', { name: busy?.display_name.split(' ')[0] || '', time: hm(conflict.b.scheduled_start, lang) })}
      </span>
      {best && (
        <div className="k-kv">
          <div><span>{t('home.kvHouse')}</span><span className="k-ell">{conflict.b.clients?.name} · {conflict.b.properties?.address_line1}, {conflict.b.properties?.city}</span></div>
          <div><span>{t('home.kvFrom')}</span><span>{busy ? shortName(busy.display_name) : ''}</span></div>
          <div><span>{t('home.kvTo')}</span><span style={{ color: C.accent }}>{shortName(best.m.display_name)} · {t('home.freeWin', { w: window(best) })}</span></div>
        </div>
      )}
      {more && options.length > 1 && (
        <div className="k-chips" role="group" aria-label={t('job.helper')}>
          {options.map((o, i) => <button key={o.m.id} className="k-chip" aria-pressed={i === pick} onClick={() => { setPick(i); setMore(false); }}>{shortName(o.m.display_name)}</button>)}
        </div>
      )}
      {best ? (
        <SheetActions cancel={t('home.pickOther')} onCancel={() => (options.length > 1 ? setMore(true) : onClose())} confirm={t('home.moveTo', { name: best.m.display_name.split(' ')[0] })} onConfirm={move} />
      ) : <button className="k-btn k-btn-line" onClick={onClose}>{t('c.close')}</button>}
    </Sheet>
  );
}

// ─────────────── Só comercial ───────────────
function CommercialHome({ members, reloadBase }: { members: Member[]; reloadBase: () => void }) {
  const { t, tErr, lang, company, profile, toast } = useApp();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [margin, setMargin] = useState<number | null>(null);
  const [tidy, setTidy] = useState(false);
  const [cover, setCover] = useState<Job | null>(null);
  const [covered, setCovered] = useState('');
  const [open, setOpen] = useState<Job | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(i); }, []);

  const load = useCallback(async () => {
    if (!company) return;
    const today = startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [j, c, fin] = await Promise.all([getJobs(company.id, today, addDays(today, 1)), getContracts(company.id), loadFinance(company.id, monthStart, addDays(today, 1))]);
    setJobs(j.filter((x) => x.status !== 'canceled')); setContracts(c); setMargin(fin.received > 0 ? marginOf(fin) : null);
  }, [company]);
  useEffect(() => { load(); }, [load]);

  const noPunch = (j: Job) => j.status === 'scheduled' && !j.started_at && now > new Date(j.scheduled_start).getTime() + 10 * 60000;
  const active = contracts.filter((c) => c.status === 'active');
  const renewSoon = active.filter((c) => c.renews_on && c.renews_on.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const crew = new Set((jobs || []).flatMap((j) => j.job_assignments.map((a) => a.membership_id)));
  const onShift = new Set((jobs || []).filter((j) => j.started_at).flatMap((j) => j.job_assignments.map((a) => a.membership_id)));
  const missing = (jobs || []).filter(noPunch);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name || '';
  const months = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / (30.44 * 864e5)) : 0);
  const days = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : 999);

  const insights: Insight[] = [
    ...missing.map((j) => ({ id: `m-${j.id}`, kind: 'cover', title: t('com.noPunchT', { name: nameOf(j.job_assignments[0]?.membership_id || '').split(' ')[0] || t('c.unassigned'), site: j.clients?.name || '' }), detail: t('com.noPunchD', { time: hm(j.scheduled_start, lang) }), cta: t('com.cover'), act: () => { setTidy(false); setCover(j); } })),
    ...(jobs || []).filter((j) => j.start_inside_geofence === false).map((j) => ({ id: `g-${j.id}`, kind: 'punch', title: t('com.outsideT', { site: j.clients?.name || '' }), detail: t('com.outsideD', { m: j.start_distance_m ?? '?' }) })),
    ...active.filter((c) => days(c.renews_on) <= 30).map((c) => ({ id: `r-${c.id}`, kind: 'contract', title: t('tidy.renewT', { name: c.clients?.name || '', n: Math.max(0, days(c.renews_on)) }), detail: months(c.last_adjusted_on || c.starts_on) >= 12 ? t('tidy.renewD', { n: months(c.last_adjusted_on || c.starts_on) }) : undefined, to: '/app/contratos', toLabel: t('tidy.prepAdjust') })),
  ];
  const tone = (j: Job): [string, string, string, string] => {
    if (covered && j.id === cover?.id) return ['#E3F1EE', '#0B6B5F', '#0B7C6E', t('com.covered')];
    if (noPunch(j)) return ['#FDE8E6', '#9F1F14', '#C2412D', t('com.noPunch')];
    if (j.status === 'completed') return ['#E3F1EE', '#0B6B5F', '#0B7C6E', t('status.completed')];
    if (j.status === 'in_progress') return ['#FDF0DC', '#8A4B05', '#E0A341', t('status.in_progress')];
    return ['#EEF1F0', '#3E4F4C', '#B9C7C4', t('status.scheduled')];
  };
  const worked = (j: Job) => {
    const s = j.started_at ? new Date(j.started_at).getTime() : 0;
    const e = j.completed_at ? new Date(j.completed_at).getTime() : j.status === 'in_progress' ? now : s;
    return s ? Math.max(0, Math.round((e - s) / 60000)) : 0;
  };
  const sites = new Set((jobs || []).map((j) => j.property_id)).size;
  const first = (profile?.full_name || '').split(' ')[0];
  const shiftWord = new Date().getHours() >= 18 ? t('com.nightShift') : '';

  return (
    <div className="k-screen">
      <main className="k-page top20" style={{ gap: 16 }}>
        <TopBar sub={`${dateLine(lang)}${shiftWord ? ` · ${shiftWord}` : ''}`} name={`${greeting(t)}${first ? `, ${first}` : ''}`} pending={insights.length} onTidy={() => setTidy(true)} />
        <InstallCard />
        <TrialSoon />
        {missing[0] && !covered && (
          <div className="k-urgent" role="status">
            <Svg d={I.alert} size={18} color="#B8400C" />
            <span>{t('com.noPunchBar', { name: nameOf(missing[0].job_assignments[0]?.membership_id || '').split(' ')[0] || t('c.unassigned'), site: missing[0].clients?.name || '', time: hm(missing[0].scheduled_start, lang) })}</span>
            <button className="k-btn k-btn-sm k-btn-danger" onClick={() => setCover(missing[0])}>{t('com.cover')}</button>
          </div>
        )}
        {covered && <div className="k-okbar" role="status">{covered}</div>}
        <div className="k-kpis">
          <div className="k-kpi"><span className="k-kpi-l">{t('com.kContracts')}</span><span className="k-kpi-v">{active.length}</span><span className="k-kpi-n">{t('com.kRenew', { n: renewSoon })}</span></div>
          <div className="k-kpi"><span className="k-kpi-l">{t('com.kOnShift')}</span><span className="k-kpi-v" style={{ color: missing.length ? '#B8400C' : C.accent }}>{onShift.size}/{crew.size}</span><span className="k-kpi-n">{missing.length ? t('com.kMissing', { n: missing.length }) : t('com.kFull')}</span></div>
          <div className="k-kpi"><span className="k-kpi-l">{t('fin.margin')}</span><span className="k-kpi-v" style={{ color: C.accent }}>{margin == null ? '–' : `${Math.round(margin * 100)}%`}</span><span className="k-kpi-n">{t('com.kMonth')}</span></div>
        </div>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="k-sec"><span className="k-h2" style={{ textTransform: 'none', letterSpacing: 0, color: C.ink }}>{t('com.shifts')}</span><span className="k-s125 k-muted" style={{ fontWeight: 700 }}>{t('com.sites', { n: sites })}</span></div>
          {!jobs ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 16 }} />) : jobs.length === 0 ? <Empty title={t('home.freeDay')} text={t('com.noShifts')} /> : jobs.map((j) => {
            const [bg, fg, bar, label] = tone(j);
            const planned = jobMinutes(j), w = worked(j);
            return (
              <button key={j.id} onClick={() => setOpen(j)} className="k-card r16" style={{ borderLeft: `4px solid ${bar}`, gap: 8, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <span className="k-ell" style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>{j.clients?.name}</span>
                  <span className="k-pill" style={{ background: bg, color: fg }}>{label}</span>
                </div>
                <span className="k-s125 k-muted">{hm(j.scheduled_start, lang)}–{hm(j.scheduled_end, lang)} · {j.job_assignments.map((a) => shortName(nameOf(a.membership_id))).join(', ') || t('c.unassigned')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div className="k-track"><div style={{ width: `${Math.min(100, (w / planned) * 100)}%`, background: bar }} /></div>
                  <span className="k-s115 num" style={{ fontWeight: 800, color: '#3E4F4C' }}>{t('com.hoursOf', { a: dur(w).replace('min', '') === '0' ? '0h' : dur(w), b: dur(planned) })}</span>
                </div>
              </button>
            );
          })}
        </section>
      </main>
      <Fab to="/app/agenda/novo" label={t('home.newJob')} />
      <OwnerBar />
      {tidy && <TidySheet title={t('com.tidyTitle')} sub={`${t('c.today')} · ${t('tidy.pendingN', { n: insights.length })}`} items={insights} onClose={() => setTidy(false)} />}
      {cover && !covered && <CoverSheet job={cover} jobs={jobs || []} members={members} onClose={() => setCover(null)} tErr={tErr}
        onDone={(name) => { setCovered(t('com.coveredText', { name, site: cover.clients?.name || '' })); toast(t('c.saved')); load(); reloadBase(); }} />}
      {open && <JobSheet job={open} members={members} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function CoverSheet({ job, jobs, members, onClose, onDone, tErr }: { job: Job; jobs: Job[]; members: Member[]; onClose: () => void; onDone: (name: string) => void; tErr: (m?: string | null) => string }) {
  const { t, company, toast } = useApp();
  const options = useMemo(() => freeHelpers(job, jobs, members, job.job_assignments[0]?.membership_id || ''), [job, jobs, members]);
  const [pick, setPick] = useState(options[0]?.m.id || '');
  const chosen = options.find((o) => o.m.id === pick);
  const go = async () => {
    if (!chosen || !company) return;
    const absent = job.job_assignments[0]?.membership_id;
    if (absent) await supabase.from('job_assignments').delete().eq('job_id', job.id).eq('membership_id', absent);
    const { error } = await supabase.from('job_assignments').insert({ job_id: job.id, membership_id: chosen.m.id, company_id: company.id, is_lead: true });
    if (error) { toast(tErr(error.message)); return; }
    onDone(chosen.m.display_name.split(' ')[0]);
  };
  return (
    <Sheet title={t('com.coverTitle', { site: job.clients?.name || '' })} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted }}>{t('com.coverText')}</span>
      {options.length === 0 ? <span className="k-help">{t('com.noneFree')}</span> : options.slice(0, 4).map((o) => {
        const on = o.m.id === pick;
        return (
          <button key={o.m.id} aria-pressed={on} onClick={() => setPick(o.m.id)} style={{ minHeight: 60, textAlign: 'left', borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
            <Avatar name={o.m.display_name} color={colorOf(memberIndex(members, o.m.id))[0]} size={36} font={12} />
            <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14 }}>{shortName(o.m.display_name)}</span><span style={{ fontSize: 12, color: C.muted }}>{o.min != null ? t('com.freeMin', { n: o.min }) : t('com.freeNow')}</span></span>
          </button>
        );
      })}
      <SheetActions cancel={t('c.back')} onCancel={onClose} confirm={chosen ? t('com.notify', { name: chosen.m.display_name.split(' ')[0] }) : t('com.cover')} onConfirm={go} disabled={!chosen} />
    </Sheet>
  );
}

// ─────────────── Conta nova ───────────────
const STEP_KEY = 'tidyo.steps';
function FirstSteps({ members, clients, counts, trialEnds }: { members: Member[]; clients: Client[]; counts: { services: number; jobs: number }; trialEnds: string | null }) {
  const { t, company, profile } = useApp();
  const [manual, setManual] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem(STEP_KEY) || '{}'); } catch { return {}; } });
  const [tour, setTour] = useState(false);
  const payOk = Object.values((company?.payment_info || {}) as Record<string, string>).some(Boolean);
  const auto: Record<string, boolean> = { emp: !!manual.emp, cli: clients.length > 0, pre: counts.services > 0, pay: payOk, eq: members.length > 1, ag: counts.jobs > 0 };
  const steps: [string, string, string, string, string][] = [
    ['emp', t('fs.emp'), t('fs.empH'), t('fs.empC'), '/app/mais'],
    ['cli', t('fs.cli'), t('fs.cliH'), t('fs.cliC'), '/app/clientes/novo'],
    ['pre', t('fs.pre'), t('fs.preH'), t('fs.preC'), '/app/mais/precos'],
    ['pay', t('fs.pay'), t('fs.payH'), t('fs.payC'), '/app/mais/recebimento'],
    ['eq', t('fs.eq'), t('fs.eqH'), t('fs.eqC'), '/app/mais/equipe'],
    ['ag', t('fs.ag'), t('fs.agH'), t('fs.agC'), '/app/agenda/novo'],
  ];
  const isDone = (id: string) => manual[id] ?? auto[id];
  const toggle = (id: string) => { const n = { ...manual, [id]: !isDone(id) }; setManual(n); try { localStorage.setItem(STEP_KEY, JSON.stringify(n)); } catch { /* ignore */ } };
  const n = steps.filter(([id]) => isDone(id)).length;
  const pct = Math.round((n / steps.length) * 100);
  const left = trialEnds ? Math.max(0, Math.ceil((new Date(trialEnds).getTime() - Date.now()) / 864e5)) : null;
  const first = (profile?.full_name || '').split(' ')[0];
  return (
    <div className="k-screen">
      <main className="k-page top20" style={{ gap: 16 }}>
        <div className="k-hello">
          <LogoMark />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span className="k-date">{left != null ? t('fs.trialLeft', { n: left }) : company?.name}</span>
            <span className="k-name">{t('home.hello')}{first ? `, ${first}` : ''}</span>
          </div>
        </div>
        <InstallCard />
        <TrialSoon />
        <div className="k-card r20" style={{ gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <span className="k-h2">{t('steps.title')}</span>
              <span className="k-s125 k-muted">{t('fs.progress', { n })}</span>
            </div>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: C.accent }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 8, background: C.track, overflow: 'hidden' }}><div style={{ height: 8, width: `${pct}%`, background: C.accent, borderRadius: 8, transition: 'width .3s' }} /></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {steps.map(([id, title, hint, cta, to], i) => {
              const d = isDone(id);
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                  <button onClick={() => toggle(id)} aria-label={d ? t('fs.markPending', { s: title }) : t('fs.markDone', { s: title })} style={{ width: 44, height: 44, flex: 'none', borderRadius: 44, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 26, border: `2px solid ${d ? C.accent : '#B9C7C4'}`, background: d ? C.accent : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                      {d && <Svg d={I.check} size={14} color="#FFFFFF" w={3.2} />}
                    </span>
                  </button>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, textDecoration: d ? 'line-through' : 'none', color: d ? '#7A8C88' : C.ink }}>{title}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{hint}</span>
                  </span>
                  {!d && <Link to={to} className="k-btn k-btn-dark" style={{ flex: 'none', minHeight: 40, borderRadius: 11, padding: '0 12px', fontSize: 12.5 }}>{cta}</Link>}
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={() => setTour(true)} className="k-brand" style={{ flexDirection: 'row', alignItems: 'center', padding: 14, border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <span style={{ width: 64, height: 64, flex: 'none', borderRadius: 14, background: '#12302B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={I.play} size={26} fill={C.mint} /></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14.5, color: '#FFFFFF' }}>{t('fs.tour')}</span><span style={{ fontSize: 12.5, color: C.faint }}>{t('fs.tourSub')}</span></span>
        </button>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-h2">{t('home.agenda')}</span>
          <Empty title={t('fs.emptyT')} text={t('fs.emptyS')} action={<Link to="/app/agenda/novo" className="k-btn k-btn-fill" style={{ marginTop: 4, minHeight: 44, borderRadius: 13, fontSize: 13.5 }}>{t('fs.firstJob')}</Link>} />
        </section>
      </main>
      <OwnerBar />
      {tour && (
        <Sheet title={t('fs.tour')} onClose={() => setTour(false)}>
          <ol className="steps">
            {[1, 2, 3, 4].map((i) => <li key={i}><span className="step-n">{i}</span><span className="grow">{t(`fs.tour${i}`)}</span></li>)}
          </ol>
          <button className="k-btn k-btn-fill" onClick={() => setTour(false)}>{t('fs.tourGo')}</button>
        </Sheet>
      )}
    </div>
  );
}
