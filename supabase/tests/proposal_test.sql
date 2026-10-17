-- Run after access_rules_test.sql on the same database.
\set QUIET on
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.expect_error(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'ok   %  (%)', label, sqlerrm; return; end; raise exception 'FAIL %', label; end $$;
grant execute on all functions in schema pg_temp to authenticated;
reset role;
update public.subscriptions set plan = 'pro', has_commercial = true, commercial_tier = 1 where true;
insert into public.contracts (id, company_id, client_id, property_id, status, monthly_value_cents)
select '50000000-0000-0000-0000-000000000009', company_id, client_id, id, 'proposal', 180000
from public.properties where id = '30000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select pg_temp.expect_error($$select public.accept_proposal('50000000-0000-0000-0000-000000000009')$$, 'another company cannot accept');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select public.accept_proposal('50000000-0000-0000-0000-000000000009');
reset role;
select pg_temp.check((select status::text from public.contracts where id = '50000000-0000-0000-0000-000000000009') = 'active', 'client accepted: contract active');
select pg_temp.check((select renews_on from public.contracts where id = '50000000-0000-0000-0000-000000000009') = (current_date + interval '1 year')::date, 'renews in a year');
select pg_temp.check((select count(*) from public.notifications where kind = 'proposal_accepted') >= 1, 'owner notified');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.expect_error($$select public.accept_proposal('50000000-0000-0000-0000-000000000009')$$, 'cannot accept twice');
reset role;
