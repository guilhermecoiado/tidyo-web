-- Tidyo · whether a company can use the app right now (trial over, paused or canceled → read-only lock screen)
create or replace function public.company_access_state(p_company uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
           when s.company_id is null then 'ok'
           when s.status = 'paused' then 'paused'
           when s.status = 'canceled' and coalesce(s.current_period_end, now()) <= now() then 'canceled'
           when s.cancel_at_period_end and s.current_period_end is not null and s.current_period_end <= now() then 'canceled'
           when s.status = 'trialing' and s.trial_ends_at <= now() then 'trial_over'
           else 'ok'
         end
    from (select 1) one
    left join public.subscriptions s on s.company_id = p_company
   where public.is_member(p_company) or public.is_platform_admin();
$$;
revoke execute on function public.company_access_state from anon, public;
grant execute on function public.company_access_state to authenticated;
