// Client portal (canvas "PortalCliente"): next cleaning, last visit with proof and rating, invoices, contract and requests
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { useTaskLabel } from '../components/proof';
import { C, I, Svg, initials, usd } from '../components/kit';
import { InstallCard } from '../components/InstallCard';
import { getChecklist, getJobPhotos, type CheckItem, type Photo } from '../lib/photos';
import { invoicePdf, shareFile, type PaymentInfo } from '../lib/invoicePdf';
import type { Lang } from '../lib/i18n';

const NAVY = '#1C3D8F';
type PJob = { id: string; status: string; scheduled_start: string; scheduled_end: string; completed_at: string | null; completion_note: string | null; rating_status: string; rating: number | null; rating_comment: string | null; rating_due_at: string | null; price_cents: number };
type PInv = { id: string; number: string; status: string; issued_on: string | null; due_on: string | null; total_cents: number; paid_cents: number };
type PCo = { company_id: string; name: string; logo_path: string | null; phone: string | null; payment_info: PaymentInfo };
type Req = { id: string; kind: string; body: string; status: string; created_at: string };
type Contract = { id: string; status: string; monthly_value_cents: number; hours_per_week: number | null; starts_on: string | null; renews_on: string | null; walkthrough: { weekdays?: number[]; after?: string; sqft?: number; rooms?: number; baths?: number; floors?: string[]; per_visit_cents?: number } };
type Visit = { started_at: string | null; completed_at: string | null; team: string[] };

const canRate = (j: PJob) => j.status === 'completed' && j.rating_status === 'pending' && !!j.rating_due_at && new Date(j.rating_due_at) > new Date();
const REQ_ST: Record<string, [string, string]> = { sent: ['#FDF0DC', '#8A4B05'], scheduled: ['#E3EAFB', NAVY], done: ['#DDF1EC', '#0B6B5F'], declined: ['#EEF1F0', '#3E4F4C'] };

export default function Portal() {
  const { t, lang, setLang, portal, session, toast, tErr } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<'visits' | 'invoices' | 'contract' | 'requests'>('visits');
  const [jobs, setJobs] = useState<PJob[] | null>(null);
  const [invoices, setInvoices] = useState<PInv[]>([]);
  const [co, setCo] = useState<PCo | null>(null);
  const [me, setMe] = useState<{ contact_name: string | null; email: string | null } | null>(null);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [contract, setContract] = useState<Contract | null>(null);
  const [req, setReq] = useState(false);
  const [open, setOpen] = useState<PJob | null>(null);
  const [past, setPast] = useState(false);
  const [askOut, setAskOut] = useState(false);

  const load = useCallback(async () => {
    const [{ data: j }, { data: inv }, { data: c }, { data: m }, { data: r }, { data: k }] = await Promise.all([
      supabase.rpc('portal_jobs'),
      supabase.from('invoices').select('id, number, status, issued_on, due_on, total_cents, paid_cents').neq('status', 'void').order('created_at', { ascending: false }).limit(24),
      supabase.rpc('portal_company'),
      supabase.rpc('portal_me'),
      supabase.from('client_requests').select('id, kind, body, status, created_at').order('created_at', { ascending: false }).limit(30),
      supabase.from('contracts').select('id, status, monthly_value_cents, hours_per_week, starts_on, renews_on, walkthrough').in('status', ['active', 'proposal']).order('created_at', { ascending: false }).limit(1),
    ]);
    setJobs((j || []) as PJob[]);
    setInvoices((inv || []) as PInv[]);
    setCo(((c || []) as PCo[])[0] || null);
    setMe(((m || []) as { contact_name: string | null; email: string | null }[])[0] || null);
    setReqs((r || []) as Req[]);
    setContract(((k || []) as Contract[])[0] || null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const upcoming = useMemo(() => (jobs || []).filter((j) => j.status === 'scheduled' && +new Date(j.scheduled_end) >= now).sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start)), [jobs, now]);
  const done = useMemo(() => (jobs || []).filter((j) => j.status === 'completed').sort((a, b) => (b.completed_at || b.scheduled_start).localeCompare(a.completed_at || a.scheduled_start)), [jobs]);
  const next = upcoming[0];
  const last = done[0];
  const company = co?.name || portal?.company_name || '';

  const messageUs = async () => {
    if (!portal) return;
    const { data } = await supabase.rpc('chat_contacts', { p_company: portal.company_id });
    const owner = ((data || []) as { user_id: string; kind: string }[]).find((x) => x.kind === 'owner') || ((data || []) as { user_id: string }[])[0];
    if (!owner) { nav('/mensagens'); return; }
    const { data: cid, error } = await supabase.rpc('open_conversation', { p_company: portal.company_id, p_with: owner.user_id });
    if (error) toast(tErr(error.message)); else nav(`/mensagens/${cid}`);
  };

  const whenBig = (iso: string) => {
    const d = new Date(iso), today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 864e5);
    const time = d.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' });
    if (diff === 0) return t(d.getHours() >= 17 ? 'po.tonight' : 'po.today', { t: time });
    if (diff === 1) return t('po.tomorrow', { t: time });
    const w = d.toLocaleDateString(lang, { weekday: 'long' });
    return `${w.charAt(0).toUpperCase() + w.slice(1)}, ${time}`;
  };
  const dayShort = (iso: string) => new Date(iso).toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' }).replace(/\./g, '');
  const mins = (j: PJob) => Math.round((+new Date(j.scheduled_end) - +new Date(j.scheduled_start)) / 60000);
  const about = (m: number) => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r} min`; };

  const tabs: [typeof tab, string][] = [['visits', t('po.visits')], ['invoices', t('po.invoices')], ...(contract ? [['contract', t('po.contract')] as [typeof tab, string]] : []), ['requests', t('po.requests')]];

  return (
    <div className="k-screen">
      <main className="k-page nobar" style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: NAVY, color: '#FFFFFF', fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(company)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</span>
            <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{portal?.name} · {t('po.portal')}</span>
          </div>
          <div role="group" aria-label={t('po.lang')} style={{ display: 'flex', gap: 2, background: '#E4ECEA', borderRadius: 10, padding: 3, flex: 'none' }}>
            {([['en', 'EN'], ['es', 'ES'], ['pt-BR', 'PT']] as [Lang, string][]).map(([l, label]) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} style={{ minWidth: 34, minHeight: 32, borderRadius: 8, border: 0, background: lang === l ? '#FFFFFF' : 'transparent', color: lang === l ? C.ink : C.muted, fontWeight: 800, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
            ))}
          </div>
        </div>
        <InstallCard />

        <div style={{ background: NAVY, color: '#FFFFFF', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B9CBF5' }}>{t('po.next')}</span>
          {jobs === null ? <div className="skeleton" style={{ height: 48, borderRadius: 12, opacity: 0.3 }} /> : next ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{whenBig(next.scheduled_start)}</span>
              <span style={{ fontSize: 13, color: '#D5E0FA' }}>{dayShort(next.scheduled_start)} · {t('po.about', { d: about(mins(next)) })}</span>
            </div>
          ) : <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 700 }}>{t('pt.none')}</span>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setReq(true)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 0, background: '#FFFFFF', color: NAVY, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t('po.addRequest')}</button>
            <button onClick={messageUs} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: '1px solid #5774C2', background: 'transparent', color: '#FFFFFF', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t('po.message')}</button>
          </div>
        </div>

        <div role="tablist" aria-label={t('ce.sections')} style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`, background: '#E4ECEA', borderRadius: 14, padding: 4, gap: 4 }}>
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ minHeight: 40, borderRadius: 11, border: 0, background: tab === id ? '#FFFFFF' : 'transparent', color: tab === id ? C.ink : C.muted, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', padding: 0, fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</button>
          ))}
        </div>

        {tab === 'visits' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs === null ? <div className="skeleton" style={{ height: 260, borderRadius: 18 }} /> : last ? <LastVisit job={last} company={company} onOpen={() => setOpen(last)} onRated={load} /> : (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, fontSize: 13.5, color: C.muted }}>{t('po.noVisits')}</div>
            )}
            {upcoming.length > 1 && (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 14px' }}>
                {upcoming.slice(1, 5).map((u, i) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, borderTop: i ? '1px solid #EEF2F1' : 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5, width: 96, flex: 'none' }}>{dayShort(u.scheduled_start)}</span>
                    <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{new Date(u.scheduled_start).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' })} · {about(mins(u))}</span>
                  </div>
                ))}
              </div>
            )}
            {done.length > 1 && <button className="k-btn k-btn-line" onClick={() => setPast(true)}>{t('po.earlier', { n: done.length - 1 })}</button>}
          </div>
        )}

        {tab === 'invoices' && <InvoicesTab invoices={invoices} co={co} client={portal?.name || ''} email={me?.email || null} />}

        {tab === 'contract' && contract && (
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 14px' }}>
            {(() => {
              const w = contract.walkthrough || {};
              const days = (w.weekdays || []).map((d) => new Date(2023, 0, 1 + d).toLocaleDateString(lang, { weekday: 'short' }).replace('.', '')).join(', ');
              const after = w.after ? new Date(`2023-01-01T${w.after}`).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) : '';
              const fmt = (d: string | null) => (d ? new Date(d + 'T12:00').toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
              const rows: [string, string][] = [
                [t('po.schedule'), [days, after ? t('po.after', { t: after }) : ''].filter(Boolean).join(' · ')],
                [t('po.scope'), [w.sqft ? `${w.sqft.toLocaleString('en-US')} sq ft` : '', w.rooms ? t('po.rooms', { n: w.rooms }) : '', w.baths ? t('po.baths', { n: w.baths }) : ''].filter(Boolean).join(' · ')],
                [t('po.price'), w.per_visit_cents ? `${t('po.perVisit', { v: usd(w.per_visit_cents, true) })} · ${t('po.monthly')}` : `${usd(contract.monthly_value_cents, true)} ${t('po.perMonth')}`],
                [t('po.term'), [fmt(contract.starts_on), fmt(contract.renews_on)].filter(Boolean).join(' – ')],
                [t('po.status'), contract.status === 'active' ? t('po.active') : t('po.proposal')],
                ...(me?.contact_name ? [[t('po.onSite'), me.contact_name] as [string, string]] : []),
              ].filter(([, v]) => v) as [string, string][];
              return rows.map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i ? '1px solid #EEF2F1' : 0 }}>
                  <span style={{ fontSize: 12.5, color: C.muted, width: 104, flex: 'none' }}>{k}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1, lineHeight: 1.45 }}>{v}</span>
                </div>
              ));
            })()}
          </div>
        )}

        {tab === 'requests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reqs.length > 0 ? (
              <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 14px' }}>
                {reqs.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? '1px solid #EEF2F1' : 0 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(`po.rk.${r.kind}`)}: {r.body}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{t('po.requested', { d: new Date(r.created_at).toLocaleDateString(lang, { month: 'short', day: 'numeric' }) })}</span>
                    </span>
                    <span className="nw" style={{ fontSize: 11.5, fontWeight: 800, borderRadius: 999, padding: '3px 9px', background: REQ_ST[r.status][0], color: REQ_ST[r.status][1] }}>{t(`po.rs.${r.status}`)}</span>
                  </div>
                ))}
              </div>
            ) : <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, fontSize: 13.5, color: C.muted }}>{t('po.noRequests')}</div>}
            <button onClick={() => setReq(true)} style={{ minHeight: 50, borderRadius: 14, border: 0, background: NAVY, color: '#FFFFFF', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', fontFamily: 'inherit' }}>{t('po.newRequest')}</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>Powered by Tidyo</span>
          <button onClick={() => setAskOut(true)} style={{ background: 'none', border: 0, color: C.muted, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', minHeight: 32, fontFamily: 'inherit', textDecoration: 'underline' }}>{t('auth.signout')}</button>
        </div>
      </main>

      {req && portal && session && <RequestSheet company={company} onClose={() => setReq(false)} onSent={() => { setReq(false); setTab('requests'); load(); }} />}
      {open && <VisitSheet job={open} onClose={() => setOpen(null)} onRated={() => { setOpen(null); load(); }} />}
      {past && (
        <Sheet title={t('pt.past')} onClose={() => setPast(false)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {done.slice(1).map((j, i) => (
              <button key={j.id} onClick={() => { setPast(false); setOpen(j); }} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, border: 0, borderTop: i ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, padding: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{dayShort(j.scheduled_start)}</span>
                <span style={{ fontSize: 13, color: '#F2A900', letterSpacing: 1 }}>{j.rating ? '★'.repeat(j.rating) : ''}</span>
                <Svg d={I.chev} size={16} color={C.muted} />
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)} onConfirm={async () => { await supabase.auth.signOut(); window.location.replace('/'); }} />}
    </div>
  );
}

function Stars({ value, onPick, size = 44 }: { value: number; onPick?: (n: number) => void; size?: number }) {
  const { t } = useApp();
  return (
    <div style={{ display: 'flex', gap: 6 }} role={onPick ? 'radiogroup' : 'img'} aria-label={t('pt.stars', { n: value })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onPick} onClick={() => onPick?.(n)} aria-label={t('po.rateN', { n })}
          style={{ width: size, height: size, borderRadius: 12, border: `1px solid ${C.line}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onPick ? 'pointer' : 'default', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={n <= value ? '#F2A900' : 'none'} stroke={n <= value ? '#F2A900' : '#9AA9A6'} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
        </button>
      ))}
    </div>
  );
}

function useVisit(id: string) {
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [visit, setVisit] = useState<Visit | null>(null);
  useEffect(() => {
    getChecklist(id).then(setItems).catch(() => setItems([]));
    getJobPhotos(id).then(setPhotos).catch(() => undefined);
    supabase.rpc('portal_visit', { p_job: id }).then(({ data }) => setVisit(((data || []) as Visit[])[0] || null));
  }, [id]);
  return { items, photos, visit };
}

function LastVisit({ job, company, onOpen, onRated }: { job: PJob; company: string; onOpen: () => void; onRated: () => void }) {
  const { t, lang, toast, tErr } = useApp();
  const label = useTaskLabel();
  const { items, photos, visit } = useVisit(job.id);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const rooms = useMemo(() => {
    const g: { room: string; n: number; done: number }[] = [];
    for (const it of items || []) { const r = g.find((x) => x.room === it.room); if (r) { r.n++; if (it.done_at) r.done++; } else g.push({ room: it.room, n: 1, done: it.done_at ? 1 : 0 }); }
    return g;
  }, [items]);
  const doneN = (items || []).filter((i) => i.done_at).length;
  const tm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }) : '');
  const due = job.rating_due_at ? new Date(job.rating_due_at).toLocaleString(lang, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const shown = (photos.filter((p) => p.kind === 'after').length ? photos.filter((p) => p.kind === 'after') : photos);
  const rate = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('rate_job', { p_job: job.id, p_rating: stars, p_comment: comment || null });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { setSent(true); onRated(); }
  };
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{t('po.lastVisit', { d: new Date(job.scheduled_start).toLocaleDateString(lang, { weekday: 'short', month: 'short', day: 'numeric' }).replace(/\./g, '') })}</span>
        {items && items.length > 0 && <span className="nw" style={{ fontSize: 12, fontWeight: 800, color: '#0B6B5F', background: '#DDF1EC', borderRadius: 999, padding: '3px 9px' }}>{t('po.tasks', { d: doneN, n: items.length })}</span>}
      </div>
      {visit && (visit.started_at || visit.team.length > 0) && (
        <span style={{ fontSize: 12.5, color: C.muted }}>{[visit.started_at ? t('po.inOut', { a: tm(visit.started_at), b: tm(visit.completed_at) }) : '', visit.team.join(', ')].filter(Boolean).join(' · ')}</span>
      )}
      {shown.length > 0 && (
        <button onClick={onOpen} aria-label={t('ck.photos')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, border: 0, background: 'none', padding: 0, cursor: 'pointer' }}>
          {shown.slice(0, 4).map((p, i) => (
            <span key={p.id} style={{ aspectRatio: '1', borderRadius: 10, background: p.url ? `#D6E3E0 url(${p.url}) center/cover` : '#D6E3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{i === 3 && shown.length > 4 ? `+${shown.length - 3}` : ''}</span>
          ))}
        </button>
      )}
      {rooms.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rooms.map((r, i) => (
            <div key={r.room} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderTop: i ? '1px solid #EEF2F1' : 0 }}>
              <Svg d={r.done === r.n ? I.check : I.x} size={16} color={r.done === r.n ? C.accent : '#B8400C'} w={2.6} />
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{label(r.room)}</span>
              <span className="num" style={{ fontSize: 12, color: C.muted }}>{r.done === r.n ? t('po.nTasks', { n: r.n }) : `${r.done}/${r.n}`}</span>
            </div>
          ))}
        </div>
      )}
      {job.completion_note && <span style={{ fontSize: 13, background: '#F4F7F6', borderRadius: 12, padding: '10px 12px', lineHeight: 1.45 }}>{job.completion_note}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #EEF2F1', paddingTop: 12 }}>
        {sent || job.rating_status === 'rated' ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{sent ? t('po.rated', { company }) : t('po.yourRating')}</span>
            <Stars value={sent ? stars : job.rating || 0} size={36} />
            {job.rating_comment && !sent && <span style={{ fontSize: 12.5, color: C.muted }}>“{job.rating_comment}”</span>}
          </>
        ) : canRate(job) ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{t('po.howWas')}</span>
            <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('po.rateUntil', { d: due })}</span>
            <Stars value={stars} onPick={setStars} />
            {stars > 0 && (
              <>
                <textarea className="k-input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('pt.comment')} aria-label={t('pt.comment')} style={{ minHeight: 64, resize: 'none' }} />
                <button onClick={rate} disabled={busy} style={{ minHeight: 46, borderRadius: 13, border: 0, background: NAVY, color: '#FFFFFF', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{t('po.sendRating')}</button>
              </>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: C.muted }}>{job.rating_status === 'auto_approved' ? t('ck.autoApproved') : ''}</span>
        )}
      </div>
    </div>
  );
}

function VisitSheet({ job, onClose, onRated }: { job: PJob; onClose: () => void; onRated: () => void }) {
  const { t, lang } = useApp();
  const label = useTaskLabel();
  const { items, photos } = useVisit(job.id);
  const [big, setBig] = useState<Photo | null>(null);
  return (
    <Sheet title={new Date(job.scheduled_start).toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' })} onClose={onClose}>
      {(['before', 'after'] as const).map((k) => photos.some((p) => p.kind === k) && (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="k-lbl">{t(k === 'before' ? 'ck.before' : 'ck.after')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
            {photos.filter((p) => p.kind === k).map((p) => <button key={p.id} onClick={() => setBig(p)} style={{ aspectRatio: '1', borderRadius: 10, border: 0, padding: 0, background: p.url ? `#D6E3E0 url(${p.url}) center/cover` : '#D6E3E0', cursor: 'zoom-in' }} aria-label={t(k === 'before' ? 'ck.before' : 'ck.after')} />)}
          </div>
        </div>
      ))}
      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 38, borderTop: i ? '1px solid #EEF2F1' : 0 }}>
              <Svg d={it.done_at ? I.check : I.x} size={15} color={it.done_at ? C.accent : '#B8400C'} w={2.6} />
              <span style={{ fontSize: 13, flex: 1 }}>{label(it.room)} · {label(it.task)}</span>
            </div>
          ))}
        </div>
      )}
      {job.rating ? <span style={{ color: '#F2A900', fontSize: 18, letterSpacing: 2 }}>{'★'.repeat(job.rating)}</span> : null}
      {canRate(job) && <button className="k-btn k-btn-fill" onClick={onRated}>{t('pt.rateNow')}</button>}
      {big && (
        <div role="dialog" aria-modal="true" onClick={() => setBig(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,18,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={big.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      )}
    </Sheet>
  );
}

function InvoicesTab({ invoices, co, client, email }: { invoices: PInv[]; co: PCo | null; client: string; email: string | null }) {
  const { t, lang, toast } = useApp();
  const openInv = invoices.find((i) => i.status !== 'paid' && i.total_cents > i.paid_cents);
  const paid = invoices.filter((i) => i !== openInv);
  const pay = co?.payment_info || {};
  const ways: [string, string][] = [];
  if (pay.zelle) ways.push(['Zelle', pay.zelle]);
  if (pay.venmo) ways.push(['Venmo', pay.venmo]);
  if (pay.cashapp) ways.push(['Cash App', pay.cashapp]);
  if (pay.check_to) ways.push([t('pdf.check'), `${t('pdf.payableTo')} ${pay.check_to}`]);
  const month = (i: PInv) => { const d = new Date((i.issued_on || i.due_on || '') + 'T12:00'); const s = d.toLocaleDateString(lang, { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
  const pdf = async (i: PInv) => {
    const { data } = await supabase.from('invoice_lines').select('description, quantity, unit_cents, amount_cents').eq('invoice_id', i.id);
    const blob = await invoicePdf({ company: { name: co?.name || '' }, client: { name: client, email }, inv: { number: i.number, issued_on: i.issued_on, due_on: i.due_on, total_cents: i.total_cents, paid_cents: i.paid_cents, lines: (data || []) as never[] }, pay, lang });
    const shared = await shareFile(blob, `${i.number}.pdf`, i.number);
    if (!shared) toast(t('po.downloaded'));
  };
  if (!invoices.length) return <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, fontSize: 13.5, color: C.muted }}>{t('po.noInvoices')}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {openInv && (
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{month(openInv)} · {openInv.number}</span>
          <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 32, fontWeight: 700 }}>{usd(openInv.total_cents - openInv.paid_cents, true)}</span>
          {openInv.due_on && <span style={{ fontSize: 13, color: C.muted }}>{t('po.due', { d: new Date(openInv.due_on + 'T12:00').toLocaleDateString(lang, { month: 'short', day: 'numeric' }) })}</span>}
          {ways.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F4F7F6', borderRadius: 12, padding: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('pdf.howToPay')}</span>
              {ways.map(([k, v]) => <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13 }}><span style={{ fontWeight: 800, width: 74, flex: 'none' }}>{k}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span></div>)}
              {pay.note && <span style={{ fontSize: 12, color: C.muted }}>{pay.note}</span>}
            </div>
          )}
          <button onClick={() => pdf(openInv)} style={{ minHeight: 50, borderRadius: 14, border: 0, background: NAVY, color: '#FFFFFF', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>{t('po.pdf')}</button>
          <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('po.payNote', { company: co?.name || '' })}</span>
        </div>
      )}
      {paid.length > 0 && (
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '4px 14px' }}>
          {paid.map((i, k) => (
            <button key={i.id} onClick={() => pdf(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, width: '100%', border: 0, borderTop: k ? '1px solid #EEF2F1' : 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink, padding: '6px 0' }}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 700, fontSize: 13.5 }}>{month(i)}</span><span style={{ fontSize: 12, color: C.muted }}>{i.number}</span></span>
              <span className="num" style={{ fontWeight: 800, fontSize: 13.5 }}>{usd(i.total_cents, true)}</span>
              <span className="nw" style={{ fontSize: 11.5, fontWeight: 800, color: i.status === 'paid' ? '#3E4F4C' : '#8A4B05', background: i.status === 'paid' ? '#EEF1F0' : '#FDF0DC', borderRadius: 999, padding: '3px 9px' }}>{t(`inv.status.${i.status}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestSheet({ company, onClose, onSent }: { company: string; onClose: () => void; onSent: () => void }) {
  const { t, lang, portal, session, toast, tErr } = useApp();
  const [kind, setKind] = useState<'extra' | 'issue' | 'supply' | 'other'>('extra');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!portal || !session || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('client_requests').insert({ company_id: portal.company_id, client_id: portal.client_id, kind, body: body.trim(), created_by: session.user.id });
    if (error) { setBusy(false); toast(tErr(error.message)); return; }
    // also as a chat message, so it arrives translated and the reply comes back in Messages
    const { data } = await supabase.rpc('chat_contacts', { p_company: portal.company_id });
    const owner = ((data || []) as { user_id: string; kind: string }[]).find((x) => x.kind === 'owner');
    if (owner) {
      const { data: cid } = await supabase.rpc('open_conversation', { p_company: portal.company_id, p_with: owner.user_id });
      if (cid) await supabase.from('messages').insert({ conversation_id: cid, company_id: portal.company_id, sender_id: session.user.id, body: `${t(`po.rk.${kind}`)}: ${body.trim()}`, body_language: lang });
    }
    setBusy(false);
    toast(t('po.reqSent'));
    onSent();
  };
  return (
    <Sheet title={t('po.newRequest')} onClose={onClose}>
      <div className="k-chips wrap" role="group" aria-label={t('po.newRequest')} style={{ justifyContent: 'flex-start', alignSelf: 'stretch' }}>
        {(['extra', 'issue', 'supply', 'other'] as const).map((k) => (
          <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} style={{ minHeight: 40, padding: '0 12px', borderRadius: 999, border: `1px solid ${kind === k ? NAVY : C.line}`, background: kind === k ? NAVY : '#FFFFFF', color: kind === k ? '#FFFFFF' : C.ink, fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t(`po.rk.${k}`)}</button>
        ))}
      </div>
      <label className="k-field"><span>{t('po.details')}</span>
        <textarea className="k-input" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('po.detailsPh')} style={{ minHeight: 92, resize: 'none', background: '#F4F7F6' }} />
      </label>
      <span style={{ fontSize: 12, color: C.muted }}>{t('po.reqNote', { company })}</span>
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={onClose}>{t('c.cancel')}</button>
        <button className="k-btn" disabled={busy || !body.trim()} onClick={send} style={{ background: NAVY, color: '#FFFFFF', border: 0 }}>{t('po.send')}</button>
      </div>
    </Sheet>
  );
}
