import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, LoadingList, Logo, Sheet, StatusBadge } from '../components/ui';
import { Bell } from './Inbox';
import { cacheGet, cacheSet, perform, useOffline } from '../lib/offline';
import { compressImage } from '../lib/photos';
import { PushToggle } from '../components/PushToggle';
import { navUrl } from './Routes';
import { fmtHours, hoursBetween, startOfDay, time, toCents, longDay, addDays, isoDate } from '../lib/format';

type HJob = {
  job_id: string; company_id: string; status: string; scheduled_start: string; scheduled_end: string; client_notes: string | null;
  client_name: string; address_line1: string; address_line2: string | null; city: string; state: string; zip: string;
  access_instructions: string | null; pets: string | null; special_instructions: string | null; service_name: string | null; membership_id: string;
};
type Entry = { id: string; clock_in: string; clock_out: string | null };

export default function MyDay() {
  const { t, tErr, lang, membership, isStaff, toast } = useApp();
  const [jobs, setJobs] = useState<HJob[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [finish, setFinish] = useState<HJob | null>(null);
  const [note, setNote] = useState('');
  const [expense, setExpense] = useState(false);
  const [problem, setProblem] = useState<HJob | null>(null);
  const [askOut, setAskOut] = useState(false);
  const [, tick] = useState(0);
  const nav = useNavigate();

  const { online, pending } = useOffline();
  const load = useCallback(async () => {
    if (!membership) return;
    const today = startOfDay(new Date());
    // Offline: show the last copy of the day saved on this phone
    const { data, error } = await supabase.rpc('helper_jobs');
    let all = (data || []) as HJob[];
    if (error) all = cacheGet<HJob[]>('helper_jobs') || [];
    else cacheSet('helper_jobs', all);
    setJobs(all.filter((j) => new Date(j.scheduled_start) >= today && new Date(j.scheduled_start) < addDays(today, 1) && j.status !== 'canceled')
      .sort((a, b) => ((a as HJob & { route_position?: number }).route_position ?? 99) - ((b as HJob & { route_position?: number }).route_position ?? 99) || a.scheduled_start.localeCompare(b.scheduled_start)));
    const { data: te, error: e2 } = await supabase.from('time_entries').select('id, clock_in, clock_out')
      .eq('membership_id', membership.id).gte('clock_in', today.toISOString()).order('clock_in');
    if (e2) setEntries(cacheGet<Entry[]>(`time_${isoDate(today)}`) || []);
    else { setEntries((te || []) as Entry[]); cacheSet(`time_${isoDate(today)}`, te || []); }
  }, [membership]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = window.setInterval(() => tick((n) => n + 1), 60000); return () => window.clearInterval(i); }, []);

  if (!membership) {
    return (
      <main className="auth-wrap">
        <Logo size={48} />
        <h1>{t('day.noMembership')}</h1>
        <p className="muted">{t('day.askInvite')}</p>
        <Link className="btn btn-primary" to="/comecar">{t('day.createOwn')}</Link>
        <button className="btn btn-secondary" onClick={async () => { await supabase.auth.signOut(); window.location.replace('/'); }}>{t('auth.signout')}</button>
      </main>
    );
  }

  const open = entries.find((e) => !e.clock_out);
  const hours = entries.reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out), 0);

  const saveEntries = (list: Entry[]) => { setEntries(list); cacheSet(`time_${isoDate(startOfDay(new Date()))}`, list); };
  const clock = async () => {
    const now = new Date().toISOString();
    if (open) {
      const r = await perform({ kind: 'update', table: 'time_entries', id: open.id, patch: { clock_out: now } });
      if (r.error) { toast(tErr(r.error)); return; }
      saveEntries(entries.map((e) => (e.id === open.id ? { ...e, clock_out: now } : e)));
      if (r.queued) toast(t('off.saved'));
    } else {
      const id = crypto.randomUUID();
      const r = await perform({ kind: 'insert', table: 'time_entries', row: { id, company_id: membership.company_id, membership_id: membership.id, clock_in: now, source: navigator.onLine ? 'app' : 'offline_sync' } });
      if (r.error) { toast(tErr(r.error)); return; }
      saveEntries([...entries, { id, clock_in: now, clock_out: null }]);
      if (r.queued) toast(t('off.saved'));
    }
  };
  const setJobStatus = (id: string, status: string) => {
    setJobs((list) => {
      const next = list && list.map((x) => (x.job_id === id ? { ...x, status } : x));
      const cached = cacheGet<HJob[]>('helper_jobs') || [];
      cacheSet('helper_jobs', cached.map((x) => (x.job_id === id ? { ...x, status } : x)));
      return next;
    });
  };
  const progress = async (job: HJob, status: string, n?: string) => {
    const r = await perform({ kind: 'rpc', fn: 'job_progress', args: { p_job: job.job_id, p_status: status, p_note: n || null } });
    if (r.error) { toast(tErr(r.error)); return false; }
    setJobStatus(job.job_id, status);
    toast(r.queued ? t('off.saved') : t('c.saved'));
    return true;
  };
  const startJob = async (j: HJob) => {
    const pos = await new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
    });
    if (pos) await perform({ kind: 'rpc', fn: 'job_start_location', args: { p_job: j.job_id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude } });
    return progress(j, 'in_progress');
  };
  const mapUrl = (j: HJob) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${j.address_line1}, ${j.city}, ${j.state} ${j.zip}`)}`;

  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <Logo size={38} />
          <div className="grow">
            <div className="small muted bold">{longDay(new Date(), lang)}</div>
            <h1 style={{ fontSize: 21 }}>{t('day.title')}</h1>
          </div>
          <Bell />
          {isStaff
            ? <Link className="btn btn-secondary" style={{ minHeight: 44 }} to="/app">{t('nav.today')}</Link>
            : <button className="icon-btn" aria-label={t('auth.signout')} onClick={() => setAskOut(true)}><Icon name="logout" size={18} /></button>}
        </div>

        {(!online || pending > 0) && (
          <div className="strip" role="status" style={online ? { background: 'var(--warn-bg)', borderColor: '#F3DDB8', color: 'var(--warn-fg)' } : undefined}>
            <span style={{ width: 8, height: 8, borderRadius: 8, background: 'currentColor', flex: 'none' }} />
            <span className="grow">{!online ? t('off.offline') : t('off.syncing', { n: pending })}</span>
          </div>
        )}
        <section className="card row" style={{ background: 'var(--brand-dark)', color: '#EAF5F2', borderColor: 'var(--brand-dark)' }}>
          <div className="grow">
            <div className="tiny bold" style={{ color: '#9DB5B0', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('day.hours')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 }} className="num">{fmtHours(hours)}</div>
          </div>
          <button className="btn" style={{ background: '#5FD4C1', color: '#0A3D35', minHeight: 48 }} onClick={clock}>
            <Icon name="clock" size={18} />{open ? t('day.clockOut') : t('day.clockIn')}
          </button>
        </section>

        {!jobs ? <LoadingList n={3} /> : jobs.length === 0 ? <div className="empty">{t('day.noJobs')}</div> : jobs.map((j, i) => (
          <section key={j.job_id} className="card stack" aria-label={j.client_name}>
            <div className="row">
              <span style={{ width: 30, height: 30, borderRadius: 30, background: 'var(--brand-light)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{i + 1}</span>
              <div className="grow"><div className="bold">{j.client_name}</div><div className="small muted">{time(j.scheduled_start, lang)}–{time(j.scheduled_end, lang)}{j.service_name ? ` · ${j.service_name}` : ''}</div></div>
              <StatusBadge status={j.status} />
            </div>
            <a className="row small" href={mapUrl(j)} target="_blank" rel="noreferrer" style={{ minHeight: 44, textDecoration: 'none' }}>
              <Icon name="pin" size={18} /><span className="grow">{j.address_line1}, {j.city}</span><span className="bold">{t('day.navigate')}</span>
            </a>
            {j.access_instructions && <div className="small row"><Icon name="key" size={16} /><span><b>{t('day.access')}:</b> {j.access_instructions}</span></div>}
            {j.pets && <div className="small"><b>{t('cl.pets')}:</b> {j.pets}</div>}
            {j.special_instructions && <div className="small"><b>{t('cl.special')}:</b> {j.special_instructions}</div>}
            {j.client_notes && <div className="card tight small" style={{ background: 'var(--warn-bg)', borderColor: '#F3DDB8' }}><b>{t('job.notesClient')}:</b> {j.client_notes}</div>}
            {j.status === 'scheduled' && <button className="btn btn-primary" onClick={async () => { if (await startJob(j)) nav(`/dia/servico/${j.job_id}`); }}>{t('day.start')}</button>}
            {j.status !== 'scheduled' && <Link className={`btn ${j.status === 'in_progress' ? 'btn-primary' : 'btn-secondary'}`} to={`/dia/servico/${j.job_id}`}>{t('ck.open')}</Link>}
            {j.status !== 'completed' && <button className="btn btn-ghost" onClick={() => setProblem(j)}><Icon name="alert" size={18} />{t('day.problem')}</button>}
          </section>
        ))}

        {jobs && jobs.filter((j) => j.status !== 'completed').length > 1 && (
          <a className="btn btn-secondary" target="_blank" rel="noreferrer" href={navUrl(null, jobs.filter((j) => j.status !== 'completed').map((j) => ({ address: `${j.address_line1}, ${j.city}, ${j.state} ${j.zip}` })))}>
            <Icon name="route" size={18} />{t('rt.openFull')}
          </a>
        )}
        <Link className="btn btn-secondary" to="/mensagens"><Icon name="chat" size={18} />{t('ch.talkOwner')}</Link>
        <button className="btn btn-secondary" onClick={() => setExpense(true)}><Icon name="receipt" size={18} />{t('day.expense')}</button>
        <PushToggle />
        <Link className="btn btn-ghost" to="/ajuda"><Icon name="help" size={18} />{t('more.help')}</Link>
      </main>

      {finish && (
        <Sheet title={t('day.finish')} onClose={() => setFinish(null)}>
          <Field label={t('day.finishNote')}><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn btn-primary" onClick={async () => { const j = finish; setFinish(null); await progress(j, 'completed', note); }}>{t('c.confirm')}</button>
        </Sheet>
      )}
      {expense && <ExpenseForm companyId={membership.company_id} membershipId={membership.id} onClose={() => setExpense(false)} />}
      {problem && <ProblemForm job={problem} membershipId={membership.id} onClose={() => setProblem(null)} />}
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)}
        onConfirm={async () => { await supabase.auth.signOut(); window.location.replace('/'); }} />}
    </div>
  );
}

function ExpenseForm({ companyId, membershipId, onClose }: { companyId: string; membershipId: string; onClose: () => void }) {
  const { t, tErr, toast, session } = useApp();
  const [cat, setCat] = useState('gas');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const row = { id: crypto.randomUUID(), company_id: companyId, membership_id: membershipId, category: cat, amount_cents: toCents(amount),
      description: desc || null, receipt_path: null as string | null, reimbursable: true, status: 'pending' };
    let r;
    if (file && session) {
      const path = `${companyId}/${crypto.randomUUID()}.jpg`;
      r = await perform({ kind: 'upload', bucket: 'receipts', path, blob: await compressImage(file), table: 'expenses', row: { ...row, receipt_path: path } });
    } else {
      r = await perform({ kind: 'insert', table: 'expenses', row });
    }
    setBusy(false);
    if (r.error) toast(tErr(r.error)); else { toast(r.queued ? t('off.saved') : t('day.expenseSent')); onClose(); }
  };
  return (
    <Sheet title={t('day.expense')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <div className="chips" role="group" aria-label={t('day.expense')}>
          {['gas', 'supplies', 'parking', 'other'].map((c) => <button type="button" key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{t(`exp.${c}`)}</button>)}
        </div>
        <Field label={t('exp.amount')}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label={`${t('exp.desc')} (${t('c.optional')})`}><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label={t('day.receipt')}><input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
        <button className="btn btn-primary btn-block" disabled={busy || toCents(amount) <= 0}>{t('c.confirm')}</button>
      </form>
    </Sheet>
  );
}

function ProblemForm({ job, membershipId, onClose }: { job: HJob; membershipId: string; onClose: () => void }) {
  const { t, tErr, toast } = useApp();
  const [cat, setCat] = useState('no_access');
  const [desc, setDesc] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const r = await perform({ kind: 'insert', table: 'job_issues', row: { id: crypto.randomUUID(), job_id: job.job_id, company_id: job.company_id, reported_by: membershipId, category: cat, description: desc || t(`day.${cat === 'no_access' ? 'noAccess' : cat === 'damage' ? 'damage' : cat === 'supplies' ? 'supplies' : 'otherIssue'}`) } });
    if (r.error) toast(tErr(r.error)); else { toast(r.queued ? t('off.saved') : t('day.problemSent')); onClose(); }
  };
  return (
    <Sheet title={t('day.problem')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <span className="label">{t('day.problemCat')}</span>
        <div className="stack" role="radiogroup">
          {[['no_access', 'day.noAccess'], ['damage', 'day.damage'], ['supplies', 'day.supplies'], ['other', 'day.otherIssue']].map(([v, k]) => (
            <label key={v} className="check" style={{ minHeight: 40, alignItems: 'center' }}><input type="radio" name="cat" checked={cat === v} onChange={() => setCat(v)} />{t(k)}</label>
          ))}
        </div>
        <Field label={t('exp.desc')}><textarea className="textarea" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <button className="btn btn-primary btn-block">{t('c.confirm')}</button>
      </form>
    </Sheet>
  );
}
