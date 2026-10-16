// Field team (canvas "MeuDia"): the day's route, hours, expenses and pay; plus the Pagamentos and Perfil tabs
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { C, Empty, Head, HelperBar, I, Svg, colorOf, dur, hm, initials, usd } from '../components/kit';
import { InstallCard } from '../components/InstallCard';
import { PushToggle } from '../components/PushToggle';
import { cacheGet, cacheSet, perform, useOffline } from '../lib/offline';
import { compressImage } from '../lib/photos';
import { addDays, isoDate, startOfDay } from '../lib/format';
import { driveMin, total, pt } from '../lib/route';
import type { Lang } from '../lib/i18n';

export type HJob = {
  job_id: string; company_id: string; status: string; scheduled_start: string; scheduled_end: string; route_position: number | null; client_notes: string | null;
  client_name: string; address_line1: string; address_line2: string | null; city: string; state: string; zip: string; lat: number | null; lng: number | null;
  access_instructions: string | null; pets: string | null; special_instructions: string | null; service_name: string | null; membership_id: string;
};
type Entry = { id: string; clock_in: string; clock_out: string | null };
type Week = { week_start: string; minutes: number; jobs_done: number; pay_cents: number; tips_cents: number; reimb_cents: number };

const PILLS: Record<string, [string, string]> = { done: ['#E3F1EE', '#0B6B5F'], next: ['#FDF0DC', '#8A4B05'], doing: ['#DDF1EC', '#0B6B5F'], todo: ['#EEF1F0', '#3E4F4C'] };

/** Today's jobs for the signed-in helper, cached for offline use */
export function useHelperDay() {
  const { membership } = useApp();
  const [jobs, setJobs] = useState<HJob[] | null>(null);
  const load = useCallback(async () => {
    if (!membership) return;
    const today = startOfDay(new Date());
    const { data, error } = await supabase.rpc('helper_jobs');
    let all = (data || []) as HJob[];
    if (error) all = cacheGet<HJob[]>('helper_jobs') || [];
    else cacheSet('helper_jobs', all);
    setJobs(all.filter((j) => j.membership_id === membership.id && new Date(j.scheduled_start) >= today && new Date(j.scheduled_start) < addDays(today, 1) && j.status !== 'canceled')
      .sort((a, b) => (a.route_position ?? 99) - (b.route_position ?? 99) || a.scheduled_start.localeCompare(b.scheduled_start)));
  }, [membership]);
  useEffect(() => { load(); }, [load]);
  return { jobs, setJobs, load };
}

export default function MyDay() {
  const { t, lang, membership, isStaff, toast, tErr } = useApp();
  const nav = useNavigate();
  const { online, pending } = useOffline();
  const { jobs } = useHelperDay();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [week, setWeek] = useState<Week | null>(null);
  const [rating, setRating] = useState<{ avg_rating: number | null; rated: number } | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [owner, setOwner] = useState('');
  const [exp, setExp] = useState(false);
  const [expSent, setExpSent] = useState(false);
  const [info, setInfo] = useState<HJob | null>(null);
  const [askOut, setAskOut] = useState(false);
  const [, tick] = useState(0);

  const loadTime = useCallback(async () => {
    if (!membership) return;
    const today = startOfDay(new Date());
    const { data, error } = await supabase.from('time_entries').select('id, clock_in, clock_out').eq('membership_id', membership.id).gte('clock_in', today.toISOString()).order('clock_in');
    if (error) setEntries(cacheGet<Entry[]>(`time_${isoDate(today)}`) || []);
    else { setEntries((data || []) as Entry[]); cacheSet(`time_${isoDate(today)}`, data || []); }
  }, [membership]);
  useEffect(() => {
    if (!membership) return;
    loadTime();
    supabase.rpc('my_pay_weeks', { p_weeks: 1 }).then(({ data }) => setWeek(((data || []) as Week[])[0] || null));
    supabase.rpc('my_rating').then(({ data }) => setRating(((data || []) as { avg_rating: number | null; rated: number }[])[0] || null));
    supabase.from('memberships').select('origin_lat, origin_lng').eq('id', membership.id).maybeSingle().then(({ data }) => { if (data?.origin_lat != null) setOrigin({ lat: data.origin_lat, lng: data.origin_lng }); });
    supabase.rpc('owner_info', { cid: membership.company_id }).then(({ data }) => setOwner((((data || []) as { display_name: string }[])[0]?.display_name || '').split(' ')[0]));
    const i = window.setInterval(() => tick((n) => n + 1), 60000);
    return () => window.clearInterval(i);
  }, [membership, loadTime]);

  const open = entries.find((e) => !e.clock_out);
  const minutes = entries.reduce((s, e) => s + (+new Date(e.clock_out || Date.now()) - +new Date(e.clock_in)) / 60000, 0);
  const clockIn = async () => {
    if (!membership || open) return;
    const id = crypto.randomUUID(), now = new Date().toISOString();
    const r = await perform({ kind: 'insert', table: 'time_entries', row: { id, company_id: membership.company_id, membership_id: membership.id, clock_in: now, source: navigator.onLine ? 'app' : 'offline_sync' } });
    if (r.error) { toast(tErr(r.error)); return; }
    const list = [...entries, { id, clock_in: now, clock_out: null }];
    setEntries(list); cacheSet(`time_${isoDate(startOfDay(new Date()))}`, list);
  };
  const clockOut = async () => {
    if (!open) return;
    const now = new Date().toISOString();
    const r = await perform({ kind: 'update', table: 'time_entries', id: open.id, patch: { clock_out: now } });
    if (r.error) { toast(tErr(r.error)); return; }
    const list = entries.map((e) => (e.id === open.id ? { ...e, clock_out: now } : e));
    setEntries(list); cacheSet(`time_${isoDate(startOfDay(new Date()))}`, list);
    if (r.queued) toast(t('off.saved'));
  };

  const stats = useMemo(() => {
    const list = jobs || [];
    const done = list.filter((j) => j.status === 'completed').length;
    const next = list.find((j) => j.status === 'in_progress') || list.find((j) => j.status === 'scheduled') || null;
    const located = list.filter((j) => pt(j));
    const drive = located.length ? driveMin(total(origin, located, !!origin)) : null;
    return { n: list.length, done, next, drive };
  }, [jobs, origin]);

  if (!membership) {
    return (
      <div className="k-screen"><main className="k-page nobar" style={{ justifyContent: 'center', minHeight: '100dvh', gap: 14 }}>
        <Empty title={t('day.noMembership')} text={t('day.askInvite')} action={<Link className="k-btn k-btn-fill" to="/comecar">{t('day.createOwn')}</Link>} />
        <button className="k-btn k-btn-line" onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
      </main></div>
    );
  }

  const first = membership.display_name.split(' ')[0];
  const date = new Date().toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' });
  const statusOf = (j: HJob): keyof typeof PILLS => (j.status === 'completed' ? 'done' : j.status === 'in_progress' ? 'doing' : j.job_id === stats.next?.job_id ? 'next' : 'todo');
  const startRoute = async () => { await clockIn(); nav('/dia/navegacao'); };
  const color = colorOf(0)[0];

  return (
    <div className="k-screen">
      <main className={`k-page top20${isStaff ? ' nobar' : ''}`} style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 42, height: 42, borderRadius: 42, background: color, color: '#FFFFFF', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(membership.display_name)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{date.charAt(0).toUpperCase() + date.slice(1)}</span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 21, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('md.hello', { name: first })}</span>
          </div>
          <span role="status" style={{ minHeight: 36, padding: '0 10px', borderRadius: 999, background: online ? '#DDF1EC' : '#FFF1D6', color: online ? '#0B6B5F' : '#6B4A04', fontWeight: 800, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: online ? C.accent : '#D99A06' }} />{!online ? t('md.offline') : pending ? t('md.sending', { n: pending }) : t('md.online')}
          </span>
          {isStaff && <Link className="k-iconbtn" to="/app" aria-label={t('nav.today')}><Svg d={I.home} size={20} color={C.ink} /></Link>}
        </div>
        {!online && <div role="status" style={{ background: '#FFF8E6', border: '1px solid #F3DFA8', borderRadius: 14, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#6B4A04', lineHeight: 1.45 }}>{t('off.offline')}</div>}
        <InstallCard />

        <div style={{ background: '#0A3D35', color: '#EAF5F2', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#9DB5B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('md.route')}</span>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.2, textWrap: 'balance' } as CSSProperties}>
              {jobs === null ? '…' : stats.n === 0 ? t('md.free') : `${t(stats.n === 1 ? 'md.oneHouse' : 'md.houses', { n: stats.n })}${stats.drive ? ` · ${t('md.inCar', { d: dur(stats.drive) })}` : ''}`}
            </span>
          </span>
          {stats.n > 0 && <>
            <div style={{ height: 8, borderRadius: 8, background: '#23463F', overflow: 'hidden' }} role="progressbar" aria-valuemin={0} aria-valuemax={stats.n} aria-valuenow={stats.done}><div style={{ height: 8, width: `${(stats.done / stats.n) * 100}%`, background: '#5FD4C1' }} /></div>
            <span style={{ fontSize: 12.5, color: '#B9D6D0' }}>{t('md.progress', { done: stats.done, n: stats.n })}{stats.next && stats.next.status === 'scheduled' ? ` · ${t('md.nextAt', { t: hm(stats.next.scheduled_start, lang) })}` : ''}</span>
            {stats.done < stats.n && (
              <button onClick={startRoute} style={{ minHeight: 50, borderRadius: 14, background: '#5FD4C1', color: '#0A3D35', fontWeight: 800, fontSize: 15, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Svg d="M3 11l18-8-8 18-2-8z" size={18} w={2.2} />{stats.done > 0 || stats.next?.status === 'in_progress' ? t('md.continue') : t('md.start')}
              </button>
            )}
          </>}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => (open ? setAskOut(true) : clockIn())} style={{ flex: 1, minWidth: 0, background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('day.hours')}</span>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800 }}>{dur(Math.round(minutes)) || '0min'}</span>
            <span style={{ fontSize: 11.5, color: open ? C.muted : C.accent, fontWeight: open ? 500 : 700 }}>{open ? t('md.inAt', { t: hm(open.clock_in, lang) }) : entries.length ? t('md.clockAgain') : t('md.tapIn')}</span>
          </button>
          <button onClick={() => setExp(true)} style={{ flex: 1, minWidth: 0, borderRadius: 16, border: '1px dashed #9DB5B0', background: '#FFFFFF', color: C.accent, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 76, fontFamily: 'inherit' }}>
            <Svg d={expSent ? I.check : I.pay} size={20} />{expSent ? t('md.expSent') : t('day.expense')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs === null ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 84, borderRadius: 16 }} />)
            : jobs.length === 0 ? <Empty title={t('day.noJobs')} text={t('md.noJobsText')} />
              : jobs.map((j, i) => {
                const st = statusOf(j), next = st === 'next' || st === 'doing', done = st === 'done';
                return (
                  <div key={j.job_id} style={{ background: '#FFFFFF', border: `1px solid ${next ? C.accent : C.line}`, borderRadius: 16, padding: 12, display: 'flex', gap: 12, alignItems: 'center', opacity: done ? 0.7 : 1 }}>
                    <button onClick={() => setInfo(j)} style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
                      <span style={{ width: 32, height: 32, borderRadius: 32, background: done ? C.accent : next ? '#0A3D35' : '#E4ECEA', color: done || next ? '#FFFFFF' : '#3E4F4C', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.client_name}</span>
                        <span style={{ fontSize: 12.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span className="num">{hm(j.scheduled_start, lang)}</span> · {j.address_line1}, {j.city}</span>
                        <span style={{ alignSelf: 'flex-start', marginTop: 2, fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px', background: PILLS[st][0], color: PILLS[st][1] }}>{t(`md.st.${st}`)}</span>
                      </span>
                    </button>
                    {next && <Link to={`/dia/servico/${j.job_id}`} style={{ flex: 'none', minHeight: 44, boxSizing: 'border-box', padding: '0 14px', borderRadius: 12, background: C.accent, color: '#FFFFFF', fontWeight: 800, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>{t('md.open')}</Link>}
                  </div>
                );
              })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <Link to="/dia/pagamentos" style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 4, textDecoration: 'none', color: C.ink }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('md.week')}</span>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800 }}>{week ? usd(week.pay_cents) : '—'}</span>
            <span style={{ fontSize: 11.5, color: C.muted }}>{week && week.tips_cents > 0 ? t('md.tips', { v: usd(week.tips_cents) }) : t('md.estimate')}</span>
          </Link>
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('md.rating')}</span>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: C.accent }}>{rating?.avg_rating != null ? Number(rating.avg_rating).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</span>
            <span style={{ fontSize: 11.5, color: C.muted }}>{rating?.rated ? t('md.lastVisits', { n: rating.rated }) : t('md.noRatings')}</span>
          </div>
        </div>
      </main>
      {!isStaff && <HelperBar />}

      {exp && <ExpenseSheet owner={owner} onClose={() => setExp(false)} onSent={() => { setExp(false); setExpSent(true); }} />}
      {info && <JobInfoSheet job={info} onClose={() => setInfo(null)} />}
      {askOut && <Confirm text={t('md.endAsk', { h: dur(Math.round(minutes)) })} confirmLabel={t('day.clockOut')} onCancel={() => setAskOut(false)} onConfirm={() => { setAskOut(false); clockOut(); }} />}
    </div>
  );
}

function ExpenseSheet({ owner, onClose, onSent }: { owner: string; onClose: () => void; onSent: () => void }) {
  const { t, tErr, toast, membership } = useApp();
  const [cat, setCat] = useState('gas');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const cents = Math.round(parseFloat(amount.replace(',', '.')) * 100) || 0;
  const save = async () => {
    if (!membership || cents <= 0) return;
    setBusy(true);
    const row = { id: crypto.randomUUID(), company_id: membership.company_id, membership_id: membership.id, category: cat, amount_cents: cents, description: null, receipt_path: null as string | null, reimbursable: true, status: 'pending' };
    const r = file
      ? await perform({ kind: 'upload', bucket: 'receipts', path: `${membership.company_id}/${crypto.randomUUID()}.jpg`, blob: await compressImage(file), table: 'expenses', row })
      : await perform({ kind: 'insert', table: 'expenses', row });
    setBusy(false);
    if (r.error) toast(tErr(r.error)); else { toast(r.queued ? t('off.saved') : t('day.expenseSent')); onSent(); }
  };
  return (
    <Sheet title={t('day.expense')} onClose={onClose}>
      <label className="k-field"><span>{t('md.amount')}</span>
        <input className="k-input num" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ minHeight: 52, background: '#F4F7F6', fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800 }} />
      </label>
      <div className="k-chips" role="group" aria-label={t('day.expense')}>
        {([['gas', t('exp.gas')], ['supplies', t('md.product')], ['parking', t('exp.parking')], ['other', t('exp.other')]] as const).map(([c, label]) => <button key={c} type="button" className="k-chip" aria-pressed={cat === c} onClick={() => setCat(c)} style={{ minHeight: 40 }}>{label}</button>)}
      </div>
      <label style={{ minHeight: 48, borderRadius: 14, border: '1.5px dashed #9DB5B0', background: '#FFFFFF', color: C.accent, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px', textAlign: 'center' }}>
        <Svg d={file ? I.check : I.cam} size={18} />{file ? t('md.receiptOk') : t('day.receipt')}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      {owner && <span style={{ fontSize: 12, color: C.muted }}>{t('md.expNote', { name: owner })}</span>}
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={onClose}>{t('c.cancel')}</button>
        <button className="k-btn k-btn-fill" disabled={busy || cents <= 0} onClick={save}>{t('hp.send')}</button>
      </div>
    </Sheet>
  );
}

function JobInfoSheet({ job, onClose }: { job: HJob; onClose: () => void }) {
  const { t, lang } = useApp();
  const [problem, setProblem] = useState(false);
  const rows: [string, string | null][] = [[t('day.access'), job.access_instructions], [t('cl.pets'), job.pets], [t('cl.special'), job.special_instructions], [t('job.notesClient'), job.client_notes]];
  if (problem) return <ProblemSheet job={job} onClose={onClose} />;
  return (
    <Sheet title={job.client_name} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted, marginTop: -6 }}><span className="num">{hm(job.scheduled_start, lang)}–{hm(job.scheduled_end, lang)}</span>{job.service_name ? ` · ${job.service_name}` : ''}</span>
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${job.address_line1}, ${job.city}, ${job.state} ${job.zip}`)}`} target="_blank" rel="noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, padding: '0 12px', borderRadius: 14, background: '#F4F7F6', textDecoration: 'none', color: C.ink }}>
        <Svg d={I.pin} size={18} color={C.accent} /><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{job.address_line1}, {job.city}</span><span style={{ fontSize: 12.5, fontWeight: 800, color: C.accent }}>{t('day.navigate')}</span>
      </a>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{k}</span><span style={{ fontSize: 14, lineHeight: 1.45 }}>{v}</span></div>
      ))}
      <div className="k-pair">
        {job.status !== 'completed' ? <button className="k-btn k-btn-line" onClick={() => setProblem(true)}>{t('day.problem')}</button> : <span />}
        <Link className="k-btn k-btn-fill" to={`/dia/servico/${job.job_id}`}>{t('md.open')}</Link>
      </div>
    </Sheet>
  );
}

export function ProblemSheet({ job, onClose }: { job: HJob; onClose: () => void }) {
  const { t, tg, tErr, toast, membership } = useApp();
  const [cat, setCat] = useState('no_access');
  const [desc, setDesc] = useState('');
  const save = async () => {
    if (!membership) return;
    const label = t(`day.${cat === 'no_access' ? 'noAccess' : cat === 'damage' ? 'damage' : cat === 'supplies' ? 'supplies' : 'otherIssue'}`);
    const r = await perform({ kind: 'insert', table: 'job_issues', row: { id: crypto.randomUUID(), job_id: job.job_id, company_id: job.company_id, reported_by: membership.id, category: cat, description: desc || label } });
    if (r.error) toast(tErr(r.error)); else { toast(r.queued ? t('off.saved') : tg('day.problemSent')); onClose(); }
  };
  return (
    <Sheet title={t('day.problem')} onClose={onClose}>
      <span className="k-lbl">{t('day.problemCat')}</span>
      <div className="k-chips" role="group" aria-label={t('day.problemCat')}>
        {[['no_access', 'day.noAccess'], ['damage', 'day.damage'], ['supplies', 'day.supplies'], ['other', 'day.otherIssue']].map(([v, k]) => <button key={v} className="k-chip" aria-pressed={cat === v} onClick={() => setCat(v)} style={{ minHeight: 40 }}>{t(k)}</button>)}
      </div>
      <label className="k-field"><span>{t('exp.desc')}</span><textarea className="k-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ minHeight: 84, resize: 'none' }} /></label>
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={onClose}>{t('c.cancel')}</button>
        <button className="k-btn k-btn-fill" onClick={save}>{t('hp.send')}</button>
      </div>
    </Sheet>
  );
}

// ─────────────── Pagamentos ───────────────
export function HelperPay() {
  const { t, lang } = useApp();
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [owner, setOwner] = useState('');
  const { membership } = useApp();
  useEffect(() => {
    supabase.rpc('my_pay_weeks', { p_weeks: 8 }).then(({ data }) => setWeeks((data || []) as Week[]));
    if (membership) supabase.rpc('owner_info', { cid: membership.company_id }).then(({ data }) => setOwner((((data || []) as { display_name: string }[])[0]?.display_name || '').split(' ')[0]));
  }, [membership]);
  const label = (ws: string) => { const a = new Date(ws + 'T12:00'), b = addDays(a, 6); const f = (d: Date) => d.toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' '); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${f(b)}` : `${f(a)}–${f(b)}`; };
  const cur = weeks?.[0];
  return (
    <div className="k-screen">
      <main className="k-page top20" style={{ gap: 16 }}>
        <Head title={t('nav.pay')} sub={t('pay.sub')} />
        {!weeks ? <div className="skeleton" style={{ height: 150, borderRadius: 22 }} /> : !cur ? <Empty title={t('pay.none')} /> : (
          <div style={{ background: '#0A3D35', color: '#EAF5F2', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#9DB5B0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('md.week')}</span>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 34, fontWeight: 800, color: '#FFFFFF' }}>{usd(cur.pay_cents + cur.tips_cents + cur.reimb_cents)}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {[[t('pay.work'), usd(cur.pay_cents)], [t('pay.tips'), usd(cur.tips_cents)], [t('pay.reimb'), usd(cur.reimb_cents)]].map(([k, v]) => (
                <span key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span style={{ fontSize: 11, color: '#9DB5B0', fontWeight: 800 }}>{k}</span><span className="num nw" style={{ fontWeight: 800, fontSize: 15 }}>{v}</span></span>
              ))}
            </div>
            <span style={{ fontSize: 12.5, color: '#B9D6D0' }}>{t('pay.hoursJobs', { h: dur(cur.minutes) || '0min', n: cur.jobs_done })}</span>
          </div>
        )}
        {weeks && weeks.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pay.previous')}</span>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '0 14px' }}>
              {weeks.slice(1).map((w, i) => (
                <div key={w.week_start} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: i ? '1px solid #EEF2F1' : 0 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{label(w.week_start)}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{t('pay.hoursJobs', { h: dur(w.minutes) || '0min', n: w.jobs_done })}{w.tips_cents ? ` · ${t('md.tips', { v: usd(w.tips_cents) })}` : ''}</span>
                  </span>
                  <span className="num nw" style={{ fontWeight: 800, fontSize: 15 }}>{usd(w.pay_cents + w.tips_cents + w.reimb_cents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{owner ? t('pay.note', { name: owner }) : t('pay.noteAnon')}</span>
      </main>
      <HelperBar />
    </div>
  );
}

// ─────────────── Perfil ───────────────
export function HelperProfile() {
  const { t, tg, lang, setLang, membership, company } = useApp();
  const nav = useNavigate();
  const [origin, setOrigin] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => { if (membership) supabase.from('memberships').select('origin_address').eq('id', membership.id).maybeSingle().then(({ data }) => setOrigin(data?.origin_address || null)); }, [membership]);
  if (!membership) return null;
  const langs: [Lang, string][] = [['pt-BR', 'Português'], ['en', 'English'], ['es', 'Español']];
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0' }}><span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{label}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span></div>
  );
  return (
    <div className="k-screen">
      <main className="k-page top20" style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 56, height: 56, borderRadius: 56, background: colorOf(0)[0], color: '#FFFFFF', fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{initials(membership.display_name)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800 }}>{membership.display_name}</span>
            <span style={{ fontSize: 13, color: C.muted }}>{tg(`team.${membership.role}`, (membership.gender as 'f' | 'm' | null) || undefined)} · {company?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="k-lbl">{t('pr.lang')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {langs.map(([l, label]) => <button key={l} className="k-chip" aria-pressed={lang === l} onClick={() => setLang(l)} style={{ minHeight: 44, borderRadius: 12, justifyContent: 'center' }}>{label}</button>)}
          </div>
          <span style={{ fontSize: 12, color: C.muted }}>{t('pr.langHint')}</span>
        </div>
        <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 18, padding: '0 14px' }}>
          {row(t('pr.origin'), origin || t('pr.noOrigin'))}
        </div>
        <PushToggle />
        <Link className="k-btn k-btn-line" to="/ajuda">{t('more.help')}</Link>
        <button className="k-btn k-btn-line" style={{ color: '#9F1F14' }} onClick={() => setAsk(true)}>{t('auth.signout')}</button>
      </main>
      <HelperBar />
      {ask && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAsk(false)} onConfirm={async () => { await supabase.auth.signOut(); nav('/', { replace: true }); window.location.reload(); }} />}
    </div>
  );
}
