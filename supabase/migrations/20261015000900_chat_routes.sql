-- Tidyo · chat with automatic translation, and route ordering

-- Open (or reuse) a 1:1 conversation. Helpers and clients can only talk to the owner/managers.
create or replace function public.open_conversation(p_company uuid, p_with uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cid uuid; cl uuid;
begin
  if me is null or p_with is null or me = p_with then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not (public.is_member(p_company) or public.is_portal_of_company(p_company)) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships where company_id = p_company and user_id = p_with and status = 'active')
     and not exists (select 1 from public.clients where company_id = p_company and portal_user_id = p_with and archived_at is null) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public.is_staff(p_company) and not exists (
       select 1 from public.memberships where company_id = p_company and user_id = p_with and status = 'active' and role in ('owner', 'manager')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select c.id into cid from public.conversations c
   where c.company_id = p_company
     and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = me)
     and exists (select 1 from public.conversation_participants p where p.conversation_id = c.id and p.user_id = p_with)
     and (select count(*) from public.conversation_participants p where p.conversation_id = c.id) = 2
   limit 1;
  if cid is null then
    select id into cl from public.clients where company_id = p_company and portal_user_id in (me, p_with) limit 1;
    insert into public.conversations (company_id, client_id) values (p_company, cl) returning id into cid;
    insert into public.conversation_participants (conversation_id, user_id, company_id) values (cid, me, p_company), (cid, p_with, p_company);
  end if;
  return cid;
end $$;

-- Conversation list for the signed-in person, with the other person's name and unread count
create or replace function public.my_conversations()
returns table (id uuid, company_id uuid, other_user uuid, other_name text, last_message text, last_message_at timestamptz, unread bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, c.company_id, o.user_id,
         coalesce((select m.display_name from public.memberships m where m.company_id = c.company_id and m.user_id = o.user_id limit 1),
                  (select k.name from public.clients k where k.company_id = c.company_id and k.portal_user_id = o.user_id limit 1), '—'),
         (select coalesce(ms.translations ->> (select pr.language::text from public.profiles pr where pr.id = auth.uid()), ms.body)
            from public.messages ms where ms.conversation_id = c.id order by ms.created_at desc limit 1),
         c.last_message_at,
         (select count(*) from public.messages ms where ms.conversation_id = c.id and ms.sender_id <> auth.uid()
            and ms.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz))
  from public.conversations c
  join public.conversation_participants me on me.conversation_id = c.id and me.user_id = auth.uid()
  join public.conversation_participants o on o.conversation_id = c.id and o.user_id <> auth.uid()
  order by c.last_message_at desc nulls last;
$$;

-- People the caller can start a chat with
create or replace function public.chat_contacts(p_company uuid)
returns table (user_id uuid, name text, kind text, language public.app_language)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.display_name, m.role::text, m.language from public.memberships m
   where m.company_id = p_company and m.status = 'active' and m.user_id is not null and m.user_id <> auth.uid()
     and (public.is_staff(p_company) or m.role in ('owner', 'manager'))
     and (public.is_member(p_company) or public.is_portal_of_company(p_company))
  union all
  select k.portal_user_id, k.name, 'client', k.language from public.clients k
   where k.company_id = p_company and k.portal_user_id is not null and k.archived_at is null and public.is_staff(p_company)
  order by 2;
$$;

-- New message: bump the conversation, notify the others, ask for translation
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
      body := jsonb_build_object('id', new.id), headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 8000);
  exception when others then null;
  end;
  return null;
end $$;
create trigger on_message after insert on public.messages for each row execute function public.on_message();

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_participants set last_read_at = now() where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Helpers' day in route order
create or replace function public.apply_route(p_membership uuid, p_date date, p_order uuid[], p_minutes_before integer, p_minutes_after integer)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; i integer;
begin
  select company_id into cid from public.memberships where id = p_membership;
  if cid is null or not public.is_staff(cid) then raise exception 'not_allowed' using errcode = '42501'; end if;
  for i in 1 .. coalesce(array_length(p_order, 1), 0) loop
    update public.jobs set route_position = i where id = p_order[i] and company_id = cid;
  end loop;
  insert into public.route_plans (company_id, membership_id, plan_date, job_order, minutes_before, minutes_after, applied_at, applied_by)
  values (cid, p_membership, p_date, p_order, p_minutes_before, p_minutes_after, now(), auth.uid())
  on conflict (membership_id, plan_date) do update set job_order = excluded.job_order, minutes_before = excluded.minutes_before,
    minutes_after = excluded.minutes_after, applied_at = now(), applied_by = auth.uid();
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

revoke execute on function public.on_message from anon, authenticated, public;
revoke execute on function public.open_conversation, public.my_conversations, public.chat_contacts, public.mark_conversation_read, public.apply_route from anon, public;
grant execute on function public.open_conversation, public.my_conversations, public.chat_contacts, public.mark_conversation_read, public.apply_route to authenticated;
