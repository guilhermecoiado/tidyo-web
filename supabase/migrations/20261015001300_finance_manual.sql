-- Tidyo · manual finance: income without an invoice, more expense categories, monthly recurring expenses,
-- the company's payment details printed on invoices

alter type public.expense_category add value if not exists 'insurance';
alter type public.expense_category add value if not exists 'software';
alter type public.expense_category add value if not exists 'payroll';
alter type public.expense_category add value if not exists 'rent';
alter type public.expense_category add value if not exists 'marketing';

alter table public.expenses add column if not exists recurring boolean not null default false;

-- money received outside an invoice (cash tip, one-off job paid on the spot)
alter table public.payments alter column invoice_id drop not null;
alter table public.payments add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.payments add column if not exists description text;

-- Zelle, Venmo, Cash App, check payable to… shown on the invoice PDF
alter table public.companies add column if not exists payment_info jsonb not null default '{}'::jsonb;

-- On the 1st of each month, repeat last month's recurring expenses
create or replace function public.copy_recurring_expenses() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.expenses (company_id, category, description, amount_cents, incurred_on, status, recurring)
  select e.company_id, e.category, e.description, e.amount_cents, date_trunc('month', current_date)::date, 'approved', true
    from public.expenses e
   where e.recurring and e.membership_id is null
     and e.incurred_on >= (date_trunc('month', current_date) - interval '1 month')::date
     and e.incurred_on < date_trunc('month', current_date)::date
     and not exists (select 1 from public.expenses x where x.company_id = e.company_id and x.recurring and x.category = e.category
                       and coalesce(x.description, '') = coalesce(e.description, '') and x.incurred_on >= date_trunc('month', current_date)::date);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.copy_recurring_expenses from anon, authenticated, public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tidyo-recurring-expenses', '5 6 1 * *', 'select public.copy_recurring_expenses()');
  end if;
end $$;
