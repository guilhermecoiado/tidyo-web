-- Helper sees her own pay estimate and rating, never the rate table
\set QUIET on
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'own@p.test', '{"full_name":"Gui"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'hel@p.test', '{"full_name":"Bia"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.create_company('Pay Clean', 'residential', 'pt-BR') as co \gset
select public.create_team_link(:'co', 'helper') as tok \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select public.request_join(:'tok', 'Bia', 'es') as mid \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.decide_join(:'mid', true);
insert into public.member_pay_rates (membership_id, company_id, hourly_cents) values (:'mid', :'co', 2400);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
insert into public.time_entries (company_id, membership_id, clock_in, clock_out) values (:'co', :'mid', date_trunc('week', now()) + interval '1 hour', date_trunc('week', now()) + interval '3 hours 30 minutes');
select pg_temp.check((select minutes from public.my_pay_weeks(2) limit 1) = 150, 'minutes this week');
select pg_temp.check((select pay_cents from public.my_pay_weeks(2) limit 1) = 6000, 'pay = 2.5h x $24');
select pg_temp.check((select count(*) from public.member_pay_rates) = 0, 'helper cannot read rate table');
select pg_temp.check((select rated from public.my_rating()) = 0, 'no ratings yet');
\echo Helper pay scenarios passed.
