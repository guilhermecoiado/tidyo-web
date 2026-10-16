-- Manual finance: charge completed jobs, payments close invoices, income without invoice, recurring expenses, team cannot see money
\set QUIET on
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'own@f.test', '{"full_name":"Gui"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'hel@f.test', '{"full_name":"Bia"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.create_company('Fin Clean', 'residential', 'pt-BR') as co \gset
select public.create_team_link(:'co', 'helper') as tok \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select public.request_join(:'tok', 'Bia', 'es') as mid \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select public.decide_join(:'mid', true);

insert into public.clients (company_id, name, language) values (:'co', 'Cohen', 'en') returning id as cl \gset
insert into public.properties (company_id, client_id, address_line1, city, state, zip) values (:'co', :'cl', '12 Elm', 'Waterbury', 'CT', '06702') returning id as pr \gset
insert into public.jobs (company_id, client_id, property_id, status, scheduled_start, scheduled_end, price_cents)
  values (:'co', :'cl', :'pr', 'completed', now() - interval '1 day', now() - interval '22 hours', 18000) returning id as j1 \gset
insert into public.jobs (company_id, client_id, property_id, status, scheduled_start, scheduled_end, price_cents)
  values (:'co', :'cl', :'pr', 'completed', now() - interval '2 day', now() - interval '46 hours', 16000) returning id as j2 \gset

-- charge one job
insert into public.invoices (company_id, client_id, status, issued_on, due_on, number) values (:'co', :'cl', 'open', current_date, current_date + 7, '') returning id as inv \gset
insert into public.invoice_lines (invoice_id, company_id, job_id, description, unit_cents) values (:'inv', :'co', :'j1', 'Standard · Oct 15', 15500), (:'inv', :'co', null, 'Extra: oven', 2500);
select pg_temp.check((select total_cents from public.invoices where id = :'inv') = 18000, 'invoice total = lines');
select pg_temp.check((select number from public.invoices where id = :'inv') <> '', 'invoice gets a number');
select pg_temp.check((select count(*) from public.jobs j where j.company_id = :'co' and j.status = 'completed' and j.price_cents > 0
  and not exists (select 1 from public.invoice_lines l join public.invoices i on i.id = l.invoice_id where l.job_id = j.id and i.status <> 'void')) = 1, 'one job still to bill');

-- partial then full payment
insert into public.payments (company_id, invoice_id, client_id, method, amount_cents) values (:'co', :'inv', :'cl', 'zelle', 8000) returning id as p1 \gset
select pg_temp.check((select status from public.invoices where id = :'inv') = 'open' and (select paid_cents from public.invoices where id = :'inv') = 8000, 'partial payment keeps it open');
insert into public.payments (company_id, invoice_id, client_id, method, amount_cents) values (:'co', :'inv', :'cl', 'cash', 10000);
select pg_temp.check((select status from public.invoices where id = :'inv') = 'paid', 'full payment marks paid');
delete from public.payments where id = :'p1';
select pg_temp.check((select status from public.invoices where id = :'inv') = 'open', 'undoing a payment reopens');

-- void: the job goes back to "to bill"
insert into public.invoices (company_id, client_id, status, issued_on, due_on, number) values (:'co', :'cl', 'open', current_date, current_date + 7, '') returning id as inv2 \gset
insert into public.invoice_lines (invoice_id, company_id, job_id, description, unit_cents) values (:'inv2', :'co', :'j2', 'Standard', 16000);
update public.invoices set status = 'void' where id = :'inv2';
select pg_temp.check((select count(*) from public.invoice_lines l join public.invoices i on i.id = l.invoice_id where l.job_id = :'j2' and i.status <> 'void') = 0, 'voided invoice frees the job');

-- income without an invoice, company expense marked monthly
insert into public.payments (company_id, invoice_id, client_id, method, amount_cents, description) values (:'co', null, :'cl', 'cash', 6000, 'Extra paid on the spot');
insert into public.expenses (company_id, category, amount_cents, description, incurred_on, status, recurring)
  values (:'co', 'software', 2900, 'Tidyo', (date_trunc('month', current_date) - interval '10 days')::date, 'approved', true);
select pg_temp.check((select count(*) from public.payments where invoice_id is null) = 1, 'manual income saved');

-- the field team never sees money
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f2');
select pg_temp.check((select count(*) from public.payments) = 0, 'helper sees no payments');
select pg_temp.check((select count(*) from public.invoices) = 0, 'helper sees no invoices');
select pg_temp.check((select count(*) from public.expenses where membership_id is null) = 0, 'helper sees no company expenses');

-- monthly copy (runs as the cron job)
reset role;
select public.copy_recurring_expenses() as copied \gset
select pg_temp.check(:copied = 1, 'recurring expense copied to this month');
select pg_temp.check(public.copy_recurring_expenses() = 0, 'copy is idempotent');
\echo Finance scenarios passed.
