import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { InstallCard } from '../components/InstallCard';
import { Confirm, Field, Icon, LoadingList, Sheet, StatusBadge, Wordmark } from '../components/ui';
import { ChecklistView, PhotoStrip, Stars } from '../components/proof';
import { getChecklist, getJobPhotos, type CheckItem, type Photo } from '../lib/photos';
import { dayLabel, money, time } from '../lib/format';
import Auth, { LangPicker } from './Auth';

type PJob = { id: string; status: string; scheduled_start: string; scheduled_end: string; client_notes: string | null; completed_at: string | null; completion_note: string | null; rating_status: string; rating: number | null; rating_comment: string | null; rating_due_at: string | null; price_cents: number };
type PInv = { id: string; number: string; status: string; due_on: string | null; total_cents: number; paid_cents: number };

const canRate = (j: PJob) => j.status === 'completed' && j.rating_status === 'pending' && !!j.rating_due_at && new Date(j.rating_due_at) > new Date();

export default function Portal() {
  const { t, lang, portal } = useApp();
  const [jobs, setJobs] = useState<PJob[] | null>(null);
  const [invoices, setInvoices] = useState<PInv[]>([]);
  const [insp, setInsp] = useState<{ id: string; score: number | null; inspected_at: string; items: { area: string; ok: boolean; note?: string }[] }[]>([]);
  const [open, setOpen] = useState<PJob | null>(null);
  const [askOut, setAskOut] = useState(false);

  const load = useCallback(async () => {
    const [{ data: j }, { data: inv }] = await Promise.all([
      supabase.rpc('portal_jobs'),
      supabase.from('invoices').select('id, number, status, due_on, total_cents, paid_cents').order('created_at', { ascending: false }).limit(50),
    ]);
    setJobs((j || []) as PJob[]);
    setInvoices((inv || []) as PInv[]);
    const { data: ins } = await supabase.from('inspections').select('id, score, inspected_at, items').order('inspected_at', { ascending: false }).limit(10);
    setInsp((ins || []) as typeof insp);
  }, []);
  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = (jobs || []).filter((j) => new Date(j.scheduled_start) >= now && j.status === 'scheduled').reverse();
  const past = (jobs || []).filter((j) => !(new Date(j.scheduled_start) >= now && j.status === 'scheduled'));
  const toRate = past.filter(canRate);

  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <div className="grow home-hello"><div className="small muted bold one-line">{portal?.company_name}</div><h1 className="one-line">{t('pt.title')}</h1></div>
          <button className="icon-btn" aria-label={t('auth.signout')} onClick={() => setAskOut(true)}><Icon name="logout" size={18} /></button>
        </div>

        <InstallCard />
        {toRate.map((j) => (
          <button key={j.id} className="card row" onClick={() => setOpen(j)} style={{ background: 'var(--brand-light)', borderColor: '#B7E3D6', textAlign: 'left', cursor: 'pointer' }}>
            <span className="grow"><span className="bold">{t('pt.rateTitle')}</span><br /><span className="small muted">{dayLabel(new Date(j.scheduled_start), lang)}</span></span>
            <span className="btn btn-primary" style={{ minHeight: 40 }}>{t('pt.rateNow')}</span>
          </button>
        ))}

        <section className="stack">
          <h2>{t('pt.next')}</h2>
          {!jobs ? <LoadingList n={2} /> : upcoming.length === 0 ? <div className="empty">{t('pt.none')}</div> : upcoming.map((j) => (
            <div key={j.id} className="item" style={{ cursor: 'default' }}>
              <span className="body"><span className="title">{dayLabel(new Date(j.scheduled_start), lang)}</span><span className="small muted">{time(j.scheduled_start, lang)}–{time(j.scheduled_end, lang)}</span></span>
              <StatusBadge status={j.status} />
            </div>
          ))}
        </section>

        <section className="stack">
          <h2>{t('pt.past')}</h2>
          {jobs && past.map((j) => (
            <button key={j.id} className="item" onClick={() => setOpen(j)}>
              <span className="body"><span className="title">{dayLabel(new Date(j.scheduled_start), lang)}</span>
                <span className="small muted">{j.rating ? '★'.repeat(j.rating) : j.rating_status === 'auto_approved' ? '✓' : ''}</span></span>
              <StatusBadge status={j.status} />
            </button>
          ))}
        </section>

        {insp.length > 0 && (
          <section className="stack">
            <h2>{t('pt.inspections')}</h2>
            {insp.map((i) => (
              <div key={i.id} className="card tight stack" style={{ gap: 4 }}>
                <div className="row"><span className="grow bold">{new Date(i.inspected_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })}</span><b className="num">{i.score}</b></div>
                {i.items.filter((x) => !x.ok).map((x) => <span key={x.area} className="small">• {t(x.area)}{x.note ? `: ${x.note}` : ''}</span>)}
              </div>
            ))}
          </section>
        )}
        {invoices.length > 0 && (
          <section className="stack">
            <h2>{t('pt.invoices')}</h2>
            {invoices.map((i) => (
              <div key={i.id} className="item" style={{ cursor: 'default' }}>
                <span className="body"><span className="title">{i.number}</span><span className="small muted">{i.due_on ? `${t('inv.due')} ${new Date(i.due_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' })}` : ''}</span></span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className="bold num">{money(i.total_cents, lang)}</span>
                  <span className={`badge ${i.status === 'paid' ? 'b-ok' : 'b-neutral'}`}>{t(`inv.status.${i.status}`)}</span>
                </span>
              </div>
            ))}
            <p className="hint" style={{ margin: 0 }}>{t('pt.payHint')}</p>
          </section>
        )}
        <Link className="btn btn-secondary" to="/mensagens"><Icon name="chat" size={18} />{t('ch.title')}</Link>
        <LangPicker />
      </main>
      {open && <VisitSheet job={open} onClose={() => setOpen(null)} onRated={() => { setOpen(null); load(); }} />}
      {askOut && <Confirm text={`${t('auth.signout')}?`} confirmLabel={t('auth.signout')} onCancel={() => setAskOut(false)}
        onConfirm={async () => { await supabase.auth.signOut(); window.location.replace('/'); }} />}
    </div>
  );
}

function VisitSheet({ job, onClose, onRated }: { job: PJob; onClose: () => void; onRated: () => void }) {
  const { t, tErr, lang, toast } = useApp();
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getChecklist(job.id).then(setItems).catch(() => setItems([]));
    getJobPhotos(job.id).then(setPhotos);
  }, [job.id]);
  const rate = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('rate_job', { p_job: job.id, p_rating: stars, p_comment: comment || null });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('pt.thanks')); onRated(); }
  };
  return (
    <Sheet title={dayLabel(new Date(job.scheduled_start), lang)} onClose={onClose}>
      <div className="row"><StatusBadge status={job.status} /><span className="small muted">{time(job.scheduled_start, lang)}–{time(job.scheduled_end, lang)}</span></div>
      {job.completion_note && <div className="card tight small">{job.completion_note}</div>}
      {canRate(job) && (
        <section className="card stack" style={{ background: 'var(--brand-light)', borderColor: '#B7E3D6' }}>
          <h3>{t('pt.rateTitle')}</h3>
          <Stars value={stars} onChange={setStars} />
          <Field label={t('pt.comment')}><textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} /></Field>
          <span className="hint">{t('pt.rateHint')}</span>
          <button className="btn btn-primary" disabled={!stars || busy} onClick={rate}>{t('c.confirm')}</button>
        </section>
      )}
      {job.rating ? <div className="stack" style={{ gap: 4 }}><Stars value={job.rating} size={22} />{job.rating_comment && <span className="small">{job.rating_comment}</span>}</div> : null}
      {photos.some((p) => p.kind === 'before') && <PhotoStrip title={t('ck.before')} photos={photos.filter((p) => p.kind === 'before')} />}
      {photos.some((p) => p.kind === 'after') && <PhotoStrip title={t('ck.after')} photos={photos.filter((p) => p.kind === 'after')} />}
      {items && items.length > 0 && <ChecklistView items={items} editable={false} />}
    </Sheet>
  );
}

export function PortalInvite() {
  const { t, tErr, session, refresh } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('t') || '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (token) { try { sessionStorage.setItem('tidyo.portalInvite', token); } catch { /* ignore */ } } }, [token]);
  if (!session) return <Auth initial="signup" title={t('pt.joinTitle')} subtitle={t('pt.joinText')} />;
  const accept = async () => {
    setBusy(true); setError('');
    let tk = token;
    if (!tk) { try { tk = sessionStorage.getItem('tidyo.portalInvite') || ''; } catch { /* ignore */ } }
    const { error } = await supabase.rpc('accept_portal_invite', { p_token: tk });
    setBusy(false);
    if (error) { setError(tErr(error.message)); return; }
    try { sessionStorage.removeItem('tidyo.portalInvite'); } catch { /* ignore */ }
    await refresh();
    nav('/portal', { replace: true });
  };
  return (
    <main className="auth-wrap">
      <Wordmark />
      <h1>{t('pt.joinTitle')}</h1>
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" onClick={accept} disabled={busy}>{t('pt.join')}</button>
      <LangPicker />
    </main>
  );
}
