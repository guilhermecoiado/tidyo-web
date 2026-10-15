-- Tidyo · in-app notifications, support and platform admin

-- Notifications are stored as a kind + data; the app writes the text in each reader's language.
create or replace function public.notify_users(p_users uuid[], p_company uuid, p_kind text, p_data jsonb, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, company_id, kind, title, data, link)
  select u, p_company, p_kind, p_kind, coalesce(p_data, '{}'::jsonb), p_link from unnest(p_users) as u where u is not null;
$$;

create or replace function public.staff_user_ids(p_company uuid) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(m.user_id), '{}') from public.memberships m
  where m.company_id = p_company and m.status = 'active' and m.role in ('owner', 'manager') and m.user_id is not null;
$$;

create or replace function public.notify_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cname text; who text; uid uuid;
begin
  if tg_table_name = 'job_issues' then
    select c.name into cname from public.jobs j join public.clients c on c.id = j.client_id where j.id = new.job_id;
    select m.display_name into who from public.memberships m where m.id = new.reported_by;
    perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_issue',
      jsonb_build_object('client', cname, 'who', who, 'category', new.category, 'text', left(new.description, 140)), '/app/agenda');

  elsif tg_table_name = 'expenses' then
    if new.status = 'pending' then
      select m.display_name into who from public.memberships m where m.id = new.membership_id;
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'expense_pending',
        jsonb_build_object('who', who, 'amount_cents', new.amount_cents, 'category', new.category), '/app/financas/despesas');
    end if;

  elsif tg_table_name = 'jobs' then
    select c.name into cname from public.clients c where c.id = new.client_id;
    if new.status = 'completed' and old.status <> 'completed' then
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_completed',
        jsonb_build_object('client', cname, 'job', new.id), '/app/agenda');
    end if;
    if new.rating_status = 'rated' and old.rating_status <> 'rated' then
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_rated',
        jsonb_build_object('client', cname, 'rating', new.rating, 'comment', left(coalesce(new.rating_comment, ''), 140)), '/app/agenda');
    end if;

  elsif tg_table_name = 'job_assignments' then
    select m.user_id into uid from public.memberships m where m.id = new.membership_id;
    select c.name into cname from public.jobs j join public.clients c on c.id = j.client_id where j.id = new.job_id;
    if uid is not null and uid is distinct from auth.uid() then
      perform public.notify_users(array[uid], new.company_id, 'job_assigned',
        jsonb_build_object('client', cname, 'start', (select scheduled_start from public.jobs where id = new.job_id)), '/dia');
    end if;

  elsif tg_table_name = 'support_messages' then
    if new.from_staff then
      select t.opened_by into uid from public.support_tickets t where t.id = new.ticket_id;
      perform public.notify_users(array[uid], null, 'support_reply', jsonb_build_object('ticket', new.ticket_id), '/ajuda');
    end if;
  end if;
  return null;
end $$;

create trigger notify_job_issues after insert on public.job_issues for each row execute function public.notify_events();
create trigger notify_expenses after insert on public.expenses for each row execute function public.notify_events();
create trigger notify_jobs after update of status, rating_status on public.jobs for each row execute function public.notify_events();
create trigger notify_assignments after insert on public.job_assignments for each row execute function public.notify_events();
create trigger notify_support after insert on public.support_messages for each row execute function public.notify_events();

create or replace function public.mark_notifications_read() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-- Platform admins: bootstrap by email (the platform owner's account becomes admin on signup)
create table if not exists public.platform_admin_emails (email text primary key);
alter table public.platform_admin_emails enable row level security;
insert into public.platform_admin_emails values ('guiicoiado@gmail.com') on conflict do nothing;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, language)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce((new.raw_user_meta_data ->> 'language')::public.app_language, 'en'));
  if exists (select 1 from public.platform_admin_emails e where lower(e.email) = lower(new.email)) then
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
insert into public.platform_admins (user_id)
select u.id from auth.users u join public.platform_admin_emails e on lower(e.email) = lower(u.email)
on conflict do nothing;

-- Admin overview of subscribers
create or replace function public.admin_companies()
returns table (id uuid, name text, mode public.company_mode, created_at timestamptz, plan public.plan_code, has_commercial boolean,
               status public.sub_status, trial_ends_at timestamptz, owner_name text, owner_email text, members bigint, clients bigint,
               jobs_30d bigint, utm jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.mode, c.created_at, s.plan, s.has_commercial, s.status, s.trial_ends_at,
         (select m.display_name from public.memberships m where m.company_id = c.id and m.role = 'owner' limit 1),
         (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = c.id and m.role = 'owner' limit 1),
         (select count(*) from public.memberships m where m.company_id = c.id and m.status = 'active'),
         (select count(*) from public.clients k where k.company_id = c.id and k.archived_at is null),
         (select count(*) from public.jobs j where j.company_id = c.id and j.scheduled_start > now() - interval '30 days'),
         s.utm
  from public.companies c left join public.subscriptions s on s.company_id = c.id
  where public.is_platform_admin() and c.deleted_at is null
  order by c.created_at desc;
$$;

-- Platform message to every owner (and optionally their teams), in each reader's language
create or replace function public.admin_broadcast(p_audience text, p_content jsonb, p_link text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.broadcasts (company_id, audience, content, sent_at, created_by) values (null, p_audience, p_content, now(), auth.uid());
  insert into public.notifications (user_id, company_id, kind, title, data, link)
  select distinct m.user_id, m.company_id, 'broadcast', 'broadcast', p_content, p_link
  from public.memberships m
  where m.status = 'active' and m.user_id is not null
    and (p_audience = 'everyone' or (p_audience = 'owners' and m.role in ('owner', 'manager')) or (p_audience = 'team' and m.role = 'helper'));
  get diagnostics n = row_count;
  return n;
end $$;

-- Support: admins see every ticket; ticket list with last message
create or replace function public.admin_tickets()
returns table (id uuid, subject text, status public.ticket_status, language public.app_language, created_at timestamptz, updated_at timestamptz,
               company_name text, opener_email text, last_message text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.subject, t.status, t.language, t.created_at, t.updated_at, c.name, u.email::text,
         (select sm.body from public.support_messages sm where sm.ticket_id = t.id order by sm.created_at desc limit 1)
  from public.support_tickets t left join public.companies c on c.id = t.company_id join auth.users u on u.id = t.opened_by
  where public.is_platform_admin()
  order by (t.status = 'resolved'), t.updated_at desc;
$$;

create or replace function public.touch_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.support_tickets set updated_at = now(),
    status = case when new.from_staff then 'waiting_customer'::public.ticket_status else 'open'::public.ticket_status end
  where id = new.ticket_id;
  return null;
end $$;
create trigger touch_ticket after insert on public.support_messages for each row execute function public.touch_ticket();

revoke execute on function public.notify_users, public.staff_user_ids, public.notify_events, public.touch_ticket from anon, authenticated, public;
revoke execute on function public.mark_notifications_read, public.admin_companies, public.admin_broadcast, public.admin_tickets from anon, public;
grant execute on function public.mark_notifications_read, public.admin_companies, public.admin_broadcast, public.admin_tickets to authenticated;
