import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, Segmented, Sheet, StatusBadge } from './ui';
import { createInvoice, getClientJobs, getJobs, findConflicts, type Client, type Job, type Member, type Invoice } from '../lib/data';
import { addDays, isoDate, money, time, dayLabel, toCents, randomToken, sha256Hex } from '../lib/format';
import { LANG_LABEL, type Lang } from '../lib/i18n';
import { ChecklistView, PhotoStrip, Stars } from './proof';
import { getChecklist, getJobPhotos, type CheckItem, type Photo } from '../lib/photos';

// ─────────────── New job ───────────────
export function JobForm({ clients, members, onClose, onSaved, defaultDate }: {
  clients: Client[]; members: Member[]; onClose: () => void; onSaved: () => void; defaultDate?: Date;
}) {
  const { t, tErr, company, toast } = useApp();
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const client = clients.find((c) => c.id === clientId);
  const [propertyId, setPropertyId] = useState(client?.properties[0]?.id || '');
  const [date, setDate] = useState(isoDate(defaultDate || new Date()));
  const [start, setStart] = useState('09:00');
  const [duration, setDuration] = useState('180');
  const [price, setPrice] = useState('');
  const [helper, setHelper] = useState('');
  const [repeat, setRepeat] = useState<'once' | 'weekly' | 'biweekly' | 'monthly'>('once');
  const [clientNotes, setClientNotes] = useState('');
  const [internal, setInternal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflictName, setConflictName] = useState('');

  useEffect(() => { setPropertyId(client?.properties[0]?.id || ''); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const helpers = members.filter((m) => m.status === 'active');

  const save = async (force = false) => {
    if (!company || !clientId || !propertyId) return;
    setBusy(true); setError('');
    const step = repeat === 'weekly' ? 7 : repeat === 'biweekly' ? 14 : repeat === 'monthly' ? 28 : 0;
    const count = step ? 8 : 1;
    const first = new Date(`${date}T${start}`);
    const mins = parseInt(duration, 10) || 120;
    const slots = Array.from({ length: count }, (_, i) => {
      const s = addDays(first, i * step);
      return { s, e: new Date(s.getTime() + mins * 60000) };
    });

    if (helper && !force) {
      const dayJobs = await getJobs(company.id, new Date(`${date}T00:00`), addDays(new Date(`${date}T00:00`), 1));
      const clash = dayJobs.some((j) => j.status !== 'canceled' && j.job_assignments.some((a) => a.membership_id === helper)
        && new Date(j.scheduled_start) < slots[0].e && slots[0].s < new Date(j.scheduled_end));
      if (clash) { setConflictName(members.find((m) => m.id === helper)?.display_name || ''); setBusy(false); return; }
    }

    try {
      let recurrenceId: string | null = null;
      const { data: ct } = await supabase.from('contracts').select('id').eq('property_id', propertyId).eq('status', 'active').limit(1);
      const contractId: string | null = ct?.[0]?.id || null;
      if (step) {
        const { data: rec, error } = await supabase.from('recurrences').insert({
          company_id: company.id, client_id: clientId, property_id: propertyId,
          rrule: `FREQ=WEEKLY;INTERVAL=${step / 7}`, start_time: start, duration_min: mins, starts_on: date,
          price_cents: toCents(price), default_member_ids: helper ? [helper] : [],
        }).select('id').single();
        if (error) throw error;
        recurrenceId = rec.id;
      }
      const { data: jobs, error } = await supabase.from('jobs').insert(slots.map(({ s, e }) => ({
        company_id: company.id, client_id: clientId, property_id: propertyId, recurrence_id: recurrenceId, contract_id: contractId,
        scheduled_start: s.toISOString(), scheduled_end: e.toISOString(), price_cents: toCents(price),
        client_notes: clientNotes || null, internal_notes: internal || null,
      }))).select('id');
      if (error) throw error;
      if (helper && jobs?.length) {
        const { error: e2 } = await supabase.from('job_assignments').insert(jobs.map((j) => ({ job_id: j.id, membership_id: helper, company_id: company.id, is_lead: true })));
        if (e2) throw e2;
      }
      toast(t('job.created'));
      onSaved();
    } catch (e) {
      setError(tErr((e as Error).message));
    }
    setBusy(false);
  };

  if (!clients.length) {
    return <Sheet title={t('home.newJob')} onClose={onClose}><p style={{ margin: 0 }}>{t('job.needClient')}</p></Sheet>;
  }

  return (
    <Sheet title={t('home.newJob')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={(e: FormEvent) => { e.preventDefault(); save(); }}>
        <Field label={t('job.client')}>
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {client && client.properties.length > 1 && (
          <Field label={t('job.address')}>
            <select className="select" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {client.properties.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.address_line1}</option>)}
            </select>
          </Field>
        )}
        <div className="grid2">
          <Field label={t('job.date')}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
          <Field label={t('job.start')}><input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
        </div>
        <div className="grid2">
          <Field label={t('job.duration')}>
            <select className="select" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {[60, 90, 120, 150, 180, 240, 300, 360, 480].map((m) => <option key={m} value={m}>{Math.floor(m / 60)}h{m % 60 ? String(m % 60).padStart(2, '0') : ''}</option>)}
            </select>
          </Field>
          <Field label={t('job.price')}><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="180" /></Field>
        </div>
        <Field label={t('job.helper')}>
          <select className="select" value={helper} onChange={(e) => setHelper(e.target.value)}>
            <option value="">{t('c.unassigned')}</option>
            {helpers.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </Field>
        <div className="stack">
          <span className="label">{t('job.repeat')}</span>
          <Segmented value={repeat} onChange={setRepeat} label={t('job.repeat')} options={[
            { value: 'once', label: t('job.once') }, { value: 'weekly', label: '1×/sem' }, { value: 'biweekly', label: '2 sem' }, { value: 'monthly', label: '4 sem' },
          ]} />
          {repeat !== 'once' && <span className="hint">{t(`job.${repeat}`)} · {t('job.repeatHint')}</span>}
        </div>
        <Field label={`${t('job.notesClient')} (${t('c.optional')})`}><textarea className="textarea" value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} /></Field>
        <Field label={`${t('job.notesInternal')}`}><textarea className="textarea" value={internal} onChange={(e) => setInternal(e.target.value)} /></Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{t('c.save')}</button>
      </form>
      {conflictName && (
        <Confirm text={t('job.conflict', { name: conflictName })} confirmLabel={t('job.scheduleAnyway')}
          onCancel={() => setConflictName('')} onConfirm={() => { setConflictName(''); save(true); }} />
      )}
    </Sheet>
  );
}

// ─────────────── Job details ───────────────
export function JobDetail({ job, members, onClose, onChanged }: { job: Job; members: Member[]; onClose: () => void; onChanged: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [helper, setHelper] = useState(job.job_assignments[0]?.membership_id || '');
  const [items, setItems] = useState<CheckItem[] | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    if (job.status === 'scheduled') return;
    getChecklist(job.id).then(setItems).catch(() => setItems([]));
    getJobPhotos(job.id).then(setPhotos);
  }, [job.id, job.status]);
  const assigned = members.find((m) => m.id === job.job_assignments[0]?.membership_id);

  const setStatus = async (status: string) => {
    setBusy(true);
    const { error } = await supabase.rpc('job_progress', { p_job: job.id, p_status: status });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { onChanged(); }
  };
  const reassign = async (id: string) => {
    if (!company) return;
    setHelper(id);
    await supabase.from('job_assignments').delete().eq('job_id', job.id);
    if (id) {
      const { error } = await supabase.from('job_assignments').insert({ job_id: job.id, membership_id: id, company_id: company.id, is_lead: true });
      if (error) { toast(tErr(error.message)); return; }
    }
    toast(t('c.saved')); onChanged();
  };
  const invoice = async () => {
    if (!company) return;
    setBusy(true);
    try {
      await createInvoice(company.id, job.client_id, [{ description: `${t('job.details')} · ${dayLabel(new Date(job.scheduled_start), lang)}`, unit_cents: job.price_cents, job_id: job.id }], isoDate(addDays(new Date(), 7)));
      toast(t('inv.created')); onChanged();
    } catch (e) { toast(tErr((e as Error).message)); }
    setBusy(false);
  };

  return (
    <Sheet title={job.clients?.name || t('job.details')} onClose={onClose}>
      <div className="row wrap">
        <StatusBadge status={job.status} />
        <span className="muted small">{dayLabel(new Date(job.scheduled_start), lang)} · {time(job.scheduled_start, lang)}–{time(job.scheduled_end, lang)}</span>
      </div>
      <div className="card tight row"><Icon name="pin" size={18} /><span>{job.properties?.address_line1}, {job.properties?.city}</span></div>
      {job.start_inside_geofence !== null && job.start_inside_geofence !== undefined && (
        <span className={`badge ${job.start_inside_geofence ? 'b-ok' : 'b-danger'}`} style={{ alignSelf: 'flex-start' }}>
          {job.start_inside_geofence ? t('geo.inside') : t('geo.outside', { m: job.start_distance_m ?? '?' })}
        </span>
      )}
      <div className="grid2">
        <div className="kpi"><div className="label">{t('job.price')}</div><div className="value num">{money(job.price_cents, lang)}</div></div>
        <div className="kpi"><div className="label">{t('job.helper')}</div><div className="bold" style={{ marginTop: 4 }}>{assigned?.display_name || t('c.unassigned')}</div></div>
      </div>
      {job.client_notes && <div className="stack" style={{ gap: 4 }}><span className="label">{t('job.notesClient')}</span><span>{job.client_notes}</span></div>}
      {job.internal_notes && <div className="stack" style={{ gap: 4 }}><span className="label">{t('job.notesInternal')}</span><span>{job.internal_notes}</span></div>}
      {job.completion_note && <div className="card tight">{job.completion_note}</div>}
      {job.status === 'completed' && (
        <div className="card stack" style={{ gap: 6 }}>
          <span className="label">{t('ck.rating')}</span>
          {job.rating ? <><Stars value={job.rating} size={22} />{job.rating_comment && <span className="small">{job.rating_comment}</span>}</>
            : <span className="small muted">{job.rating_status === 'auto_approved' ? t('ck.autoApproved') : t('ck.waitingRating')}</span>}
        </div>
      )}
      {photos.some((p) => p.kind === 'before') && <PhotoStrip title={t('ck.before')} photos={photos.filter((p) => p.kind === 'before')} />}
      {photos.some((p) => p.kind === 'after') && <PhotoStrip title={t('ck.after')} photos={photos.filter((p) => p.kind === 'after')} />}
      {items && items.length > 0 && <details className="card"><summary className="bold" style={{ cursor: 'pointer', minHeight: 32 }}>{t('ck.progress', { done: items.filter((i) => i.done_at).length, total: items.length })}</summary><div style={{ marginTop: 10 }}><ChecklistView items={items} editable={false} /></div></details>}
      {job.status === 'scheduled' && (
        <Field label={t('job.helper')}>
          <select className="select" value={helper} onChange={(e) => reassign(e.target.value)}>
            <option value="">{t('c.unassigned')}</option>
            {members.filter((m) => m.status === 'active').map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </Field>
      )}
      <div className="stack">
        {(job.status === 'scheduled' || job.status === 'in_progress') && (
          <button className="btn btn-primary" disabled={busy} onClick={() => setStatus('completed')}>{t('job.markDone')}</button>
        )}
        {job.status === 'completed' && <button className="btn btn-primary" disabled={busy} onClick={invoice}>{t('job.invoice')}</button>}
        {job.status === 'scheduled' && <button className="btn btn-secondary" onClick={() => setAsk(true)}>{t('job.cancelJob')}</button>}
      </div>
      {ask && <Confirm danger text={t('job.cancelAsk')} confirmLabel={t('job.cancelJob')} onCancel={() => setAsk(false)}
        onConfirm={async () => { setAsk(false); await setStatus('canceled'); }} />}
    </Sheet>
  );
}

// ─────────────── New client ───────────────
export function ClientForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, toast } = useApp();
  const [kind, setKind] = useState<'residential' | 'commercial'>(company?.mode === 'commercial' ? 'commercial' : 'residential');
  const [f, setF] = useState({ name: '', email: '', phone: '', language: 'en', no_translate: false, street: '', city: '', state: '', zip: '', access: '', pets: '', special: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const up = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true); setError('');
    const { data: c, error } = await supabase.from('clients').insert({
      company_id: company.id, kind, name: f.name.trim(), email: f.email || null, phone: f.phone || null,
      language: f.language, no_translate: f.no_translate, notes: f.notes || null,
    }).select('id').single();
    if (error) { setError(tErr(error.message)); setBusy(false); return; }
    const { error: e2 } = await supabase.from('properties').insert({
      company_id: company.id, client_id: c.id, address_line1: f.street, city: f.city, state: f.state.toUpperCase(), zip: f.zip,
      access_instructions: f.access || null, pets: f.pets || null, special_instructions: f.special || null,
    });
    setBusy(false);
    if (e2) { setError(tErr(e2.message)); await supabase.from('clients').delete().eq('id', c.id); return; }
    const { data: pr } = await supabase.from('properties').select('id').eq('client_id', c.id);
    if (pr?.length) supabase.functions.invoke('geocode', { body: { table: 'properties', ids: pr.map((x: { id: string }) => x.id) } }).then(() => undefined);
    toast(t('cl.created'));
    onSaved();
  };

  return (
    <Sheet title={t('cl.new')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        {company?.mode === 'both' && (
          <Segmented value={kind} onChange={setKind} label={t('cl.kind')} options={[{ value: 'residential', label: t('cl.res') }, { value: 'commercial', label: t('cl.com') }]} />
        )}
        <Field label={t('cl.name')}><input className="input" value={f.name} onChange={up('name')} required /></Field>
        <div className="grid2">
          <Field label={t('auth.email')}><input className="input" type="email" value={f.email} onChange={up('email')} /></Field>
          <Field label={t('cl.phone')}><input className="input" type="tel" value={f.phone} onChange={up('phone')} /></Field>
        </div>
        <Field label={t('cl.lang')}>
          <select className="select" value={f.language} onChange={up('language')}>
            {(['en', 'es', 'pt-BR'] as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
          </select>
        </Field>
        <label className="check"><input type="checkbox" checked={f.no_translate} onChange={(e) => setF({ ...f, no_translate: e.target.checked })} />{t('cl.noTranslate')}</label>
        <Field label={t('cl.street')}><input className="input" value={f.street} onChange={up('street')} autoComplete="street-address" required /></Field>
        <div className="grid3">
          <Field label={t('cl.city')}><input className="input" value={f.city} onChange={up('city')} required /></Field>
          <Field label={t('cl.state')}><input className="input" value={f.state} onChange={up('state')} maxLength={2} placeholder="CT" required /></Field>
          <Field label={t('cl.zip')}><input className="input" inputMode="numeric" value={f.zip} onChange={up('zip')} required /></Field>
        </div>
        <Field label={t('cl.access')}><input className="input" value={f.access} onChange={up('access')} /></Field>
        {kind === 'residential' && <Field label={t('cl.pets')}><input className="input" value={f.pets} onChange={up('pets')} /></Field>}
        <Field label={t('cl.special')}><textarea className="textarea" value={f.special} onChange={up('special')} /></Field>
        <Field label={t('cl.notes')}><textarea className="textarea" value={f.notes} onChange={up('notes')} /></Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !f.name.trim()}>{t('c.save')}</button>
      </form>
    </Sheet>
  );
}

// ─────────────── Client details ───────────────
export function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const [portalLink, setPortalLink] = useState('');
  const invitePortal = async () => {
    const token = randomToken();
    const { error } = await supabase.from('clients').update({ portal_invite_hash: await sha256Hex(token), portal_invite_expires_at: addDays(new Date(), 7).toISOString() }).eq('id', client.id);
    if (error) { toast(tErr(error.message)); return; }
    setPortalLink(`${window.location.origin}/portal/convite?t=${token}`);
  };
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [profit, setProfit] = useState<{ revenue_cents: number; labour_cents: number; expense_cents: number; profit_cents: number } | null>(null);
  useEffect(() => {
    getClientJobs(client.id).then(setJobs);
    supabase.from('v_client_profit_90d').select('revenue_cents, labour_cents, expense_cents, profit_cents').eq('client_id', client.id).maybeSingle()
      .then(({ data }) => setProfit(data as typeof profit));
  }, [client.id]);
  const p = client.properties[0];
  const [hasGeo, setHasGeo] = useState(!!(p?.lat && p?.lng));
  const setGeo = () => {
    if (!p || !navigator.geolocation) { toast(t('geo.denied')); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { error } = await supabase.from('properties').update({ lat: pos.coords.latitude, lng: pos.coords.longitude }).eq('id', p.id);
      if (error) toast(tErr(error.message)); else { setHasGeo(true); toast(t('geo.saved')); }
    }, () => toast(t('geo.denied')), { enableHighAccuracy: true, timeout: 10000 });
  };
  return (
    <Sheet title={client.name} onClose={onClose}>
      <div className="row wrap small muted">
        <span className="badge b-neutral">{client.kind === 'commercial' ? t('cl.com') : t('cl.res')}</span>
        {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
        {client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}
        <span>{LANG_LABEL[client.language as Lang]}{client.no_translate ? ` · ${t('cl.noTranslate').split(' (')[0]}` : ''}</span>
      </div>
      {p && (
        <div className="card stack" style={{ gap: 6 }}>
          <div className="row"><Icon name="pin" size={18} /><b>{p.address_line1}, {p.city} {p.state} {p.zip}</b></div>
          {p.access_instructions && <div className="small"><b>{t('day.access')}:</b> {p.access_instructions}</div>}
          {p.pets && <div className="small"><b>{t('cl.pets')}:</b> {p.pets}</div>}
          {p.special_instructions && <div className="small"><b>{t('cl.special')}:</b> {p.special_instructions}</div>}
          {hasGeo ? <span className="row small bold" style={{ color: 'var(--ok-fg)' }}><Icon name="check" size={16} />{t('geo.has')}</span>
            : <><button className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={setGeo}><Icon name="pin" size={16} />{t('geo.set')}</button><span className="hint">{t('geo.setHint')}</span></>}
        </div>
      )}
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">{t('cl.profit')}</span>
        <div className="grid2">
          <div className="kpi"><div className="label">{t('cl.revenue')}</div><div className="value num">{money(profit?.revenue_cents, lang)}</div></div>
          <div className="kpi"><div className="label">{t('cl.labour')}</div><div className="value num">{money(profit?.labour_cents, lang)}</div></div>
          <div className="kpi"><div className="label">{t('cl.expenses')}</div><div className="value num">{money(profit?.expense_cents, lang)}</div></div>
          <div className="kpi" style={{ background: 'var(--brand-light)' }}><div className="label">Lucro / Profit</div><div className="value num">{money(profit?.profit_cents, lang)}</div></div>
        </div>
      </div>
      {client.notes && <div className="card tight small"><b>{t('cl.notes')}:</b> {client.notes}</div>}
      <div className="card stack" style={{ gap: 8 }}>
        {client.portal_user_id ? <span className="row small bold"><Icon name="check" size={18} color="var(--action)" />{t('pt.connected')}</span> : !portalLink ? (
          <><button className="btn btn-secondary" onClick={invitePortal}><Icon name="share" size={18} />{t('pt.invite')}</button><span className="hint">{t('pt.inviteHint')}</span></>
        ) : (
          <>
            <div className="small" style={{ wordBreak: 'break-all' }}>{portalLink}</div>
            <div className="grid2">
              <a className="btn btn-primary" style={{ minHeight: 44 }} target="_blank" rel="noreferrer" href={`https://wa.me/${(client.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(t('pt.waText', { company: company?.name || '', link: portalLink }))}`}>{t('team.whatsapp')}</a>
              {client.email
                ? <a className="btn btn-secondary" href={`mailto:${client.email}?subject=${encodeURIComponent(company?.name || 'Tidyo')}&body=${encodeURIComponent(t('pt.waText', { company: company?.name || '', link: portalLink }))}`}>E-mail</a>
                : <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(portalLink); toast(t('c.copied')); } catch { /* ignore */ } }}>{t('c.copy')}</button>}
            </div>
          </>
        )}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <span className="label">{t('cl.history')}</span>
        {!jobs ? <div className="skeleton" style={{ height: 56 }} /> : jobs.length === 0 ? <span className="muted small">{t('cl.noHistory')}</span> : jobs.map((j) => (
          <div key={j.id} className="row card tight">
            <span className="grow small">{dayLabel(new Date(j.scheduled_start), lang)} · {time(j.scheduled_start, lang)}</span>
            <span className="num small bold">{money(j.price_cents, lang)}</span>
            <StatusBadge status={j.status} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ─────────────── New invoice ───────────────
export function InvoiceForm({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, toast } = useApp();
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(isoDate(addDays(new Date(), 7)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true); setError('');
    try {
      await createInvoice(company.id, clientId, [{ description: desc || 'Cleaning service', unit_cents: toCents(amount) }], due);
      toast(t('inv.created')); onSaved();
    } catch (er) { setError(tErr((er as Error).message)); }
    setBusy(false);
  };
  if (!clients.length) return <Sheet title={t('inv.new')} onClose={onClose}><p style={{ margin: 0 }}>{t('job.needClient')}</p></Sheet>;
  return (
    <Sheet title={t('inv.new')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <Field label={t('job.client')}>
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={t('inv.description')}><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Deep clean" /></Field>
        <div className="grid2">
          <Field label={t('inv.amount')}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label={t('inv.due')}><input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <p className="hint" style={{ margin: 0 }}>{t('inv.stripeSoon')}</p>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || toCents(amount) <= 0}>{t('c.save')}</button>
      </form>
    </Sheet>
  );
}

// ─────────────── Payment received outside ───────────────
export function PaymentForm({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, membership, toast, lang } = useApp();
  const left = Math.max(0, invoice.total_cents - invoice.paid_cents);
  const [method, setMethod] = useState('zelle');
  const [amount, setAmount] = useState((left / 100).toFixed(2));
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true);
    const { error } = await supabase.from('payments').insert({
      company_id: company.id, invoice_id: invoice.id, method, amount_cents: toCents(amount), reference: ref || null, recorded_by: membership?.id,
    });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('inv.recorded')); onSaved(); }
  };
  return (
    <Sheet title={t('inv.receivedOutside')} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>{invoice.number} · {invoice.clients?.name} · {money(left, lang)}</p>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <div className="stack">
          <span className="label">{t('inv.method')}</span>
          <div className="chips" role="group" aria-label={t('inv.method')}>
            {['zelle', 'cash', 'check', 'venmo', 'card', 'ach', 'other'].map((m) => (
              <button type="button" key={m} className="chip" aria-pressed={method === m} onClick={() => setMethod(m)}>{t(`pay.${m}`)}</button>
            ))}
          </div>
        </div>
        <Field label={t('inv.amount')}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={`${t('inv.reference')} (${t('c.optional')})`}><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <button className="btn btn-primary btn-block" disabled={busy || toCents(amount) <= 0}>{t('c.confirm')}</button>
      </form>
    </Sheet>
  );
}

// ─────────────── Invite team ───────────────
export function InviteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, membership, lang } = useApp();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'helper' | 'manager'>('helper');
  const [mlang, setMlang] = useState<Lang>('es');
  const [rate, setRate] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true); setError('');
    const token = randomToken();
    const hash = await sha256Hex(token);
    const { data, error } = await supabase.from('memberships').insert({
      company_id: company.id, role, status: 'invited', display_name: name.trim(), language: mlang,
      invite_token_hash: hash, invite_expires_at: addDays(new Date(), 7).toISOString(),
    }).select('id').single();
    if (error) { setError(tErr(error.message)); setBusy(false); return; }
    if (rate && toCents(rate) > 0) await supabase.from('member_pay_rates').insert({ membership_id: data.id, company_id: company.id, hourly_cents: toCents(rate) });
    setLink(`${window.location.origin}/convite?t=${token}`);
    setBusy(false);
    onSaved();
  };
  const wa = useMemo(() => `https://wa.me/?text=${encodeURIComponent(t('team.waText', { name: name.trim(), company: company?.name || '', link }))}`, [link, name, company, t]);

  return (
    <Sheet title={role === 'manager' ? t('team.inviteManager') : t('team.invite')} onClose={onClose}>
      {!link ? (
        <form className="stack" style={{ gap: 14 }} onSubmit={create}>
          <Field label={t('team.name')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          {membership?.role === 'owner' && (
            <Segmented value={role} onChange={setRole} label={t('team.role')} options={[{ value: 'helper', label: t('team.helper') }, { value: 'manager', label: t('team.manager') }]} />
          )}
          <Field label={t('more.lang')}>
            <select className="select" value={mlang} onChange={(e) => setMlang(e.target.value as Lang)}>
              {(['es', 'pt-BR', 'en'] as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </Field>
          <Field label={`${t('team.rate')} (${t('c.optional')})`}><input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>{t('c.confirm')}</button>
        </form>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <span className="label">{t('team.link')}</span>
          <div className="card tight small" style={{ wordBreak: 'break-all' }}>{link}</div>
          <span className="hint">{t('team.linkHint')}</span>
          <a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer">{t('team.whatsapp')}</a>
          <button className="btn btn-secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>
            {copied ? t('c.copied') : t('c.copy')}
          </button>
          <span className="sr-only">{lang}</span>
        </div>
      )}
    </Sheet>
  );
}

export { findConflicts };
