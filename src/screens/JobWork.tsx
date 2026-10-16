// Checklist (canvas "Checklist"): one visit in progress — notes, before/after photos, tasks by room, problem, signature, finish
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { useTaskLabel } from '../components/proof';
import { C, Empty, Head, I, Svg } from '../components/kit';
import { getChecklist, getJobPhotos, compressImage, type CheckItem, type Photo } from '../lib/photos';
import { cacheGet, cacheSet, perform, useOffline } from '../lib/offline';
import { ProblemSheet, type HJob } from './MyDay';

type WJob = HJob & { started_at?: string | null };

export default function JobWork() {
  const { id = '' } = useParams();
  const { t, tErr, membership, toast } = useApp();
  const nav = useNavigate();
  const label = useTaskLabel();
  const { online, pending } = useOffline();
  const [job, setJob] = useState<WJob | null | undefined>(undefined);
  const [all, setAll] = useState<WJob[]>([]);
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'before' | 'after' | 'start' | 'finish'>('');
  const [problem, setProblem] = useState(false);
  const [sign, setSign] = useState(false);
  const sig = useRef<HTMLCanvasElement>(null);
  const [signed, setSigned] = useState(false);
  const [finish, setFinish] = useState<'' | 'ask' | 'done'>('');
  const [, tick] = useState(0);

  const saveItems = (list: CheckItem[]) => { setItems(list); cacheSet(`checklist_${id}`, list); };
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('helper_jobs');
    const list = (error ? cacheGet<WJob[]>('helper_jobs') || [] : (data || []) as WJob[]);
    if (!error) cacheSet('helper_jobs', list);
    setAll(list);
    const j = list.find((x) => x.job_id === id) || null;
    setJob(j);
    if (!j) return;
    try { const c = await getChecklist(id); saveItems(c); } catch { setItems(cacheGet<CheckItem[]>(`checklist_${id}`) || []); }
    try { setPhotos(await getJobPhotos(id)); } catch { /* offline: keep local previews */ }
    supabase.rpc('job_extras', { p_job: id }).then(({ data: ex }) => setExtras(((ex || []) as string[]).filter(Boolean)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); const i = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(i); }, [load]);

  const setStatus = (status: string) => {
    setJob((j) => (j ? { ...j, status, started_at: status === 'in_progress' ? new Date().toISOString() : j.started_at } : j));
    const cached = cacheGet<WJob[]>('helper_jobs') || [];
    cacheSet('helper_jobs', cached.map((x) => (x.job_id === id ? { ...x, status } : x)));
  };
  const start = async () => {
    if (!job) return;
    setBusy('start');
    const pos = await new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 });
    });
    if (pos) await perform({ kind: 'rpc', fn: 'job_start_location', args: { p_job: job.job_id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude } });
    const r = await perform({ kind: 'rpc', fn: 'job_progress', args: { p_job: job.job_id, p_status: 'in_progress', p_note: null } });
    setBusy('');
    if (r.error) { toast(tErr(r.error)); return; }
    setStatus('in_progress');
  };
  const toggle = async (it: CheckItem) => {
    if (job?.status !== 'in_progress') { toast(t('ck.startFirst')); return; }
    const done_at = it.done_at ? null : new Date().toISOString();
    saveItems((items || []).map((x) => (x.id === it.id ? { ...x, done_at } : x)));
    const r = await perform({ kind: 'update', table: 'job_checklist_items', id: it.id, patch: { done_at } });
    if (r.error) { toast(tErr(r.error)); load(); }
  };
  const addPhoto = async (kind: 'before' | 'after', f: File) => {
    if (!job) return;
    setBusy(kind);
    try {
      const blob = await compressImage(f);
      const pid = crypto.randomUUID();
      const path = `${job.company_id}/${job.job_id}/${pid}.jpg`;
      const r = await perform({ kind: 'upload', bucket: 'job-photos', path, blob, table: 'job_photos', row: { id: pid, job_id: job.job_id, company_id: job.company_id, kind, storage_path: path, uploaded_by: membership?.id || null } });
      if (r.error) toast(t('ck.photoFail'));
      else setPhotos((p) => [...p, { id: pid, kind, storage_path: path, taken_at: new Date().toISOString(), url: URL.createObjectURL(blob) }]);
    } catch { toast(t('ck.photoFail')); }
    setBusy('');
  };
  const complete = async () => {
    if (!job) return;
    setBusy('finish');
    let sigPath: string | null = null;
    if (sign && signed && sig.current && navigator.onLine) {
      const blob = await new Promise<Blob | null>((res) => sig.current!.toBlob(res, 'image/png'));
      if (blob) {
        const p = `${job.company_id}/${job.job_id}/signature.png`;
        const { error } = await supabase.storage.from('signatures').upload(p, blob, { contentType: 'image/png', upsert: true });
        if (!error) sigPath = p;
      }
    }
    const r = await perform({ kind: 'rpc', fn: 'job_progress', args: { p_job: job.job_id, p_status: 'completed', p_note: null, ...(sigPath ? { p_signature_path: sigPath } : {}) } });
    setBusy('');
    if (r.error) { toast(tErr(r.error)); return; }
    setStatus('completed');
    if (r.queued) toast(t('off.saved'));
    setFinish('done');
  };

  if (job === undefined) return <div className="k-screen"><main className="k-page nobar">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: i ? 120 : 52, borderRadius: 16 }} />)}</main></div>;
  if (!job) return <div className="k-screen"><main className="k-page nobar"><Head back="/dia" title={t('ck.open')} /><Empty title={t('c.notAllowed')} action={<Link className="k-btn k-btn-line" to="/dia">{t('nav.myDay')}</Link>} /></main></div>;

  const editable = job.status === 'in_progress';
  const before = photos.filter((p) => p.kind === 'before'), after = photos.filter((p) => p.kind === 'after');
  const list = items || [];
  const done = list.filter((i) => i.done_at).length;
  const rooms: { room: string; items: CheckItem[] }[] = [];
  for (const it of list) { const g = rooms.find((r) => r.room === it.room); if (g) g.items.push(it); else rooms.push({ room: it.room, items: [it] }); }
  const elapsed = job.started_at ? Math.max(0, Math.round((Date.now() - +new Date(job.started_at)) / 60000)) : 0;
  const pill = job.status === 'in_progress' ? ['#FDF0DC', '#8A4B05', `${t('status.in_progress')} ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`]
    : job.status === 'completed' ? ['#DDF1EC', '#0B6B5F', t('status.completed')] : ['#EEF1F0', '#3E4F4C', t('status.scheduled')];
  const notes = [job.access_instructions, job.pets, job.special_instructions, job.client_notes].filter(Boolean) as string[];
  const nextJob = all.find((x) => x.job_id !== job.job_id && x.membership_id === job.membership_id && x.status === 'scheduled' && new Date(x.scheduled_start).toDateString() === new Date().toDateString());
  const first = membership?.display_name.split(' ')[0] || '';

  const photoGrid = (kind: 'before' | 'after', ps: Photo[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
      {ps.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ aspectRatio: '1', borderRadius: 12, background: p.url ? `#CFE0DB url(${p.url}) center/cover` : '#CFE0DB', display: 'block' }} aria-label={t(kind === 'before' ? 'ck.before' : 'ck.after')} />)}
      {editable && (
        <label style={{ aspectRatio: '1', borderRadius: 12, border: '1.5px dashed #9DB5B0', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: busy === kind ? 0.5 : 1 }} aria-label={t(kind === 'before' ? 'wk.addBefore' : 'wk.addAfter')}>
          <Svg d={I.cam} size={22} color={C.accent} />
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPhoto(kind, f); }} />
        </label>
      )}
    </div>
  );

  return (
    <div className="k-screen">
      <main className="k-page footer" style={{ gap: 16 }}>
        <Head back="/dia" title={job.client_name} sub={[job.service_name, `${job.address_line1}, ${job.city}`].filter(Boolean).join(' · ')}
          right={<span className="num nw" style={{ fontSize: 12, fontWeight: 800, color: pill[1], background: pill[0], borderRadius: 999, padding: '5px 10px', flex: 'none' }}>{pill[2]}</span>} />
        {(!online || pending > 0) && <div role="status" style={{ background: '#FFF8E6', border: '1px solid #F3DFA8', borderRadius: 14, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: '#6B4A04', lineHeight: 1.45 }}>{!online ? t('off.offline') : t('off.syncing', { n: pending })}</div>}

        {notes.length > 0 && (
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('wk.notes')}</span>
            {notes.map((n, i) => <span key={i} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{n}</span>)}
          </div>
        )}
        {extras.length > 0 && (
          <div style={{ background: '#FDF0DC', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#8A4B05', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('wk.extras')}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#6B3A04' }}>{extras.join(' · ')}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('ck.before')}</span>
          {before.length || editable ? photoGrid('before', before) : <span style={{ fontSize: 13, color: C.muted }}>{t('wk.noPhotos')}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800 }}>{t('wk.tasks')}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{done}/{list.length}</span>
          </div>
          {items === null ? <div className="skeleton" style={{ height: 160, borderRadius: 16 }} /> : rooms.length === 0 ? <span style={{ fontSize: 13, color: C.muted }}>{t('wk.noTasks')}</span> : rooms.map((g) => (
            <div key={g.room} style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '4px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{label(g.room)}</span>
                <span className="num" style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{g.items.filter((i) => i.done_at).length}/{g.items.length}</span>
              </div>
              {g.items.map((it) => (
                <label key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, borderTop: '1px solid #EEF2F1', cursor: editable ? 'pointer' : 'default' }}>
                  <input type="checkbox" checked={!!it.done_at} onChange={() => toggle(it)} style={{ width: 22, height: 22, accentColor: C.accent, margin: 0, flex: 'none' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textDecoration: it.done_at ? 'line-through' : 'none', color: it.done_at ? '#7A8C88' : C.ink }}>{label(it.task)}</span>
                </label>
              ))}
            </div>
          ))}
        </div>

        {after.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('ck.after')}</span>
            {photoGrid('after', after)}
          </div>
        )}

        {job.status !== 'completed' && (
          <button onClick={() => setProblem(true)} style={{ minHeight: 48, borderRadius: 14, border: '1px solid #F5D3C2', background: '#FFF3EC', color: '#8F2F08', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
            <Svg d={I.alert} size={18} />{t('day.problem')}
          </button>
        )}

        {editable && (
          <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, cursor: 'pointer' }}>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}><span style={{ fontWeight: 800, fontSize: 14 }}>{t('wk.sign')}</span><span style={{ fontSize: 12, color: C.muted }}>{t('wk.signHint')}</span></span>
              <input type="checkbox" checked={sign} onChange={() => setSign(!sign)} style={{ width: 22, height: 22, accentColor: C.accent, margin: 0 }} />
            </label>
            {sign && <SignaturePad canvas={sig} onSigned={setSigned} />}
          </div>
        )}
      </main>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#FFFFFF', borderTop: `1px solid ${C.line}`, zIndex: 20, padding: '12px 16px calc(22px + env(safe-area-inset-bottom))' }}>
        <div style={{ maxWidth: 528, margin: '0 auto', display: 'flex', gap: 10 }}>
          {job.status === 'scheduled' ? (
            <button className="k-btn k-btn-fill k-btn-big" style={{ flex: 1 }} disabled={busy === 'start'} onClick={start}>{t('wk.start')}</button>
          ) : job.status === 'in_progress' ? (
            <>
              <label className="k-iconbtn" style={{ width: 52, height: 52, borderRadius: 16, flex: 'none', cursor: 'pointer', opacity: busy === 'after' ? 0.5 : 1 }} aria-label={t('wk.addAfter')}>
                <Svg d={I.cam} size={22} color={C.ink} w={1.9} />
                <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) addPhoto('after', f); }} />
              </label>
              <button className="k-btn k-btn-fill k-btn-big" style={{ flex: 1 }} onClick={() => setFinish('ask')}>{t('wk.finish')}</button>
            </>
          ) : (
            <Link className="k-btn k-btn-line k-btn-big" style={{ flex: 1 }} to="/dia">{t('nav.myDay')}</Link>
          )}
        </div>
      </div>

      {problem && <ProblemSheet job={job} onClose={() => setProblem(false)} />}
      {finish && (
        <Sheet title={finish === 'done' ? t('wk.doneT', { name: first }) : t('wk.finishAsk')} onClose={() => (finish === 'done' ? nav('/dia') : setFinish(''))}>
          {finish === 'ask' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#F4F7F6', borderRadius: 14, padding: 12 }}>
                {[[t('wk.tasksRow'), t('wk.nOfM', { n: done, m: list.length }), done < list.length ? '#8A4B05' : '#0B6B5F'], [t('ck.photos'), t('wk.photosRow', { b: before.length, a: after.length }), after.length ? C.ink : '#8A4B05'], [t('wk.signRow'), sign && signed ? t('wk.signed') : t('wk.noSign'), C.ink]].map(([k, v, c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span style={{ color: C.muted }}>{k}</span><span style={{ fontWeight: 800, color: c }}>{v}</span></div>
                ))}
              </div>
              {done < list.length && <span style={{ fontSize: 12.5, color: '#8A4B05', fontWeight: 700 }}>{t('wk.missing')}</span>}
              {!after.length && <span style={{ fontSize: 12.5, color: '#8A4B05', fontWeight: 700 }}>{t('ck.noAfter')}</span>}
              <div className="k-pair">
                <button className="k-btn k-btn-line" onClick={() => setFinish('')}>{t('c.back')}</button>
                <button className="k-btn k-btn-fill" disabled={busy === 'finish'} onClick={complete}>{t('wk.finishBtn')}</button>
              </div>
            </>
          ) : (
            <>
              <span style={{ width: 48, height: 48, borderRadius: 48, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={I.check} size={24} color={C.accent} w={2.6} /></span>
              <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{t('wk.doneText', { client: job.client_name })}</span>
              {nextJob ? <Link className="k-btn k-btn-fill" to="/dia/navegacao">{t('wk.next')}</Link> : <Link className="k-btn k-btn-fill" to="/dia">{t('nav.myDay')}</Link>}
            </>
          )}
        </Sheet>
      )}
    </div>
  );
}

function SignaturePad({ canvas, onSigned }: { canvas: RefObject<HTMLCanvasElement>; onSigned: (v: boolean) => void }) {
  const { t } = useApp();
  const drawing = useRef(false);
  const [has, setHas] = useState(false);
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink;
  }, [canvas]);
  const pos = (e: RPointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHas(false); onSigned(false); };
  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvas} aria-label={t('wk.signHere')} style={{ width: '100%', height: 130, borderRadius: 12, border: '1.5px dashed #B9C7C4', background: '#F7FAF9', touchAction: 'none', display: 'block' }}
        onPointerDown={(e) => { drawing.current = true; const [x, y] = pos(e); const ctx = canvas.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); (e.target as Element).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = canvas.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); if (!has) { setHas(true); onSigned(true); } }}
        onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
      {!has && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8AA19C', fontSize: 13, fontWeight: 700, pointerEvents: 'none' }}>{t('wk.signHere')}</span>}
      {has && <button type="button" onClick={clear} style={{ position: 'absolute', right: 8, top: 8, minHeight: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#FFFFFF', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{t('wk.clear')}</button>}
    </div>
  );
}
