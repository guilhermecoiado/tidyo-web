-- Tidyo · plan changes and cancellation by the owner (no card billing yet: Stripe comes last)

create or replace function public.set_plan(p_company uuid, p_plan public.plan_code, p_commercial boolean, p_interval public.billing_interval)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_company) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.subscriptions
     set plan = p_plan,
         has_commercial = case when p_plan = 'comercial' then true else p_commercial end,
         commercial_tier = case when p_plan = 'comercial' or p_commercial then coalesce(commercial_tier, 1) else null end,
         interval = p_interval, cancel_at_period_end = false,
         status = case when status = 'canceled' then 'trialing'::public.sub_status else status end,
         updated_at = now()
   where company_id = p_company;
end $$;

create or replace function public.cancel_subscription(p_company uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_company) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.subscriptions set cancel_at_period_end = true, updated_at = now() where company_id = p_company;
  insert into public.audit_log (company_id, actor_id, action, table_name, row_id, detail)
  values (p_company, auth.uid(), 'subscription_cancel', 'subscriptions', p_company, jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));
end $$;

-- What the plan allows and what is in use, for "Uso do plano"
create or replace function public.plan_usage(p_company uuid)
returns table (houses integer, max_houses integer, users integer, max_users integer, contracts integer, max_contracts integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::int from public.properties p join public.clients c on c.id = p.client_id where p.company_id = p_company and p.archived_at is null and c.archived_at is null and c.kind = 'residential'),
         l.max_houses,
         (select count(*)::int from public.memberships m where m.company_id = p_company and m.status in ('active', 'invited')),
         l.max_users,
         (select count(*)::int from public.contracts k where k.company_id = p_company and k.status = 'active'),
         l.max_contracts
    from public.plan_limits(p_company) l
   where public.is_staff(p_company);
$$;

revoke execute on function public.set_plan, public.cancel_subscription, public.plan_usage from anon, public;
grant execute on function public.set_plan, public.cancel_subscription, public.plan_usage to authenticated;
