-- Tidyo · client portal: requests (extra service, issue, supplies), visit details and how to pay

create table if not exists public.client_requests (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null check (kind in ('extra', 'issue', 'supply', 'other')),
  body        text not null check (length(body) between 1 and 2000),
  status      text not null default 'sent' check (status in ('sent', 'scheduled', 'done', 'declined')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists client_requests_company on public.client_requests (company_id, created_at desc);
alter table public.client_requests enable row level security;
create policy staff_all on public.client_requests for all to authenticated
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));
create policy portal_select on public.client_requests for select to authenticated using (public.is_portal_client(client_id));
create policy portal_insert on public.client_requests for insert to authenticated
  with check (public.is_portal_client(client_id) and status = 'sent' and created_by = auth.uid()
              and company_id = (select c.company_id from public.clients c where c.id = client_id));
grant select, insert, update, delete on public.client_requests to authenticated;

create or replace function public.on_client_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cname text;
begin
  select name into cname from public.clients where id = new.client_id;
  perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'client_request',
    jsonb_build_object('client', cname, 'kind', new.kind, 'text', left(new.body, 140), 'client_id', new.client_id), '/app/clientes?c=' || new.client_id);
  return new;
end $$;
revoke execute on function public.on_client_request from anon, authenticated, public;
create trigger client_request_notify after insert on public.client_requests for each row execute function public.on_client_request();

-- The company as the client sees it: name, logo, phone and how to pay
create or replace function public.portal_company()
returns table (company_id uuid, name text, logo_path text, phone text, payment_info jsonb)
language sql stable security definer set search_path = '' as $$
  select co.id, co.name, co.logo_path,
         (select p.phone from public.memberships m join public.profiles p on p.id = m.user_id where m.company_id = co.id and m.role = 'owner' and m.status = 'active' order by m.created_at limit 1),
         coalesce(co.payment_info, '{}'::jsonb)
    from public.clients c join public.companies co on co.id = c.company_id
   where c.portal_user_id = auth.uid() and c.archived_at is null
   limit 1;
$$;

-- One visit for the client: when the team arrived and left, and who came (first name + initial)
create or replace function public.portal_visit(p_job uuid)
returns table (started_at timestamptz, completed_at timestamptz, team text[])
language sql stable security definer set search_path = '' as $$
  select j.started_at, j.completed_at,
         coalesce(array(select split_part(m.display_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(m.display_name, ' ', 2), ''), 1) || '.', '')
                          from public.job_assignments ja join public.memberships m on m.id = ja.membership_id
                         where ja.job_id = j.id order by ja.is_lead desc, m.display_name), '{}')
    from public.jobs j
   where j.id = p_job and public.is_portal_client(j.client_id);
$$;

revoke execute on function public.portal_company, public.portal_visit from anon, public;
grant execute on function public.portal_company, public.portal_visit to authenticated;
