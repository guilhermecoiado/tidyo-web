import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Confirm, Field, Icon, LoadingList, OwnerNav, Segmented, Sheet } from '../components/ui';
import { getClients, getMembers, type Client, type Member } from '../lib/data';
import { addDays, fmtHours, hoursBetween, isoDate, money, startOfDay, toCents } from '../lib/format';
import { compressImage } from '../lib/photos';

export function FinanceTabs() {
  const { t } = useApp();
  const tabs: [string, string][] = [['/app/financas', t('fin.overview')], ['/app/cobrancas', t('nav.money')], ['/app/financas/despesas', t('fin.expenses')], ['/app/financas/equipe', t('fin.team')]];
  return (
    <nav className="segmented" aria-label={t('nav.finance')} style={{ gridAutoColumns: 'auto' }}>
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'seg-on' : '')}
          style={({ isActive }) => ({ minHeight: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, textDecoration: 'none', padding: '0 6px', color: isActive ? 'var(--brand-dark)' : 'var(--ink-muted)', background: isActive ? 'var(--surface)' : 'transparent', boxShadow: isActive ? 'var(--shadow-card)' : 'none' })}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

type Period = 'month' | 'last' | '90';
function range(p: Period) {
  const now = new Date();
  if (p === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(startOfDay(now), 1) };
  if (p === 'last') return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
  return { from: addDays(startOfDay(now), -90), to: addDays(startOfDay(now), 1) };
}

type Expense = { id: string; membership_id: string | null; client_id: string | null; category: string; description: string | null; amount_cents: number; incurred_on: string; receipt_path: string | null; reimbursable: boolean; status: string };
type Entry = { id: string; membership_id: string; job_id: string | null; clock_in: string; clock_out: string | null; approval: string };
type Rate = { membership_id: string; hourly_cents: number };

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { t } = useApp();
  return <Segmented value={value} onChange={onChange} label={t('fin.period')} options={[{ value: 'month', label: t('fin.thisMonth') }, { value: 'last', label: t('fin.lastMonth') }, { value: '90', label: t('fin.last90') }]} />;
}

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ─────────────── Resumo ───────────────
export function FinanceOverview() {
  const { t, lang, company } = useApp();
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<{ received: number; billed: number; open: number; overdue: number; expenses: number; labour: number; weeks: number[]; byCat: Record<string, number> } | null>(null);
  const [profit, setProfit] = useState<{ name: string; revenue_cents: number; profit_cents: number }[]>([]);

  const load = useCallback(async () => {
    if (!company) return;
    setData(null);
    const { from, to } = range(period);
    const [pay, inv, exp, te, rates, prof] = await Promise.all([
      supabase.from('payments').select('amount_cents, received_at').eq('company_id', company.id).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
      supabase.from('invoices').select('total_cents, paid_cents, status, due_on, issued_on').eq('company_id', company.id),
      supabase.from('expenses').select('amount_cents, category, status, incurred_on').eq('company_id', company.id).gte('incurred_on', isoDate(from)).lt('incurred_on', isoDate(to)),
      supabase.from('time_entries').select('membership_id, clock_in, clock_out').eq('company_id', company.id).gte('clock_in', from.toISOString()).lt('clock_in', to.toISOString()),
      supabase.from('member_pay_rates').select('membership_id, hourly_cents').eq('company_id', company.id),
      supabase.from('v_client_profit_90d').select('name, revenue_cents, profit_cents').eq('company_id', company.id).order('profit_cents', { ascending: false }),
    ]);
    const rate = new Map(((rates.data || []) as Rate[]).map((r) => [r.membership_id, r.hourly_cents]));
    const payments = (pay.data || []) as { amount_cents: number; received_at: string }[];
    const invoices = (inv.data || []) as { total_cents: number; paid_cents: number; status: string; due_on: string | null; issued_on: string | null }[];
    const expenses = ((exp.data || []) as { amount_cents: number; category: string; status: string }[]).filter((e) => e.status === 'approved' || e.status === 'reimbursed');
    const labour = ((te.data || []) as Entry[]).reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out) * (rate.get(e.membership_id) || 0), 0);
    const today = isoDate(new Date());
    const weeks = Array(Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (7 * 864e5)))).fill(0);
    for (const p of payments) weeks[Math.min(weeks.length - 1, Math.floor((new Date(p.received_at).getTime() - from.getTime()) / (7 * 864e5)))] += p.amount_cents;
    const byCat: Record<string, number> = {};
    for (const e of expenses) byCat[e.category] = (byCat[e.category] || 0) + e.amount_cents;
    setData({
      received: payments.reduce((s, p) => s + p.amount_cents, 0),
      billed: invoices.filter((i) => i.issued_on && i.issued_on >= isoDate(from) && i.issued_on < isoDate(to)).reduce((s, i) => s + i.total_cents, 0),
      open: invoices.filter((i) => i.status === 'open').reduce((s, i) => s + i.total_cents - i.paid_cents, 0),
      overdue: invoices.filter((i) => i.status === 'open' && i.due_on && i.due_on < today).reduce((s, i) => s + i.total_cents - i.paid_cents, 0),
      expenses: expenses.reduce((s, e) => s + e.amount_cents, 0),
      labour: Math.round(labour), weeks, byCat,
    });
    setProfit(((prof.data || []) as { name: string; revenue_cents: number; profit_cents: number }[]).filter((p) => p.revenue_cents > 0));
  }, [company, period]);
  useEffect(() => { load(); }, [load]);

  const net = data ? data.received - data.expenses - data.labour : 0;
  const margin = data && data.received > 0 ? net / data.received : 0;
  // Health 0–100: margin, overdue share and how much was collected
  const health = useMemo(() => {
    if (!data) return 0;
    const m = Math.max(0, Math.min(1, margin / 0.35));
    const od = data.open > 0 ? 1 - Math.min(1, data.overdue / data.open) : 1;
    const col = data.billed > 0 ? Math.min(1, data.received / data.billed) : (data.received > 0 ? 1 : 0.5);
    return Math.round((m * 0.5 + od * 0.25 + col * 0.25) * 100);
  }, [data, margin]);
  const maxW = data ? Math.max(1, ...data.weeks) : 1;

  return (
    <div className="shell">
      <main className="page">
        <h1>{t('nav.finance')}</h1>
        <FinanceTabs />
        <PeriodPicker value={period} onChange={setPeriod} />
        {!data ? <LoadingList n={4} /> : (
          <>
            <div className="grid2">
              <div className="kpi"><div className="label">{t('fin.received')}</div><div className="value num">{money(data.received, lang)}</div></div>
              <div className="kpi"><div className="label">{t('fin.costs')}</div><div className="value num">{money(data.expenses + data.labour, lang)}</div></div>
              <div className="kpi" style={{ background: 'var(--brand-light)' }}><div className="label">{t('fin.profit')}</div><div className="value num">{money(net, lang)}</div></div>
              <div className="kpi"><div className="label">{t('fin.margin')}</div><div className="value num">{Math.round(margin * 100)}%</div></div>
            </div>
            <section className="card row" aria-label={t('fin.health')}>
              <svg width="76" height="76" viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="16" fill="none" stroke="var(--line)" strokeWidth="5" />
                <circle cx="20" cy="20" r="16" fill="none" stroke={health >= 70 ? 'var(--action)' : health >= 45 ? '#C98A12' : 'var(--danger-strong)'} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(health / 100) * 100.5} 100.5`} transform="rotate(-90 20 20)" />
                <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--ink)">{health}</text>
              </svg>
              <div className="grow stack" style={{ gap: 4 }}>
                <span className="bold">{t('fin.health')}</span>
                <span className="small muted">{data.overdue > 0 ? t('fin.tipOverdue', { amount: money(data.overdue, lang) }) : margin < 0.2 && data.received > 0 ? t('fin.tipMargin') : t('fin.tipGood')}</span>
              </div>
            </section>
            <section className="card stack">
              <span className="label">{t('fin.weekly')}</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }} role="img" aria-label={t('fin.weekly')}>
                {data.weeks.map((w, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div title={money(w, lang)} style={{ width: '100%', height: `${Math.max(2, (w / maxW) * 90)}px`, background: 'var(--action)', borderRadius: '6px 6px 2px 2px' }} />
                    <span className="tiny muted">{t('fin.weekN', { n: i + 1 })}</span>
                  </div>
                ))}
              </div>
            </section>
            <div className="grid2">
              <div className="kpi"><div className="label">{t('inv.open')}</div><div className="value num" style={{ fontSize: 18 }}>{money(data.open, lang)}</div></div>
              <div className="kpi" style={data.overdue ? { background: 'var(--danger-bg)' } : undefined}><div className="label">{t('inv.overdue')}</div><div className="value num" style={{ fontSize: 18 }}>{money(data.overdue, lang)}</div></div>
            </div>
            <section className="card stack">
              <span className="label">{t('fin.costBreakdown')}</span>
              <div className="row small"><span className="grow">{t('fin.labour')}</span><b className="num">{money(data.labour, lang)}</b></div>
              {Object.entries(data.byCat).map(([k, v]) => <div key={k} className="row small"><span className="grow">{t(`expc.${k}`)}</span><b className="num">{money(v, lang)}</b></div>)}
            </section>
            <section className="card stack">
              <span className="label">{t('fin.byClient')}</span>
              {profit.length === 0 ? <span className="small muted">{t('fin.noData')}</span> : profit.slice(0, 8).map((p) => (
                <div key={p.name} className="row small">
                  <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span className="muted num">{p.revenue_cents ? Math.round((p.profit_cents / p.revenue_cents) * 100) : 0}%</span>
                  <b className="num" style={{ color: p.profit_cents < 0 ? 'var(--danger-fg)' : undefined }}>{money(p.profit_cents, lang)}</b>
                </div>
              ))}
            </section>
            <ExportButton period={period} />
          </>
        )}
      </main>
      <OwnerNav />
    </div>
  );
}

function ExportButton({ period }: { period: Period }) {
  const { t, company } = useApp();
  const run = async () => {
    if (!company) return;
    const { from, to } = range(period);
    const [pay, exp] = await Promise.all([
      supabase.from('payments').select('received_at, amount_cents, method, reference, invoices(number, clients(name))').eq('company_id', company.id).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
      supabase.from('expenses').select('incurred_on, amount_cents, category, description, status').eq('company_id', company.id).gte('incurred_on', isoDate(from)).lt('incurred_on', isoDate(to)),
    ]);
    const rows: (string | number)[][] = [['Date', 'Type', 'Name', 'Category', 'Memo', 'Amount']];
    for (const p of (pay.data || []) as any[]) rows.push([p.received_at.slice(0, 10), 'Income', p.invoices?.clients?.name || '', 'Cleaning services', `${p.invoices?.number || ''} ${p.method} ${p.reference || ''}`.trim(), (p.amount_cents / 100).toFixed(2)]);
    for (const e of (exp.data || []) as any[]) if (e.status !== 'rejected' && e.status !== 'pending') rows.push([e.incurred_on, 'Expense', '', e.category, e.description || '', (-e.amount_cents / 100).toFixed(2)]);
    download(`tidyo-${isoDate(from)}-${isoDate(addDays(to, -1))}.csv`, rows);
  };
  return <button className="btn btn-secondary" onClick={run}><Icon name="receipt" size={18} />{t('fin.export')}</button>;
}

// ─────────────── Despesas ───────────────
export function Expenses() {
  const { t, tErr, lang, company, toast, membership } = useApp();
  const [list, setList] = useState<Expense[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [create, setCreate] = useState(false);
  const [receipt, setReceipt] = useState<string>('');
  const load = useCallback(async () => {
    if (!company) return;
    const { data } = await supabase.from('expenses').select('id, membership_id, client_id, category, description, amount_cents, incurred_on, receipt_path, reimbursable, status').eq('company_id', company.id).order('incurred_on', { ascending: false }).limit(200);
    setList((data || []) as Expense[]);
  }, [company]);
  useEffect(() => { load(); if (company) { getMembers(company.id).then(setMembers); getClients(company.id).then(setClients); } }, [load, company]);
  const pending = (list || []).filter((e) => e.status === 'pending');
  const toReimburse = (list || []).filter((e) => e.status === 'approved' && e.reimbursable);
  const shown = tab === 'pending' ? [...pending, ...toReimburse] : list || [];
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name || t('fin.company');
  const setStatus = async (e: Expense, status: string) => {
    const { error } = await supabase.from('expenses').update({ status, reviewed_by: membership?.id, reviewed_at: new Date().toISOString() }).eq('id', e.id);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); load(); }
  };
  const openReceipt = async (path: string) => {
    const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 600);
    if (data?.signedUrl) setReceipt(data.signedUrl);
  };
  return (
    <div className="shell">
      <main className="page">
        <div className="topbar"><h1 className="grow">{t('nav.finance')}</h1>
          <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => setCreate(true)}><Icon name="plus" size={18} />{t('fin.newExpense')}</button></div>
        <FinanceTabs />
        <Segmented value={tab} onChange={setTab} label={t('fin.expenses')} options={[{ value: 'pending', label: `${t('fin.toReview')} (${pending.length + toReimburse.length})` }, { value: 'all', label: t('inv.all') }]} />
        {!list ? <LoadingList /> : shown.length === 0 ? <div className="empty">{t('fin.noExpenses')}</div> : (
          <div className="list">
            {shown.map((e) => (
              <div key={e.id} className="card stack" style={{ gap: 8 }}>
                <div className="row">
                  <div className="grow"><div className="bold">{t(`expc.${e.category}`)} · <span className="num">{money(e.amount_cents, lang)}</span></div>
                    <div className="small muted">{nameOf(e.membership_id)} · {new Date(e.incurred_on + 'T12:00').toLocaleDateString(lang, { day: 'numeric', month: 'short' })}{e.description ? ` · ${e.description}` : ''}</div></div>
                  <span className={`badge ${e.status === 'pending' ? 'b-warn' : e.status === 'rejected' ? 'b-danger' : 'b-ok'}`}>{t(`fin.st.${e.status}`)}</span>
                </div>
                <div className="row wrap">
                  {e.receipt_path && <button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => openReceipt(e.receipt_path!)}><Icon name="receipt" size={16} />{t('day.receipt')}</button>}
                  <span className="spacer" />
                  {e.status === 'pending' && <>
                    <button className="btn btn-secondary" style={{ minHeight: 40 }} onClick={() => setStatus(e, 'rejected')}>{t('fin.reject')}</button>
                    <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={() => setStatus(e, 'approved')}>{t('fin.approve')}</button>
                  </>}
                  {e.status === 'approved' && e.reimbursable && <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={() => setStatus(e, 'reimbursed')}>{t('fin.markReimbursed')}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <OwnerNav />
      {create && <CompanyExpenseForm clients={clients} onClose={() => setCreate(false)} onSaved={() => { setCreate(false); load(); }} />}
      {receipt && <div className="scrim center" onClick={() => setReceipt('')} role="dialog" aria-modal="true"><img src={receipt} alt="" style={{ maxWidth: '100%', maxHeight: '86dvh', borderRadius: 16 }} /></div>}
    </div>
  );
}

function CompanyExpenseForm({ clients, onClose, onSaved }: { clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const { t, tErr, company, toast } = useApp();
  const [cat, setCat] = useState('supplies');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [clientId, setClientId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setBusy(true);
    let receipt: string | null = null;
    if (file) {
      const path = `${company.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('receipts').upload(path, await compressImage(file), { contentType: 'image/jpeg' });
      if (!error) receipt = path;
    }
    const { error } = await supabase.from('expenses').insert({ company_id: company.id, category: cat, amount_cents: toCents(amount), description: desc || null, incurred_on: date, client_id: clientId || null, receipt_path: receipt, status: 'approved' });
    setBusy(false);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); onSaved(); }
  };
  return (
    <Sheet title={t('fin.newExpense')} onClose={onClose}>
      <form className="stack" style={{ gap: 14 }} onSubmit={save}>
        <div className="chips" role="group" aria-label={t('fin.category')}>
          {['supplies', 'gas', 'mileage', 'equipment', 'parking', 'tolls', 'other'].map((c) => <button type="button" key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{t(`expc.${c}`)}</button>)}
        </div>
        <div className="grid2">
          <Field label={t('exp.amount')}><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label={t('job.date')}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label={`${t('exp.desc')} (${t('c.optional')})`}><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label={`${t('job.client')} (${t('c.optional')})`} hint={t('fin.clientHint')}>
          <select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">—</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label={t('day.receipt')}><input className="input" type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
        <button className="btn btn-primary btn-block" disabled={busy || toCents(amount) <= 0}>{t('c.save')}</button>
      </form>
    </Sheet>
  );
}

// ─────────────── Equipe: horas e pagamento ───────────────
export function TeamPay() {
  const { t, tErr, lang, company, toast, membership } = useApp();
  const [period, setPeriod] = useState<Period>('month');
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [rates, setRates] = useState<Map<string, number>>(new Map());
  const [tips, setTips] = useState<Map<string, number>>(new Map());
  const [reimb, setReimb] = useState<Map<string, number>>(new Map());
  const [editRate, setEditRate] = useState<Member | null>(null);
  const [rateValue, setRateValue] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    if (!company) return;
    setEntries(null);
    const { from, to } = range(period);
    const [m, te, r, tp, ex] = await Promise.all([
      getMembers(company.id),
      supabase.from('time_entries').select('id, membership_id, job_id, clock_in, clock_out, approval').eq('company_id', company.id).gte('clock_in', from.toISOString()).lt('clock_in', to.toISOString()).order('clock_in'),
      supabase.from('member_pay_rates').select('membership_id, hourly_cents').eq('company_id', company.id),
      supabase.from('tips').select('membership_id, amount_cents').eq('company_id', company.id).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
      supabase.from('expenses').select('membership_id, amount_cents, status, reimbursable').eq('company_id', company.id).eq('reimbursable', true).eq('status', 'approved'),
    ]);
    setMembers(m.filter((x) => x.status === 'active'));
    setEntries((te.data || []) as Entry[]);
    setRates(new Map(((r.data || []) as Rate[]).map((x) => [x.membership_id, x.hourly_cents])));
    const sum = (rows: { membership_id: string | null; amount_cents: number }[]) => { const mp = new Map<string, number>(); for (const x of rows) if (x.membership_id) mp.set(x.membership_id, (mp.get(x.membership_id) || 0) + x.amount_cents); return mp; };
    setTips(sum((tp.data || []) as { membership_id: string; amount_cents: number }[]));
    setReimb(sum((ex.data || []) as { membership_id: string; amount_cents: number }[]));
  }, [company, period]);
  useEffect(() => { load(); }, [load]);

  const rows = members.map((m) => {
    const es = (entries || []).filter((e) => e.membership_id === m.id);
    const hours = es.reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out), 0);
    const rate = rates.get(m.id) || 0;
    return { m, es, hours, rate, pay: Math.round(hours * rate), tips: tips.get(m.id) || 0, reimb: reimb.get(m.id) || 0, pending: es.filter((e) => e.approval === 'pending' && e.clock_out).length, open: es.some((e) => !e.clock_out) };
  });
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);

  const approveAll = async () => {
    if (!entries) return;
    const ids = entries.filter((e) => e.approval === 'pending' && e.clock_out).map((e) => e.id);
    if (!ids.length) return;
    const { error } = await supabase.from('time_entries').update({ approval: 'approved', edited_by: membership?.id }).in('id', ids);
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); load(); }
  };
  const saveRate = async () => {
    if (!company || !editRate) return;
    const { error } = await supabase.from('member_pay_rates').upsert({ membership_id: editRate.id, company_id: company.id, hourly_cents: toCents(rateValue) });
    if (error) toast(tErr(error.message)); else { toast(t('c.saved')); setEditRate(null); load(); }
  };
  const exportPay = () => {
    const { from, to } = range(period);
    const out: (string | number)[][] = [['Name', 'Hours', 'Hourly rate', 'Pay', 'Tips', 'Reimbursements', 'Total']];
    for (const r of rows) out.push([r.m.display_name, r.hours.toFixed(2), (r.rate / 100).toFixed(2), (r.pay / 100).toFixed(2), (r.tips / 100).toFixed(2), (r.reimb / 100).toFixed(2), ((r.pay + r.tips + r.reimb) / 100).toFixed(2)]);
    download(`tidyo-team-pay-${isoDate(from)}-${isoDate(addDays(to, -1))}.csv`, out);
  };

  return (
    <div className="shell">
      <main className="page">
        <h1>{t('nav.finance')}</h1>
        <FinanceTabs />
        <PeriodPicker value={period} onChange={setPeriod} />
        {totalPending > 0 && (
          <div className="strip" style={{ background: 'var(--warn-bg)', borderColor: '#F3DDB8', color: 'var(--warn-fg)' }}>
            <span className="grow">{t('fin.hoursPending', { n: totalPending })}</span>
            <button className="btn btn-primary" style={{ minHeight: 40 }} onClick={() => setConfirmAll(true)}>{t('fin.approveAll')}</button>
          </div>
        )}
        {!entries ? <LoadingList /> : rows.length === 0 ? <div className="empty">{t('fin.noTeam')}</div> : (
          <div className="list">
            {rows.map((r) => (
              <div key={r.m.id} className="card stack" style={{ gap: 8 }}>
                <div className="row">
                  <span style={{ width: 38, height: 38, borderRadius: 38, background: 'var(--brand-dark)', color: '#5FD4C1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: 'none' }}>{r.m.display_name.slice(0, 1).toUpperCase()}</span>
                  <div className="grow"><div className="bold">{r.m.display_name}{r.open && <span className="badge b-warn" style={{ marginLeft: 6 }}>{t('fin.onShift')}</span>}</div>
                    <div className="small muted">{fmtHours(r.hours)} · {r.rate ? `${money(r.rate, lang)}/h` : t('fin.noRate')}</div></div>
                  <b className="num">{money(r.pay + r.tips + r.reimb, lang)}</b>
                </div>
                <div className="grid3 small">
                  <span><span className="muted">{t('fin.pay')}</span><br /><b className="num">{money(r.pay, lang)}</b></span>
                  <span><span className="muted">{t('fin.tips')}</span><br /><b className="num">{money(r.tips, lang)}</b></span>
                  <span><span className="muted">{t('fin.reimb')}</span><br /><b className="num">{money(r.reimb, lang)}</b></span>
                </div>
                <button className="btn btn-ghost" style={{ minHeight: 40, alignSelf: 'flex-start' }} onClick={() => { setEditRate(r.m); setRateValue(r.rate ? (r.rate / 100).toFixed(2) : ''); }}>{t('team.rate')}</button>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-secondary" onClick={exportPay}><Icon name="receipt" size={18} />{t('fin.exportPay')}</button>
        <p className="hint" style={{ margin: 0 }}>{t('fin.1099hint')}</p>
      </main>
      <OwnerNav />
      {editRate && (
        <Sheet title={`${t('team.rate')} · ${editRate.display_name}`} onClose={() => setEditRate(null)}>
          <Field label={t('team.rate')}><input className="input" inputMode="decimal" value={rateValue} onChange={(e) => setRateValue(e.target.value)} autoFocus /></Field>
          <button className="btn btn-primary" onClick={saveRate}>{t('c.save')}</button>
        </Sheet>
      )}
      {confirmAll && <Confirm text={t('fin.approveAllAsk', { n: totalPending })} confirmLabel={t('fin.approveAll')} onCancel={() => setConfirmAll(false)} onConfirm={() => { setConfirmAll(false); approveAll(); }} />}
    </div>
  );
}
