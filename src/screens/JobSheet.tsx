// Detalhe do job — canvas Agenda (sheet with colour bar, address/value/recurrence and Mensagem · Reagendar · Fechar)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { C, Pill, colorOf, hm, jobTone, shortName, usd } from '../components/kit';
import { ChecklistView, PhotoStrip, Stars } from '../components/proof';
import { getChecklist, getJobPhotos, type CheckItem, type Photo } from '../lib/photos';
import { memberIndex, type Job, type Member } from '../lib/data';
import { NewCharge } from './Invoices';

export function recurrenceText(job: Job, t: (k: string, p?: Record<string, string | number>) => string) {
  if (job.contract_id) return t('job.recContract');
  const r = job.recurrences?.rrule || '';
  const n = Number((r.match(/INTERVAL=(\d+)/) || [])[1] || 1);
  if (/FREQ=WEEKLY/.test(r)) return n === 1 ? t('job.recWeekly') : t('job.recEveryN', { n });
  if (/FREQ=MONTHLY/.test(r)) return t('job.recMonthly');
  return t('job.recOnce');
}

export function JobSheet({ job, members, onClose, onChanged }: { job: Job; members: Member[]; onClose: () => void; onChanged: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const nav = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [more, setMore] = useState(false);
  const [charging, setCharging] = useState(false);
  // completed job with a price: is it already on a (non-void) invoice?
  const [billed, setBilled] = useState<{ number: string } | null | undefined>(undefined);
  const billable = job.status === 'completed' && job.price_cents > 0 && !job.contract_id;
  useEffect(() => {
    if (!billable) return;
    supabase.from('invoice_lines').select('invoices(number, status)').eq('job_id', job.id).then(({ data }) => {
      const inv = ((data || []) as unknown as { invoices: { number: string; status: string } | null }[]).map((r) => r.invoices).find((i) => i && i.status !== 'void');
      setBilled(inv ? { number: inv.number } : null);
    });
  }, [job.id, billable]);
  useEffect(() => {
    if (job.status === 'scheduled') return;
    getJobPhotos(job.id).then(setPhotos).catch(() => undefined);
    getChecklist(job.id).then(setItems).catch(() => undefined);
  }, [job.id, job.status]);
  const helperId = job.job_assignments[0]?.membership_id;
  const helper = members.find((m) => m.id === helperId);
  const color = helper ? colorOf(memberIndex(members, helper.id))[0] : '#9AA9A6';

  const setStatus = async (status: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('job_progress', { p_job: job.id, p_status: status });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onChanged(); }
  };
  const assign = async (id: string) => {
    if (!company || id === helperId) return;
    setBusy(true);
    await supabase.from('job_assignments').delete().eq('job_id', job.id);
    const { error } = id ? await supabase.from('job_assignments').insert({ job_id: job.id, membership_id: id, company_id: company.id, is_lead: true }) : { error: null };
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onChanged(); }
  };
  const message = async () => {
    if (!helper?.user_id || !company) return;
    const { data, error } = await supabase.rpc('open_conversation', { p_company: company.id, p_with: helper.user_id });
    if (error) toast(tErr(error.message)); else nav(`/mensagens/${data}`);
  };

  if (charging) return <NewCharge preset={job.client_id} jobId={job.id} onClose={() => setCharging(false)} onSaved={() => { setCharging(false); onChanged(); }} />;

  return (
    <Sheet title={job.clients?.name || ''} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -6 }}>
        <span style={{ width: 12, height: 40, borderRadius: 6, background: color, flex: 'none' }} />
        <span style={{ fontSize: 13, color: C.muted, flex: 1 }}>{hm(job.scheduled_start, lang)}–{hm(job.scheduled_end, lang)} · {job.services?.name || (job.contract_id ? t('job.recContract') : t('job.details'))} · {helper ? shortName(helper.display_name) : t('c.unassigned')}</span>
        <Pill tone={jobTone(job.status)}>{t(`status.${job.status}`)}</Pill>
      </div>
      <div className="k-kv">
        <div><span>{t('job.kvAddress')}</span><span className="k-ell">{job.properties?.address_line1}, {job.properties?.city}</span></div>
        <div><span>{t('job.kvValue')}</span><span className="num">{job.contract_id ? t('job.recContract') : usd(job.price_cents)}</span></div>
        <div><span>{t('job.kvRecurrence')}</span><span>{recurrenceText(job, t)}</span></div>
        {job.start_inside_geofence != null && <div><span>{t('job.kvCheckin')}</span><span style={{ color: job.start_inside_geofence ? '#0B6B5F' : '#9F1F14' }}>{job.start_inside_geofence ? t('geo.inside') : t('geo.outside', { m: job.start_distance_m ?? '?' })}</span></div>}
      </div>
      {job.client_notes && <div className="k-kv"><div style={{ flexDirection: 'column', gap: 4 }}><span>{t('job.notesClient')}</span><span style={{ textAlign: 'left', fontWeight: 600 }}>{job.client_notes}</span></div></div>}
      {job.status === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {job.rating ? <><Stars value={job.rating} size={20} />{job.rating_comment && <span className="k-s125 k-muted k-ell">{job.rating_comment}</span>}</>
            : <span className="k-s125 k-muted">{job.rating_status === 'auto_approved' ? t('ck.autoApproved') : t('ck.waitingRating')}</span>}
        </div>
      )}
      {billable && billed === null && (
        <div className="k-chargebox">
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>{t('job.toBillT')}</b>
            <span className="k-s125" style={{ color: '#0B6B5F' }}>{t('job.toBillS', { v: usd(job.price_cents, true) })}</span>
          </span>
          <button className="k-btn k-btn-fill nw" style={{ minHeight: 44, padding: '0 16px' }} onClick={() => setCharging(true)}>{t('job.chargeNow')}</button>
        </div>
      )}
      {billable && billed && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pill tone="ok">{t('job.billed')}</Pill><span className="k-s125 k-muted">{billed.number}</span></div>}
      {photos.length > 0 && <PhotoStrip title={t('ck.photos')} photos={photos} />}
      {items && items.length > 0 && <details className="k-kv"><summary style={{ fontWeight: 800, cursor: 'pointer', minHeight: 28 }}>{t('ck.progress', { done: items.filter((i) => i.done_at).length, total: items.length })}</summary><ChecklistView items={items} editable={false} /></details>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        <button className="k-btn k-btn-line" style={{ fontSize: 13 }} onClick={message} disabled={!helper?.user_id}>{t('job.message')}</button>
        <button className="k-btn k-btn-line" style={{ fontSize: 13 }} onClick={() => nav(`/app/agenda/novo?edit=${job.id}`)} disabled={job.status === 'completed' || job.status === 'canceled'}>{t('job.reschedule')}</button>
        <button className="k-btn k-btn-fill" style={{ fontSize: 13 }} onClick={onClose}>{t('c.close')}</button>
      </div>

      <button className="k-link" style={{ alignSelf: 'center' }} aria-expanded={more} onClick={() => setMore(!more)}>{more ? t('job.lessActions') : t('job.moreActions')}</button>
      {more && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(job.status === 'scheduled' || job.status === 'in_progress') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="k-lbl">{t('job.helper')}</span>
              <div className="k-chips">
                {[{ id: '', display_name: t('c.unassigned') } as Member, ...members.filter((m) => m.status === 'active')].map((m) => (
                  <button key={m.id || 'none'} className="k-chip" aria-pressed={(helperId || '') === m.id} disabled={busy} onClick={() => assign(m.id)}>
                    {m.id && <span className="k-dot" style={{ background: colorOf(memberIndex(members, m.id))[0] }} />}{m.id ? shortName(m.display_name) : m.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(job.status === 'scheduled' || job.status === 'in_progress') && <button className="k-btn k-btn-fill" disabled={busy} onClick={() => setStatus('completed')}>{t('job.markDone')}</button>}
          {job.status === 'scheduled' && <button className="k-btn k-btn-line" style={{ color: '#9F1F14' }} onClick={() => setAsk(true)}>{t('job.cancelJob')}</button>}
        </div>
      )}
      {ask && <Confirm danger text={t('job.cancelAsk')} confirmLabel={t('job.cancelJob')} onCancel={() => setAsk(false)} onConfirm={async () => { setAsk(false); await setStatus('canceled'); }} />}
    </Sheet>
  );
}
