-- Run after access_rules_test.sql on the same database.
\set QUIET on
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.expect_error(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'ok   %  (%)', label, sqlerrm; return; end; raise exception 'FAIL %', label; end $$;
grant execute on all functions in schema pg_temp to authenticated;
reset role;
update public.subscriptions set plan = 'pro', has_commercial = true where true;
insert into public.jobs (id, company_id, client_id, property_id, scheduled_start, scheduled_end, price_cents)
select '40000000-0000-0000-0000-000000000003', company_id, client_id, id, now(), now() + interval '2 hours', 15000
from public.properties where id = '30000000-0000-0000-0000-000000000001';
insert into public.job_assignments (job_id, membership_id, company_id)
select '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000c0', company_id from public.jobs where id = '40000000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.job_checklist('40000000-0000-0000-0000-000000000003')) = 15, 'helper opens standard residential checklist');
select pg_temp.check((select count(*) from public.job_checklist('40000000-0000-0000-0000-000000000003')) = 15, 'checklist is created only once');
select pg_temp.expect_error($$select * from public.job_checklist('40000000-0000-0000-0000-000000000002')$$, 'helper cannot open another helper''s checklist');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from public.job_checklist('40000000-0000-0000-0000-000000000003')) = 15, 'client reads own visit checklist');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000022', 'rossi@client.test');
update public.clients set portal_invite_hash = encode(extensions.digest('portal-1', 'sha256'), 'hex'), portal_invite_expires_at = now() + interval '7 days'
 where id = '20000000-0000-0000-0000-000000000002';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000000022');
select public.accept_portal_invite('portal-1');
select pg_temp.check((select count(*) from public.portal_me()) = 1, 'client joins the portal by link');
select pg_temp.expect_error($$select public.accept_portal_invite('portal-1')$$, 'portal link works once');
reset role;
\echo 'Checklist and portal scenarios passed.'
