import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Field, Icon, LoadingList, OwnerNav, Segmented, Sheet } from '../components/ui';
import { getClients, type Client } from '../lib/data';
import { addDays, isoDate, money, toCents } from '../lib/format';

export type Contract = {
  id: string; client_id: string; property_id: string; status: string; monthly_value_cents: number; hours_per_week: number | null;
  starts_on: string | null; renews_on: string | null; last_adjusted_on: string | null; geofence_radius_m: number;
  clients: { name: string } | null; properties: { address_line1: string; city: string } | null;
};
type Inspection = { id: string; score: number | null; items: { area: string; ok: boolean; note?: string }[]; shared_with_client: boolean; inspected_at: string };

const SELECT = 'id, client_id, property_id, status, monthly_value_cents, hours_per_week, starts_on, renews_on, last_adjusted_on, geofence_radius_m, clients(name), properties(address_line1, city)';

export async function getContracts(companyId: string) {
  const { data } = await supabase.from('contracts').select(SELECT).eq('company_id', companyId).order('renews_on', { ascending: true, nullsFirst: false });
  return (data || []) as unknown as Contract[];
}

const daysUntil = (d: string | null) => (d ? Math.ceil((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5) : null);
const monthsSince = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d + 'T12:00').getTime()) / (30.44 * 864e5)) : null);

export default function Contracts() {
  const { t, lang, company } = useApp();
  const [list, setList] = useState<Contract[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<'active' | 'proposal' | 'all'>('active');
  const [create, setCreate] = useState(false);
  const [open, setOpen] = useState<Contract | null>(null);
  const load = useCallback(async () => { if (company) setList(await getContracts(company.id)); }, [company]);
  useEffect(() => { load(); if (company) getClients(company.id).then((c) => setClients(c.filter((x) => x.kind === 'commercial'))); }, [load, company]);
  const shown = (list || []).filter((c) => tab === 'all' || c.status === tab);
  const mrr = (list || []).filter((c) => c.status === 'active').reduce((s, c) => s + c.monthly_value_cents, 0);

  return (
    <div className="shell">
      <main className="page">
        <div className="topbar"><h1 className="grow">{t('ct.title')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setCreate(true)}><Icon name="plus" size={18} />{t('ct.new')}</button></div>
        <div className="grid2">
          <div className="kpi"><div className="label">{t('ct.mrr')}</div><div className="value num">{money(mrr, lang)}</div></div>
          <div className="kpi"><div className="label">{t('ct.active')}</div><div className="value num">{(list || []).filter((c) => c.status === 'active').length}</div></div>
        </div>
        <Segmented value={tab} onChange={setTab} label={t('ct.title')} options={[{ value: 'active', label: t('ct.st.active') }, { value: 'proposal', label: t('ct.st.proposal') }, { value: 'all', label: t('inv.all') }]} />
        {!list ? <LoadingList /> : shown.length === 0 ? <div className="empty">{t('ct.empty')}</div> : (
          <div className="list">
            {shown.map((c) => {
              const d = daysUntil(c.renews_on);
              const m = monthsSince(c.last_adjusted_on || c.starts_on);
              return (
                <button key={c.id} className="item" onClick={() => setOpen(c)}>
                  <span className="body">
                    <span className="title">{c.clients?.name}</span>
                    <span className="small muted">{money(c.monthly_value_cents, lang)}/{t('ct.mo')}{c.hours_per_week ? ` · ${c.hours_per_week}h/${t('ct.wk')}` : ''}</span>
                  </span>
                  <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                    <span className={`badge ${c.status === 'active' ? 'b-ok' : c.status === 'proposal' ? 'b-neutral' : 'b-warn'}`}>{t(`ct.st.${c.status}`)}</span>
                    {d !== null && d <= 30 && c.status === 'active' && <span className="badge b-danger">{t('ct.renewsIn', { n: Math.max(0, d) })}</span>}
                    {m !== null && m >= 12 && c.status === 'active' && <span className="badge b-warn">{t('ct.noAdjust', { n: m })}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>
      <OwnerNav />
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
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Segmented value={status} onChange={setStatus} label={t('ct.status')} options={[{ value: 'active', label: t('ct.st.active') }, { value: 'proposal', label: t('ct.st.proposal') }]} />
        <div className="grid2">
          <Field label={t('ct.value')}><input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required /></Field>
          <Field label={t('ct.hours')}><input className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        </div>
        <div className="grid2">
          <Field label={t('ct.start')}><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label={t('ct.renews')}><input className="input" type="date" value={renew} onChange={(e) => setRenew(e.target.value)} /></Field>
        </div>
        <Field label={t('ct.radius')} hint={t('ct.radiusHint')}><input className="input" inputMode="numeric" value={radius} onChange={(e) => setRadius(e.target.value)} /></Field>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || toCents(value) <= 0}>{t('c.save')}</button>
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
        <div className="kpi"><div className="label">{t('ct.value')}</div><div className="value num">{money(contract.monthly_value_cents, lang)}</div></div>
        <div className="kpi"><div className="label">{t('ct.renews')}</div><div className="bold" style={{ marginTop: 4 }}>{contract.renews_on ? new Date(contract.renews_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div></div>
      </div>
      <section className="card stack" style={{ gap: 6 }}>
        <span className="label">{t('ct.hoursVs')}</span>
        {delivered === null ? <div className="skeleton" style={{ height: 24 }} /> : (
          <>
            <div className="row"><span className="grow bold num">{delivered.toFixed(1)}h</span><span className="muted small">{expected ? `${t('ct.contracted')}: ${expected}h` : t('ct.noHours')}</span></div>
            {expected && <div style={{ height: 8, borderRadius: 8, background: 'var(--line)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, (delivered / expected) * 100)}%`, background: delivered > expected * 1.1 ? 'var(--danger-strong)' : 'var(--action)' }} /></div>}
            {expected && delivered > expected * 1.1 && <span className="small" style={{ color: 'var(--danger-fg)' }}>{t('ct.overHours')}</span>}
          </>
        )}
        {outside > 0 && <span className="small" style={{ color: 'var(--danger-fg)' }}>{t('ct.outside', { n: outside })}</span>}
      </section>
      <div className="row wrap">
        <button className="btn btn-secondary" onClick={() => setAdjust(true)}>{t('ct.adjust')}</button>
        {contract.status === 'proposal' && <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setStatus('active')}>{t('ct.activate')}</button>}
        {contract.status === 'active' && <button className="btn btn-ghost" onClick={() => setStatus('paused')}>{t('ct.pause')}</button>}
        {contract.status === 'paused' && <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setStatus('active')}>{t('ct.activate')}</button>}
      </div>
      {adjust && (
        <div className="card stack">
          <Field label={t('ct.newValue')}><input className="input" inputMode="decimal" value={newValue} onChange={(e) => setNewValue(e.target.value)} /></Field>
          <button className="btn btn-primary" onClick={saveAdjust}>{t('c.save')}</button>
        </div>
      )}
      <section className="stack">
        <div className="row"><h3 className="grow">{t('ins.title')}</h3><button className="btn btn-ghost" onClick={() => setNewInsp(true)}><Icon name="plus" size={18} />{t('ins.new')}</button></div>
        {insp.length === 0 ? <span className="small muted">{t('ins.none')}</span> : insp.map((i) => (
          <div key={i.id} className="card tight row">
            <span className="grow small">{new Date(i.inspected_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' })} · {i.items.filter((x) => !x.ok).length ? t('ins.issues', { n: i.items.filter((x) => !x.ok).length }) : t('ins.allOk')}</span>
            {i.shared_with_client && <span className="badge b-neutral">{t('ins.shared')}</span>}
            <b className="num" style={{ color: (i.score || 0) < 80 ? 'var(--danger-fg)' : 'var(--ok-fg)' }}>{i.score}</b>
          </div>
        ))}
      </section>
      {newInsp && company && <InspectionForm contractId={contract.id} companyId={company.id} inspectorId={membership?.id || null} onClose={() => setNewInsp(false)} onSaved={() => { setNewInsp(false); load(); }} />}
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
      <button className="btn btn-primary" onClick={save}>{t('c.save')}</button>
    </Sheet>
  );
}
