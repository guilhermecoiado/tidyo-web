-- Run after access_rules_test.sql on the same database.
\set QUIET on
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok   %', label; else raise exception 'FAIL %', label; end if; end $$;
create or replace function pg_temp.expect_error(q text, label text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'ok   %  (%)', label, sqlerrm; return; end; raise exception 'FAIL %', label; end $$;
grant execute on all functions in schema pg_temp to authenticated;
reset role;
update public.subscriptions set plan = 'pro', has_commercial = true, commercial_tier = 1, status = 'active' where true;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.clients set notes = 'ok while active' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select notes from public.clients where id = '20000000-0000-0000-0000-000000000001') = 'ok while active', 'active account writes');

-- trial over: writes refused, reads still work
reset role;
update public.subscriptions s set status = 'trialing', trial_ends_at = now() - interval '1 day' from public.clients c where c.company_id = s.company_id and c.id = '20000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($$update public.clients set notes = 'x' where id = '20000000-0000-0000-0000-000000000001'$$, 'locked account cannot edit clients');
select pg_temp.expect_error($$delete from public.jobs where company_id = (select company_id from public.clients where id = '20000000-0000-0000-0000-000000000001')$$, 'locked account cannot delete jobs');
select pg_temp.check((select count(*) from public.clients where id = '20000000-0000-0000-0000-000000000001') = 1, 'locked account still reads its data');
update public.notifications set read_at = now() where user_id = auth.uid();
select pg_temp.check(true, 'locked owner can still mark notices as read');

-- Essencial after the trial: no portal invite, no saved routes
reset role;
update public.subscriptions s set plan = 'essencial', has_commercial = false, commercial_tier = null, status = 'active' from public.clients c where c.company_id = s.company_id and c.id = '20000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($$update public.clients set portal_invite_hash = 'abc' where id = '20000000-0000-0000-0000-000000000001'$$, 'Essencial cannot invite to the portal');
update public.clients set notes = 'essencial edits' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select notes from public.clients where id = '20000000-0000-0000-0000-000000000001') = 'essencial edits', 'Essencial still edits clients');

-- trial: everything open again
reset role;
update public.subscriptions s set status = 'trialing', trial_ends_at = now() + interval '5 days' from public.clients c where c.company_id = s.company_id and c.id = '20000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.clients set portal_invite_hash = 'abc' where id = '20000000-0000-0000-0000-000000000001';
select pg_temp.check((select portal_invite_hash from public.clients where id = '20000000-0000-0000-0000-000000000001') = 'abc', 'trial can invite to the portal');
-- closing the company still works (cancel first, then the team is removed)
select public.close_company((select company_id from public.clients where id = '20000000-0000-0000-0000-000000000001'), 'EXCLUIR');
reset role;
select pg_temp.check((select count(*) from public.memberships m join public.clients c on c.company_id = m.company_id where c.id = '20000000-0000-0000-0000-000000000001' and m.status = 'active') = 0, 'owner can still close the company');
