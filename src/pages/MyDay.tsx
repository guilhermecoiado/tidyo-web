import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, LoadingList, Logo, Sheet, StatusBadge } from '../components/ui';
import { fmtHours, hoursBetween, startOfDay, time, toCents, longDay, addDays } from '../lib/format';

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

  const load = useCallback(async () => {
    if (!membership) return;
    const today = startOfDay(new Date());
    const { data } = await supabase.rpc('helper_jobs');
    const all = (data || []) as HJob[];
    setJobs(all.filter((j) => new Date(j.scheduled_start) >= today && new Date(j.scheduled_start) < addDays(today, 1) && j.status !== 'canceled'));
    const { data: te } = await supabase.from('time_entries').select('id, clock_in, clock_out')
      .eq('membership_id', membership.id).gte('clock_in', today.toISOString()).order('clock_in');
    setEntries((te || []) as Entry[]);
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

  const clock = async () => {
    if (open) {
      const { error } = await supabase.from('time_entries').update({ clock_out: new Date().toISOString() }).eq('id', open.id);
      if (error) toast(tErr(error.message));
    } else {
      const { error } = await supabase.from('time_entries').insert({ company_id: membership.company_id, membership_id: membership.id, clock_in: new Date().toISOString() });
      if (error) toast(tErr(error.message));
    }
    load();
  };
  const progress = async (job: HJob, status: string, n?: string) => {
    const { error } = await supabase.rpc('job_progress', { p_job: job.job_id, p_status: status, p_note: n || null });
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); load(); }
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
          {isStaff
            ? <Link className="btn btn-secondary" style={{ minHeight: 44 }} to="/app">{t('nav.today')}</Link>
            : <button className="icon-btn" aria-label={t('auth.signout')} onClick={() => setAskOut(true)}><Icon name="logout" size={18} /></button>}
        </div>

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
            {j.status === 'scheduled' && <button className="btn btn-primary" onClick={() => progress(j, 'in_progress')}>{t('day.start')}</button>}
            {j.status === 'in_progress' && <button className="btn btn-primary" onClick={() => { setNote(''); setFinish(j); }}>{t('day.finish')}</button>}
            {j.status !== 'completed' && <button className="btn btn-ghost" onClick={() => setProblem(j)}><Icon name="alert" size={18} />{t('day.problem')}</button>}
          </section>
        ))}

        <button className="btn btn-secondary" onClick={() => setExpense(true)}><Icon name="receipt" size={18} />{t('day.expense')}</button>
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
    let receipt: string | null = null;
    if (file && session) {
      const path = `${companyId}/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
      if (!error) receipt = path;
    }
    const { error } = await supabase.from('expenses').insert({
      company_id: companyId, membership_id: membershipId, category: cat, amount_cents: toCents(amount),
      description: desc || null, receipt_path: receipt, reimbursable: true, status: 'pending',
    });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('day.expenseSent')); onClose(); }
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
    const { error } = await supabase.from('job_issues').insert({ job_id: job.job_id, company_id: job.company_id, reported_by: membershipId, category: cat, description: desc || t(`day.${cat === 'no_access' ? 'noAccess' : cat === 'damage' ? 'damage' : cat === 'supplies' ? 'supplies' : 'otherIssue'}`) });
    if (error) toast(tErr(error.message)); else { toast(t('day.problemSent')); onClose(); }
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
