import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { DateField, Select, TimeField } from '../components/pickers';
import { Field, Icon, Segmented, Sheet } from '../components/ui';
import { C, Empty, Head, OwnerBar, PILL, Segment, SheetActions, Stepper, display, usd } from '../components/kit';
import { getClients, getMembers, type Client, type Member } from '../lib/data';
import { addDays, isoDate, startOfDay, toCents } from '../lib/format';

export type Contract = {
  id: string; client_id: string; property_id: string; status: string; monthly_value_cents: number; hours_per_week: number | null;
  starts_on: string | null; renews_on: string | null; last_adjusted_on: string | null; geofence_radius_m: number; walkthrough?: { weekdays?: number[]; after?: string } | null;
  clients: { name: string } | null; properties: { address_line1: string; city: string } | null;
};
type Inspection = { id: string; score: number | null; items: { area: string; ok: boolean; note?: string }[]; shared_with_client: boolean; inspected_at: string };

const SELECT = 'id, client_id, property_id, status, monthly_value_cents, hours_per_week, starts_on, renews_on, last_adjusted_on, geofence_radius_m, walkthrough, clients(name), properties(address_line1, city)';

export async function getContracts(companyId: string) {
  const { data } = await supabase.from('contracts').select(SELECT).eq('company_id', companyId).order('renews_on', { ascending: true, nullsFirst: false });
  return (data || []) as unknown as Contract[];
}

const daysUntil = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : null);
const monthsSince = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / (30.44 * 864e5)) : null);

export default function Contracts() {
  const { t, company } = useApp();
  const [list, setList] = useState<Contract[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<'active' | 'proposal' | 'all'>('active');
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState<Contract | null>(null);
  const load = useCallback(async () => { if (company) setList(await getContracts(company.id)); }, [company]);
  useEffect(() => { load(); if (company) getClients(company.id).then((c) => setClients(c.filter((x) => x.kind === 'commercial'))); }, [load, company]);
  const shown = (list || []).filter((c) => tab === 'all' || c.status === tab);
  const active = (list || []).filter((c) => c.status === 'active');
  const mrr = active.reduce((s, c) => s + c.monthly_value_cents, 0);
  const renewSoon = active.filter((c) => { const d = daysUntil(c.renews_on); return d !== null && d <= 30; }).length;
  const proposals = (list || []).filter((c) => c.status === 'proposal').length;

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <Head title={t('ct.title')} back="/app/clientes" right={<button className="k-btn k-btn-fill nw" style={{ minHeight: 44, borderRadius: 13, fontSize: 13.5, padding: '0 14px' }} onClick={() => setCreate(true)}>+ {t('ct.newShort')}</button>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <div className="k-card" style={{ gap: 4, padding: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('ct.mrr')}</span>
            <b className="num" style={{ ...display, fontSize: 24, lineHeight: 1.1 }}>{usd(mrr)}</b>
            <span style={{ fontSize: 12, color: C.muted }}>{t('ct.activeN', { n: active.length })}</span>
          </div>
          <div className="k-card" style={{ gap: 4, padding: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('ct.renewSoon')}</span>
            <b className="num" style={{ ...display, fontSize: 24, lineHeight: 1.1, color: renewSoon ? '#B23A1E' : C.ink }}>{renewSoon}</b>
            <span style={{ fontSize: 12, color: C.muted }}>{t('ct.next30')}</span>
          </div>
        </div>
        <Segment value={tab} onChange={setTab} label={t('ct.title')} options={[{ value: 'active', label: t('ct.st.active') }, { value: 'proposal', label: <>{t('ct.st.proposal')}{proposals > 0 && <span className="k-segbadge">{proposals}</span>}</> }, { value: 'all', label: t('inv.all') }]} />
        {!list ? <div className="k-card">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}</div> : shown.length === 0 ? (
          <Empty title={t('ct.empty')} text={t('ct.emptyText')} action={<button className="k-btn k-btn-fill" style={{ marginTop: 8 }} onClick={() => setCreate(true)}>+ {t('ct.new')}</button>} />
        ) : (
          <div className="k-card" style={{ padding: '2px 14px', gap: 0 }}>
            {shown.map((c, i) => {
              const d = daysUntil(c.renews_on);
              const m = monthsSince(c.last_adjusted_on || c.starts_on);
              const [bg, fg] = c.status === 'active' ? PILL.ok : c.status === 'proposal' ? PILL.neutral : PILL.warn;
              return (
                <button key={c.id} onClick={() => setOpen(c)} style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 0', borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <b className="k-ell" style={{ fontSize: 14.5 }}>{c.clients?.name}</b>
                      <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{c.properties ? `${c.properties.address_line1}, ${c.properties.city}` : ''}</span>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <b className="num nw" style={{ fontSize: 14.5 }}>{usd(c.monthly_value_cents)}<span style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>/{t('ct.mo')}</span></b>
                      <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: bg, color: fg }}>{t(`ct.st.${c.status}`)}</span>
                    </span>
                  </span>
                  {c.status === 'active' && ((d !== null && d <= 30) || (m !== null && m >= 12) || c.hours_per_week) && (
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.hours_per_week ? <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: PILL.neutral[0], color: PILL.neutral[1] }}>{c.hours_per_week}h/{t('ct.wk')}</span> : null}
                      {d !== null && d <= 30 && <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: PILL.danger[0], color: PILL.danger[1] }}>{t('ct.renewsIn', { n: Math.max(0, d) })}</span>}
                      {m !== null && m >= 12 && <span className="k-pill nw" style={{ fontSize: 11, padding: '2px 8px', background: PILL.warn[0], color: PILL.warn[1] }}>{t('ct.noAdjust', { n: m })}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('ct.footHint')}</span>
      </main>
      <OwnerBar />
      {create && <ContractForm clients={clients} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
      {open && <ContractDetail contract={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function ContractForm({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, toast } = useApp();
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const client = clients.find((c) => c.id === clientId);
  const [value, setValue] = useState('');
  const [hours, setHours] = useState('');
  const [start, setStart] = useState(isoDate(new Date()));
  const [renew, setRenew] = useState(isoDate(addDays(new Date(), 365)));
  const [status, setStatus] = useState<'proposal' | 'active'>('active');
  const [radius, setRadius] = useState('150');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!company || !client?.properties[0]) return;
    setBusy(true); setError('');
    const { error } = await supabase.from('contracts').insert({
      company_id: company.id, client_id: clientId, property_id: client.properties[0].id, status,
      monthly_value_cents: toCents(value), hours_per_week: hours ? parseFloat(hours.replace(',', '.')) : null,
      starts_on: start, renews_on: renew, last_adjusted_on: start, geofence_radius_m: parseInt(radius, 10) || 150,
    });
    setBusy(false);
    if (error) setError(tErr(error.message)); else { toast(t('c.saved')); onSaved(); }
  };
  if (!clients.length) return <Sheet title={t('ct.new')} onClose={onClose}><p style={{ margin: 0 }}>{t('ct.needClient')}</p></Sheet>;
  return (
    <Sheet title={t('ct.new')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <Field label={t('job.client')}>
          <Select value={clientId} onChange={(v) => setClientId(v)} label={t('job.client')}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <Segmented value={status} onChange={setStatus} label={t('ct.status')} options={[{ value: 'active', label: t('ct.st.active') }, { value: 'proposal', label: t('ct.st.proposal') }]} />
        <div className="grid2">
          <Field label={t('ct.value')}><input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required /></Field>
          <Field label={t('ct.hours')}><input className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label={t('ct.start')}><DateField label={t('ct.start')} value={start} onChange={setStart} /></Field>
          <Field label={t('ct.renews')}><DateField label={t('ct.renews')} value={renew} onChange={setRenew} /></Field>
        </div>
        <Field label={t('ct.radius')} hint={t('ct.radiusHint')}><input className="input" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="k-btn k-btn-fill" style={{ width: '100%' }} disabled={busy || toCents(value) <= 0}>{t('c.save')}</button>
      </form>
    </Sheet>
  );
}

function ContractDetail({ contract, onClose, onChanged }: { contract: Contract; onClose: () => void; onChanged: () => void }) {
  const { t, tErr, lang, company, membership, toast } = useApp();
  const [delivered, setDelivered] = useState<number | null>(null);
  const [outside, setOutside] = useState(0);
  const [insp, setInsp] = useState<Inspection[]>([]);
  const [newInsp, setNewInsp] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [newValue, setNewValue] = useState((contract.monthly_value_cents / 100).toFixed(2));
  const [upcoming, setUpcoming] = useState<{ n: number; last: string } | null>(null);
  const [gen, setGen] = useState(false);
  const loadUpcoming = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('scheduled_start').eq('contract_id', contract.id).eq('status', 'scheduled').gte('scheduled_start', new Date().toISOString()).order('scheduled_start', { ascending: false }).limit(200);
    const l = (data || []) as { scheduled_start: string }[];
    setUpcoming({ n: l.length, last: l[0]?.scheduled_start || '' });
  }, [contract.id]);
  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  const load = useCallback(async () => {
    const since = addDays(new Date(), -28).toISOString();
    const { data: jobs } = await supabase.from('jobs').select('started_at, completed_at, start_inside_geofence')
      .eq('property_id', contract.property_id).eq('status', 'completed').gte('scheduled_start', since);
    const list = (jobs || []) as { started_at: string | null; completed_at: string | null; start_inside_geofence: boolean | null }[];
    setDelivered(list.reduce((s, j) => s + (j.started_at && j.completed_at ? (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 36e5 : 0), 0));
    setOutside(list.filter((j) => j.start_inside_geofence === false).length);
    const { data: ins } = await supabase.from('inspections').select('id, score, items, shared_with_client, inspected_at').eq('contract_id', contract.id).order('inspected_at', { ascending: false });
    setInsp((ins || []) as Inspection[]);
  }, [contract]);
  useEffect(() => { load(); }, [load]);

  const expected = contract.hours_per_week ? contract.hours_per_week * 4 : null;
  const setStatus = async (status: string) => {
    const { error } = await supabase.from('contracts').update({ status }).eq('id', contract.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onChanged(); }
  };
  const saveAdjust = async () => {
    const { error } = await supabase.from('contracts').update({ monthly_value_cents: toCents(newValue), last_adjusted_on: isoDate(new Date()) }).eq('id', contract.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onChanged(); }
  };

  return (
    <Sheet title={contract.clients?.name || t('ct.title')} onClose={onClose}>
      <div className="row small muted"><Icon name="pin" size={16} />{contract.properties?.address_line1}, {contract.properties?.city}</div>
      <div className="grid2">
        <div className="k-card" style={{ gap: 4, padding: 14 }}><span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{t('ct.value')}</span><b className="num" style={{ ...display, fontSize: 22 }}>{usd(contract.monthly_value_cents)}</b></div>
        <div className="k-card" style={{ gap: 4, padding: 14 }}><span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{t('ct.renews')}</span><div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{contract.renews_on ? new Date(contract.renews_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div></div>
      </div>
      <section className="k-card" style={{ gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{t('ct.hoursVs')}</span>
        {delivered === null ? <div className="skeleton" style={{ height: 24 }} /> : (
          <>
            <div className="row"><span className="grow bold num">{delivered.toFixed(1)}h</span><span className="muted small">{expected ? `${t('ct.contracted')}: ${expected}h` : t('ct.noHours')}</span></div>
            {expected && <div style={{ height: 8, borderRadius: 8, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (delivered / expected) * 100)}%`, background: delivered > expected * 1.1 ? 'var(--danger-strong)' : 'var(--action)' }} /></div>}
            {expected && delivered > expected * 1.1 && <span className="small" style={{ color: 'var(--danger-fg)' }}>{t('ct.overHours')}</span>}
          </>
        )}
        {outside > 0 && <span className="small" style={{ color: 'var(--danger-fg)' }}>{t('ct.outside', { n: outside })}</span>}
      </section>
      {contract.status === 'active' && (
        <section className="k-card" style={{ gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{t('ct.visits')}</span>
          <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{upcoming === null ? '…' : upcoming.n ? t('ct.visitsUntil', { n: upcoming.n, d: new Date(upcoming.last).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '') }) : t('ct.noVisits')}</span>
          <div className="k-pair">
            <button className="k-btn k-btn-fill" onClick={() => setGen(true)}>{t('ct.genVisits')}</button>
            <Link className="k-btn k-btn-line" to={`/app/cobrancas?nova=${contract.client_id}`}>{t('ct.billMonth')}</Link>
          </div>
        </section>
      )}
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={() => setAdjust(true)}>{t('ct.adjust')}</button>
        {contract.status === 'proposal' && <button className="k-btn k-btn-fill" onClick={() => setStatus('active')}>{t('ct.activate')}</button>}
        {contract.status === 'active' && <button className="k-btn k-btn-line" onClick={() => setStatus('paused')}>{t('ct.pause')}</button>}
        {contract.status === 'paused' && <button className="k-btn k-btn-fill" onClick={() => setStatus('active')}>{t('ct.activate')}</button>}
      </div>
      {adjust && (
        <div className="card stack">
          <Field label={t('ct.newValue')}><input className="input" inputMode="decimal" value={newValue} onChange={(e) => setNewValue(e.target.value)} /></Field>
          <button className="k-btn k-btn-fill" onClick={saveAdjust}>{t('c.save')}</button>
        </div>
      )}
      <section className="stack">
        <div className="row"><h3 className="grow">{t('ins.title')}</h3><button className="k-btn k-btn-line" onClick={() => setNewInsp(true)}><Icon name="plus" size={18} />{t('ins.new')}</button></div>
        {insp.length === 0 ? <span className="small muted">{t('ins.none')}</span> : insp.map((i) => (
          <div key={i.id} className="card tight row">
            <span className="grow small">{new Date(i.inspected_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })} · {i.items.filter((x) => !x.ok).length ? t('ins.issues', { n: i.items.filter((x) => !x.ok).length }) : t('ins.allOk')}</span>
            {i.shared_with_client && <span className="badge b-neutral">{t('ins.shared')}</span>}
            <b className="num" style={{ color: (i.score || 0) < 80 ? 'var(--danger-fg)' : 'var(--ok-fg)' }}>{i.score}</b>
          </div>
        ))}
      </section>
      {gen && <GenerateVisits contract={contract} lastScheduled={upcoming?.last || ''} onClose={() => setGen(false)} onDone={() => { setGen(false); loadUpcoming(); }} />}
      {newInsp && company && <InspectionForm contractId={contract.id} companyId={company.id} inspectorId={membership?.id || null} onClose={() => setNewInsp(false)} onSaved={() => { setNewInsp(false); load(); }} />}
    </Sheet>
  );
}

const WD = [1, 2, 3, 4, 5, 6, 0];

/** Creates the contract's visits on the chosen weekdays (no price: the contract is billed by month) */
function GenerateVisits({ contract, lastScheduled, onClose, onDone }: { contract: Contract; lastScheduled: string; onClose: () => void; onDone: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const wt = contract.walkthrough || {};
  const [days, setDays] = useState<number[]>(wt.weekdays?.length ? wt.weekdays : [1, 3, 5]);
  const [time, setTime] = useState(wt.after && /^\d{2}:\d{2}$/.test(wt.after) ? wt.after : '18:00');
  const perVisit = contract.hours_per_week && days.length ? Math.max(0.5, Math.round((contract.hours_per_week / days.length) * 2) / 2) : 2;
  const [hours, setHours] = useState(perVisit);
  const [weeks, setWeeks] = useState(4);
  const [members, setMembers] = useState<Member[]>([]);
  const [helper, setHelper] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (company) getMembers(company.id).then((m) => setMembers(m.filter((x) => x.status === 'active'))); }, [company]);
  // start the day after the last visit already on the schedule (or tomorrow)
  const from = startOfDay(addDays(lastScheduled ? new Date(lastScheduled) : new Date(), 1));
  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(from, i);
      if (days.includes(d.getDay())) { const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); out.push(d); }
    }
    return out;
  }, [from.getTime(), weeks, days, time]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!company || !dates.length) return;
    setBusy(true);
    const { data: jobs, error } = await supabase.from('jobs').insert(dates.map((d) => ({
      company_id: company.id, client_id: contract.client_id, property_id: contract.property_id, contract_id: contract.id,
      scheduled_start: d.toISOString(), scheduled_end: new Date(d.getTime() + hours * 36e5).toISOString(), price_cents: 0,
    }))).select('id');
    if (!error && helper && jobs?.length) await supabase.from('job_assignments').insert(jobs.map((j) => ({ job_id: j.id, membership_id: helper, company_id: company.id, is_lead: true })));
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('ct.genDone', { n: dates.length })); onDone(); }
  };
  const wdName = (d: number) => new Date(2026, 0, 4 + d).toLocaleDateString(lang, { weekday: 'short' }).replace('.', '');
  return (
    <Sheet title={t('ct.genVisits')} onClose={onClose}>
      <span className="k-lbl">{t('ct.weekdays')}</span>
      <div className="k-optgrid sm">
        {WD.map((d) => <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}>{wdName(d)}</button>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <label className="k-field"><span>{t('ct.startTime')}</span><TimeField value={time} onChange={setTime} label={t('ct.startTime')} from={5} to={23} /></label>
        <label className="k-field"><span>{t('ct.hoursVisit')}</span><Stepper value={hours} onChange={setHours} min={0.5} max={12} step={0.5} label={t('ct.hoursVisit')} /></label>
      </div>
      <label className="k-field"><span>{t('ct.weeks')}</span><Stepper value={weeks} onChange={setWeeks} min={1} max={12} label={t('ct.weeks')} /></label>
      <label className="k-field"><span>{t('job.helper')}</span><Select value={helper} onChange={setHelper} label={t('job.helper')}><option value="">{t('c.unassigned')}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}</Select></label>
      <span className="k-help">{dates.length ? t('ct.genSummary', { n: dates.length, a: dates[0].toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', ''), b: dates[dates.length - 1].toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '') }) : t('ct.pickDays')}</span>
      <SheetActions cancel={t('c.cancel')} onCancel={onClose} confirm={t('ct.genN', { n: dates.length })} onConfirm={save} disabled={busy || !dates.length} />
    </Sheet>
  );
}

const AREAS = ['std.office', 'std.bathroom', 'std.breakroom', 'ins.floors', 'ins.trash', 'ins.glass', 'ins.entrance'];

function InspectionForm({ contractId, companyId, inspectorId, onClose, onSaved }: { contractId: string; companyId: string; inspectorId: string | null; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, toast } = useApp();
  const [items, setItems] = useState(AREAS.map((a) => ({ area: a, ok: true, note: '' })));
  const [share, setShare] = useState(true);
  const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
  const save = async () => {
    const { error } = await supabase.from('inspections').insert({ company_id: companyId, contract_id: contractId, inspector_id: inspectorId, score, items: items.map((i) => ({ area: i.area, ok: i.ok, note: i.note || undefined })), shared_with_client: share });
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onSaved(); }
  };
  return (
    <Sheet title={t('ins.new')} onClose={onClose}>
      <div className="row"><span className="grow bold">{t('ins.score')}</span><span className="num" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26 }}>{score}</span></div>
      {items.map((it, n) => (
        <div key={it.area} className="card tight stack" style={{ gap: 6 }}>
          <div className="row">
            <span className="grow bold">{t(it.area)}</span>
            <Segmented value={it.ok ? 'ok' : 'bad'} onChange={(v) => setItems(items.map((x, k) => (k === n ? { ...x, ok: v === 'ok' } : x)))} label={t(it.area)}
              options={[{ value: 'ok', label: t('ins.ok') }, { value: 'bad', label: t('ins.bad') }]} />
          </div>
          {!it.ok && <input className="input" placeholder={t('ins.note')} value={it.note} onChange={(e) => setItems(items.map((x, k) => (k === n ? { ...x, note: e.target.value } : x)))} />}
        </div>
      ))}
      <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />{t('ins.shareClient')}</label>
      <button className="k-btn k-btn-fill" onClick={save}>{t('c.save')}</button>
    </Sheet>
  );
}
