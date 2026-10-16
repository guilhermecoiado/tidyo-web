// Financeiro — canvas Financeiro + manual money module (income without invoice, recurring expenses, forecast, break-even, ledger)
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/session';
import { Sheet } from '../components/ui';
import { DateField, Select } from '../components/pickers';
import { C, OwnerBar, PILL, SheetActions, Svg, I, usd, useUnbilled } from '../components/kit';
import { getClients, type Client } from '../lib/data';
import { hoursBetween, isoDate } from '../lib/format';
import { compressImage } from '../lib/photos';

const EXP_CATS = ['supplies', 'gas', 'payroll', 'insurance', 'software', 'rent', 'marketing', 'equipment', 'mileage', 'parking', 'tolls', 'other'] as const;
const FIXED = new Set(['insurance', 'software', 'rent', 'marketing', 'payroll']);
const METHODS = ['zelle', 'venmo', 'cash', 'check', 'card', 'ach', 'other'] as const;
const toCents = (s: string) => Math.round(parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.')) * 100) || 0;

type Pay = { id: string; amount_cents: number; received_at: string; method: string; description: string | null; invoice_id: string | null; invoices: { number: string; clients: { name: string } | null } | null; clients: { name: string } | null };
type Exp = { id: string; amount_cents: number; category: string; status: string; incurred_on: string; description: string | null; recurring: boolean; membership_id: string | null; job_id: string | null };
type Inv = { total_cents: number; paid_cents: number; status: string; due_on: string | null; issued_on: string | null };
type JobRow = { id: string; status: string; price_cents: number; scheduled_start: string; contract_id: string | null; services: { name: string } | null; job_assignments: { membership_id: string }[] };
type Entry = { membership_id: string; job_id: string | null; clock_in: string; clock_out: string | null };

export type Month = { y: number; m: number };
const monthRange = ({ y, m }: Month) => ({ from: new Date(y, m, 1), to: new Date(y, m + 1, 1) });

async function loadMonth(companyId: string, mo: Month) {
  const { from, to } = monthRange(mo);
  const prev = monthRange({ y: mo.m ? mo.y : mo.y - 1, m: mo.m ? mo.m - 1 : 11 });
  const sixWeeks = new Date(Math.min(to.getTime(), Date.now() + 864e5) - 42 * 864e5);
  const [pay, inv, exp, te, rates, jobs, prevInv, prevPay, recent] = await Promise.all([
    supabase.from('payments').select('id, amount_cents, received_at, method, description, invoice_id, invoices(number, clients(name)), clients(name)').eq('company_id', companyId).gte('received_at', sixWeeks < from ? sixWeeks.toISOString() : from.toISOString()).lt('received_at', to.toISOString()).order('received_at', { ascending: false }),
    supabase.from('invoices').select('total_cents, paid_cents, status, due_on, issued_on').eq('company_id', companyId).neq('status', 'void'),
    supabase.from('expenses').select('id, amount_cents, category, status, incurred_on, description, recurring, membership_id, job_id').eq('company_id', companyId).gte('incurred_on', isoDate(sixWeeks < from ? sixWeeks : from)).lt('incurred_on', isoDate(to)).order('incurred_on', { ascending: false }),
    supabase.from('time_entries').select('membership_id, job_id, clock_in, clock_out').eq('company_id', companyId).gte('clock_in', (sixWeeks < from ? sixWeeks : from).toISOString()).lt('clock_in', to.toISOString()),
    supabase.from('member_pay_rates').select('membership_id, hourly_cents, per_job_cents').eq('company_id', companyId),
    supabase.from('jobs').select('id, status, price_cents, scheduled_start, contract_id, services(name), job_assignments(membership_id)').eq('company_id', companyId).gte('scheduled_start', from.toISOString()).lt('scheduled_start', to.toISOString()),
    supabase.from('invoices').select('total_cents, issued_on').eq('company_id', companyId).neq('status', 'void').gte('issued_on', isoDate(prev.from)).lt('issued_on', isoDate(prev.to)),
    supabase.from('payments').select('amount_cents, received_at, invoice_id').eq('company_id', companyId).is('invoice_id', null).gte('received_at', prev.from.toISOString()).lt('received_at', prev.to.toISOString()),
    supabase.from('jobs').select('id, price_cents').eq('company_id', companyId).eq('status', 'completed').gte('scheduled_start', new Date(Date.now() - 90 * 864e5).toISOString()),
  ]);
  const rate = new Map(((rates.data || []) as { membership_id: string; hourly_cents: number; per_job_cents: number | null }[]).map((r) => [r.membership_id, r]));
  const inMonth = (iso: string) => iso >= from.toISOString().slice(0, 10) && iso < to.toISOString().slice(0, 10);
  const payments = (pay.data || []) as unknown as Pay[];
  const expenses = ((exp.data || []) as Exp[]).filter((e) => e.status === 'approved' || e.status === 'reimbursed');
  const entries = (te.data || []) as Entry[];
  const jobList = (jobs.data || []) as unknown as JobRow[];
  const labourOf = (e: Entry) => hoursBetween(e.clock_in, e.clock_out) * (rate.get(e.membership_id)?.hourly_cents || 0);
  const perJob = jobList.filter((j) => j.status === 'completed').reduce((s, j) => s + j.job_assignments.reduce((x, a) => x + (rate.get(a.membership_id)?.per_job_cents || 0), 0), 0);
  const monthEntries = entries.filter((e) => inMonth(e.clock_in.slice(0, 10)));
  const labour = Math.round(monthEntries.reduce((s, e) => s + labourOf(e), 0) + perJob);
  const monthExp = expenses.filter((e) => inMonth(e.incurred_on));
  const manualIncome = payments.filter((p) => !p.invoice_id && inMonth(p.received_at.slice(0, 10))).reduce((s, p) => s + p.amount_cents, 0);
  const invoices = (inv.data || []) as Inv[];
  const today = isoDate(new Date());
  const billed = invoices.filter((i) => i.issued_on && inMonth(i.issued_on)).reduce((s, i) => s + i.total_cents, 0) + manualIncome;
  // same point of last month, for the comparison note
  const dayN = Math.min(new Date().getDate(), new Date(mo.y, mo.m + 1, 0).getDate());
  const cut = isoDate(new Date(prev.from.getFullYear(), prev.from.getMonth(), dayN + 1));
  const prevBilled = ((prevInv.data || []) as { total_cents: number; issued_on: string }[]).filter((i) => i.issued_on < cut).reduce((s, i) => s + i.total_cents, 0)
    + ((prevPay.data || []) as { amount_cents: number; received_at: string }[]).filter((p) => p.received_at.slice(0, 10) < cut).reduce((s, p) => s + p.amount_cents, 0);
  const received = payments.filter((p) => inMonth(p.received_at.slice(0, 10))).reduce((s, p) => s + p.amount_cents, 0);
  const expTotal = monthExp.reduce((s, e) => s + e.amount_cents, 0);
  const open = invoices.filter((i) => i.status === 'open');
  const overdue = open.filter((i) => i.due_on && i.due_on < today);
  const byCat: Record<string, number> = { payroll: 0 };
  for (const e of monthExp) byCat[e.category] = (byCat[e.category] || 0) + e.amount_cents;
  byCat.payroll += labour;
  // weekly bars, last 6 weeks
  const end = new Date(Math.min(to.getTime(), Date.now() + 864e5));
  const weeks = Array.from({ length: 6 }, (_, i) => { const s = new Date(end.getTime() - (6 - i) * 7 * 864e5); return { s, e: new Date(s.getTime() + 7 * 864e5), in: 0, out: 0 }; });
  for (const p of payments) { const t = new Date(p.received_at).getTime(); const w = weeks.find((x) => t >= x.s.getTime() && t < x.e.getTime()); if (w) w.in += p.amount_cents; }
  for (const e of expenses) { const t = new Date(e.incurred_on + 'T12:00').getTime(); const w = weeks.find((x) => t >= x.s.getTime() && t < x.e.getTime()); if (w) w.out += e.amount_cents; }
  for (const e of entries) { const t = new Date(e.clock_in).getTime(); const w = weeks.find((x) => t >= x.s.getTime() && t < x.e.getTime()); if (w) w.out += labourOf(e); }
  // margin per kind of service (direct costs: team time on that job and expenses tied to it)
  const svc = new Map<string, { visits: number; revenue: number; cost: number; contract: boolean }>();
  for (const j of jobList.filter((x) => x.status === 'completed')) {
    const key = j.contract_id ? '__contract' : j.services?.name || '—';
    const g = svc.get(key) || { visits: 0, revenue: 0, cost: 0, contract: !!j.contract_id };
    g.visits++; g.revenue += j.price_cents;
    g.cost += entries.filter((e) => e.job_id === j.id).reduce((s, e) => s + labourOf(e), 0) + expenses.filter((e) => e.job_id === j.id).reduce((s, e) => s + e.amount_cents, 0);
    svc.set(key, g);
  }
  // forecast: what is still booked this month
  const booked = jobList.filter((j) => j.status === 'scheduled' && new Date(j.scheduled_start) > new Date());
  // break-even: fixed costs ÷ average contribution of a cleaning
  const fixed = monthExp.filter((e) => e.recurring || FIXED.has(e.category)).reduce((s, e) => s + e.amount_cents, 0);
  const done = jobList.filter((j) => j.status === 'completed');
  const avgPrice = ((recent.data || []) as { price_cents: number }[]).reduce((s, j, _, a) => s + j.price_cents / a.length, 0);
  const variableShare = billed > 0 ? Math.min(0.95, (labour + (expTotal - fixed)) / billed) : 0.55;
  const contrib = avgPrice * (1 - variableShare);
  return {
    billed, prevBilled, received, labour, expTotal, costs: labour + expTotal, open: open.reduce((s, i) => s + i.total_cents - i.paid_cents, 0),
    overdue: overdue.reduce((s, i) => s + i.total_cents - i.paid_cents, 0), overdueN: overdue.length, byCat, weeks, svc, payments, monthExp,
    forecast: booked.reduce((s, j) => s + j.price_cents, 0), bookedN: booked.length, fixed, doneN: done.length,
    breakEven: fixed > 0 && contrib > 0 ? Math.ceil(fixed / contrib) : null,
  };
}
type Data = Awaited<ReturnType<typeof loadMonth>>;

export function healthScore(d: Data): number | null {
  if (d.billed + d.received + d.costs + d.open === 0) return null;
  const margin = d.billed > 0 ? (d.billed - d.costs) / d.billed : 0;
  const m = Math.max(0, Math.min(1, margin / 0.35));
  const od = d.open > 0 ? 1 - Math.min(1, d.overdue / d.open) : 1;
  const col = d.billed > 0 ? Math.min(1, d.received / d.billed) : d.received > 0 ? 1 : 0.5;
  return Math.round((m * 0.5 + od * 0.25 + col * 0.25) * 100);
}

export default function Finance() {
  const { t, lang, company } = useApp();
  const now = new Date();
  const [mo, setMo] = useState<Month>({ y: now.getFullYear(), m: now.getMonth() });
  const [d, setD] = useState<Data | null>(null);
  const [pendingExp, setPendingExp] = useState(0);
  const unbilled = useUnbilled();
  const [sheet, setSheet] = useState<'' | 'exp' | 'inc' | 'rep' | 'month'>('');
  const [undo, setUndo] = useState<{ table: 'expenses' | 'payments'; id: string; label: string } | null>(null);
  const load = useCallback(async () => {
    if (!company) return;
    setD(await loadMonth(company.id, mo));
    const { count } = await supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'pending');
    setPendingExp(count || 0);
  }, [company, mo]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!undo) return; const i = window.setTimeout(() => setUndo(null), 4000); return () => window.clearTimeout(i); }, [undo]);

  const isCurrent = mo.y === now.getFullYear() && mo.m === now.getMonth();
  const monthName = new Date(mo.y, mo.m, 1).toLocaleDateString(lang, mo.y === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' });
  const health = d ? healthScore(d) : null;
  const profit = d ? d.billed - d.costs : 0;
  const margin = d && d.billed > 0 ? profit / d.billed : null;
  const delta = d && d.prevBilled > 0 ? Math.round(((d.billed - d.prevBilled) / d.prevBilled) * 100) : null;
  const prevMonthShort = new Date(mo.y, mo.m - 1, 1).toLocaleDateString(lang, { month: 'short' }).replace('.', '');
  const maxW = d ? Math.max(1, ...d.weeks.map((w) => Math.max(w.in, w.out))) : 1;
  const scale = (() => { const k = maxW / 100; const step = k > 5000 ? 5000 : k > 1000 ? 1000 : k > 500 ? 500 : 100; return Math.ceil(k / step) * step * 100 || 100; })();
  const cats = d ? Object.entries(d.byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const ledger = d ? [...d.payments.filter((p) => p.received_at.slice(0, 7) === `${mo.y}-${String(mo.m + 1).padStart(2, '0')}`).map((p) => ({ id: p.id, when: p.received_at, label: p.invoice_id ? `${p.invoices?.clients?.name || ''} · ${p.invoices?.number || ''}` : p.description || p.clients?.name || t('fin.income'), sub: t(`pay.${p.method}`), v: p.amount_cents })),
    ...d.monthExp.map((e) => ({ id: e.id, when: e.incurred_on + 'T12:00', label: e.description || t(`expc.${e.category}`), sub: `${t(`expc.${e.category}`)}${e.recurring ? ` · ${t('fin.monthly')}` : ''}`, v: -e.amount_cents }))]
    .sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8) : [];
  const healthTitle = health == null ? t('fin.hNone') : health >= 70 ? t('fin.hGood') : health >= 45 ? t('fin.hOk') : t('fin.hBad');
  const healthText = !d ? '' : d.breakEven != null
    ? (d.doneN >= d.breakEven ? t('fin.beDone', { n: d.breakEven, k: d.doneN }) : t('fin.beLeft', { n: d.breakEven, k: d.doneN }))
    : t('fin.beSetup');

  return (
    <div className="k-screen">
      <main className="k-page" style={{ gap: 14 }}>
        <div className="k-head">
          <div className="k-head-t">
            <span className="k-title" style={{ fontSize: 22 }}>{t('fin.title')}</span>
            <button className="k-sub" onClick={() => setSheet('month')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, padding: 0, minHeight: 24, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <Svg d={I.cal} size={14} color={C.accent} />{monthName.charAt(0).toUpperCase() + monthName.slice(1)}{isCurrent ? ` · ${t('fin.untilDay', { n: now.getDate() })}` : ''}
            </button>
          </div>
          <Link to={unbilled ? '/app/cobrancas?tab=cobrar' : '/app/cobrancas'} className="k-btn k-btn-line" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px', position: 'relative' }}>{t('fin.invoices')}{unbilled > 0 && <span className="k-badge sm" style={{ top: -7, right: -7 }}>{unbilled}</span>}</Link>
          <button className="k-btn k-btn-line" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }} onClick={() => setSheet('rep')}>{t('fin.reports')}</button>
        </div>

        {unbilled > 0 && (
          <Link to="/app/cobrancas?tab=cobrar" className="k-note ok" style={{ textDecoration: 'none' }}>
            <span>{t('tidy.uninvoicedText', { n: unbilled })}</span>
            <span className="k-btn k-btn-sm k-btn-fill" style={{ minHeight: 40 }}>{t('job.chargeNow')}</span>
          </Link>
        )}
        {pendingExp > 0 && (
          <Link to="/app/financas/despesas" className="k-note" style={{ textDecoration: 'none' }}>
            <span>{t('tidy.reviewText', { n: pendingExp })}</span>
            <span className="k-btn k-btn-sm" style={{ background: '#FFFFFF', border: '1px solid #E5C875', color: '#6B4A04', minHeight: 40 }}>{t('tidy.open')}</span>
          </Link>
        )}

        {!d ? <div className="k-kpis two">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 92, borderRadius: 16 }} />)}</div> : <>
          <div className="k-kpis two">
            {[
              [t('fin.kBilled'), usd(d.billed), C.ink, delta == null ? t('fin.kBilledN0') : t('fin.kBilledN', { p: `${delta >= 0 ? '+' : ''}${delta}`, m: prevMonthShort })],
              [t('fin.kCosts'), usd(d.costs), '#8A4B05', d.billed > 0 ? t('fin.kCostsN', { p: Math.round((d.costs / d.billed) * 100) }) : t('fin.kCostsN0')],
              [t('fin.profit'), usd(profit), profit < 0 ? '#B8400C' : '#0B6B5F', margin == null ? '–' : t('fin.kProfitN', { p: Math.round(margin * 100) })],
              [t('home.receivable'), usd(d.open), d.overdue > 0 ? '#B8400C' : C.ink, d.overdueN ? t('fin.kOpenN', { n: d.overdueN, v: usd(d.overdue) }) : t('fin.kOpenN0')],
            ].map(([l, v, c, n]) => (
              <div key={l} className="k-kpi" style={{ padding: '12px 14px', gap: 3 }}><span className="k-kpi-l" style={{ fontWeight: 800 }}>{l}</span><span className="k-kpi-v" style={{ color: c }}>{v}</span><span className="k-kpi-n">{n}</span></div>
            ))}
          </div>

          <div className="k-dark" style={{ borderRadius: 18, padding: '14px 16px', flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${t('fin.health')} ${health ?? '–'}`} style={{ flex: 'none' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="#23383A" strokeWidth="7" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={health == null ? '#23383A' : health >= 70 ? C.mint : health >= 45 ? '#F5C66B' : '#FFB59C'} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${((health || 0) / 100) * 163.4} 163.4`} transform="rotate(-90 32 32)" className="ring-anim" />
              <text x="32" y="38" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontSize="18" fontWeight="700" fill="#FFFFFF">{health ?? '–'}</text>
            </svg>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: '#FFFFFF' }}>{healthTitle}</span>
              <span style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.45 }}>{healthText}</span>
            </span>
          </div>

          {isCurrent && (
            <div className="k-card" style={{ padding: 14, gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('fin.forecast')}</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {[[t('fin.fBilled'), d.billed, C.ink], [t('fin.fBooked'), d.forecast, C.accent], [t('fin.fTotal'), d.billed + d.forecast, C.ink]].map(([k, v, c]) => (
                  <span key={k as string} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{k}</span><span className="num nw" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700, color: c as string }}>{usd(v as number)}</span></span>
                ))}
              </div>
              <span className="k-s12 k-muted">{t('fin.forecastN', { n: d.bookedN })}</span>
            </div>
          )}

          <div className="k-card" style={{ padding: 14, gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>{t('fin.weekly')}</span>
              <span className="k-s115" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: C.muted }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.accent }} />{t('fin.in')}</span>
              <span className="k-s115" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: C.muted }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#E0A341' }} />{t('fin.out')}</span>
            </div>
            <svg width="100%" viewBox="0 0 326 170" role="img" aria-label={t('fin.weekly')}>
              {[0, 0.5, 1].map((f) => { const y = 150 - f * 142; return <g key={f}><line x1="38" x2="326" y1={y} y2={y} stroke={C.soft} /><text x="32" y={y + 3.5} textAnchor="end" fontSize="10" fontWeight="700" fill="#7A8C88">{f === 0 ? '$0' : `$${(scale * f / 100000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`}</text></g>; })}
              {d.weeks.map((w, i) => {
                const x = 46 + i * 47, h1 = (w.in / scale) * 142, h2 = (w.out / scale) * 142;
                return <g key={i}>
                  <rect x={x} y={150 - h1} width="18" height={Math.max(h1, 1)} rx="4" fill={C.accent}><title>{usd(w.in)}</title></rect>
                  <rect x={x + 20} y={150 - h2} width="18" height={Math.max(h2, 1)} rx="4" fill="#E0A341"><title>{usd(w.out)}</title></rect>
                  <text x={x + 19} y="166" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7A8C88">{w.s.toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '').replace(' de', '')}</text>
                </g>;
              })}
            </svg>
          </div>

          <div className="k-card" style={{ padding: 14, gap: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 6 }}>{t('fin.bySvc')}</span>
            {d.svc.size === 0 ? <span className="k-s125 k-muted">{t('fin.noData')}</span> : [...d.svc.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([name, g], i) => {
              const m = g.revenue > 0 ? Math.round(((g.revenue - g.cost) / g.revenue) * 100) : 0;
              const c = m < 28 ? '#B8400C' : C.accent;
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span className="k-ell" style={{ fontWeight: 700, fontSize: 13.5 }}>{name === '__contract' ? t('fin.contracts') : name}</span><span style={{ fontSize: 11.5, color: C.muted }}>{t('fin.visits', { n: g.visits })} · {usd(g.revenue)}</span></span>
                  <span style={{ width: 70, height: 6, borderRadius: 6, background: C.track, overflow: 'hidden' }}><span style={{ display: 'block', height: 6, width: `${Math.max(0, m)}%`, background: c }} /></span>
                  <span className="num" style={{ width: 38, textAlign: 'right', fontWeight: 800, fontSize: 13, color: c }}>{m}%</span>
                </div>
              );
            })}
            <span style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{t('fin.bySvcN')}</span>
          </div>

          <div className="k-card" style={{ padding: 14, gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>{t('fin.monthExp')}</span>
              <button className="k-btn k-btn-fill" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }} onClick={() => setSheet('exp')}>+ {t('fin.addExp')}</button>
            </div>
            {cats.length === 0 ? <span className="k-s125 k-muted">{t('fin.noExpenses')}</span> : cats.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <span className="k-ell" style={{ fontWeight: 700, fontSize: 13.5, width: 128, flex: 'none' }}>{t(`expc.${k}`)}</span>
                <span style={{ flex: 1, height: 6, borderRadius: 6, background: C.track, overflow: 'hidden' }}><span style={{ display: 'block', height: 6, width: `${Math.round((v / cats[0][1]) * 100)}%`, background: '#5B7F79' }} /></span>
                <span className="num" style={{ width: 72, textAlign: 'right', fontWeight: 800, fontSize: 13 }}>{usd(v)}</span>
              </div>
            ))}
          </div>

          <div className="k-card" style={{ padding: 14, gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 14.5, flex: 1 }}>{t('fin.ledger')}</span>
              <button className="k-btn k-btn-line" style={{ minHeight: 40, borderRadius: 12, fontSize: 12.5, padding: '0 12px' }} onClick={() => setSheet('inc')}>+ {t('fin.addInc')}</button>
            </div>
            {ledger.length === 0 ? <span className="k-s125 k-muted">{t('fin.noMoves')}</span> : ledger.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, borderTop: i ? `1px solid ${C.soft}` : 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, flex: 'none', background: r.v > 0 ? PILL.ok[0] : PILL.warn[0], color: r.v > 0 ? PILL.ok[1] : PILL.warn[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{r.v > 0 ? '+' : '−'}</span>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span className="k-ell" style={{ fontWeight: 700, fontSize: 13.5 }}>{r.label}</span><span className="k-s115 k-muted">{new Date(r.when).toLocaleDateString(lang, { day: 'numeric', month: 'short' }).replace('.', '')} · {r.sub}</span></span>
                <span className="num nw" style={{ fontWeight: 800, fontSize: 13.5, color: r.v > 0 ? '#0B6B5F' : C.ink }}>{r.v > 0 ? '+' : '−'}{usd(Math.abs(r.v), true)}</span>
              </div>
            ))}
          </div>
        </>}
      </main>
      <OwnerBar />
      {sheet === 'exp' && <ExpenseSheet onClose={() => setSheet('')} onSaved={(id, label) => { setSheet(''); setUndo({ table: 'expenses', id, label }); load(); }} />}
      {sheet === 'inc' && <IncomeSheet onClose={() => setSheet('')} onSaved={(id, label) => { setSheet(''); setUndo({ table: 'payments', id, label }); load(); }} />}
      {sheet === 'rep' && <ReportsSheet month={mo} onClose={() => setSheet('')} />}
      {sheet === 'month' && (
        <Sheet title={t('fin.pickMonth')} onClose={() => setSheet('')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1)).map((x) => (
              <button key={x.toISOString()} className="k-chip" style={{ minHeight: 44, borderRadius: 12, justifyContent: 'center' }} aria-pressed={x.getFullYear() === mo.y && x.getMonth() === mo.m} onClick={() => { setMo({ y: x.getFullYear(), m: x.getMonth() }); setSheet(''); }}>
                {x.toLocaleDateString(lang, { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', ' ')}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {undo && (
        <div className="toast" role="status" style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}>
          <span>{undo.label}</span>
          <button className="link-btn" style={{ color: C.mint }} onClick={async () => { await supabase.from(undo.table).delete().eq('id', undo.id); setUndo(null); load(); }}>{t('fin.undo')}</button>
        </div>
      )}
    </div>
  );
}

function ExpenseSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string, label: string) => void }) {
  const { t, tErr, company, toast } = useApp();
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>('supplies');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [monthly, setMonthly] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!company || toCents(amount) <= 0) return;
    setBusy(true);
    let receipt: string | null = null;
    if (file) {
      const path = `${company.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('receipts').upload(path, await compressImage(file), { contentType: 'image/jpeg' });
      if (!error) receipt = path;
    }
    const { data, error } = await supabase.from('expenses').insert({ company_id: company.id, category: cat, amount_cents: toCents(amount), description: desc || null, incurred_on: date, receipt_path: receipt, status: 'approved', recurring: monthly }).select('id').single();
    setBusy(false);
    if (error) toast(tErr(error.message)); else onSaved(data.id, t('fin.expSaved', { cat: t(`expc.${cat}`) }));
  };
  return (
    <Sheet title={t('fin.addExp')} onClose={onClose}>
      <MoneyInput value={amount} onChange={setAmount} label={t('fin.valueUsd')} />
      <div className="k-field"><span>{t('fin.category')}</span>
        <div className="k-optgrid" role="group" aria-label={t('fin.category')}>{EXP_CATS.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>{t(`expc.${c}`)}</button>)}</div>
      </div>
      <label className="k-field"><span>{t('exp.desc')} <em className="k-opt">{t('c.optional')}</em></span><input className="k-input" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="k-field"><span>{t('job.date')}</span><DateField label={t('job.date')} value={date} onChange={setDate} /></label>
      <div className="k-optrows">
        <label className="k-optrow">
          <span className="k-optrow-t"><b>{t('fin.receiptPhoto')}</b><small>{file ? file.name : t('c.optional')}</small></span>
          <span className="k-btn k-btn-sm k-btn-line" style={{ color: C.accent }}>{file ? t('fin.change') : t('fin.addPhoto')}</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <div className="k-optrow">
          <span className="k-optrow-t" id="exp-monthly"><b>{t('fin.everyMonth')}</b><small>{t('fin.everyMonthSub')}</small></span>
          <button type="button" role="switch" aria-checked={monthly} aria-labelledby="exp-monthly" className="switch" onClick={() => setMonthly(!monthly)}><span /></button>
        </div>
      </div>
      <SheetActions cancel={t('c.cancel')} onCancel={onClose} confirm={t('c.save')} onConfirm={save} disabled={busy || toCents(amount) <= 0} />
    </Sheet>
  );
}

function MoneyInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="k-field"><span>{label}</span>
      <span className="k-money"><i>$</i><input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0.00" autoFocus /></span>
    </label>
  );
}

function IncomeSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string, label: string) => void }) {
  const { t, tErr, company, toast } = useApp();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('zelle');
  const [desc, setDesc] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [date, setDate] = useState(isoDate(new Date()));
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (company) getClients(company.id).then(setClients); }, [company]);
  const save = async () => {
    if (!company || toCents(amount) <= 0) return;
    setBusy(true);
    const { data, error } = await supabase.from('payments').insert({ company_id: company.id, invoice_id: null, client_id: clientId || null, method, amount_cents: toCents(amount), description: desc || null, received_at: new Date(`${date}T12:00`).toISOString() }).select('id').single();
    setBusy(false);
    if (error) toast(tErr(error.message)); else onSaved(data.id, t('fin.incSaved'));
  };
  return (
    <Sheet title={t('fin.addInc')} onClose={onClose}>
      <span className="k-help" style={{ marginTop: -4 }}>{t('fin.incHelp')}</span>
      <MoneyInput value={amount} onChange={setAmount} label={t('fin.valueUsd')} />
      <div className="k-field"><span>{t('fin.method')}</span>
        <div className="k-optgrid sm" role="group" aria-label={t('fin.method')}>{METHODS.map((m) => <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>{t(`pay.${m}`)}</button>)}</div>
      </div>
      <label className="k-field"><span>{t('job.client')} <em className="k-opt">{t('c.optional')}</em></span>
        <Select value={clientId} onChange={setClientId} label={t('job.client')}><option value="">{t('fin.noClient')}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      </label>
      <label className="k-field"><span>{t('exp.desc')} <em className="k-opt">{t('c.optional')}</em></span><input className="k-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('fin.incPh')} /></label>
      <label className="k-field"><span>{t('job.date')}</span><DateField label={t('job.date')} value={date} onChange={setDate} /></label>
      <SheetActions cancel={t('c.cancel')} onCancel={onClose} confirm={t('c.save')} onConfirm={save} disabled={busy || toCents(amount) <= 0} />
    </Sheet>
  );
}

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function ReportsSheet({ month, onClose }: { month: Month; onClose: () => void }) {
  const { t, company } = useApp();
  const { from, to } = monthRange(month);
  const exportCsv = async () => {
    if (!company) return;
    const [pay, exp] = await Promise.all([
      supabase.from('payments').select('received_at, amount_cents, method, reference, description, invoices(number, clients(name)), clients(name)').eq('company_id', company.id).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
      supabase.from('expenses').select('incurred_on, amount_cents, category, description, status').eq('company_id', company.id).gte('incurred_on', isoDate(from)).lt('incurred_on', isoDate(to)),
    ]);
    const rows: (string | number)[][] = [['Date', 'Type', 'Name', 'Category', 'Memo', 'Amount']];
    for (const p of (pay.data || []) as any[]) rows.push([p.received_at.slice(0, 10), 'Income', p.invoices?.clients?.name || p.clients?.name || '', 'Cleaning services', `${p.invoices?.number || p.description || ''} ${p.method} ${p.reference || ''}`.trim(), (p.amount_cents / 100).toFixed(2)]);
    for (const e of (exp.data || []) as any[]) if (e.status === 'approved' || e.status === 'reimbursed') rows.push([e.incurred_on, 'Expense', '', e.category, e.description || '', (-e.amount_cents / 100).toFixed(2)]);
    download(`tidyo-${isoDate(from).slice(0, 7)}.csv`, rows);
  };
  const items: [string, string, () => void, string?][] = [
    [t('fin.export'), 'CSV · QuickBooks, Xero, Excel', exportCsv],
    [t('fin.print'), t('fin.printSub'), () => { onClose(); setTimeout(() => window.print(), 300); }],
    [t('fin.teamPay'), t('fin.teamPaySub'), () => undefined, '/app/financas/equipe'],
    [t('fin.teamExp'), t('fin.teamExpSub'), () => undefined, '/app/financas/despesas'],
  ];
  return (
    <Sheet title={t('fin.reports')} onClose={onClose}>
      <div className="k-list">
        {items.map(([label, sub, act, to]) => {
          const inner = <><span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span><span style={{ fontSize: 12, color: C.muted }}>{sub}</span></span><Svg d={I.chev} size={16} color="#9AA9A6" /></>;
          return to ? <Link key={label} to={to} className="k-row tall">{inner}</Link> : <button key={label} className="k-row tall" onClick={act}>{inner}</button>;
        })}
      </div>
    </Sheet>
  );
}

