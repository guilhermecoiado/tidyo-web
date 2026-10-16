// Faturas — canvas Faturas, in manual mode: PDF with the company's payment details, reminders by WhatsApp/SMS/Email, manual "paid"
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Sheet } from '../components/ui';
import { DateField, Select } from '../components/pickers';
import { C, Head, OwnerBar, PILL, Segment, SheetActions, Svg, I, usd } from '../components/kit';
import { getClients, isOverdue, type Client } from '../lib/data';
import { addDays, isoDate } from '../lib/format';
import { invoicePdf, shareFile, type PaymentInfo } from '../lib/invoicePdf';
import { translate, type Lang } from '../lib/i18n';

type Inv = { id: string; number: string; status: string; issued_on: string | null; due_on: string | null; total_cents: number; paid_cents: number; client_id: string; last_reminder_at: string | null;
  clients: { name: string; email: string | null; phone: string | null; language: Lang } | null; payments: { method: string; received_at: string }[] };
type Line = { description: string; quantity: number; unit_cents: number; amount_cents: number };
type Tab = 'late' | 'open' | 'paid';
const toCents = (s: string) => Math.round(parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.')) * 100) || 0;

export async function sendInvoicePdf(inv: Inv, company: { name: string; address?: string | null; payment_info?: PaymentInfo }, _t?: unknown) {
  const [{ data: lines }, { data: prop }] = await Promise.all([
    supabase.from('invoice_lines').select('description, quantity, unit_cents, amount_cents').eq('invoice_id', inv.id),
    supabase.from('properties').select('address_line1, city, state, zip').eq('client_id', inv.client_id).limit(1),
  ]);
  const p = (prop || [])[0] as { address_line1: string; city: string; state: string; zip: string } | undefined;
  const blob = await invoicePdf({
    company: { name: company.name, address: company.address }, lang: inv.clients?.language || 'en', pay: company.payment_info || {},
    client: { name: inv.clients?.name || '', email: inv.clients?.email, address: p ? `${p.address_line1}, ${p.city}, ${p.state} ${p.zip}` : '' },
    inv: { number: inv.number, issued_on: inv.issued_on, due_on: inv.due_on, total_cents: inv.total_cents, paid_cents: inv.paid_cents, lines: (lines || []) as Line[] },
  });
  return shareFile(blob, `${inv.number}.pdf`, translate(inv.clients?.language || 'en', 'inv.shareText', { company: company.name, n: inv.number, v: usd(inv.total_cents - inv.paid_cents, true) }));
}

export default function Invoices() {
  const { t, lang, company, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState<Inv[] | null>(null);
  const [tab, setTab] = useState<Tab>('late');
  const [create, setCreate] = useState(!!params.get('nova'));
  const [mark, setMark] = useState<Inv | null>(null);
  const [open, setOpen] = useState<Inv | null>(null);
  const [remind, setRemind] = useState(false);
  const load = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from('invoices').select('id, number, status, issued_on, due_on, total_cents, paid_cents, client_id, last_reminder_at, clients(name, email, phone, language), payments(method, received_at)')
      .eq('company_id', company.id).in('status', ['open', 'paid']).order('due_on', { ascending: true }).limit(300);
    const l = (data || []) as unknown as Inv[];
    setList(l);
    setTab((cur) => (cur === 'late' && !l.some((i) => isOverdue(i as never)) ? 'open' : cur));
  }, [company]);
  useEffect(() => { load(); }, [load]);

  const late = (list || []).filter((i) => isOverdue(i as never));
  const openL = (list || []).filter((i) => i.status === 'open' && !isOverdue(i as never));
  const monthStart = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const paid = (list || []).filter((i) => i.status === 'paid').sort((a, b) => ((b.payments || [])[0]?.received_at || '').localeCompare((a.payments || [])[0]?.received_at || ''));
  const paidMonth = paid.filter((i) => ((i.payments || []).map((p) => p.received_at).sort().pop() || '').slice(0, 10) >= monthStart);
  const rest = (i: Inv) => i.total_cents - i.paid_cents;
  const rows = tab === 'late' ? late : tab === 'open' ? openL : paid.slice(0, 40);
  const days = (d: string) => Math.round((new Date(d + 'T12:00').getTime() - Date.now()) / 864e5);
  const when = (i: Inv) => {
    if (i.status === 'paid') { const p = (i.payments || []).map((x) => x).sort((a, b) => b.received_at.localeCompare(a.received_at))[0]; return p ? t('inv.paidOn', { d: new Date(p.received_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', ''), m: t(`pay.${p.method}`) }) : t('inv.status.paid'); }
    if (!i.due_on) return '';
    const n = days(i.due_on);
    return n < 0 ? t('inv.lateBy', { n: -n }) : n === 0 ? t('inv.dueToday') : t('inv.dueIn', { n });
  };
  const missingPay = !company?.payment_info || !Object.values(company.payment_info as Record<string, string>).some(Boolean);

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <Head title={t('fin.invoices')} back="/app/financas" right={<button className="k-btn k-btn-fill" style={{ minHeight: 44, borderRadius: 13, fontSize: 13.5, padding: '0 14px' }} onClick={() => setCreate(true)}>{t('inv.newCharge')}</button>} />
        <div className="k-kpis">
          {[[t('inv.lateTab'), late.reduce((s, i) => s + rest(i), 0), '#B8400C'], [t('inv.openTab'), openL.reduce((s, i) => s + rest(i), 0), C.ink], [t('inv.paidMonth'), paidMonth.reduce((s, i) => s + i.total_cents, 0), '#0B6B5F']].map(([l, v, c]) => (
            <div key={l as string} className="k-kpi" style={{ borderRadius: 14, padding: '10px 12px', gap: 2 }}><span className="k-kpi-l" style={{ fontWeight: 800, letterSpacing: '0.04em' }}>{l}</span><span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 19, fontWeight: 700, color: c as string }}>{usd(v as number)}</span></div>
          ))}
        </div>
        <Segment value={tab} onChange={setTab} label={t('inv.title')} options={[{ value: 'late', label: t('inv.lateTab') }, { value: 'open', label: t('inv.openTab') }, { value: 'paid', label: t('inv.paidTab') }]} />
        {missingPay && <Link to="/app/mais/recebimento" className="k-note" style={{ textDecoration: 'none' }}><span>{t('inv.addPayInfo')}</span><span className="k-btn k-btn-sm" style={{ background: '#FFFFFF', border: '1px solid #E5C875', color: '#6B4A04', minHeight: 40 }}>{t('inv.add')}</span></Link>}
        {tab === 'late' && late.length > 0 && (
          <button className="k-btn" onClick={() => setRemind(true)} style={{ minHeight: 46, border: '1px solid #F5D3C2', background: '#FFF3EC', color: '#8F2F08', fontSize: 13.5 }}>{t('inv.remindN', { n: late.length })}</button>
        )}
        <div className="k-card" style={{ padding: '2px 12px', gap: 0 }}>
          {!list ? [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 48, margin: '12px 0' }} />) : rows.length === 0 ? <span style={{ display: 'block', padding: '20px 0', textAlign: 'center', fontSize: 13.5, color: C.muted }}>{tab === 'late' ? t('inv.noneLate') : tab === 'open' ? t('inv.noneOpen') : t('inv.nonePaid')}</span> : rows.map((i, k) => {
            const st: [string, string, string] = i.status === 'paid' ? [t('inv.status.paid'), ...PILL.ok] : isOverdue(i as never) ? [t('inv.status.overdue'), ...PILL.danger] : [t('inv.openTab'), ...PILL.neutral];
            return (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: k ? `1px solid ${C.soft}` : 0 }}>
                <button onClick={() => setOpen(i)} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: C.ink }}>
                  <span className="k-ell" style={{ fontWeight: 800, fontSize: 14 }}>{i.clients?.name}</span>
                  <span className="k-ell" style={{ fontSize: 12, color: C.muted }}>{i.number} · {when(i)}</span>
                </button>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className="num nw" style={{ fontWeight: 800, fontSize: 14 }}>{usd(i.status === 'paid' ? i.total_cents : rest(i), true)}</span>
                  <span className="k-pill" style={{ fontSize: 11, padding: '2px 8px', background: st[1], color: st[2] }}>{st[0]}</span>
                </span>
                {i.status !== 'paid' && (
                  <button className="k-iconbtn" style={{ borderRadius: 12 }} onClick={() => setMark(i)} aria-label={t('inv.markAria', { name: i.clients?.name || '' })}><Svg d={I.check} size={18} color={C.accent} w={2.4} /></button>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <OwnerBar />
      {create && <NewCharge preset={params.get('nova') || ''} onClose={() => { setCreate(false); if (params.get('nova')) setParams({}); }} onSaved={() => { setCreate(false); setParams({}); load(); }} />}
      {mark && <MarkPaid inv={mark} onClose={() => setMark(null)} onSaved={(m) => { setMark(null); toast(t('inv.markedAs', { m })); load(); }} />}
      {open && <InvoiceSheet inv={open} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); load(); }} onMark={() => { setMark(open); setOpen(null); }} />}
      {remind && <RemindSheet list={late} onClose={() => { setRemind(false); load(); }} />}
    </div>
  );
}

function NewCharge({ preset, onClose, onSaved }: { preset: string; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(preset);
  const [jobs, setJobs] = useState<{ id: string; scheduled_start: string; price_cents: number; services: { name: string } | null; extras: { name: string; price_cents: number }[] }[] | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState<{ d: string; v: string }[]>([]);
  const [due, setDue] = useState(isoDate(addDays(new Date(), 7)));
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (company) getClients(company.id).then((c) => { setClients(c); if (!preset && c[0]) setClientId(c[0].id); }); }, [company, preset]);
  useEffect(() => {
    if (!company || !clientId) return;
    setJobs(null);
    Promise.all([
      supabase.from('jobs').select('id, scheduled_start, price_cents, services(name), extras').eq('client_id', clientId).eq('status', 'completed').gt('price_cents', 0).order('scheduled_start', { ascending: false }).limit(30),
      supabase.from('invoice_lines').select('job_id').eq('company_id', company.id).not('job_id', 'is', null),
    ]).then(([j, l]) => {
      const done = new Set(((l.data || []) as { job_id: string }[]).map((x) => x.job_id));
      const list = ((j.data || []) as unknown as NonNullable<typeof jobs>).filter((x) => !done.has(x.id));
      setJobs(list); setPick(Object.fromEntries(list.map((x) => [x.id, true])));
    });
  }, [company, clientId]);
  const lines = useMemo(() => [
    ...(jobs || []).filter((j) => pick[j.id]).flatMap((j) => {
      const exTotal = (j.extras || []).reduce((s, e) => s + e.price_cents, 0);
      const d = new Date(j.scheduled_start).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '');
      return [{ job_id: j.id, description: `${j.services?.name || t('job.details')} · ${d}`, unit_cents: j.price_cents - exTotal },
        ...(j.extras || []).map((e) => ({ job_id: null as string | null, description: `${t('inv.extra')}: ${e.name}`, unit_cents: e.price_cents }))];
    }),
    ...extra.filter((e) => e.d && toCents(e.v) > 0).map((e) => ({ job_id: null as string | null, description: e.d, unit_cents: toCents(e.v) })),
  ], [jobs, pick, extra, lang, t]);
  const total = lines.reduce((s, l) => s + l.unit_cents, 0);
  const client = clients.find((c) => c.id === clientId);
  const save = async () => {
    if (!company || !client || !lines.length) return;
    setBusy(true);
    const { data: inv, error } = await supabase.from('invoices').insert({ company_id: company.id, client_id: client.id, status: 'open', issued_on: isoDate(new Date()), due_on: due, number: '' }).select('id, number').single();
    if (error) { setBusy(false); toast(tErr(error.message)); return; }
    const { error: e2 } = await supabase.from('invoice_lines').insert(lines.map((l) => ({ ...l, invoice_id: inv.id, company_id: company.id })));
    if (e2) { setBusy(false); toast(tErr(e2.message)); return; }
    const { data: full } = await supabase.from('invoices').select('id, number, status, issued_on, due_on, total_cents, paid_cents, client_id, last_reminder_at, clients(name, email, phone, language), payments(method, received_at)').eq('id', inv.id).single();
    if (full) await sendInvoicePdf(full as unknown as Inv, company as never, t);
    setBusy(false);
    toast(t('inv.sent', { v: usd(total, true), name: client.name }));
    onSaved();
  };
  return (
    <Sheet title={t('inv.newCharge')} onClose={onClose}>
      <label className="k-field"><span>{t('job.client')}</span><Select value={clientId} onChange={setClientId} label={t('job.client')}>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
      <div style={{ background: C.bg, borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.muted }}>{t('inv.notBilled')}</span>
        {!jobs ? <div className="skeleton" style={{ height: 30 }} /> : jobs.length === 0 && !extra.length ? <span className="k-s125 k-muted">{t('inv.nothing')}</span> : jobs.map((j) => (
          <label key={j.id} className="check" style={{ alignItems: 'center', gap: 10, fontSize: 13.5 }}>
            <input type="checkbox" checked={!!pick[j.id]} onChange={() => setPick({ ...pick, [j.id]: !pick[j.id] })} />
            <span style={{ flex: 1 }}>{j.services?.name || t('job.details')} · {new Date(j.scheduled_start).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '')}{(j.extras || []).length ? ` + ${j.extras.length} extra` : ''}</span>
            <b className="num">{usd(j.price_cents, true)}</b>
          </label>
        ))}
        {extra.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 6 }}>
            <input className="k-input" style={{ minHeight: 44 }} placeholder={t('inv.itemPh')} value={e.d} onChange={(x) => setExtra(extra.map((y, k) => (k === i ? { ...y, d: x.target.value } : y)))} />
            <input className="k-input" style={{ minHeight: 44 }} inputMode="decimal" placeholder="0.00" value={e.v} onChange={(x) => setExtra(extra.map((y, k) => (k === i ? { ...y, v: x.target.value } : y)))} />
          </div>
        ))}
        <button className="k-link" style={{ alignSelf: 'flex-start' }} onClick={() => setExtra([...extra, { d: '', v: '' }])}>+ {t('inv.addItem')}</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><span style={{ fontWeight: 800 }}>{t('job.kvTotal')}</span><span className="num" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17 }}>{usd(total, true)}</span></div>
      </div>
      <label className="k-field"><span>{t('inv.due')}</span><DateField label={t('inv.due')} value={due} onChange={setDue} /></label>
      <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{t('inv.manualNote')}</span>
      <SheetActions cancel={t('c.cancel')} onCancel={onClose} confirm={t('inv.sendV', { v: usd(total, true) })} onConfirm={save} disabled={busy || !lines.length} />
    </Sheet>
  );
}

function MarkPaid({ inv, onClose, onSaved }: { inv: Inv; onClose: () => void; onSaved: (m: string) => void }) {
  const { t, tErr, company, membership, toast } = useApp();
  const [method, setMethod] = useState('zelle');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!company) return;
    setBusy(true);
    const { error } = await supabase.from('payments').insert({ company_id: company.id, invoice_id: inv.id, client_id: inv.client_id, method, amount_cents: inv.total_cents - inv.paid_cents, reference: ref || null, recorded_by: membership?.id || null });
    setBusy(false);
    if (error) toast(tErr(error.message)); else onSaved(t(`pay.${method}`));
  };
  return (
    <Sheet title={t('inv.gotPaid')} onClose={onClose}>
      <span style={{ fontSize: 13.5, color: C.muted, marginTop: -6 }}>{inv.clients?.name} · {usd(inv.total_cents - inv.paid_cents, true)}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {['zelle', 'cash', 'check', 'venmo', 'card', 'other'].map((m) => {
          const on = m === method;
          return <button key={m} aria-pressed={on} onClick={() => setMethod(m)} style={{ minHeight: 48, borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? '#F0F9F7' : '#FFFFFF', fontWeight: 800, fontSize: 13.5, color: C.ink, cursor: 'pointer', fontFamily: 'inherit' }}>{t(`pay.${m}`)}</button>;
        })}
      </div>
      <label className="k-field"><span>{t('inv.ref')}</span><input className="k-input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t('inv.refPh')} /></label>
      <SheetActions cancel={t('c.back')} onCancel={onClose} confirm={t('inv.markPaidBtn')} onConfirm={go} disabled={busy} />
    </Sheet>
  );
}

function InvoiceSheet({ inv, onClose, onChanged, onMark }: { inv: Inv; onClose: () => void; onChanged: () => void; onMark: () => void }) {
  const { t, tErr, lang, company, toast } = useApp();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [ask, setAsk] = useState(false);
  useEffect(() => { supabase.from('invoice_lines').select('description, quantity, unit_cents, amount_cents').eq('invoice_id', inv.id).then(({ data }) => setLines((data || []) as Line[])); }, [inv.id]);
  const d = (s: string | null) => (s ? new Date(s + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  return (
    <Sheet title={`${inv.number} · ${inv.clients?.name || ''}`} onClose={onClose}>
      <div className="k-kv">
        <div><span>{t('pdf.issued')}</span><span>{d(inv.issued_on)}</span></div>
        <div><span>{t('inv.due')}</span><span>{d(inv.due_on)}</span></div>
        {(lines || []).map((l, i) => <div key={i}><span className="k-ell">{l.description}</span><span className="num">{usd(l.amount_cents, true)}</span></div>)}
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}><span style={{ fontWeight: 800, color: C.ink }}>{t('job.kvTotal')}</span><span className="num">{usd(inv.total_cents, true)}</span></div>
        {inv.paid_cents > 0 && <div><span>{t('pdf.paid')}</span><span className="num" style={{ color: '#0B6B5F' }}>{usd(inv.paid_cents, true)}</span></div>}
      </div>
      <div className="k-pair">
        <button className="k-btn k-btn-line" onClick={async () => { if (company) { const shared = await sendInvoicePdf(inv, company as never, t); if (!shared) toast(t('inv.downloaded')); } }}>{t('inv.pdf')}</button>
        {inv.status !== 'paid' ? <button className="k-btn k-btn-fill" onClick={onMark}>{t('inv.markPaidBtn')}</button> : <button className="k-btn k-btn-fill" onClick={onClose}>{t('c.close')}</button>}
      </div>
      {inv.status !== 'paid' && inv.paid_cents === 0 && <button className="k-link" style={{ alignSelf: 'center', color: '#9F1F14' }} onClick={() => setAsk(true)}>{t('inv.void')}</button>}
      {ask && <Confirm danger text={t('inv.voidAsk', { n: inv.number })} confirmLabel={t('inv.void')} onCancel={() => setAsk(false)} onConfirm={async () => {
        setAsk(false);
        const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id);
        if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onChanged(); }
      }} />}
    </Sheet>
  );
}

function RemindSheet({ list, onClose }: { list: Inv[]; onClose: () => void }) {
  const { t, company } = useApp();
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const msg = (i: Inv) => {
    const lt = (k: string, p: Record<string, string | number>) => translate(i.clients?.language || 'en', k, p);
    return lt('inv.remindMsg', { name: i.clients?.name || '', company: company?.name || '', n: i.number, v: usd(i.total_cents - i.paid_cents, true) });
  };
  const mark = async (i: Inv) => {
    setSent({ ...sent, [i.id]: true });
    await supabase.from('invoices').update({ last_reminder_at: new Date().toISOString() }).eq('id', i.id);
  };
  return (
    <Sheet title={t('inv.remindTitle')} onClose={onClose}>
      <span className="k-help">{t('inv.remindHelp')}</span>
      {list.map((i) => (
        <div key={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 0', borderTop: `1px solid ${C.soft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b className="k-ell">{i.clients?.name}</b><span className="num" style={{ fontWeight: 800 }}>{usd(i.total_cents - i.paid_cents, true)}</span></div>
          <div className="k-chips wrap">
            {i.clients?.phone && <a className="k-chip" href={`https://wa.me/${i.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg(i))}`} target="_blank" rel="noreferrer" onClick={() => mark(i)}>WhatsApp</a>}
            {i.clients?.phone && <a className="k-chip" href={`sms:${i.clients.phone}?&body=${encodeURIComponent(msg(i))}`} onClick={() => mark(i)}>SMS</a>}
            {i.clients?.email && <a className="k-chip" href={`mailto:${i.clients.email}?subject=${encodeURIComponent(i.number)}&body=${encodeURIComponent(msg(i))}`} onClick={() => mark(i)}>Email</a>}
            {sent[i.id] && <span className="k-pill" style={{ background: PILL.ok[0], color: PILL.ok[1], alignSelf: 'center' }}>✓</span>}
          </div>
        </div>
      ))}
      <button className="k-btn k-btn-fill" onClick={onClose}>{t('c.close')}</button>
    </Sheet>
  );
}
