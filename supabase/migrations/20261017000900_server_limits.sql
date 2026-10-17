-- Tidyo · rules the app shows are also enforced in the database
-- 1) a locked account (trial over, paused, canceled) cannot change its data through the API
-- 2) Essencial after the trial: no client portal invites and no saved routes (Pro features)

create or replace function public.enforce_company_active() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  -- server code (cron, webhooks, edge functions with the service key) and Tidyo staff are never blocked
  if auth.uid() is null or public.is_platform_admin() then return coalesce(new, old); end if;
  -- internal steps of company creation and closing (close_company cancels first, then removes the team)
  if current_setting('tidyo.creating_company', true) = 'on' then return coalesce(new, old); end if;
  cid := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  if cid is not null and public.company_access_state_raw(cid) <> 'ok' then
    raise exception 'account_locked' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke execute on function public.enforce_company_active from anon, authenticated, public;

-- every table that holds company data, except what a locked owner still needs:
-- notifications (mark as read), support, push devices, subscription/plan, audit trail and the lead form (server only)
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'broadcasts', 'checklist_template_items', 'checklist_templates', 'client_requests', 'clients', 'contracts',
    'conversation_participants', 'conversations', 'expenses', 'inspections', 'invoice_lines', 'invoices',
    'job_assignments', 'job_checklist_items', 'job_issues', 'job_photos', 'jobs', 'leads', 'member_pay_rates',
    'memberships', 'messages', 'payments', 'properties', 'recurrences', 'route_plans', 'service_extras', 'services',
    'supply_items', 'team_invite_links', 'tidy_insights', 'time_entries', 'tips']
  loop
    if to_regclass('public.' || tbl) is not null then
      execute format('create trigger zz_company_active before insert or update or delete on public.%I for each row execute function public.enforce_company_active()', tbl);
    end if;
  end loop;
end $$;

-- Pro features: true on Pro, Comercial, any trial, or without a subscription row
create or replace function public.plan_has_pro(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.plan <> 'essencial' or s.status = 'trialing' from public.subscriptions s where s.company_id = p_company), true);
$$;
revoke execute on function public.plan_has_pro from anon, public;
grant execute on function public.plan_has_pro to authenticated;

create or replace function public.enforce_pro_features() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_platform_admin() then return new; end if;
  if tg_table_name = 'clients' then
    if new.portal_invite_hash is not null and new.portal_invite_hash is distinct from old.portal_invite_hash
       and not public.plan_has_pro(new.company_id) then
      raise exception 'plan_limit:portal_not_in_plan' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'route_plans' then
    if not public.plan_has_pro(new.company_id) then
      raise exception 'plan_limit:routes_not_in_plan' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.enforce_pro_features from anon, authenticated, public;
create trigger pro_portal_invite before update of portal_invite_hash on public.clients for each row execute function public.enforce_pro_features();
create trigger pro_routes before insert or update on public.route_plans for each row execute function public.enforce_pro_features();
