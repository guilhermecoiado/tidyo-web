-- Access rule scenarios. Run after the migrations on a throwaway database:
--   psql -v ON_ERROR_STOP=1 -f tests/access_rules_test.sql
-- Each block raises if a rule does not hold.
\set QUIET on
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
$$;
create or replace function pg_temp.expect_error(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'ok   %  (%)', label, sqlerrm; return; end;
  raise exception 'FAIL % — query succeeded but should have been refused', label;
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'carla@shine.test',  '{"full_name":"Carla","language":"pt-BR"}'),
  ('00000000-0000-0000-0000-00000000000b', 'paulo@shine.test',  '{"full_name":"Paulo"}'),
  ('00000000-0000-0000-0000-00000000000c', 'bianca@shine.test', '{"full_name":"Bianca","language":"es"}'),
  ('00000000-0000-0000-0000-00000000000d', 'joana@shine.test',  '{"full_name":"Joana","language":"es"}'),
  ('00000000-0000-0000-0000-00000000000e', 'cohen@client.test', '{"full_name":"Ruth Cohen"}'),
  ('00000000-0000-0000-0000-00000000000f', 'rival@other.test',  '{"full_name":"Rival"}'),
  ('00000000-0000-0000-0000-000000000099', 'admin@tidyo.test',  '{"full_name":"Admin"}');
insert into public.platform_admins values ('00000000-0000-0000-0000-000000000099');

set role authenticated;

-- ── Signup ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_company('Shine Cleaning', 'both', 'pt-BR') as shine \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select public.create_company('Other Co') as other \gset
select pg_temp.check((select count(*) from public.companies) = 1, 'rival sees only own company');

-- ── Owner builds the company ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select role from public.memberships where user_id = auth.uid()) = 'owner', 'creator is owner');
select pg_temp.check((select status from public.subscriptions where company_id = :'shine') = 'trialing', 'trial started');

insert into public.memberships (id, company_id, user_id, role, status, display_name, language) values
  ('10000000-0000-0000-0000-0000000000b0', :'shine', '00000000-0000-0000-0000-00000000000b', 'manager', 'active', 'Paulo', 'pt-BR'),
  ('10000000-0000-0000-0000-0000000000c0', :'shine', '00000000-0000-0000-0000-00000000000c', 'helper', 'active', 'Bianca', 'es'),
  ('10000000-0000-0000-0000-0000000000d0', :'shine', '00000000-0000-0000-0000-00000000000d', 'helper', 'active', 'Joana', 'es');
insert into public.member_pay_rates (membership_id, company_id, hourly_cents) values
  ('10000000-0000-0000-0000-0000000000c0', :'shine', 2200), ('10000000-0000-0000-0000-0000000000d0', :'shine', 2000);

insert into public.clients (id, company_id, kind, name, email, language, portal_user_id, notes) values
  ('20000000-0000-0000-0000-000000000001', :'shine', 'residential', 'Família Cohen', 'cohen@client.test', 'en', '00000000-0000-0000-0000-00000000000e', 'Pays late, be firm'),
  ('20000000-0000-0000-0000-000000000002', :'shine', 'commercial', 'Dental Care', 'office@dental.test', 'en', null, null);
insert into public.properties (id, company_id, client_id, address_line1, city, state, zip, access_instructions, pets) values
  ('30000000-0000-0000-0000-000000000001', :'shine', '20000000-0000-0000-0000-000000000001', '12 Elm St', 'Waterbury', 'CT', '06702', 'Gate 4512', 'Dog: Max'),
  ('30000000-0000-0000-0000-000000000002', :'shine', '20000000-0000-0000-0000-000000000002', '400 Main St', 'Middlebury', 'CT', '06762', null, null);
insert into public.jobs (id, company_id, client_id, property_id, scheduled_start, scheduled_end, price_cents, internal_notes, client_notes) values
  ('40000000-0000-0000-0000-000000000001', :'shine', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now(), now() + interval '2 hours', 18000, 'Raise price next month', 'Please check the oven'),
  ('40000000-0000-0000-0000-000000000002', :'shine', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now(), now() + interval '3 hours', 25000, null, null);
insert into public.job_assignments (job_id, membership_id, company_id) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000c0', :'shine'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000d0', :'shine');
insert into public.job_checklist_items (id, job_id, company_id, room, task) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', :'shine', 'Cocina', 'Limpiar horno');

-- ── Manager limits ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$insert into public.memberships (company_id, role, display_name) values ('$$ || :'shine' || $$', 'manager', 'New manager')$$, 'manager cannot add managers');
insert into public.memberships (company_id, role, display_name) values (:'shine', 'helper', 'Invited helper');
select pg_temp.check(true, 'manager can invite helpers');
select pg_temp.check((select count(*) from public.subscriptions) = 0, 'manager does not see billing');

-- ── Helper (Bianca) ──
reset role;
update public.companies set allow_push_team = true where id = :'shine';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.jobs) = 0, 'helper cannot read jobs table (prices, internal notes)');
select pg_temp.check((select count(*) from public.clients) = 0, 'helper cannot read client records');
select pg_temp.check((select count(*) from public.member_pay_rates) = 0, 'helper cannot see pay rates');
select pg_temp.check((select count(*) from public.memberships) = 1, 'helper sees only her own membership');
select pg_temp.check((select count(*) from public.team_directory(:'shine')) = 4, 'helper sees colleague names');
select pg_temp.check((select count(*) from public.helper_jobs()) = 1, 'helper sees only her job');
select pg_temp.check((select access_instructions from public.helper_jobs()) = 'Gate 4512', 'helper gets access instructions');
select pg_temp.expect_error($$select public.job_progress('40000000-0000-0000-0000-000000000002', 'in_progress')$$, 'helper cannot start a job not assigned to her');
select pg_temp.expect_error($$select public.job_progress('40000000-0000-0000-0000-000000000001', 'completed')$$, 'helper cannot skip from scheduled to completed');
select public.job_progress('40000000-0000-0000-0000-000000000001', 'in_progress');
insert into public.time_entries (company_id, membership_id, job_id, clock_in) values
  (:'shine', '10000000-0000-0000-0000-0000000000c0', '40000000-0000-0000-0000-000000000001', now() - interval '2 hours');
select pg_temp.expect_error($$insert into public.time_entries (company_id, membership_id, clock_in) values ('$$ || :'shine' || $$', '10000000-0000-0000-0000-0000000000d0', now())$$, 'helper cannot clock in someone else');
update public.job_checklist_items set done_at = now() where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.check((select done_by from public.job_checklist_items) = '10000000-0000-0000-0000-0000000000c0', 'checklist records who ticked it');
insert into public.expenses (company_id, membership_id, category, amount_cents, reimbursable, status) values
  (:'shine', '10000000-0000-0000-0000-0000000000c0', 'gas', 2350, true, 'pending');
select pg_temp.expect_error($$insert into public.expenses (company_id, membership_id, category, amount_cents, reimbursable, status) values ('$$ || :'shine' || $$', '10000000-0000-0000-0000-0000000000c0', 'gas', 9999, true, 'approved')$$, 'helper cannot self-approve an expense');
update public.time_entries set clock_out = now() where membership_id = '10000000-0000-0000-0000-0000000000c0';
select public.job_progress('40000000-0000-0000-0000-000000000001', 'completed', 'Horno listo');
select pg_temp.expect_error($$insert into public.broadcasts (company_id, audience, content) values ('$$ || :'shine' || $$', 'team', '{}')$$, 'helper cannot send broadcasts');

-- ── Portal client (Cohen) ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from public.clients) = 0, 'client cannot read the raw client row (internal notes)');
select pg_temp.check((select name from public.portal_me()) = 'Família Cohen', 'client sees own profile');
select pg_temp.check((select count(*) from public.portal_jobs()) = 1, 'client sees only own visits');
select pg_temp.check((select count(*) from public.companies) = 1, 'client sees the company name');
select pg_temp.check((select count(*) from public.job_checklist_items) = 1, 'client sees checklist of own visit');
select public.rate_job('40000000-0000-0000-0000-000000000001', 5::smallint, 'Great');
select pg_temp.expect_error($$select public.rate_job('40000000-0000-0000-0000-000000000001', 1::smallint)$$, 'client cannot rate twice');
select pg_temp.expect_error($$select public.rate_job('40000000-0000-0000-0000-000000000002', 5::smallint)$$, 'client cannot rate another client''s visit');

-- ── Outsider ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select pg_temp.check((select count(*) from public.clients) = 0, 'other company sees no Shine clients');
select pg_temp.expect_error($$insert into public.clients (company_id, name) values ('$$ || :'shine' || $$', 'Stolen')$$, 'other company cannot write into Shine');
select pg_temp.check((select count(*) from public.helper_jobs()) = 0, 'other company sees no field jobs');

-- ── Owner: money ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.invoices (id, company_id, client_id, status, issued_on, due_on) values
  ('60000000-0000-0000-0000-000000000001', :'shine', '20000000-0000-0000-0000-000000000001', 'open', current_date, current_date + 7);
insert into public.invoice_lines (invoice_id, company_id, job_id, description, unit_cents) values
  ('60000000-0000-0000-0000-000000000001', :'shine', '40000000-0000-0000-0000-000000000001', 'Recurring clean', 18000);
select pg_temp.check((select number from public.invoices) = 'INV-1001', 'invoice numbered automatically');
insert into public.payments (company_id, invoice_id, method, amount_cents, reference, recorded_by) values
  (:'shine', '60000000-0000-0000-0000-000000000001', 'zelle', 18000, 'ZL-889', '10000000-0000-0000-0000-0000000000b0');
select pg_temp.check((select status from public.invoices) = 'paid', 'Zelle payment closes the invoice');
select pg_temp.check((select count(*) from public.audit_log where table_name = 'payments') = 1, 'payment is audited');
select pg_temp.check((select profit_cents from public.v_client_profit_90d where name = 'Família Cohen') = 18000 - 4400, 'profit per client = revenue − labour');
select pg_temp.expect_error($$insert into public.broadcasts (company_id, audience, content) values ('$$ || :'shine' || $$', 'clients', '{}')$$, 'push to clients is off by default');
update public.companies set allow_push_clients = true where id = :'shine';
insert into public.broadcasts (company_id, audience, content) values (:'shine', 'clients', '{"en":{"title":"Holiday hours"}}');
select pg_temp.check(true, 'push to clients works after the owner enables it');
select pg_temp.expect_error($$update public.memberships set role = 'helper' where user_id = auth.uid()$$, 'owner cannot demote self');

-- ── Invite link (WhatsApp) and files ──
insert into public.memberships (company_id, role, display_name, invite_token_hash, invite_expires_at) values
  (:'shine', 'helper', 'Maria', 'c8963414bf6c4c869eeac5f8a057c3dc574d422f1b108397b66f67bab3d2f981', now() + interval '7 days');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000011', 'maria@shine.test');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000011');
select pg_temp.expect_error($$select public.accept_invite('wrong')$$, 'wrong invite token refused');
select public.accept_invite('tok-123');
select pg_temp.check(public.is_member(:'shine'), 'invite link joins the company');
select pg_temp.expect_error($$select public.accept_invite('tok-123')$$, 'invite link works only once');
insert into storage.objects (bucket_id, name, owner) values ('job-photos', :'shine' || '/40000000-0000-0000-0000-000000000001/a.jpg', auth.uid());
select pg_temp.check(true, 'helper uploads photo into her company folder');
select pg_temp.expect_error($$insert into storage.objects (bucket_id, name, owner) values ('job-photos', '$$ || :'other' || $$/x.jpg', auth.uid())$$, 'helper cannot upload into another company');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000f');
select pg_temp.check((select count(*) from storage.objects) = 0, 'other company cannot list Shine files');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from storage.objects) = 1, 'owner sees team photos');

-- ── Plan limits ──
reset role;
update public.subscriptions set plan = 'essencial', has_commercial = false where company_id = :'shine';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$insert into public.memberships (company_id, role, display_name) values ('$$ || :'shine' || $$', 'helper', 'Sixth')$$, 'Essencial limits users');
select pg_temp.expect_error($$insert into public.clients (company_id, kind, name) values ('$$ || :'shine' || $$', 'commercial', 'Office')$$, 'Essencial has no commercial clients');
reset role;
update public.subscriptions set plan = 'comercial', has_commercial = true, commercial_tier = 1 where company_id = :'shine';
set role authenticated;
select pg_temp.expect_error($$insert into public.clients (company_id, kind, name) values ('$$ || :'shine' || $$', 'residential', 'House')$$, 'Comercial-only has no residential clients');

-- ── Ratings auto-approve after 24h ──
reset role;
update public.jobs set status = 'in_progress' where id = '40000000-0000-0000-0000-000000000002';
update public.jobs set status = 'completed', completed_at = now() - interval '25 hours' where id = '40000000-0000-0000-0000-000000000002';
select pg_temp.check(public.auto_approve_ratings() = 1, 'unrated visit auto-approved after 24h');
select pg_temp.check((select rating_status from public.jobs where id = '40000000-0000-0000-0000-000000000002') = 'auto_approved', 'status is auto_approved, no notes');

-- ── Signed-out visitor ──
set role anon;
select pg_temp.expect_error('select count(*) from public.clients', 'anon reads nothing');
reset role;
\echo 'All access rule scenarios passed.'
