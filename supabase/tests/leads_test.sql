-- Run after access_rules_test.sql on the same database.
\set QUIET on
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.expect_error(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'ok   %  (%)', label, sqlerrm; return; end; raise exception 'FAIL %', label; end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;
reset role;
select pg_temp.check((select count(*) from public.companies where slug is null) = 0, 'every company has a slug');
select pg_temp.check((select slug from public.companies where name = 'Shine Cleaning') = 'shine-cleaning', 'slug from the name');
update public.subscriptions set status = 'active' where true;

set role anon;
select set_config('request.headers', '{"x-forwarded-for": "1.2.3.4"}', false);
select pg_temp.check((select name from public.public_company('shine-cleaning')) = 'Shine Cleaning', 'anon reads the public page');
select pg_temp.check(public.submit_lead('shine-cleaning', '{"name": "Ana", "phone": "+1 203 555 0101", "bedrooms": 3, "bathrooms": 2, "language": "es"}'), 'anon sends a lead');
select pg_temp.expect_error($$select public.submit_lead('shine-cleaning', '{"name": "Ana"}')$$, 'lead needs phone or email');
select pg_temp.expect_error($$select public.submit_lead('nope-co', '{"name": "Ana", "phone": "1"}')$$, 'unknown page');
select pg_temp.expect_error($$select * from public.leads$$, 'anon cannot read leads');
select pg_temp.check(public.submit_lead('shine-cleaning', '{"name": "Bot", "phone": "1"}', 'http://spam'), 'honeypot answers ok');
select public.submit_lead('shine-cleaning', '{"name": "B", "email": "b@x.com"}');
select public.submit_lead('shine-cleaning', '{"name": "C", "email": "c@x.com"}');
select pg_temp.expect_error($$select public.submit_lead('shine-cleaning', '{"name": "D", "email": "d@x.com"}')$$, 'visitor limited to 3 per hour');

reset role;
select pg_temp.check((select count(*) from public.leads) = 3, 'three leads saved, bot skipped');
select pg_temp.check((select count(*) from public.notifications where kind = 'lead_new') >= 3, 'owner notified');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.check((select count(*) from public.leads) = 3, 'owner sees her leads');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000f', false);
select pg_temp.check((select count(*) from public.leads) = 0, 'other company sees none');
reset role;
update public.subscriptions s set status = 'paused' from public.companies c where c.id = s.company_id and c.slug = 'shine-cleaning';
set role anon;
select pg_temp.check((select count(*) from public.public_company('shine-cleaning')) = 0, 'paused company page is hidden');
reset role;
