-- Tidyo · superadmin: subscribers with usage and actions, support desk with internal notes, ads stats and media, push audiences

alter table public.subscriptions add column if not exists discount_pct smallint not null default 0 check (discount_pct between 0 and 100);

-- Internal notes on a ticket: only the Tidyo team sees them
create table if not exists public.support_notes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.support_notes enable row level security;
create policy admin_all on public.support_notes for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select, insert, update, delete on public.support_notes to authenticated;

create or replace function public.admin_subscribers()
returns table (id uuid, name text, mode public.company_mode, created_at timestamptz, state text, language public.app_language,
               plan public.plan_code, has_commercial boolean, commercial_tier smallint, billing public.billing_interval,
               status public.sub_status, trial_ends_at timestamptz, cancel_at_period_end boolean, discount_pct smallint, updated_at timestamptz,
               owner_name text, owner_email text, users bigint, houses bigint, contracts bigint, utm jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.mode, c.created_at, c.state, c.default_language,
         s.plan, s.has_commercial, s.commercial_tier, s."interval", s.status, s.trial_ends_at, s.cancel_at_period_end, s.discount_pct, s.updated_at,
         (select m.display_name from public.memberships m where m.company_id = c.id and m.role = 'owner' order by m.created_at limit 1),
         (select u.email::text from public.memberships m join auth.users u on u.id = m.user_id where m.company_id = c.id and m.role = 'owner' order by m.created_at limit 1),
         (select count(*) from public.memberships m where m.company_id = c.id and m.status in ('active', 'invited')),
         (select count(*) from public.properties p join public.clients k on k.id = p.client_id where p.company_id = c.id and p.archived_at is null and k.archived_at is null and k.kind = 'residential'),
         (select count(*) from public.contracts k where k.company_id = c.id and k.status = 'active'),
         coalesce(s.utm, '{}'::jsonb)
    from public.companies c left join public.subscriptions s on s.company_id = c.id
   where public.is_platform_admin() and c.deleted_at is null
   order by c.created_at desc;
$$;

-- Actions on a subscriber; every one is written to the audit log with the reason
create or replace function public.admin_action(p_company uuid, p_action text, p_value integer, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_action = 'extend_trial' then
    update public.subscriptions set trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + make_interval(days => greatest(1, least(coalesce(p_value, 7), 90))),
           status = case when status in ('canceled', 'paused') then status else 'trialing'::public.sub_status end, updated_at = now()
     where company_id = p_company;
  elsif p_action = 'discount' then
    update public.subscriptions set discount_pct = greatest(0, least(coalesce(p_value, 0), 100)), updated_at = now() where company_id = p_company;
  elsif p_action = 'suspend' then
    update public.subscriptions set status = 'paused', updated_at = now() where company_id = p_company;
  elsif p_action = 'reactivate' then
    update public.subscriptions set status = case when trial_ends_at > now() then 'trialing'::public.sub_status else 'active'::public.sub_status end, updated_at = now() where company_id = p_company;
  else
    raise exception 'invalid_action' using errcode = '22023';
  end if;
  insert into public.audit_log (company_id, actor_id, action, table_name, row_id, detail)
  values (p_company, auth.uid(), 'admin_' || p_action, 'subscriptions', p_company, jsonb_build_object('value', p_value, 'reason', left(p_reason, 300)));
end $$;

create or replace function public.admin_support()
returns table (id uuid, number bigint, subject text, topic text, status public.ticket_status, language public.app_language, created_at timestamptz, updated_at timestamptz,
               last_from_staff boolean, staff_replied boolean, company_id uuid, company_name text, company_state text, company_mode public.company_mode, company_since timestamptz,
               plan public.plan_code, has_commercial boolean, opener_name text, opener_email text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.number, t.subject, t.topic, t.status, t.language, t.created_at, t.updated_at,
         coalesce((select sm.from_staff from public.support_messages sm where sm.ticket_id = t.id order by sm.created_at desc limit 1), false),
         exists (select 1 from public.support_messages sm where sm.ticket_id = t.id and sm.from_staff),
         c.id, c.name, c.state, c.mode, c.created_at, s.plan, s.has_commercial,
         (select p.full_name from public.profiles p where p.id = t.opened_by), u.email::text
    from public.support_tickets t
    left join public.companies c on c.id = t.company_id
    left join public.subscriptions s on s.company_id = c.id
    join auth.users u on u.id = t.opened_by
   where public.is_platform_admin()
   order by (t.status = 'resolved'), t.updated_at desc
   limit 300;
$$;

-- First reply time (7 days) and resolved count (7 days)
create or replace function public.admin_support_stats()
returns table (first_reply_minutes integer, resolved_7d integer, new_today integer)
language sql stable security definer set search_path = '' as $$
  select (select round(avg(extract(epoch from (fr.at - t.created_at)) / 60))::int from public.support_tickets t
            cross join lateral (select min(sm.created_at) as at from public.support_messages sm where sm.ticket_id = t.id and sm.from_staff) fr
           where t.created_at > now() - interval '7 days' and fr.at is not null),
         (select count(*)::int from public.support_tickets t where t.status = 'resolved' and t.updated_at > now() - interval '7 days'),
         (select count(*)::int from public.support_tickets t where t.created_at > date_trunc('day', now()))
   where public.is_platform_admin();
$$;

create or replace function public.admin_ad_stats()
returns table (campaign_id uuid, impressions bigint, clicks bigint)
language sql stable security definer set search_path = '' as $$
  select e.campaign_id, count(*) filter (where e.event = 'impression'), count(*) filter (where e.event = 'click')
    from public.ad_events e where public.is_platform_admin() group by e.campaign_id;
$$;

-- Push from the platform: owners always allowed; team and clients only when explicitly included
create or replace function public.admin_push(p_owners boolean, p_team boolean, p_clients boolean, p_content jsonb, p_link text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  insert into public.broadcasts (company_id, audience, content, sent_at, created_by)
  values (null, case when p_team or p_clients then 'everyone' else 'owners' end, p_content, now(), auth.uid());
  insert into public.notifications (user_id, company_id, kind, title, data, link)
  select distinct on (x.user_id) x.user_id, x.company_id, 'broadcast', 'broadcast', p_content, p_link from (
    select m.user_id, m.company_id from public.memberships m
     where m.status = 'active' and m.user_id is not null and ((p_owners and m.role in ('owner', 'manager')) or (p_team and m.role = 'helper'))
    union all
    select k.portal_user_id, k.company_id from public.clients k where p_clients and k.portal_user_id is not null and k.archived_at is null
  ) x;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_push_counts()
returns table (owners bigint, team bigint, clients bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(distinct user_id) from public.memberships where status = 'active' and role in ('owner', 'manager') and user_id is not null),
         (select count(distinct user_id) from public.memberships where status = 'active' and role = 'helper' and user_id is not null),
         (select count(*) from public.clients where portal_user_id is not null and archived_at is null)
   where public.is_platform_admin();
$$;

revoke execute on function public.admin_subscribers, public.admin_action, public.admin_support, public.admin_support_stats, public.admin_ad_stats, public.admin_push, public.admin_push_counts from anon, public;
grant execute on function public.admin_subscribers, public.admin_action, public.admin_support, public.admin_support_stats, public.admin_ad_stats, public.admin_push, public.admin_push_counts to authenticated;

-- Ad images and videos: public to read (they are ads), only the Tidyo team uploads
insert into storage.buckets (id, name, public, file_size_limit) values ('ad-media', 'ad-media', true, 20971520) on conflict (id) do nothing;
create policy "ad media admin write" on storage.objects for insert to authenticated with check (bucket_id = 'ad-media' and public.is_platform_admin());
create policy "ad media admin update" on storage.objects for update to authenticated using (bucket_id = 'ad-media' and public.is_platform_admin());
create policy "ad media admin delete" on storage.objects for delete to authenticated using (bucket_id = 'ad-media' and public.is_platform_admin());
