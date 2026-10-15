import { supabase } from './supabase';

export type Member = { id: string; display_name: string; role: 'owner' | 'manager' | 'helper'; status: string; language: string; user_id: string | null };
export type Property = { id: string; client_id: string; label: string; address_line1: string; city: string; state: string; zip: string; lat: number | null; lng: number | null; access_instructions: string | null; pets: string | null; special_instructions: string | null };
export type Client = { id: string; kind: 'residential' | 'commercial'; name: string; portal_user_id: string | null; email: string | null; phone: string | null; language: string; no_translate: boolean; notes: string | null; properties: Property[] };
export type Job = {
  id: string; client_id: string; property_id: string; status: string; scheduled_start: string; scheduled_end: string;
  price_cents: number; client_notes: string | null; internal_notes: string | null; completion_note: string | null; recurrence_id: string | null;
  rating_status: string; rating: number | null; rating_comment: string | null;
  contract_id: string | null; start_distance_m: number | null; start_inside_geofence: boolean | null;
  clients: { name: string } | null; properties: { address_line1: string; city: string } | null; job_assignments: { membership_id: string }[];
};
export type Invoice = {
  id: string; number: string; status: string; issued_on: string | null; due_on: string | null; total_cents: number; paid_cents: number;
  client_id: string; clients: { name: string } | null;
};

const JOB_SELECT = 'id, client_id, property_id, status, scheduled_start, scheduled_end, price_cents, client_notes, internal_notes, completion_note, recurrence_id, rating_status, rating, rating_comment, contract_id, start_distance_m, start_inside_geofence, clients(name), properties(address_line1, city), job_assignments(membership_id)';

export async function getJobs(companyId: string, from: Date, to: Date) {
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT)
    .eq('company_id', companyId).gte('scheduled_start', from.toISOString()).lt('scheduled_start', to.toISOString())
    .order('scheduled_start');
  if (error) throw error;
  return (data || []) as unknown as Job[];
}

export async function getClientJobs(clientId: string) {
  const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('client_id', clientId).order('scheduled_start', { ascending: false }).limit(30);
  return (data || []) as unknown as Job[];
}

export async function getMembers(companyId: string) {
  const { data } = await supabase.from('memberships').select('id, display_name, role, status, language, user_id')
    .eq('company_id', companyId).in('status', ['active', 'invited']).order('display_name');
  return (data || []) as Member[];
}

export async function getClients(companyId: string) {
  const { data, error } = await supabase.from('clients')
    .select('id, kind, name, email, phone, language, no_translate, notes, portal_user_id, properties(id, client_id, label, address_line1, city, state, zip, lat, lng, access_instructions, pets, special_instructions)')
    .eq('company_id', companyId).is('archived_at', null).order('name');
  if (error) throw error;
  return (data || []) as unknown as Client[];
}

export async function getInvoices(companyId: string) {
  const { data, error } = await supabase.from('invoices')
    .select('id, number, status, issued_on, due_on, total_cents, paid_cents, client_id, clients(name)')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []) as unknown as Invoice[];
}

export async function getInvoicedJobIds(companyId: string) {
  const { data } = await supabase.from('invoice_lines').select('job_id').eq('company_id', companyId).not('job_id', 'is', null);
  return new Set((data || []).map((r: { job_id: string }) => r.job_id));
}

export function isOverdue(inv: Invoice) {
  return inv.status === 'open' && !!inv.due_on && inv.due_on < new Date().toISOString().slice(0, 10);
}

export async function createInvoice(companyId: string, clientId: string, lines: { description: string; unit_cents: number; job_id?: string | null }[], dueOn: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: inv, error } = await supabase.from('invoices')
    .insert({ company_id: companyId, client_id: clientId, status: 'open', issued_on: today, due_on: dueOn, number: '' })
    .select('id').single();
  if (error) throw error;
  const { error: e2 } = await supabase.from('invoice_lines').insert(lines.map((l) => ({ ...l, invoice_id: inv.id, company_id: companyId })));
  if (e2) throw e2;
  return inv.id as string;
}

// Jobs that overlap for the same person
export function findConflicts(jobs: Job[]) {
  const out: { memberId: string; a: Job; b: Job }[] = [];
  const active = jobs.filter((j) => j.status !== 'canceled');
  for (let i = 0; i < active.length; i++) {
    for (let k = i + 1; k < active.length; k++) {
      const a = active[i], b = active[k];
      if (new Date(a.scheduled_start) < new Date(b.scheduled_end) && new Date(b.scheduled_start) < new Date(a.scheduled_end)) {
        for (const ma of a.job_assignments) if (b.job_assignments.some((mb) => mb.membership_id === ma.membership_id)) out.push({ memberId: ma.membership_id, a, b });
      }
    }
  }
  return out;
}
