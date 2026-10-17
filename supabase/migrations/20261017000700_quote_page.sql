-- Tidyo · public quote page (/orcamento/<slug>): anyone can ask for a quote, the company gets a lead

-- 1) a short public name for each company
alter table public.companies add column if not exists slug text unique
  check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$');

create or replace function public.make_slug(p_name text, p_id uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare base text; s text;
begin
  base := trim(both '-' from left(regexp_replace(lower(translate(coalesce(p_name, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'), 32));
  if length(base) < 3 then base := 'tidyo-' || left(replace(p_id::text, '-', ''), 6); end if;
  s := base;
  if exists (select 1 from public.companies where slug = s and id <> p_id) then s := base || '-' || left(replace(p_id::text, '-', ''), 4); end if;
  return s;
end $$;
revoke execute on function public.make_slug from anon, authenticated, public;

create or replace function public.companies_default_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.slug is null then new.slug := public.make_slug(new.name, new.id); end if;
  return new;
end $$;
revoke execute on function public.companies_default_slug from anon, authenticated, public;
create trigger companies_default_slug before insert on public.companies for each row execute function public.companies_default_slug();

update public.companies set slug = public.make_slug(name, id) where slug is null;

-- 2) leads
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         text not null default 'residential' check (kind in ('residential', 'commercial')),
  name         text not null check (length(name) between 1 and 120),
  phone        text check (length(phone) <= 40),
  email        text check (length(email) <= 160),
  language     text not null default 'en' check (language in ('en', 'es', 'pt-BR')),
  address      text check (length(address) <= 240),
  bedrooms     smallint check (bedrooms between 0 and 20),
  bathrooms    numeric(3,1) check (bathrooms between 0 and 20),
  square_feet  integer check (square_feet between 0 and 1000000),
  frequency    text check (frequency in ('once', 'weekly', 'biweekly', 'monthly', 'deep', 'move')),
  message      text check (length(message) <= 1000),
  estimate_cents integer check (estimate_cents between 0 and 10000000),
  status       text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  client_id    uuid references public.clients(id) on delete set null,
  source       text check (length(source) <= 60),
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index if not exists leads_company_created on public.leads (company_id, created_at desc);
create index if not exists leads_ip_created on public.leads (ip_hash, created_at desc);
alter table public.leads enable row level security;
create policy staff_select on public.leads for select to authenticated using (public.is_staff(company_id));
create policy staff_update on public.leads for update to authenticated using (public.is_staff(company_id)) with check (public.is_staff(company_id));
create policy staff_delete on public.leads for delete to authenticated using (public.is_staff(company_id));
revoke all on public.leads from anon;
grant select, update, delete on public.leads to authenticated;

-- access state without the membership check (only used by server code)
create or replace function public.company_access_state_raw(p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
           when s.company_id is null then 'ok'
           when s.status = 'paused' then 'paused'
           when s.status = 'canceled' and coalesce(s.current_period_end, now()) <= now() then 'canceled'
           when s.cancel_at_period_end and s.current_period_end is not null and s.current_period_end <= now() then 'canceled'
           when s.status = 'trialing' and s.trial_ends_at <= now() then 'trial_over'
           else 'ok'
         end
    from (select 1) one left join public.subscriptions s on s.company_id = p_company;
$$;
revoke execute on function public.company_access_state_raw from anon, authenticated, public;

-- 3) what the public page shows: name, logo, languages, operation and the pricing used for a rough estimate
create or replace function public.public_company(p_slug text)
returns table (name text, logo_path text, mode text, default_language text, pricing jsonb, state text)
language sql stable security definer set search_path = '' as $$
  select c.name, c.logo_path, c.mode::text, c.default_language::text, coalesce(c.pricing, '{}'::jsonb), c.state
    from public.companies c
   where c.slug = lower(p_slug)
     and public.company_access_state_raw(c.id) = 'ok';
$$;


-- 4) the form: honeypot, size checks and rate limits (per company, per visitor, per contact)
create or replace function public.submit_lead(p_slug text, p jsonb, p_website text default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare cid uuid; ip text; h text; n int; nm text; ph text; em text; lid uuid;
begin
  if coalesce(p_website, '') <> '' then return true; end if;            -- bots fill the hidden field
  select c.id into cid from public.companies c where c.slug = lower(p_slug);
  if cid is null or public.company_access_state_raw(cid) <> 'ok' then raise exception 'not_found' using errcode = 'P0002'; end if;

  nm := left(trim(coalesce(p->>'name', '')), 120);
  ph := nullif(left(regexp_replace(coalesce(p->>'phone', ''), '[^0-9+() -]', '', 'g'), 40), '');
  em := nullif(left(lower(trim(coalesce(p->>'email', ''))), 160), '');
  if nm = '' or (ph is null and em is null) then raise exception 'lead_contact' using errcode = '22023'; end if;
  if em is not null and em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'lead_contact' using errcode = '22023'; end if;

  begin
    ip := split_part(coalesce((current_setting('request.headers', true)::jsonb)->>'x-forwarded-for', ''), ',', 1);
  exception when others then ip := ''; end;
  h := md5('tidyo-lead:' || coalesce(ip, ''));

  select count(*) into n from public.leads where ip_hash = h and created_at > now() - interval '1 hour';
  if ip <> '' and n >= 3 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select count(*) into n from public.leads where company_id = cid and created_at > now() - interval '1 day';
  if n >= 40 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  select count(*) into n from public.leads where company_id = cid and created_at > now() - interval '1 day'
     and ((ph is not null and phone = ph) or (em is not null and email = em));
  if n >= 2 then return true; end if;                                    -- same person twice a day: keep the first ones

  insert into public.leads (company_id, kind, name, phone, email, language, address, bedrooms, bathrooms, square_feet, frequency, message, estimate_cents, source, ip_hash)
  values (cid,
          case when p->>'kind' = 'commercial' then 'commercial' else 'residential' end,
          nm, ph, em,
          case when p->>'language' in ('en', 'es', 'pt-BR') then p->>'language' else 'en' end,
          nullif(left(trim(coalesce(p->>'address', '')), 240), ''),
          least(greatest((p->>'bedrooms')::numeric, 0), 20)::smallint,
          least(greatest((p->>'bathrooms')::numeric, 0), 20),
          least(greatest((p->>'square_feet')::numeric, 0), 1000000)::int,
          case when p->>'frequency' in ('once', 'weekly', 'biweekly', 'monthly', 'deep', 'move') then p->>'frequency' end,
          nullif(left(trim(coalesce(p->>'message', '')), 1000), ''),
          least(greatest((p->>'estimate_cents')::numeric, 0), 10000000)::int,
          nullif(left(coalesce(p->>'source', ''), 60), ''),
          h)
  returning id into lid;

  perform public.notify_users(public.staff_user_ids(cid), cid, 'lead_new',
    jsonb_build_object('name', nm, 'kind', case when p->>'kind' = 'commercial' then 'commercial' else 'residential' end, 'lead', lid), '/app/clientes?pedidos=1');
  return true;
end $$;

revoke execute on function public.public_company, public.submit_lead from public;
grant execute on function public.public_company, public.submit_lead to anon, authenticated;
