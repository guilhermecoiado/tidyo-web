import { supabase } from './supabase';
import { hoursBetween, isoDate } from './format';

export type FinanceData = {
  received: number; billed: number; open: number; overdue: number; overdueCount: number; expenses: number; labour: number;
  byCat: Record<string, number>; payments: { amount_cents: number; received_at: string }[]; expenseRows: { amount_cents: number; incurred_on: string; category: string }[];
};

export async function loadFinance(companyId: string, from: Date, to: Date): Promise<FinanceData> {
  const [pay, inv, exp, te, rates] = await Promise.all([
    supabase.from('payments').select('amount_cents, received_at').eq('company_id', companyId).gte('received_at', from.toISOString()).lt('received_at', to.toISOString()),
    supabase.from('invoices').select('total_cents, paid_cents, status, due_on, issued_on').eq('company_id', companyId),
    supabase.from('expenses').select('amount_cents, category, status, incurred_on').eq('company_id', companyId).gte('incurred_on', isoDate(from)).lt('incurred_on', isoDate(to)),
    supabase.from('time_entries').select('membership_id, clock_in, clock_out').eq('company_id', companyId).gte('clock_in', from.toISOString()).lt('clock_in', to.toISOString()),
    supabase.from('member_pay_rates').select('membership_id, hourly_cents').eq('company_id', companyId),
  ]);
  const rate = new Map(((rates.data || []) as { membership_id: string; hourly_cents: number }[]).map((r) => [r.membership_id, r.hourly_cents]));
  const payments = (pay.data || []) as { amount_cents: number; received_at: string }[];
  const invoices = (inv.data || []) as { total_cents: number; paid_cents: number; status: string; due_on: string | null; issued_on: string | null }[];
  const expenseRows = ((exp.data || []) as { amount_cents: number; category: string; status: string; incurred_on: string }[]).filter((e) => e.status === 'approved' || e.status === 'reimbursed');
  const labour = ((te.data || []) as { membership_id: string; clock_in: string; clock_out: string | null }[]).reduce((s, e) => s + hoursBetween(e.clock_in, e.clock_out) * (rate.get(e.membership_id) || 0), 0);
  const today = isoDate(new Date());
  const byCat: Record<string, number> = {};
  for (const e of expenseRows) byCat[e.category] = (byCat[e.category] || 0) + e.amount_cents;
  const over = invoices.filter((i) => i.status === 'open' && i.due_on && i.due_on < today);
  return {
    received: payments.reduce((s, p) => s + p.amount_cents, 0),
    billed: invoices.filter((i) => i.issued_on && i.issued_on >= isoDate(from) && i.issued_on < isoDate(to)).reduce((s, i) => s + i.total_cents, 0),
    open: invoices.filter((i) => i.status === 'open').reduce((s, i) => s + i.total_cents - i.paid_cents, 0),
    overdue: over.reduce((s, i) => s + i.total_cents - i.paid_cents, 0), overdueCount: over.length,
    expenses: expenseRows.reduce((s, e) => s + e.amount_cents, 0),
    labour: Math.round(labour), byCat, payments, expenseRows,
  };
}

export const hasActivity = (d: FinanceData) => d.received + d.billed + d.open + d.expenses + d.labour > 0;
export const marginOf = (d: FinanceData) => (d.received > 0 ? (d.received - d.expenses - d.labour) / d.received : 0);

/** Financial health 0–100: margin (50%), share of open money that is not overdue (25%) and how much of what was billed came in (25%). null = no activity yet */
export function healthOf(d: FinanceData): number | null {
  if (!hasActivity(d)) return null;
  const m = Math.max(0, Math.min(1, marginOf(d) / 0.35));
  const od = d.open > 0 ? 1 - Math.min(1, d.overdue / d.open) : 1;
  const col = d.billed > 0 ? Math.min(1, d.received / d.billed) : (d.received > 0 ? 1 : 0.5);
  return Math.round((m * 0.5 + od * 0.25 + col * 0.25) * 100);
}

/** The health score needs about a month of history; before that it would mostly be noise */
export const healthReady = (createdAt?: string | null) => !createdAt || Date.now() - new Date(createdAt).getTime() >= 30 * 864e5;
