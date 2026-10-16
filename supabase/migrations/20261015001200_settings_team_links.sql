-- Tidyo · company settings (price parameters, automatic messages, address) and team invite links with approval

alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists pricing jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists auto_messages jsonb not null default '{"r24": true, "otw": true, "rev": true, "late": true}'::jsonb;

-- One link per role, valid 7 days. Whoever opens it asks to join; the owner approves each person.
create table if not exists public.team_invite_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  role        public.member_role not null check (role in ('helper', 'manager')),
  token_hash  text not null unique,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.team_invite_links enable row level security;
create policy staff_select on public.team_invite_links for select to authenticated using (public.is_staff(company_id));

create or replace function public.create_team_link(p_company uuid, p_role public.member_role) returns text
language plpgsql security definer set search_path = '' as $$
declare tok text;
begin
  if not public.is_staff(p_company) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_role = 'manager' and not public.is_owner(p_company) then raise exception 'only_owner_manages_managers' using errcode = 'P0001'; end if;
  if p_role not in ('helper', 'manager') then raise exception 'not_allowed' using errcode = '42501'; end if;
  tok := encode(extensions.gen_random_bytes(12), 'hex');
  insert into public.team_invite_links (company_id, role, token_hash, created_by)
    values (p_company, p_role, encode(extensions.digest(tok, 'sha256'), 'hex'), auth.uid());
  return tok;
end $$;

-- What the link is for, before signing in (company name and role only)
create or replace function public.team_link_info(p_token text)
returns table (company_name text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select c.name, l.role from public.team_invite_links l join public.companies c on c.id = l.company_id
   where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and l.expires_at > now() and c.deleted_at is null;
$$;

-- Signed-in person asks to join: membership stays "invited" until the owner approves
create or replace function public.request_join(p_token text, p_name text, p_language public.app_language) returns uuid
language plpgsql security definer set search_path = '' as $$
declare l public.team_invite_links; mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into l from public.team_invite_links where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and expires_at > now();
  if not found then raise exception 'invite_invalid_or_expired' using errcode = 'P0001'; end if;
  select id into mid from public.memberships where company_id = l.company_id and user_id = auth.uid();
  if mid is not null then return mid; end if;
  perform set_config('tidyo.creating_company', 'on', true);
  insert into public.memberships (company_id, user_id, role, status, display_name, language)
    values (l.company_id, auth.uid(), l.role, 'invited', left(coalesce(nullif(trim(p_name), ''), 'Helper'), 80), p_language)
    returning id into mid;
  perform set_config('tidyo.creating_company', 'off', true);
  perform public.notify_users(public.staff_user_ids(l.company_id), l.company_id, 'join_request',
    jsonb_build_object('who', left(coalesce(nullif(trim(p_name), ''), 'Helper'), 80), 'role', l.role), '/app/mais/equipe');
  return mid;
end $$;

-- Requests waiting for approval, for the person who asked
create or replace function public.my_join_requests()
returns table (membership_id uuid, company_name text, role public.member_role)
language sql stable security definer set search_path = '' as $$
  select m.id, c.name, m.role from public.memberships m join public.companies c on c.id = m.company_id
   where m.user_id = auth.uid() and m.status = 'invited' and m.invite_token_hash is null;
$$;

create or replace function public.decide_join(p_membership uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.memberships;
begin
  select * into m from public.memberships where id = p_membership;
  if not found or not public.is_staff(m.company_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if m.role = 'manager' and not public.is_owner(m.company_id) then raise exception 'only_owner_manages_managers' using errcode = 'P0001'; end if;
  if m.status <> 'invited' or m.user_id is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_approve then
    update public.memberships set status = 'active' where id = p_membership;
    perform public.notify_users(array[m.user_id], m.company_id, 'join_approved', '{}'::jsonb, '/');
  else
    update public.memberships set status = 'removed' where id = p_membership;
  end if;
end $$;

revoke execute on function public.create_team_link, public.team_link_info, public.request_join, public.my_join_requests, public.decide_join from anon, public;
grant execute on function public.create_team_link, public.request_join, public.my_join_requests, public.decide_join to authenticated;
grant execute on function public.team_link_info to anon, authenticated;
