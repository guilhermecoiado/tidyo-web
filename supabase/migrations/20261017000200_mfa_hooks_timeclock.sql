-- Tidyo · launch review, part 2
-- 1) Two-step verification enforced by the database: once a person has an authenticator app turned on,
--    every access rule requires a session that passed the code (aal2). People without it are unaffected.
create or replace function public.mfa_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified');
$$;

create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function public.is_staff(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
                   and m.role in ('owner', 'manager'));
$$;
create or replace function public.is_owner(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
                   and m.role = 'owner');
$$;
create or replace function public.my_membership_id(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.memberships m
  where public.mfa_ok() and m.company_id = cid and m.user_id = auth.uid() and m.status = 'active' limit 1;
$$;
create or replace function public.is_assigned(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.job_assignments ja
                 join public.memberships m on m.id = ja.membership_id
                 where ja.job_id = jid and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function public.is_portal_client(clid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.clients c
                 where c.id = clid and c.portal_user_id = auth.uid() and c.archived_at is null);
$$;
create or replace function public.is_portal_of_company(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.clients c
                 where c.company_id = cid and c.portal_user_id = auth.uid() and c.archived_at is null);
$$;
create or replace function public.is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.conversation_participants p
                 where p.conversation_id = conv and p.user_id = auth.uid());
$$;
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mfa_ok() and exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

-- 2) client_of_job only answers for jobs the caller can already see
create or replace function public.client_of_job(jid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select j.client_id from public.jobs j
  where j.id = jid and (public.is_member(j.company_id) or public.is_portal_client(j.client_id));
$$;

-- 3) internal key so only the database can ask for a chat translation
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'internal_hook_key') then
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'vault' and p.proname = 'create_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'internal_hook_key');
    end if;
  end if;
exception when others then null;
end $$;

create or replace function public.internal_hook_key() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'internal_hook_key' limit 1;
$$;
revoke execute on function public.internal_hook_key from anon, authenticated, public;
grant execute on function public.internal_hook_key to service_role;

create or replace function public.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who text; others uuid[];
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_participants set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  select coalesce((select m.display_name from public.memberships m where m.company_id = new.company_id and m.user_id = new.sender_id limit 1),
                  (select k.name from public.clients k where k.company_id = new.company_id and k.portal_user_id = new.sender_id limit 1), 'Tidyo')
    into who;
  select array_agg(p.user_id) into others from public.conversation_participants p where p.conversation_id = new.conversation_id and p.user_id <> new.sender_id;
  perform public.notify_users(others, new.company_id, 'message', jsonb_build_object('who', who, 'conversation', new.conversation_id), '/mensagens/' || new.conversation_id);
  begin
    perform net.http_post(url := 'https://dydppwblbknosekojgwc.supabase.co/functions/v1/translate-message',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-tidyo-key', coalesce(public.internal_hook_key(), '')),
      timeout_milliseconds := 8000);
  exception when others then null;
  end;
  return null;
end $$;

-- 4) a shift left open closes itself after 14 hours and the office is told to review it
alter table public.time_entries add column if not exists auto_closed boolean not null default false;
create or replace function public.close_stale_time_entries() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in
    update public.time_entries t set clock_out = t.clock_in + interval '14 hours', auto_closed = true
     where t.clock_out is null and t.clock_in < now() - interval '14 hours'
    returning t.id, t.company_id, t.membership_id
  loop
    n := n + 1;
    perform public.notify_users(public.staff_user_ids(r.company_id), r.company_id, 'time_auto_closed',
      jsonb_build_object('who', (select m.display_name from public.memberships m where m.id = r.membership_id)), '/app/financas/equipe');
  end loop;
  return n;
end $$;
revoke execute on function public.close_stale_time_entries from anon, authenticated, public;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tidyo-close-stale-shifts', '*/30 * * * *', 'select public.close_stale_time_entries()');
  end if;
end $$;
