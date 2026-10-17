-- Two-step verification is enforced by the database once a person turns it on
\set QUIET on
create or replace function pg_temp.as_user(u uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), false), set_config('request.jwt.claims', jsonb_build_object('aal', aal)::text, false); $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
grant execute on all functions in schema pg_temp to authenticated;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e1', 'mfa@t.test', '{"full_name":"Ana"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select public.create_company('MFA Clean', 'residential', 'pt-BR') as co \gset
insert into public.clients (company_id, name) values (:'co', 'Cliente A');
select pg_temp.check((select count(*) from public.clients) = 1, 'no factor: sees clients with a normal session');
reset role;
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-0000000000e1', 'verified');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1', 'aal1');
select pg_temp.check((select count(*) from public.clients) = 0, 'factor on + password only: sees nothing');
select pg_temp.check((select count(*) from public.memberships) = 1, 'still reads own membership to show the code prompt');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1', 'aal2');
select pg_temp.check((select count(*) from public.clients) = 1, 'factor on + code: sees clients');
\echo MFA scenarios passed.
