-- Team invite link: request to join, approval, and prices seeded for new companies
\set QUIET on
create or replace function pg_temp.as_user(u uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'own@t.test', '{"full_name":"Gui"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'new@t.test', '{"full_name":"Lia"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.create_company('Gui Clean', 'residential', 'pt-BR') as co \gset
select pg_temp.check((select count(*) from public.services where company_id = :'co') = 4, 'four cleaning types seeded');
select pg_temp.check((select count(*) from public.service_extras where company_id = :'co') = 3, 'three extras seeded');
select public.create_team_link(:'co', 'helper') as tok \gset
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select company_name from public.team_link_info(:'tok')) = 'Gui Clean', 'link shows company');
select public.request_join(:'tok', 'Lia Souza', 'es') as mid \gset
select pg_temp.check((select count(*) from public.my_join_requests()) = 1, 'request is pending');
select pg_temp.check(not public.is_member(:'co'), 'not a member before approval');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.decide_join(:'mid', true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.is_member(:'co'), 'member after approval');
\echo Team link scenarios passed.
