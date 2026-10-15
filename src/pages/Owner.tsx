import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Icon, LoadingList, Logo, OwnerNav, Sheet, Sparkle, StatusBadge, Segmented, Confirm } from '../components/ui';
import { ClientDetail, ClientForm, InvoiceForm, InviteForm, JobDetail, JobForm, PaymentForm } from '../components/forms';
import { findConflicts, getClients, getInvoicedJobIds, getInvoices, getJobs, getMembers, isOverdue, type Client, type Invoice, type Job, type Member } from '../lib/data';
import { addDays, dayLabel, longDay, money, startOfDay, time } from '../lib/format';
import { LANG_LABEL, type Lang } from '../lib/i18n';
import { FinanceTabs } from './Finance';
import { getContracts } from './Contracts';
import { Bell } from './Inbox';
import { AdSlot } from './Admin';

function useOwnerData() {
  const { company } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[] | null>(null);
  const reload = useCallback(async () => {
    if (!company) return;
    const [m, c] = await Promise.all([getMembers(company.id), getClients(company.id)]);
    setMembers(m); setClients(c);
  }, [company]);
  useEffect(() => { reload(); }, [reload]);
  return { members, clients, reload };
}

function JobRow({ job, members, onOpen }: { job: Job; members: Member[]; onOpen: () => void }) {
  const { lang, t } = useApp();
  const who = members.find((m) => m.id === job.job_assignments[0]?.membership_id)?.display_name || t('c.unassigned');
  return (
    <button className="item" onClick={onOpen}>
      <span className="time">{time(job.scheduled_start, lang)}</span>
      <span className="body">
        <span className="title">{job.clients?.name}</span>
        <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.properties?.city} · {who}</span>
      </span>
      <StatusBadge status={job.status} />
    </button>
  );
}

// ─────────────── Hoje ───────────────
type Insight = { tag: string; bg: string; fg: string; text: string; go: () => void };

export function Home() {
  const { t, lang, company, profile, sub } = useApp();
  const nav = useNavigate();
  const { members, clients, reload } = useOwnerData();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [soon, setSoon] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [uninvoiced, setUninvoiced] = useState(0);
  const [extra, setExtra] = useState<{ renewals: { name: string; n: number }[]; stale: { name: string; n: number }[]; outside: number; pendingExp: number }>({ renewals: [], stale: [], outside: 0, pendingExp: 0 });
  const [open, setOpen] = useState<Job | null>(null);
  const [newJob, setNewJob] = useState(false);
  const [newClient, setNewClient] = useState(false);
  const [tidy, setTidy] = useState(false);
  const [invite, setInvite] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    const today = startOfDay(new Date());
    const [j, s, inv, invoiced, recent] = await Promise.all([
      getJobs(company.id, today, addDays(today, 1)),
      getJobs(company.id, today, addDays(today, 2)),
      getInvoices(company.id),
      getInvoicedJobIds(company.id),
      getJobs(company.id, addDays(today, -30), addDays(today, 1)),
    ]);
    setJobs(j); setSoon(s); setInvoices(inv);
    setUninvoiced(recent.filter((x) => x.status === 'completed' && x.price_cents > 0 && !invoiced.has(x.id)).length);
    const week = addDays(today, -7);
    const [cts, exp] = await Promise.all([
      company.mode !== 'residential' ? getContracts(company.id) : Promise.resolve([]),
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending'),
    ]);
    const active = cts.filter((c) => c.status === 'active');
    const days = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : 999);
    const months = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / (30.44 * 864e5)) : 0);
    setExtra({
      renewals: active.filter((c) => days(c.renews_on) <= 30).map((c) => ({ name: c.clients?.name || '', n: Math.max(0, days(c.renews_on)) })),
      stale: active.filter((c) => months(c.last_adjusted_on || c.starts_on) >= 12).map((c) => ({ name: c.clients?.name || '', n: months(c.last_adjusted_on || c.starts_on) })),
      outside: recent.filter((x) => x.start_inside_geofence === false && new Date(x.scheduled_start) >= week).length,
      pendingExp: exp.count || 0,
    });
  }, [company]);
  useEffect(() => { load(); }, [load]);

  const receivable = invoices.filter((i) => i.status === 'open').reduce((s, i) => s + i.total_cents - i.paid_cents, 0);
  const overdue = invoices.filter(isOverdue);
  const conflicts = jobs ? findConflicts(jobs) : [];
  const unassigned = soon.filter((j) => j.status === 'scheduled' && j.job_assignments.length === 0);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name || '';

  const insights: Insight[] = [
    ...conflicts.slice(0, 3).map((c) => ({ tag: t('tidy.conflict'), bg: '#5A2416', fg: '#FFB59C', text: t('tidy.conflictText', { name: nameOf(c.memberId), time: time(c.b.scheduled_start, lang) }), go: () => { setTidy(false); setOpen(c.b); } })),
    ...(unassigned.length ? [{ tag: t('tidy.unassigned'), bg: '#4A3510', fg: '#F5C66B', text: t('tidy.unassignedText', { n: unassigned.length }), go: () => { setTidy(false); setOpen(unassigned[0]); } }] : []),
    ...(overdue.length ? [{ tag: t('tidy.overdue'), bg: '#4A1A1A', fg: '#FF9C9C', text: t('tidy.overdueText', { n: overdue.length, amount: money(overdue.reduce((s, i) => s + i.total_cents - i.paid_cents, 0), lang) }), go: () => nav('/app/cobrancas') }] : []),
    ...extra.renewals.map((r) => ({ tag: t('tidy.renewal'), bg: '#4A3510', fg: '#F5C66B', text: t('tidy.renewalText', { name: r.name, n: r.n }), go: () => nav('/app/contratos') })),
    ...extra.stale.map((r) => ({ tag: t('tidy.renewal'), bg: '#4A3510', fg: '#F5C66B', text: t('tidy.adjustText', { name: r.name, n: r.n }), go: () => nav('/app/contratos') })),
    ...(extra.outside ? [{ tag: 'GPS', bg: '#5A2416', fg: '#FFB59C', text: t('tidy.geoText', { n: extra.outside }), go: () => nav('/app/agenda') }] : []),
    ...(extra.pendingExp ? [{ tag: t('tidy.review'), bg: '#173F3A', fg: '#5FD4C1', text: t('tidy.reviewText', { n: extra.pendingExp }), go: () => nav('/app/financas/despesas') }] : []),
    ...(uninvoiced ? [{ tag: t('tidy.uninvoiced'), bg: '#173F3A', fg: '#5FD4C1', text: t('tidy.uninvoicedText', { n: uninvoiced }), go: () => nav('/app/agenda') }] : []),
  ];

  const steps = [
    { done: (clients?.length || 0) > 0, label: t('steps.client'), go: () => setNewClient(true) },
    { done: soon.length > 0 || (jobs?.length || 0) > 0, label: t('steps.job'), go: () => setNewJob(true) },
    { done: members.length > 1, label: t('steps.team'), go: () => setInvite(true) },
    { done: invoices.length > 0, label: t('steps.invoice'), go: () => nav('/app/cobrancas') },
  ];
  const showSteps = steps.some((s) => !s.done);
  const first = (profile?.full_name || '').split(' ')[0];

  return (
    <div className="shell">
      <main className="page">
        <div className="topbar">
          <Logo size={38} />
          <div className="grow">
            <div className="small muted bold">{longDay(new Date(), lang)}</div>
            <h1 style={{ fontSize: 21 }}>{t('home.hello')}{first ? `, ${first}` : ''}</h1>
          </div>
          <Bell />
          <button className="icon-btn dark" onClick={() => setTidy(true)} aria-label={`Tidy · ${insights.length}`}>
            <Sparkle size={18} />
            {insights.length > 0 && <span className="count">{insights.length}</span>}
          </button>
        </div>

        {conflicts.length > 0 && (
          <button className="strip" onClick={() => setOpen(conflicts[0].b)} style={{ cursor: 'pointer', textAlign: 'left' }}>
            <Icon name="alert" size={18} /><span style={{ flex: 1 }}>{t('tidy.conflictText', { name: nameOf(conflicts[0].memberId), time: time(conflicts[0].b.scheduled_start, lang) })}</span>
          </button>
        )}

        <AdSlot />
        {sub?.status === 'trialing' && (
          <div className="small muted">{t('home.trial')} {new Date(sub.trial_ends_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</div>
        )}

        <div className="grid3">
          <div className="kpi"><div className="label">{t('home.jobsToday')}</div><div className="value num">{jobs ? jobs.filter((j) => j.status !== 'canceled').length : '–'}</div></div>
          <div className="kpi"><div className="label">{t('home.receivable')}</div><div className="value num" style={{ fontSize: 18 }}>{money(receivable, lang)}</div></div>
          <div className="kpi"><div className="label">{t('home.clients')}</div><div className="value num">{clients ? clients.length : '–'}</div></div>
        </div>

        {showSteps && clients && (
          <section className="card stack" aria-labelledby="steps-h">
            <h2 id="steps-h">{t('steps.title')}</h2>
            {steps.map((s) => (
              <button key={s.label} className="row" onClick={s.go} disabled={s.done}
                style={{ minHeight: 44, border: 0, background: 'none', textAlign: 'left', cursor: s.done ? 'default' : 'pointer', padding: 0 }}>
                <span style={{ width: 24, height: 24, borderRadius: 24, flex: 'none', border: s.done ? 0 : '2px solid var(--line-strong)', background: s.done ? 'var(--action)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {s.done && <Icon name="check" size={14} color="#fff" stroke={3} />}
                </span>
                <span style={{ flex: 1, fontWeight: 700, textDecoration: s.done ? 'line-through' : 'none', color: s.done ? 'var(--ink-muted)' : 'inherit' }}>{s.label}</span>
                {!s.done && <Icon name="chevR" size={18} color="var(--ink-muted)" />}
              </button>
            ))}
          </section>
        )}

        <section className="stack" aria-labelledby="agenda-h">
          <div className="row"><h2 id="agenda-h" style={{ flex: 1 }}>{t('home.agenda')}</h2>
            <button className="btn btn-ghost" onClick={() => setNewJob(true)}><Icon name="plus" size={18} />{t('home.newJob')}</button>
          </div>
          {!jobs ? <LoadingList /> : jobs.length === 0 ? (
            <div className="empty"><span>{t('home.noJobs')}</span></div>
          ) : (
            <div className="list">{jobs.map((j) => <JobRow key={j.id} job={j} members={members} onOpen={() => setOpen(j)} />)}</div>
          )}
        </section>
      </main>
      <OwnerNav />

      {tidy && (
        <Sheet title={t('tidy.title')} onClose={() => setTidy(false)} dark>
          {insights.length === 0 ? <p style={{ margin: 0, color: '#9DB5B0' }}>{t('tidy.none')}</p> : insights.map((i, n) => (
            <div key={n} className="tidy-item">
              <span className="tag" style={{ background: i.bg, color: i.fg }}>{i.tag}</span>
              <div className="row"><span style={{ flex: 1, fontWeight: 700 }}>{i.text}</span>
                <button className="btn" style={{ background: '#5FD4C1', color: '#0A3D35', minHeight: 40 }} onClick={i.go}>{t('tidy.open')}</button>
              </div>
            </div>
          ))}
        </Sheet>
      )}
      {open && <JobDetail job={open} members={members} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
      {newJob && clients && <JobForm clients={clients} members={members} onClose={() => setNewJob(false)} onSaved={() => { setNewJob(false); load(); }} />}
      {newClient && <ClientForm onClose={() => setNewClient(false)} onSaved={() => { setNewClient(false); reload(); }} />}
      {invite && <InviteForm onClose={() => setInvite(false)} onSaved={reload} />}
    </div>
  );
}

// ─────────────── Agenda ───────────────
export function Schedule() {
  const { t, lang, company } = useApp();
  const { members, clients } = useOwnerData();
  const [day, setDay] = useState(startOfDay(new Date()));
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [open, setOpen] = useState<Job | null>(null);
  const [newJob, setNewJob] = useState(false);
  const [who, setWho] = useState('all');

  const load = useCallback(async () => {
    if (!company) return;
    setJobs(null);
    setJobs(await getJobs(company.id, day, addDays(day, 1)));
  }, [company, day]);
  useEffect(() => { load(); }, [load]);

  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i - 1));
  const shown = (jobs || []).filter((j) => who === 'all' || (who === 'none' ? j.job_assignments.length === 0 : j.job_assignments.some((a) => a.membership_id === who)));

  return (
    <div className="shell">
      <main className="page">
        <div className="topbar">
          <h1 className="grow">{t('nav.schedule')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setNewJob(true)}><Icon name="plus" size={18} />{t('home.newJob')}</button>
        </div>
        <div className="row">
          <button className="icon-btn" aria-label="‹" onClick={() => setDay(addDays(day, -1))}><Icon name="chevL" size={18} /></button>
          <div className="chips" style={{ flex: 1 }}>
            {week.map((d) => (
              <button key={d.toISOString()} className="chip" aria-pressed={d.getTime() === day.getTime()} onClick={() => setDay(d)}>{dayLabel(d, lang)}</button>
            ))}
          </div>
          <button className="icon-btn" aria-label="›" onClick={() => setDay(addDays(day, 1))}><Icon name="chevR" size={18} /></button>
        </div>
        <div className="chips" role="group" aria-label={t('job.helper')}>
          <button className="chip" aria-pressed={who === 'all'} onClick={() => setWho('all')}>{t('inv.all')}</button>
          {members.filter((m) => m.status === 'active').map((m) => <button key={m.id} className="chip" aria-pressed={who === m.id} onClick={() => setWho(m.id)}>{m.display_name}</button>)}
          <button className="chip" aria-pressed={who === 'none'} onClick={() => setWho('none')}>{t('c.unassigned')}</button>
        </div>
        <h2>{longDay(day, lang)}</h2>
        {!jobs ? <LoadingList /> : shown.length === 0 ? <div className="empty">{t('home.noJobs')}</div> : (
          <div className="list">{shown.map((j) => <JobRow key={j.id} job={j} members={members} onOpen={() => setOpen(j)} />)}</div>
        )}
      </main>
      <OwnerNav />
      {open && <JobDetail job={open} members={members} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
      {newJob && clients && <JobForm clients={clients} members={members} defaultDate={day} onClose={() => setNewJob(false)} onSaved={() => { setNewJob(false); load(); }} />}
    </div>
  );
}

// ─────────────── Clientes ───────────────
export function Clients() {
  const { t } = useApp();
  const { clients, reload } = useOwnerData();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [open, setOpen] = useState<Client | null>(null);
  const [create, setCreate] = useState(false);
  const shown = useMemo(() => (clients || []).filter((c) =>
    (kind === 'all' || c.kind === kind) &&
    (!q || `${c.name} ${c.properties.map((p) => p.address_line1 + ' ' + p.city).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [clients, q, kind]);
  return (
    <div className="shell">
      <main className="page">
        <div className="topbar">
          <h1 className="grow">{t('nav.clients')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setCreate(true)}><Icon name="plus" size={18} />{t('cl.new')}</button>
        </div>
        <label className="row card tight" style={{ padding: '0 12px' }}>
          <Icon name="search" size={18} color="var(--ink-muted)" />
          <span className="sr-only">{t('c.search')}</span>
          <input className="input" style={{ border: 0, boxShadow: 'none', padding: 0 }} placeholder={t('c.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chips">
          {[['all', t('inv.all')], ['residential', t('cl.res')], ['commercial', t('cl.com')]].map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>
          ))}
        </div>
        {!clients ? <LoadingList /> : shown.length === 0 ? (
          <div className="empty"><span>{t('cl.empty')}</span><button className="btn btn-secondary" onClick={() => setCreate(true)}>{t('cl.new')}</button></div>
        ) : (
          <div className="list">
            {shown.map((c) => (
              <button key={c.id} className="item" onClick={() => setOpen(c)}>
                <span style={{ width: 40, height: 40, borderRadius: 40, background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: 'none' }}>{c.name.slice(0, 1).toUpperCase()}</span>
                <span className="body"><span className="title">{c.name}</span><span className="small muted">{c.properties[0] ? `${c.properties[0].address_line1}, ${c.properties[0].city}` : ''}</span></span>
                <span className="badge b-neutral">{c.kind === 'commercial' ? t('cl.com') : t('cl.res')}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <OwnerNav />
      {open && <ClientDetail client={open} onClose={() => setOpen(null)} />}
      {create && <ClientForm onClose={() => setCreate(false)} onSaved={() => { setCreate(false); reload(); }} />}
    </div>
  );
}

// ─────────────── Cobranças ───────────────
export function Billing() {
  const { t, lang, company } = useApp();
  const { clients } = useOwnerData();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [tab, setTab] = useState<'open' | 'overdue' | 'paid' | 'all'>('open');
  const [create, setCreate] = useState(false);
  const [pay, setPay] = useState<Invoice | null>(null);
  const load = useCallback(async () => { if (company) setInvoices(await getInvoices(company.id)); }, [company]);
  useEffect(() => { load(); }, [load]);
  const list = (invoices || []).filter((i) => tab === 'all' || (tab === 'overdue' ? isOverdue(i) : tab === 'open' ? i.status === 'open' : i.status === 'paid'));
  const totalOpen = (invoices || []).filter((i) => i.status === 'open').reduce((s, i) => s + i.total_cents - i.paid_cents, 0);
  const totalOver = (invoices || []).filter(isOverdue).reduce((s, i) => s + i.total_cents - i.paid_cents, 0);
  return (
    <div className="shell">
      <main className="page">
        <div className="topbar">
          <h1 className="grow">{t('nav.finance')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setCreate(true)}><Icon name="plus" size={18} />{t('inv.new')}</button>
        </div>
        <FinanceTabs />
        <div className="grid2">
          <div className="kpi"><div className="label">{t('inv.open')}</div><div className="value num">{money(totalOpen, lang)}</div></div>
          <div className="kpi" style={totalOver ? { background: 'var(--danger-bg)', borderColor: '#F5D3C2' } : undefined}><div className="label">{t('inv.overdue')}</div><div className="value num">{money(totalOver, lang)}</div></div>
        </div>
        <Segmented value={tab} onChange={setTab} label={t('inv.title')} options={[
          { value: 'open', label: t('inv.open') }, { value: 'overdue', label: t('inv.overdue') }, { value: 'paid', label: t('inv.paid') }, { value: 'all', label: t('inv.all') },
        ]} />
        {!invoices ? <LoadingList /> : list.length === 0 ? <div className="empty">{t('inv.empty')}</div> : (
          <div className="list">
            {list.map((i) => {
              const over = isOverdue(i);
              const label = over ? t('inv.status.overdue') : t(`inv.status.${i.status}`);
              return (
                <div key={i.id} className="item" style={{ cursor: 'default' }}>
                  <span className="body">
                    <span className="title">{i.clients?.name}</span>
                    <span className="small muted">{i.number}{i.due_on ? ` · ${t('inv.due')} ${new Date(i.due_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' })}` : ''}</span>
                  </span>
                  <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className="bold num">{money(i.total_cents, lang)}</span>
                    <span className={`badge ${i.status === 'paid' ? 'b-ok' : over ? 'b-danger' : 'b-neutral'}`}>{label}</span>
                  </span>
                  {i.status === 'open' && <button className="btn btn-secondary" style={{ minHeight: 40, padding: '0 10px', fontSize: 13 }} onClick={() => setPay(i)}>{t('inv.markPaid')}</button>}
                </div>
              );
            })}
          </div>
        )}
        <p className="hint" style={{ margin: 0 }}>{t('inv.stripeSoon')}</p>
      </main>
      <OwnerNav />
      {create && clients && <InvoiceForm clients={clients} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
      {pay && <PaymentForm invoice={pay} onClose={() => setPay(null)} onSaved={() => { setPay(null); load(); }} />}
    </div>
  );
}

// ─────────────── Mais ───────────────
export function More() {
  const { t, lang, setLang, company, membership, sub, refresh, toast, isAdmin } = useApp();
  const { members, reload } = useOwnerData();
  const [invite, setInvite] = useState(false);
  const [askOut, setAskOut] = useState(false);
  const isOwner = membership?.role === 'owner';
  const toggle = async (field: 'allow_push_team' | 'allow_push_clients') => {
    if (!company) return;
    const { error } = await supabase.from('companies').update({ [field]: !company[field] }).eq('id', company.id);
    if (!error) { await refresh(); toast(t('c.saved')); }
  };
  const roleLabel = (r: string) => t(`team.${r}`);
  return (
    <div className="shell">
      <main className="page">
        <h1>{t('more.title')}</h1>
        <section className="card stack">
          <div className="row"><Icon name="building" /><div className="grow"><div className="bold">{company?.name}</div>
            <div className="small muted">{t('more.plan')}: {sub?.plan === 'essencial' ? 'Essencial' : sub?.plan === 'comercial' ? 'Comercial' : 'Pro'}{sub?.has_commercial && sub.plan !== 'comercial' ? ' + Comercial' : ''} · {sub?.status === 'trialing' ? `${t('home.trial')} ${new Date(sub.trial_ends_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}` : sub?.status}</div></div></div>
        </section>

        {company?.mode !== 'residential' && (
          <Link to="/app/contratos" className="item" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="building" /><span className="body"><span className="title">{t('ct.title')}</span><span className="small muted">{t('ins.title')}</span></span><Icon name="chevR" size={18} />
          </Link>
        )}
        <section className="stack" aria-labelledby="team-h">
          <div className="row"><h2 id="team-h" style={{ flex: 1 }}>{t('more.team')}</h2>
            <button className="btn btn-ghost" onClick={() => setInvite(true)}><Icon name="plus" size={18} />{t('team.invite')}</button></div>
          <div className="list">
            {members.map((m) => (
              <div key={m.id} className="item" style={{ cursor: 'default' }}>
                <span style={{ width: 38, height: 38, borderRadius: 38, background: 'var(--brand-dark)', color: '#5FD4C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: 'none' }}>{m.display_name.slice(0, 1).toUpperCase()}</span>
                <span className="body"><span className="title">{m.display_name}</span><span className="small muted">{roleLabel(m.role)} · {LANG_LABEL[m.language as Lang]}</span></span>
                <span className={`badge ${m.status === 'active' ? 'b-ok' : 'b-warn'}`}>{m.status === 'active' ? t('team.active') : t('team.invited')}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <span className="label">{t('more.lang')}</span>
          <Segmented<Lang> value={lang} onChange={setLang} label={t('more.lang')} options={(['pt-BR', 'en', 'es'] as Lang[]).map((l) => ({ value: l, label: LANG_LABEL[l] }))} />
        </section>

        {isOwner && (
          <section className="card stack">
            {(['allow_push_team', 'allow_push_clients'] as const).map((f) => (
              <label key={f} className="row" style={{ minHeight: 44, cursor: 'pointer' }}>
                <span className="grow"><span className="bold">{t(f === 'allow_push_team' ? 'more.pushTeam' : 'more.pushClients')}</span><br /><span className="small muted">{t('more.pushHint')}</span></span>
                <input type="checkbox" role="switch" checked={!!company?.[f]} onChange={() => toggle(f)} style={{ width: 22, height: 22, accentColor: 'var(--action)' }} />
              </label>
            ))}
          </section>
        )}

        <section className="card stack">
          <div className="row"><Icon name="help" /><span className="bold grow">{t('more.help')}</span></div>
          <span className="small muted">{t('more.helpText')}</span>
          <Link className="btn btn-secondary" to="/ajuda">{t('hp.newTicket')}</Link>
        </section>

        {isAdmin && <Link className="btn btn-secondary" to="/admin"><Icon name="building" size={18} />{t('ad.open')}</Link>}
        <button className="btn btn-secondary" onClick={() => setAskOut(true)}><Icon name="logout" size={18} />{t('auth.signout')}</button>
        <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>Tidyo 0.1 · <Link to="/dia">{t('nav.myDay')}</Link></p>
      </main>
      <OwnerNav />
      {invite && <InviteForm onClose={() => setInvite(false)} onSaved={reload} />}
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)}
        onConfirm={async () => { await supabase.auth.signOut(); window.location.replace('/'); }} />}
    </div>
  );
}
