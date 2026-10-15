import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, LoadingList, StatusBadge } from '../components/ui';
import { ChecklistView, PhotoStrip } from '../components/proof';
import { getChecklist, getJobPhotos, type CheckItem, type Photo } from '../lib/photos';
import { time } from '../lib/format';
import { cacheGet, cacheSet, perform, useOffline } from '../lib/offline';
import { compressImage } from '../lib/photos';

type HJob = { job_id: string; company_id: string; status: string; scheduled_start: string; scheduled_end: string; client_name: string; address_line1: string; city: string; access_instructions: string | null; pets: string | null; special_instructions: string | null; client_notes: string | null };

export default function JobWork() {
  const { id = '' } = useParams();
  const { t, tg, tErr, lang, membership, toast } = useApp();
  const nav = useNavigate();
  const [job, setJob] = useState<HJob | null>(null);
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busyKind, setBusyKind] = useState<'' | 'before' | 'after'>('');
  const [note, setNote] = useState('');
  const [ask, setAsk] = useState<'' | 'incomplete' | 'noAfter'>('');
  const [finishing, setFinishing] = useState(false);

  const { online, pending } = useOffline();
  const saveItems = (list: CheckItem[]) => { setItems(list); cacheSet(`checklist_${id}`, list); };
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('helper_jobs');
    const list = error ? cacheGet<HJob[]>('helper_jobs') || [] : (data || []) as HJob[];
    const j = list.find((x) => x.job_id === id) || null;
    setJob(j);
    if (!j) return;
    try { const c = await getChecklist(id); setItems(c); cacheSet(`checklist_${id}`, c); }
    catch { setItems(cacheGet<CheckItem[]>(`checklist_${id}`) || []); }
    try { setPhotos(await getJobPhotos(id)); } catch { /* offline: keep local previews */ }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const toggle = async (it: CheckItem) => {
    if (job?.status !== 'in_progress') { toast(t('ck.startFirst')); return; }
    const done_at = it.done_at ? null : new Date().toISOString();
    saveItems((items || []).map((x) => (x.id === it.id ? { ...x, done_at } : x)));
    const r = await perform({ kind: 'update', table: 'job_checklist_items', id: it.id, patch: { done_at } });
    if (r.error) { toast(tErr(r.error)); load(); }
  };
  const add = async (kind: 'before' | 'after', f: File) => {
    if (!job) return;
    setBusyKind(kind);
    try {
      const blob = await compressImage(f);
      const pid = crypto.randomUUID();
      const path = `${job.company_id}/${job.job_id}/${pid}.jpg`;
      const r = await perform({ kind: 'upload', bucket: 'job-photos', path, blob, table: 'job_photos',
        row: { id: pid, job_id: job.job_id, company_id: job.company_id, kind, storage_path: path, uploaded_by: membership?.id || null } });
      if (r.error) toast(t('ck.photoFail'));
      else setPhotos((p) => [...p, { id: pid, kind, storage_path: path, taken_at: new Date().toISOString(), url: URL.createObjectURL(blob) }]);
    } catch { toast(t('ck.photoFail')); }
    setBusyKind('');
  };
  const finish = async (force = false) => {
    if (!job || !items) return;
    const open = items.filter((i) => !i.done_at).length;
    if (!force && !photos.some((p) => p.kind === 'after')) { setAsk('noAfter'); return; }
    if (!force && open > 0) { setAsk('incomplete'); return; }
    setFinishing(true);
    const r = await perform({ kind: 'rpc', fn: 'job_progress', args: { p_job: job.job_id, p_status: 'completed', p_note: note || null } });
    setFinishing(false);
    if (r.error) { toast(tErr(r.error)); return; }
    const cached = cacheGet<HJob[]>('helper_jobs') || [];
    cacheSet('helper_jobs', cached.map((x) => (x.job_id === job.job_id ? { ...x, status: 'completed' } : x)));
    toast(r.queued ? t('off.saved') : t('ck.done'));
    nav('/dia');
  };

  if (job === null && items === null) return <div className="shell"><main className="page no-nav"><LoadingList n={5} /></main></div>;
  if (!job) return <div className="shell"><main className="page no-nav"><p>{t('c.notAllowed')}</p><Link to="/dia">{t('nav.myDay')}</Link></main></div>;

  const editable = job.status === 'in_progress';
  const open = (items || []).filter((i) => !i.done_at).length;

  return (
    <div className="shell">
      <main className="page no-nav">
        <div className="topbar">
          <Link className="icon-btn" to="/dia" aria-label={t('nav.myDay')}><Icon name="chevL" size={18} /></Link>
          <div className="grow">
            <h1 style={{ fontSize: 20 }}>{job.client_name}</h1>
            <div className="small muted">{time(job.scheduled_start, lang)}–{time(job.scheduled_end, lang)} · {job.address_line1}, {job.city}</div>
          </div>
          <StatusBadge status={job.status} />
        </div>
        {(!online || pending > 0) && (
          <div className="strip" role="status" style={online ? { background: 'var(--warn-bg)', borderColor: '#F3DDB8', color: 'var(--warn-fg)' } : undefined}>
            <span className="grow">{!online ? t('off.offline') : t('off.syncing', { n: pending })}</span>
          </div>
        )}
        {(job.access_instructions || job.pets || job.special_instructions || job.client_notes) && (
          <div className="card stack" style={{ gap: 6 }}>
            {job.access_instructions && <div className="small"><b>{t('day.access')}:</b> {job.access_instructions}</div>}
            {job.pets && <div className="small"><b>{t('cl.pets')}:</b> {job.pets}</div>}
            {job.special_instructions && <div className="small"><b>{t('cl.special')}:</b> {job.special_instructions}</div>}
            {job.client_notes && <div className="small"><b>{t('job.notesClient')}:</b> {job.client_notes}</div>}
          </div>
        )}
        <section className="card"><PhotoStrip title={t('ck.before')} photos={photos.filter((p) => p.kind === 'before')} onAdd={editable ? (f) => add('before', f) : undefined} busy={busyKind === 'before'} /></section>
        <section className="card">{items ? <ChecklistView items={items} editable={editable} onToggle={toggle} /> : <LoadingList n={4} />}</section>
        <section className="card"><PhotoStrip title={t('ck.after')} photos={photos.filter((p) => p.kind === 'after')} onAdd={editable ? (f) => add('after', f) : undefined} busy={busyKind === 'after'} /></section>
        {editable && (
          <>
            <Field label={tg('day.finishNote')}><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <button className="btn btn-primary btn-block" disabled={finishing} onClick={() => finish()}>{t('day.finish')}</button>
          </>
        )}
      </main>
      {ask === 'incomplete' && <Confirm text={t('ck.incomplete', { n: open })} confirmLabel={t('ck.finishAnyway')} onCancel={() => setAsk('')} onConfirm={() => { setAsk(''); finish(true); }} />}
      {ask === 'noAfter' && <Confirm text={t('ck.noAfter')} confirmLabel={t('ck.finishAnyway')} onCancel={() => setAsk('')} onConfirm={() => { setAsk(''); open > 0 ? setAsk('incomplete') : finish(true); }} />}
    </div>
  );
}
