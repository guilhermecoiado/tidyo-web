-- Tidyo · the client accepts a commercial proposal from the portal
alter table public.contracts
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references auth.users(id) on delete set null;

create or replace function public.accept_proposal(p_contract uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare k record; cname text; st date;
begin
  select * into k from public.contracts where id = p_contract for update;
  if not found or not public.is_portal_client(k.client_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if k.status <> 'proposal' then raise exception 'proposal_not_open' using errcode = 'P0001'; end if;
  st := greatest(coalesce(k.starts_on, current_date), current_date);
  update public.contracts
     set status = 'active', starts_on = st,
         renews_on = case when k.renews_on is null or k.renews_on <= st then (st + interval '1 year')::date else k.renews_on end,
         last_adjusted_on = coalesce(k.last_adjusted_on, st),
         accepted_at = now(), accepted_by = auth.uid(), updated_at = now()
   where id = p_contract;
  select c.name into cname from public.clients c where c.id = k.client_id;
  insert into public.audit_log (company_id, actor_id, action, table_name, row_id, detail)
  values (k.company_id, auth.uid(), 'proposal_accepted', 'contracts', p_contract, jsonb_build_object('monthly_cents', k.monthly_value_cents));
  perform public.notify_users(public.staff_user_ids(k.company_id), k.company_id, 'proposal_accepted',
    jsonb_build_object('client', cname, 'monthly_cents', k.monthly_value_cents, 'contract', p_contract), '/app/contratos');
end $$;
revoke execute on function public.accept_proposal from anon, public;
grant execute on function public.accept_proposal to authenticated;
