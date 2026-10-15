-- Tidyo · how each person is addressed (Dono/Dona). Null = guess from the first name.
alter table public.memberships add column if not exists gender text check (gender in ('f', 'm'));

-- Owner's name and form of address, for wording like "Falar com a dona" in the field app and portal
create or replace function public.owner_info(cid uuid)
returns table (display_name text, gender text)
language sql stable security definer set search_path = '' as $$
  select m.display_name, m.gender from public.memberships m
   where m.company_id = cid and m.role = 'owner' and m.status = 'active'
     and (public.is_member(cid) or public.is_portal_of_company(cid))
   order by m.created_at limit 1;
$$;
revoke execute on function public.owner_info from anon, public;
grant execute on function public.owner_info to authenticated;
