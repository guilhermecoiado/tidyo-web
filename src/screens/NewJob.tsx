// Novo agendamento — canvas NovoAgendamento (full screen, fixed total bar, confirm sheet, "Agendado")
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { DateField, TimeField } from '../components/pickers';
import { Avatar, C, Head, Segment, SheetActions, Svg, I, colorOf, dur, hm, shortName, usd } from '../components/kit';
import { getClients, getJobs, getMembers, getServices, memberIndex, type Client, type Job, type Member, type Service } from '../lib/data';
import { addDays, isoDate, startOfDay } from '../lib/format';
import { driveMin, km, pt } from '../lib/route';
import { LANG_LABEL, type Lang } from '../lib/i18n';

type Extra = { id: string; name: string; price_cents: number; minutes: number };
type Rec = 'once' | 'weekly' | 'biweekly' | 'monthly';
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const COMMERCIAL: Service = { id: 'contract', name: '', kind: 'commercial', default_price_cents: 0, default_duration_min: 120, active: true };

export default function NewJob() {
  const { t, tErr, lang, company, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const [clients, setClients] = useState<Client[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [clientId, setClientId] = useState(params.get('client') || '');
  const [propertyId, setPropertyId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(params.get('date') || isoDate(new Date()));
  const [slot, setSlot] = useState('');
  const [rec, setRec] = useState<Rec>('once');
  const [helper, setHelper] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState({ client: '', internal: '' });
  const [showNotes, setShowNotes] = useState(false);
  const [dayJobs, setDayJobs] = useState<Job[]>([]);
  const [all, setAll] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [channels, setChannels] = useState<Record<string, boolean>>({ wa: true, email: true });

  useEffect(() => {
    if (!company) return;
    Promise.all([getClients(company.id), getMembers(company.id), getServices(company.id),
      supabase.from('service_extras').select('id, name, price_cents, minutes').eq('company_id', company.id).eq('active', true).order('position'),
      supabase.from('jobs').select('client_id, scheduled_start').eq('company_id', company.id).order('scheduled_start', { ascending: false }).limit(200)])
      .then(async ([c, m, s, e, recent]) => {
        // most recent clients first
        const last = new Map<string, string>();
        for (const r of (recent.data || []) as { client_id: string; scheduled_start: string }[]) if (!last.has(r.client_id)) last.set(r.client_id, r.scheduled_start);
        setClients([...c].sort((a, b) => (last.get(b.id) || '').localeCompare(last.get(a.id) || '') || a.name.localeCompare(b.name)));
        setMembers(m); setServices(s); setExtras((e.data || []) as Extra[]);
        if (editId) {
          const { data } = await supabase.from('jobs').select('id, client_id, property_id, service_id, scheduled_start, scheduled_end, price_cents, client_notes, internal_notes, extras, contract_id, status, job_assignments(membership_id)').eq('id', editId).maybeSingle();
          if (data) {
            const j = data as unknown as Job & { extras: { id?: string }[] };
            setEditJob(j); setClientId(j.client_id); setPropertyId(j.property_id); setServiceId(j.service_id || (j.contract_id ? 'contract' : ''));
            const d = new Date(j.scheduled_start); setDate(isoDate(d)); setSlot(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
            setHelper(j.job_assignments[0]?.membership_id || ''); setNotes({ client: j.client_notes || '', internal: j.internal_notes || '' });
            setPicked(Object.fromEntries((j.extras || []).filter((x) => x.id).map((x) => [x.id!, true])));
          }
        } else if (!clientId && c.length) {
          const sorted = [...c].sort((a, b) => (last.get(b.id) || '').localeCompare(last.get(a.id) || '') || a.name.localeCompare(b.name));
          setClientId(sorted[0].id);
        }
      });
  }, [company, editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = clients?.find((c) => c.id === clientId);
  useEffect(() => { if (client && !client.properties.some((p) => p.id === propertyId)) setPropertyId(client.properties[0]?.id || ''); }, [client]); // eslint-disable-line react-hooks/exhaustive-deps
  const property = client?.properties.find((p) => p.id === propertyId) || client?.properties[0];
  const commercial = client?.kind === 'commercial';
  const types = commercial ? [...services.filter((s) => s.kind === 'commercial'), { ...COMMERCIAL, name: t('job.recContract') }] : services.filter((s) => s.kind === 'residential');
  const service = types.find((s) => s.id === serviceId) || types[0];
  useEffect(() => { if (service && service.id !== serviceId && !editJob) setServiceId(service.id); }, [service?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!company) return;
    const d = new Date(`${date}T00:00`);
    getJobs(company.id, d, addDays(d, 1)).then((j) => setDayJobs(j.filter((x) => x.status !== 'canceled' && x.id !== editId)));
  }, [company, date, editId]);

  const extraList = extras.filter((e) => picked[e.id]);
  const minutes = (service?.default_duration_min || 120) + extraList.reduce((s, e) => s + e.minutes, 0);
  const total = (editJob && !Object.keys(picked).length && serviceId === (editJob.service_id || '') ? editJob.price_cents : (service?.default_price_cents || 0) + extraList.reduce((s, e) => s + e.price_cents, 0));
  const helpers = members.filter((m) => m.status === 'active' && (m.role === 'helper' || company?.solo || members.filter((x) => x.role === 'helper' && x.status === 'active').length === 0));

  const at = (hhmm: string) => new Date(`${date}T${hhmm}`);
  const overlaps = (m: string, s: Date, e: Date) => dayJobs.some((j) => j.job_assignments.some((a) => a.membership_id === m) && new Date(j.scheduled_start) < e && s < new Date(j.scheduled_end));
  const slotBusy = (hhmm: string) => helpers.length > 0 && helpers.every((h) => overlaps(h.id, at(hhmm), new Date(at(hhmm).getTime() + minutes * 60000)));
  useEffect(() => { if (!slot) { const free = SLOTS.find((s) => !slotBusy(s) && at(s).getTime() > Date.now()); setSlot(free || '09:00'); } }, [dayJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // helper suggestions: free at that time, nearest from the previous house of the day
  const target = property ? pt({ lat: property.lat, lng: property.lng }) : null;
  const ranked = useMemo(() => helpers.map((h) => {
    if (!slot) return { h, free: true, min: null as number | null, prev: false };
    const s = at(slot), e = new Date(s.getTime() + minutes * 60000);
    const free = !overlaps(h.id, s, e);
    const before = dayJobs.filter((j) => j.job_assignments.some((a) => a.membership_id === h.id) && new Date(j.scheduled_end) <= s).sort((a, b) => b.scheduled_end.localeCompare(a.scheduled_end))[0];
    const from = before ? pt({ lat: before.properties?.lat ?? null, lng: before.properties?.lng ?? null }) : null;
    return { h, free, min: from && target ? driveMin(km(from, target)) : null, prev: !!before };
  }).sort((a, b) => Number(b.free) - Number(a.free) || (a.min ?? 999) - (b.min ?? 999)), [helpers, slot, dayJobs, minutes, target]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = ranked.find((r) => r.free)?.h.id;
  useEffect(() => { if (!editJob && best && !helper) setHelper(best); }, [best]); // eslint-disable-line react-hooks/exhaustive-deps

  const dates = useMemo(() => {
    const out: Date[] = []; let d = startOfDay(new Date());
    while (out.length < 12) { if (d.getDay() !== 0) out.push(d); d = addDays(d, 1); }
    const cur = new Date(`${date}T00:00`);
    if (!out.some((x) => x.getTime() === cur.getTime())) out.unshift(cur);
    return out;
  }, [date]);

  const recLabel = { once: t('job.recOnce'), weekly: t('job.recWeekly'), biweekly: t('job.recEveryN', { n: 2 }), monthly: t('job.recMonthly') }[rec];
  const helperM = members.find((m) => m.id === helper);
  const when = `${new Date(`${date}T12:00`).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')} · ${slot ? hm(at(slot), lang) : ''}${editJob ? '' : ` · ${recLabel.toLowerCase()}`}`;
  const facts = property ? [
    `${property.address_line1}, ${property.city}`,
    property.bedrooms ? (property.bathrooms ? t('job.roomsBaths', { n: property.bedrooms, b: Number(property.bathrooms) }) : t('job.rooms', { n: property.bedrooms })) : '',
    property.pets || '', client ? t('job.speaks', { lang: LANG_LABEL[client.language as Lang] }) : '',
  ].filter(Boolean).join(' · ') : '';

  const save = async () => {
    if (!company || !client || !property || !slot) return;
    setBusy(true); setError('');
    const mins = minutes;
    const first = at(slot);
    const step = rec === 'weekly' ? 7 : rec === 'biweekly' ? 14 : 0;
    const count = editJob ? 1 : rec === 'once' ? 1 : 8;
    const starts = Array.from({ length: count }, (_, i) => (rec === 'monthly' ? new Date(first.getFullYear(), first.getMonth() + i, first.getDate(), first.getHours(), first.getMinutes()) : addDays(first, i * step)));
    const ex = extraList.map((e) => ({ id: e.id, name: e.name, price_cents: e.price_cents }));
    const sid = service && service.id !== 'contract' ? service.id : null;
    try {
      const { data: ct } = await supabase.from('contracts').select('id').eq('property_id', property.id).eq('status', 'active').limit(1);
      const contractId: string | null = ct?.[0]?.id || null;
      if (editJob) {
        const { error } = await supabase.from('jobs').update({
          property_id: property.id, service_id: sid, scheduled_start: first.toISOString(), scheduled_end: new Date(first.getTime() + mins * 60000).toISOString(),
          price_cents: total, extras: ex, client_notes: notes.client || null, internal_notes: notes.internal || null,
        }).eq('id', editJob.id);
        if (error) throw error;
        if ((editJob.job_assignments[0]?.membership_id || '') !== helper) {
          await supabase.from('job_assignments').delete().eq('job_id', editJob.id);
          if (helper) await supabase.from('job_assignments').insert({ job_id: editJob.id, membership_id: helper, company_id: company.id, is_lead: true });
        }
      } else {
        let recurrenceId: string | null = null;
        if (rec !== 'once') {
          const { data: r, error } = await supabase.from('recurrences').insert({
            company_id: company.id, client_id: client.id, property_id: property.id, service_id: sid, contract_id: contractId,
            rrule: rec === 'monthly' ? 'FREQ=MONTHLY' : `FREQ=WEEKLY;INTERVAL=${step / 7}`, start_time: slot, duration_min: mins, starts_on: date,
            price_cents: total, extras: ex, default_member_ids: helper ? [helper] : [],
          }).select('id').single();
          if (error) throw error;
          recurrenceId = r.id;
        }
        const { data: jobs, error } = await supabase.from('jobs').insert(starts.map((s) => ({
          company_id: company.id, client_id: client.id, property_id: property.id, service_id: sid, recurrence_id: recurrenceId, contract_id: contractId,
          scheduled_start: s.toISOString(), scheduled_end: new Date(s.getTime() + mins * 60000).toISOString(), price_cents: total, extras: ex,
          client_notes: notes.client || null, internal_notes: notes.internal || null,
        }))).select('id');
        if (error) throw error;
        if (helper && jobs?.length) {
          const { error: e2 } = await supabase.from('job_assignments').insert(jobs.map((j) => ({ job_id: j.id, membership_id: helper, company_id: company.id, is_lead: true })));
          if (e2) throw e2;
        }
      }
      setDone(true);
    } catch (e) { setError(tErr((e as Error).message)); }
    setBusy(false);
  };

  const msg = client ? t('job.confirmMsg', { company: company?.name || '', when, total: usd(total) }) : '';
  const sendLinks = client ? [
    channels.wa && client.phone ? { label: 'WhatsApp', href: `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}` } : null,
    channels.sms && client.phone ? { label: 'SMS', href: `sms:${client.phone}?&body=${encodeURIComponent(msg)}` } : null,
    channels.email && client.email ? { label: 'Email', href: `mailto:${client.email}?subject=${encodeURIComponent(company?.name || 'Tidyo')}&body=${encodeURIComponent(msg)}` } : null,
  ].filter(Boolean) as { label: string; href: string }[] : [];

  if (clients && clients.length === 0) return (
    <div className="k-screen"><main className="k-page nobar">
      <Head title={t('home.newJob')} back="/app/agenda" closeIcon />
      <div className="k-empty"><span className="k-empty-t">{t('job.needClientT')}</span><span className="k-empty-s">{t('job.needClient')}</span><Link to="/app/clientes/novo" className="k-btn k-btn-fill">{t('cl.new')}</Link></div>
    </main></div>
  );

  const shownClients = clients ? (all ? clients : clients.slice(0, 6)) : [];
  if (client && !shownClients.some((c) => c.id === client.id)) shownClients.unshift(client);

  return (
    <div className="k-screen">
      <main className="k-page footer" style={{ gap: 20 }}>
        <Head title={editJob ? t('job.reschedule') : t('home.newJob')} back={() => (window.history.length > 1 ? nav(-1) : nav('/app/agenda'))} closeIcon />

        <section className="k-field" style={{ gap: 8 }}>
          <span className="k-sec"><span>{t('job.client')}</span></span>
          <div className="k-chips">
            {shownClients.map((c) => <button key={c.id} className="k-chip" style={{ minHeight: 40, fontSize: 13 }} aria-pressed={c.id === clientId} onClick={() => setClientId(c.id)} disabled={!!editJob && c.id !== clientId}>{c.name}</button>)}
            {!editJob && clients && clients.length > 6 && !all && <button className="k-chip" style={{ minHeight: 40, fontSize: 13 }} onClick={() => setAll(true)}>{t('job.moreClients', { n: clients.length - 6 })}</button>}
            {!editJob && <Link to="/app/clientes/novo" className="k-chip" style={{ minHeight: 40, fontSize: 13, border: `1px dashed ${C.accent}`, color: C.accent, textDecoration: 'none' }}>+ {t('cl.new')}</Link>}
          </div>
          {client && client.properties.length > 1 && (
            <div className="k-chips">{client.properties.map((p) => <button key={p.id} className="k-chip light" aria-pressed={p.id === property?.id} onClick={() => setPropertyId(p.id)}>{p.label} · {p.address_line1}</button>)}</div>
          )}
          {facts && <span className="k-s125 k-muted">{facts}</span>}
        </section>

        {client && (
          <section className="k-field" style={{ gap: 8 }}>
            <span className="k-sec"><span>{t('job.type')}</span></span>
            {types.length === 0 ? <Link to="/app/mais/precos" className="k-help" style={{ color: C.accent, fontWeight: 700 }}>{t('job.noTypes')}</Link> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {types.map((s) => {
                  const on = s.id === service?.id;
                  return (
                    <button key={s.id} aria-pressed={on} onClick={() => setServiceId(s.id)} style={{ minHeight: 64, textAlign: 'left', borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer', color: C.ink, fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{s.name}</span>
                      <span className="num" style={{ fontSize: 12, color: C.muted }}>{s.id === 'contract' ? t('job.inContract') : `${usd(s.default_price_cents)} · ${dur(s.default_duration_min)}`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="k-field" style={{ gap: 8 }}>
          <span className="k-sec"><span>{t('job.when')}</span></span>
          <div className="k-dategrid">
            {dates.map((d) => {
              const on = isoDate(d) === date;
              return (
                <button key={d.toISOString()} aria-pressed={on} onClick={() => setDate(isoDate(d))} style={{ minWidth: 0, minHeight: 56, borderRadius: 12, border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : '#FFFFFF', color: on ? '#FFFFFF' : C.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{d.toLocaleDateString(lang, { weekday: 'short' }).replace('.', '').replace(/^./, (c) => c.toUpperCase()).slice(0, 3)}</span>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700 }}>{d.getDate()}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
            {SLOTS.map((s) => {
              const b = slotBusy(s), on = slot === s && !b;
              return (
                <button key={s} disabled={b} aria-pressed={on} onClick={() => setSlot(s)} className="num"
                  style={{ minHeight: 44, borderRadius: 12, border: `1px solid ${b ? C.soft : on ? C.ink : C.line}`, background: b ? C.soft : on ? C.ink : '#FFFFFF', color: b ? '#9AA9A6' : on ? '#FFFFFF' : C.ink, fontWeight: 800, fontSize: 13, cursor: b ? 'not-allowed' : 'pointer', textDecoration: b ? 'line-through' : 'none', fontFamily: 'inherit' }}>{hm(at(s), lang)}</button>
              );
            })}
          </div>
          <span className="k-s12 k-muted">{t('job.slotsHint')}</span>
          <details>
            <summary className="k-link" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{t('job.otherTime')}</summary>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <DateField label={t('job.date')} value={date} onChange={setDate} />
              <TimeField label={t('job.start')} value={slot} onChange={setSlot} />
            </div>
          </details>
        </section>

        {!editJob && (
          <section className="k-field" style={{ gap: 8 }}>
            <span className="k-sec"><span>{t('job.repeat')}</span></span>
            <Segment value={rec} onChange={setRec} label={t('job.repeat')} options={[{ value: 'once', label: t('rep.once') }, { value: 'weekly', label: t('rep.weekly') }, { value: 'biweekly', label: t('rep.biweekly') }, { value: 'monthly', label: t('rep.monthly') }]} />
          </section>
        )}

        <section className="k-field" style={{ gap: 8 }}>
          <span className="k-sec"><span>{t('job.helper')}</span></span>
          {ranked.length === 0 && <span className="k-help">{t('job.noHelpers')} <Link to="/app/mais/equipe">{t('team.invite')}</Link></span>}
          {ranked.map(({ h, free, min, prev }) => {
            const on = helper === h.id;
            const note = !free ? t('job.busyThen') : min != null ? (prev ? t('job.freeNear', { time: slot ? hm(at(slot), lang) : '', n: min }) : t('job.freeDrive', { n: min })) : t('job.free');
            return (
              <button key={h.id} aria-pressed={on} onClick={() => setHelper(on ? '' : h.id)} style={{ minHeight: 60, textAlign: 'left', borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: C.ink, fontFamily: 'inherit', opacity: free ? 1 : 0.7 }}>
                <Avatar name={h.display_name} color={colorOf(memberIndex(members, h.id))[0]} size={36} font={12} />
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{shortName(h.display_name)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{note}</span>
                </span>
                {h.id === best && <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, color: C.ink, background: C.mint, borderRadius: 999, padding: '3px 9px' }}>{t('job.tidyPick')}</span>}
              </button>
            );
          })}
        </section>

        {!commercial && extras.length > 0 && (
          <section className="k-field" style={{ gap: 8 }}>
            <span className="k-sec"><span>{t('job.extras')}</span></span>
            <div style={{ background: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: 16, padding: '0 12px' }}>
              {extras.map((e, i) => (
                <label key={e.id} className="check" style={{ alignItems: 'center', gap: 10, minHeight: 52, borderTop: i ? `1px solid ${C.soft}` : 0, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!picked[e.id]} onChange={() => setPicked({ ...picked, [e.id]: !picked[e.id] })} />
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{e.name}</span>
                  <span className="num" style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>+{usd(e.price_cents)}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="k-field" style={{ gap: 8 }}>
          <button className="k-link" style={{ alignSelf: 'flex-start' }} aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}>{showNotes ? '−' : '+'} {t('job.notes')}</button>
          {showNotes && <>
            <label className="k-field"><span>{t('job.notesClient')}</span><textarea className="k-input" value={notes.client} onChange={(e) => setNotes({ ...notes, client: e.target.value })} /></label>
            <label className="k-field"><span>{t('job.notesInternal')}</span><textarea className="k-input" value={notes.internal} onChange={(e) => setNotes({ ...notes, internal: e.target.value })} /></label>
          </>}
        </section>
      </main>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#FFFFFF', borderTop: `1px solid ${C.line}`, zIndex: 20, padding: `12px 16px calc(16px + env(safe-area-inset-bottom))` }}>
        <div style={{ maxWidth: 528, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span className="k-ell" style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{service?.name || ''}{editJob ? '' : ` · ${recLabel.toLowerCase()}`}</span>
            <span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700 }}>{service?.id === 'contract' ? t('job.inContract') : usd(total)}</span>
          </div>
          <button className="k-btn k-btn-fill k-btn-big" style={{ padding: '0 20px' }} disabled={!client || !slot} onClick={() => { setConfirm(true); setDone(false); setError(''); }}>{editJob ? t('c.save') : t('job.book')}</button>
        </div>
      </div>

      {confirm && client && (
        <Sheet title={done ? (editJob ? t('c.saved') : t('job.booked')) : t('job.confirmT')} onClose={() => (done ? nav('/app/agenda') : setConfirm(false))}>
          {!done ? <>
            <div className="k-kv">
              <div><span>{t('job.client')}</span><span>{client.name}</span></div>
              <div><span>{t('job.kvWhen')}</span><span>{when}</span></div>
              <div><span>{t('job.helper')}</span><span>{helperM ? shortName(helperM.display_name) : t('c.unassigned')}</span></div>
              <div><span>{t('job.kvTotal')}</span><span className="num">{service?.id === 'contract' ? t('job.inContract') : usd(total)}</span></div>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 800 }}>{t('job.notifyBy')}</span>
            <div className="k-chips">
              {[['wa', 'WhatsApp'], ['sms', 'SMS'], ['email', 'Email']].map(([id, label]) => <button key={id} className="k-chip" style={{ minHeight: 40 }} aria-pressed={!!channels[id]} onClick={() => setChannels({ ...channels, [id]: !channels[id] })}>{label}</button>)}
            </div>
            {error && <span className="k-err" role="alert">{error}</span>}
            <SheetActions cancel={t('c.back')} onCancel={() => setConfirm(false)} confirm={t('c.confirm')} onConfirm={save} disabled={busy} />
          </> : <>
            <span style={{ width: 44, height: 44, borderRadius: 44, background: '#DDF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Svg d={I.check} size={22} color={C.accent} w={2.6} /></span>
            <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>{helperM ? t('job.doneHelper', { name: helperM.display_name.split(' ')[0] }) : t('job.doneNoHelper')} {sendLinks.length ? t('job.doneSend', { client: client.name }) : ''}</span>
            {sendLinks.map((l) => <a key={l.label} className="k-btn k-btn-line" href={l.href} target="_blank" rel="noreferrer" onClick={() => toast(t('c.opened'))}>{t('job.sendVia', { ch: l.label })}</a>)}
            <Link to="/app/agenda" className="k-btn k-btn-fill">{t('job.seeAgenda')}</Link>
          </>}
        </Sheet>
      )}
    </div>
  );
}
