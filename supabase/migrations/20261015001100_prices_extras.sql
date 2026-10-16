-- Tidyo · price table: cleaning types (services) and extras, seeded for every new company

create table if not exists public.service_extras (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  minutes     integer not null default 0 check (minutes >= 0),
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists service_extras_company on public.service_extras (company_id) where active;
alter table public.service_extras enable row level security;
create policy staff_all on public.service_extras for all to authenticated
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));
grant select, insert, update, delete on public.service_extras to authenticated;

-- what was added to a visit, frozen at booking time (name and price)
alter table public.jobs add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.recurrences add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.services add column if not exists position integer not null default 0;

create or replace function public.seed_prices(cid uuid, lang public.app_language, mode public.company_mode)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if mode <> 'commercial' and not exists (select 1 from public.services where company_id = cid) then
    insert into public.services (company_id, name, kind, default_price_cents, default_duration_min, position)
    select cid, n, 'residential', p, d, i from (values
      (1, case lang when 'en' then 'Standard' when 'es' then 'Estándar' else 'Standard' end, 16000, 120),
      (2, case lang when 'es' then 'Limpieza profunda' else 'Deep clean' end, 28000, 210),
      (3, case lang when 'es' then 'Mudanza' else 'Move-in/out' end, 34000, 240),
      (4, case lang when 'en' then 'Post-construction' when 'es' then 'Post-obra' else 'Pós-obra' end, 52000, 300)
    ) v(i, n, p, d);
  end if;
  if mode <> 'commercial' and not exists (select 1 from public.service_extras where company_id = cid) then
    insert into public.service_extras (company_id, name, price_cents, minutes, position)
    select cid, n, p, m, i from (values
      (1, case lang when 'en' then 'Inside the oven' when 'es' then 'Dentro del horno' else 'Dentro do forno' end, 2500, 30),
      (2, case lang when 'en' then 'Inside the fridge' when 'es' then 'Dentro del refrigerador' else 'Dentro da geladeira' end, 2500, 30),
      (3, case lang when 'en' then 'Interior windows' when 'es' then 'Ventanas interiores' else 'Janelas internas' end, 4000, 45)
    ) v(i, n, p, m);
  end if;
end $$;
revoke execute on function public.seed_prices from anon, authenticated, public;

create or replace function public.on_company_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_prices(new.id, new.default_language, new.mode);
  return null;
end $$;
revoke execute on function public.on_company_created from anon, authenticated, public;
create trigger on_company_created after insert on public.companies for each row execute function public.on_company_created();

-- existing companies get the same starting table
select public.seed_prices(id, default_language, mode) from public.companies where deleted_at is null;
