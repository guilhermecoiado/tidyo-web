-- Tidyo · access rules (RLS), business rules and helper views
-- Roles: owner, manager (staff) · helper (field) · portal client · platform admin.
-- Default is deny: every table has RLS on, and only the policies below open access.

-- ───────────────────────── Identity helpers ─────────────────────────
-- security definer so policies can look up memberships without recursing into their own RLS.
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_staff(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
                   and m.role in ('owner', 'manager'));
$$;

create or replace function public.is_owner(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active'
                   and m.role = 'owner');
$$;

create or replace function public.my_membership_id(cid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.memberships m
  where m.company_id = cid and m.user_id = auth.uid() and m.status = 'active' limit 1;
$$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

create or replace function public.is_assigned(jid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.job_assignments ja
                 join public.memberships m on m.id = ja.membership_id
                 where ja.job_id = jid and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.is_portal_client(clid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients c
                 where c.id = clid and c.portal_user_id = auth.uid() and c.archived_at is null);
$$;

create or replace function public.is_portal_of_company(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.clients c
                 where c.company_id = cid and c.portal_user_id = auth.uid() and c.archived_at is null);
$$;

create or replace function public.client_of_job(jid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select j.client_id from public.jobs j where j.id = jid;
$$;

create or replace function public.is_participant(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversation_participants p
                 where p.conversation_id = conv and p.user_id = auth.uid());
$$;

-- ───────────────────────── Turn RLS on everywhere ─────────────────────────
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;


-- ───────────────────────── Staff: full access to their company's operational data ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'clients','properties','checklist_templates','checklist_template_items','services','contracts',
    'recurrences','jobs','job_assignments','job_checklist_items','job_photos','job_issues',
    'time_entries','tips','expenses','member_pay_rates','invoices','invoice_lines','payments',
    'inspections','supply_items','route_plans','conversations']
  loop
    execute format($f$
      create policy staff_all on public.%1$I for all to authenticated
        using (public.is_staff(company_id)) with check (public.is_staff(company_id))$f$, t);
  end loop;
end $$;

-- ───────────────────────── Profiles ─────────────────────────
create policy own_profile_select on public.profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, language)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce((new.raw_user_meta_data ->> 'language')::public.app_language, 'en'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Companies, memberships, subscription ─────────────────────────
create policy company_select on public.companies for select to authenticated
  using (deleted_at is null and (
    public.is_member(id)
    or public.is_portal_of_company(id)
    or public.is_platform_admin()));
create policy company_update on public.companies for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
-- companies are created only through create_company()

create policy membership_select on public.memberships for select to authenticated
  using (public.is_staff(company_id) or user_id = auth.uid() or public.is_platform_admin());
create policy membership_write on public.memberships for all to authenticated
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));

create policy subscription_select on public.subscriptions for select to authenticated
  using (public.is_owner(company_id) or public.is_platform_admin());
-- subscription rows are written only by the Stripe webhook (service role)

-- Only the owner can create, promote or change owners/managers; managers handle helpers.
create or replace function public.memberships_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;           -- service role / server code
  if current_setting('tidyo.creating_company', true) = 'on' then return new; end if;
  if public.is_owner(coalesce(new.company_id, old.company_id)) then
    if tg_op = 'UPDATE' and old.role = 'owner' and old.user_id = auth.uid()
       and (new.role <> 'owner' or new.status <> 'active') then
      raise exception 'owner_cannot_demote_self' using errcode = 'P0001';
    end if;
    return coalesce(new, old);
  end if;
  if (tg_op in ('UPDATE', 'DELETE') and old.role in ('owner', 'manager'))
     or (tg_op in ('INSERT', 'UPDATE') and new.role in ('owner', 'manager')) then
    raise exception 'only_owner_manages_managers' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger memberships_guard before insert or update or delete on public.memberships
  for each row execute function public.memberships_guard();

-- Plan limits: users per plan and houses on Essencial; contracts per Comercial tier.
create or replace function public.plan_limits(cid uuid,
  out max_users integer, out max_houses integer, out max_contracts integer, out allows_residential boolean, out allows_commercial boolean)
language sql stable security definer set search_path = '' as $$
  select case s.plan when 'essencial' then 3 else 15 end,
         case s.plan when 'essencial' then 30 else null end,
         case when s.plan = 'comercial' or s.has_commercial then
           case s.commercial_tier when 1 then 5 when 2 then 15 when 3 then 40 else null end
         else 0 end,
         s.plan in ('essencial', 'pro'),
         s.plan = 'comercial' or s.has_commercial
  from public.subscriptions s where s.company_id = cid;
$$;

create or replace function public.enforce_plan_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare l record; n integer;
begin
  select * into l from public.plan_limits(new.company_id);
  if not found then return new; end if;

  if tg_table_name = 'memberships' then
    if new.status in ('invited', 'active') then
      select count(*) into n from public.memberships
       where company_id = new.company_id and status in ('invited', 'active') and id <> new.id;
      if n + 1 > l.max_users then
        raise exception 'plan_limit:users:%', l.max_users using errcode = 'P0001';
      end if;
    end if;

  elsif tg_table_name = 'clients' then
    if new.kind = 'residential' and not l.allows_residential then
      raise exception 'plan_limit:residential_not_in_plan' using errcode = 'P0001';
    elsif new.kind = 'commercial' and not l.allows_commercial then
      raise exception 'plan_limit:commercial_not_in_plan' using errcode = 'P0001';
    end if;

  elsif tg_table_name = 'properties' then
    if l.max_houses is not null and new.archived_at is null then
      select count(*) into n from public.properties p join public.clients c on c.id = p.client_id
       where p.company_id = new.company_id and p.archived_at is null and c.kind = 'residential' and p.id <> new.id;
      if n + 1 > l.max_houses then
        raise exception 'plan_limit:houses:%', l.max_houses using errcode = 'P0001';
      end if;
    end if;

  elsif tg_table_name = 'contracts' then
    if new.status = 'active' and l.max_contracts is not null then
      select count(*) into n from public.contracts
       where company_id = new.company_id and status = 'active' and id <> new.id;
      if n + 1 > l.max_contracts then
        raise exception 'plan_limit:contracts:%', l.max_contracts using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger plan_limits before insert or update of status on public.memberships
  for each row execute function public.enforce_plan_limits();
create trigger plan_limits before insert or update of kind on public.clients
  for each row execute function public.enforce_plan_limits();
create trigger plan_limits before insert or update of archived_at on public.properties
  for each row execute function public.enforce_plan_limits();
create trigger plan_limits before insert or update of status on public.contracts
  for each row execute function public.enforce_plan_limits();

-- Signup: creates the company, the owner membership and a 14-day trial in one step.
create or replace function public.create_company(
  p_name text, p_mode public.company_mode default 'residential', p_language public.app_language default 'en',
  p_timezone text default 'America/New_York', p_solo boolean default false, p_utm jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; uname text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform set_config('tidyo.creating_company', 'on', true);
  select coalesce(nullif(full_name, ''), 'Owner') into uname from public.profiles where id = auth.uid();
  insert into public.companies (name, mode, default_language, timezone, solo)
    values (p_name, p_mode, p_language, p_timezone, p_solo) returning id into cid;
  insert into public.subscriptions (company_id, plan, has_commercial, commercial_tier, utm)
    values (cid,
            case when p_mode = 'commercial' then 'comercial'::public.plan_code else 'pro'::public.plan_code end,
            p_mode <> 'residential',
            case when p_mode = 'residential' then null else 1 end,
            coalesce(p_utm, '{}'::jsonb));
  insert into public.memberships (company_id, user_id, role, status, display_name, language)
    values (cid, auth.uid(), 'owner', 'active', coalesce(uname, 'Owner'), p_language);
  perform set_config('tidyo.creating_company', 'off', true);
  return cid;
end $$;
grant execute on function public.create_company to authenticated;

-- Invite: the link carries a random token; only its hash is stored.
create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  update public.memberships
     set user_id = auth.uid(), status = 'active', invite_token_hash = null, invite_expires_at = null
   where invite_token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and status = 'invited' and invite_expires_at > now()
  returning id into mid;
  if mid is null then raise exception 'invite_invalid_or_expired' using errcode = 'P0001'; end if;
  return mid;
end $$;
grant execute on function public.accept_invite to authenticated;

-- Colleague names for chat and assignment pickers, without pay or invite data.
create or replace function public.team_directory(cid uuid)
returns table (membership_id uuid, display_name text, role public.member_role, language public.app_language)
language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.role, m.language from public.memberships m
  where m.company_id = cid and m.status = 'active' and public.is_member(cid)
  order by m.display_name;
$$;
grant execute on function public.team_directory to authenticated;

-- ───────────────────────── Field team (helpers) ─────────────────────────
-- Helpers never read the jobs table directly (it holds prices and internal notes):
-- they read helper_jobs() and move a job forward with job_progress().
create or replace function public.job_progress(p_job uuid, p_status public.job_status, p_note text default null,
                                               p_signature_path text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_job for update;
  if not found or not (public.is_assigned(p_job) or public.is_staff(j.company_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public.is_staff(j.company_id) and not (
       (j.status = 'scheduled' and p_status = 'in_progress') or (j.status = 'in_progress' and p_status = 'completed')) then
    raise exception 'status_change_not_allowed' using errcode = '42501';
  end if;
  update public.jobs
     set status = p_status,
         completion_note = coalesce(nullif(trim(p_note), ''), completion_note),
         signature_path = coalesce(p_signature_path, signature_path)
   where id = p_job;
end $$;
grant execute on function public.job_progress to authenticated;

-- Completion opens the 24h rating window; without a rating it auto-approves as positive.
create or replace function public.jobs_lifecycle() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'in_progress' and old.status = 'scheduled' and new.started_at is null then
    new.started_at := now();
  end if;
  if new.status = 'completed' and old.status <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.rating_due_at := new.completed_at + interval '24 hours';
  end if;
  if new.status = 'canceled' and old.status <> 'canceled' then
    new.canceled_at := now();
  end if;
  return new;
end $$;
create trigger jobs_lifecycle before update of status on public.jobs
  for each row execute function public.jobs_lifecycle();

create policy helper_assignments_select on public.job_assignments for select to authenticated
  using (public.is_assigned(job_id));

create policy helper_checklist_select on public.job_checklist_items for select to authenticated
  using (public.is_assigned(job_id));
create policy helper_checklist_update on public.job_checklist_items for update to authenticated
  using (public.is_assigned(job_id)) with check (public.is_assigned(job_id));

create or replace function public.checklist_field_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_staff(old.company_id) then return new; end if;
  if new.job_id <> old.job_id or new.room <> old.room or new.task <> old.task or new.position <> old.position then
    raise exception 'field_update_not_allowed' using errcode = '42501';
  end if;
  new.done_by := case when new.done_at is null then null else public.my_membership_id(old.company_id) end;
  return new;
end $$;
create trigger checklist_field_guard before update on public.job_checklist_items
  for each row execute function public.checklist_field_guard();

create policy helper_photos_select on public.job_photos for select to authenticated
  using (public.is_assigned(job_id));
create policy helper_photos_insert on public.job_photos for insert to authenticated
  with check (public.is_assigned(job_id) and uploaded_by = public.my_membership_id(company_id));

create policy helper_issues_select on public.job_issues for select to authenticated
  using (public.is_assigned(job_id));
create policy helper_issues_insert on public.job_issues for insert to authenticated
  with check (public.is_assigned(job_id) and reported_by = public.my_membership_id(company_id));


-- Time: helpers clock themselves in and out; edits after closing go through a manager.
create policy own_time_select on public.time_entries for select to authenticated
  using (membership_id = public.my_membership_id(company_id));
create policy own_time_insert on public.time_entries for insert to authenticated
  with check (membership_id = public.my_membership_id(company_id) and approval = 'pending'
              and (job_id is null or public.is_assigned(job_id)));
create policy own_time_update on public.time_entries for update to authenticated
  using (membership_id = public.my_membership_id(company_id) and clock_out is null)
  with check (membership_id = public.my_membership_id(company_id) and approval = 'pending');

create or replace function public.time_field_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_staff(new.company_id) then return new; end if;
  if tg_op = 'INSERT' then
    new.source := case when new.source = 'offline_sync' then 'offline_sync' else 'app' end;
    if new.clock_in > now() + interval '5 minutes' then
      raise exception 'clock_in_in_future' using errcode = 'P0001';
    end if;
  else
    if new.clock_in <> old.clock_in or new.membership_id <> old.membership_id then
      raise exception 'field_update_not_allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger time_field_guard before insert or update on public.time_entries
  for each row execute function public.time_field_guard();

create policy own_tips_select on public.tips for select to authenticated
  using (membership_id = public.my_membership_id(company_id));

-- Field expenses: the helper submits with a receipt; the owner approves and reimburses.
create policy own_expenses_select on public.expenses for select to authenticated
  using (membership_id = public.my_membership_id(company_id));
create policy own_expenses_insert on public.expenses for insert to authenticated
  with check (membership_id = public.my_membership_id(company_id) and status = 'pending'
              and reimbursable and reviewed_by is null);

create policy own_route_select on public.route_plans for select to authenticated
  using (membership_id = public.my_membership_id(company_id));

-- What the helper's "Meu dia" reads: only her jobs, only the fields she needs (no prices, no client contact, no internal notes).
-- Exposed as a function (not a view) so it runs with fixed privileges and always filters by the caller.
create or replace function public.helper_jobs()
returns table (job_id uuid, company_id uuid, status public.job_status, scheduled_start timestamptz, scheduled_end timestamptz,
  route_position smallint, client_notes text, started_at timestamptz, completed_at timestamptz,
  client_name text, client_language public.app_language,
  address_line1 text, address_line2 text, city text, state text, zip text, lat double precision, lng double precision,
  access_instructions text, pets text, special_instructions text, service_name text, membership_id uuid, is_lead boolean)
language sql stable security definer set search_path = '' as $$
  select j.id as job_id, j.company_id, j.status, j.scheduled_start, j.scheduled_end, j.route_position,
         j.client_notes, j.started_at, j.completed_at,
         c.name as client_name, c.language as client_language,
         p.address_line1, p.address_line2, p.city, p.state, p.zip, p.lat, p.lng,
         p.access_instructions, p.pets, p.special_instructions,
         s.name as service_name, ja.membership_id, ja.is_lead
  from public.jobs j
  join public.job_assignments ja on ja.job_id = j.id
  join public.memberships m on m.id = ja.membership_id and m.user_id = auth.uid() and m.status = 'active'
  join public.clients c on c.id = j.client_id
  join public.properties p on p.id = j.property_id
  left join public.services s on s.id = j.service_id
  order by j.scheduled_start, j.route_position;
$$;

-- ───────────────────────── Client portal ─────────────────────────
create policy portal_properties_select on public.properties for select to authenticated using (public.is_portal_client(client_id));
create policy portal_contracts_select on public.contracts for select to authenticated using (public.is_portal_client(client_id));
create policy portal_invoices_select on public.invoices for select to authenticated
  using (status <> 'draft' and public.is_portal_client(client_id));
create policy portal_lines_select on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.status <> 'draft' and public.is_portal_client(i.client_id)));
create policy portal_payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and public.is_portal_client(i.client_id)));
create policy portal_checklist_select on public.job_checklist_items for select to authenticated
  using (public.is_portal_client(public.client_of_job(job_id)));
create policy portal_photos_select on public.job_photos for select to authenticated
  using (kind in ('before', 'after') and public.is_portal_client(public.client_of_job(job_id)));
create policy portal_inspections_select on public.inspections for select to authenticated
  using (shared_with_client and exists (select 1 from public.contracts k where k.id = contract_id and public.is_portal_client(k.client_id)));

-- The portal reads its own record and visits through these views, which leave out internal notes and pay.
create or replace function public.portal_me()
returns table (client_id uuid, company_id uuid, name text, contact_name text, email text, phone text,
  language public.app_language, no_translate boolean, cancellation_policy_accepted_at timestamptz,
  company_name text, company_logo text)
language sql stable security definer set search_path = '' as $$
  select c.id as client_id, c.company_id, c.name, c.contact_name, c.email, c.phone, c.language, c.no_translate,
         c.cancellation_policy_accepted_at, co.name as company_name, co.logo_path as company_logo
  from public.clients c join public.companies co on co.id = c.company_id
  where c.portal_user_id = auth.uid() and c.archived_at is null;
$$;

create or replace function public.portal_jobs()
returns table (id uuid, company_id uuid, client_id uuid, property_id uuid, status public.job_status,
  scheduled_start timestamptz, scheduled_end timestamptz, client_notes text, completed_at timestamptz,
  completion_note text, rating_status public.rating_status, rating smallint, rating_comment text,
  rating_due_at timestamptz, price_cents integer)
language sql stable security definer set search_path = '' as $$
  select j.id, j.company_id, j.client_id, j.property_id, j.status, j.scheduled_start, j.scheduled_end, j.client_notes,
         j.completed_at, j.completion_note, j.rating_status, j.rating, j.rating_comment, j.rating_due_at, j.price_cents
  from public.jobs j
  where public.is_portal_client(j.client_id)
  order by j.scheduled_start desc;
$$;

create or replace function public.rate_job(p_job uuid, p_rating smallint, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.jobs;
begin
  select * into j from public.jobs where id = p_job for update;
  if not found or not public.is_portal_client(j.client_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if j.status <> 'completed' or j.rating_status <> 'pending' or now() > j.rating_due_at then
    raise exception 'rating_window_closed' using errcode = 'P0001';
  end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_rating' using errcode = '22023'; end if;
  update public.jobs set rating = p_rating, rating_comment = nullif(trim(p_comment), ''), rating_status = 'rated'
   where id = p_job;
end $$;
grant execute on function public.rate_job to authenticated;

-- Run every 15 min (pg_cron): past the 24h window, the visit counts as approved with no notes.
create or replace function public.auto_approve_ratings() returns integer
language sql security definer set search_path = '' as $$
  with done as (
    update public.jobs set rating_status = 'auto_approved'
     where status = 'completed' and rating_status = 'pending' and rating_due_at <= now()
    returning 1)
  select count(*)::integer from done;
$$;
revoke execute on function public.auto_approve_ratings from authenticated, public;

-- ───────────────────────── Invoices and payments ─────────────────────────
create or replace function public.invoice_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n integer; prefix text;
begin
  if new.number is null or new.number = '' then
    update public.companies set next_invoice_no = next_invoice_no + 1
     where id = new.company_id returning next_invoice_no - 1, invoice_prefix into n, prefix;
    new.number := prefix || '-' || n;
  end if;
  return new;
end $$;
create trigger invoice_number before insert on public.invoices
  for each row execute function public.invoice_number();

create or replace function public.invoice_recalc() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if tg_table_name = 'invoice_lines' then
    update public.invoices
       set subtotal_cents = coalesce((select sum(amount_cents) from public.invoice_lines where invoice_id = inv), 0)
     where id = inv;
  else
    update public.invoices i
       set paid_cents = coalesce((select sum(amount_cents) from public.payments where invoice_id = inv), 0)
     where i.id = inv;
    update public.invoices
       set status = case when paid_cents >= total_cents and total_cents > 0 then 'paid'::public.invoice_status
                         when status = 'paid' and paid_cents < total_cents then 'open'::public.invoice_status
                         else status end
     where id = inv;
  end if;
  return null;
end $$;
create trigger invoice_lines_recalc after insert or update or delete on public.invoice_lines
  for each row execute function public.invoice_recalc();
create trigger payments_recalc after insert or update or delete on public.payments
  for each row execute function public.invoice_recalc();

-- ───────────────────────── Chat ─────────────────────────
create policy conv_participant_select on public.conversations for select to authenticated
  using (public.is_participant(id));
create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id) or public.is_staff(company_id));
create policy participants_staff_write on public.conversation_participants for all to authenticated
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));
create policy participants_mark_read on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_select on public.messages for select to authenticated
  using (public.is_participant(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (public.is_participant(conversation_id) and sender_id = auth.uid() and translations = '{}'::jsonb);
-- translations are filled by the translation worker (service role)

-- ───────────────────────── Notifications, push, deliveries ─────────────────────────
create policy own_notifications on public.notifications for select to authenticated using (user_id = auth.uid());
create policy own_notifications_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy own_push on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy staff_deliveries on public.message_deliveries for select to authenticated using (public.is_staff(company_id));

-- ───────────────────────── Tidy ─────────────────────────
create policy staff_insights_select on public.tidy_insights for select to authenticated using (public.is_staff(company_id));
create policy staff_insights_update on public.tidy_insights for update to authenticated
  using (public.is_staff(company_id)) with check (public.is_staff(company_id));
-- insights are generated by the nightly job (service role)

-- Profit per client over the last 90 days: revenue − labour − direct expenses.
create or replace view public.v_client_profit_90d with (security_invoker = true) as
  with jobs90 as (
    select j.* from public.jobs j
    where j.status = 'completed' and j.completed_at >= now() - interval '90 days'),
  labour as (
    select j.client_id,
           sum(extract(epoch from (least(t.clock_out, now()) - t.clock_in)) / 3600.0 * coalesce(r.hourly_cents, 0)) as cents
    from jobs90 j
    join public.time_entries t on t.job_id = j.id and t.clock_out is not null
    left join public.member_pay_rates r on r.membership_id = t.membership_id
    group by j.client_id),
  costs as (
    select e.client_id, sum(e.amount_cents) as cents from public.expenses e
    where e.client_id is not null and e.status in ('approved', 'reimbursed')
      and e.incurred_on >= current_date - 90
    group by e.client_id)
  select c.id as client_id, c.company_id, c.name,
         coalesce(sum(j.price_cents), 0)::bigint as revenue_cents,
         coalesce(max(l.cents), 0)::bigint as labour_cents,
         coalesce(max(k.cents), 0)::bigint as expense_cents,
         (coalesce(sum(j.price_cents), 0) - coalesce(max(l.cents), 0) - coalesce(max(k.cents), 0))::bigint as profit_cents,
         count(j.id) as visits
  from public.clients c
  left join jobs90 j on j.client_id = c.id
  left join labour l on l.client_id = c.id
  left join costs k on k.client_id = c.id
  group by c.id, c.company_id, c.name;
grant select on public.v_client_profit_90d to authenticated;

-- ───────────────────────── Platform: ads, broadcasts, support ─────────────────────────
create policy admin_all on public.platform_admins for select to authenticated using (public.is_platform_admin());
create policy admin_ads on public.ad_campaigns for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy running_ads_select on public.ad_campaigns for select to authenticated
  using (status = 'running' and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
create policy admin_ad_events on public.ad_events for select to authenticated using (public.is_platform_admin());
create policy own_ad_events_insert on public.ad_events for insert to authenticated
  with check (user_id = auth.uid() and (company_id is null or public.is_member(company_id)));

create policy admin_broadcasts on public.broadcasts for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy owner_broadcasts on public.broadcasts for all to authenticated
  using (company_id is not null and public.is_staff(company_id))
  with check (company_id is not null and public.is_staff(company_id) and audience in ('team', 'clients', 'everyone'));

-- Push to team or clients stays off until the owner turns it on.
create or replace function public.broadcast_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.companies;
begin
  if new.company_id is null then return new; end if;
  select * into c from public.companies where id = new.company_id;
  if new.audience in ('team', 'everyone') and not c.allow_push_team then
    raise exception 'push_team_disabled' using errcode = 'P0001';
  end if;
  if new.audience in ('clients', 'everyone') and not c.allow_push_clients then
    raise exception 'push_clients_disabled' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger broadcast_guard before insert or update on public.broadcasts
  for each row execute function public.broadcast_guard();

create policy ticket_select on public.support_tickets for select to authenticated
  using (opened_by = auth.uid() or public.is_owner(company_id) or public.is_platform_admin());
create policy ticket_insert on public.support_tickets for insert to authenticated
  with check (opened_by = auth.uid() and (company_id is null or public.is_member(company_id))
              and status = 'open' and assigned_to is null);
create policy ticket_admin_update on public.support_tickets for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy ticket_msg_select on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id
                 and (t.opened_by = auth.uid() or public.is_owner(t.company_id) or public.is_platform_admin())));
create policy ticket_msg_insert on public.support_messages for insert to authenticated
  with check (sender_id = auth.uid() and (
    (not from_staff and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.opened_by = auth.uid()))
    or (from_staff and public.is_platform_admin())));

-- ───────────────────────── Audit log ─────────────────────────
create policy owner_audit_select on public.audit_log for select to authenticated
  using (public.is_owner(company_id) or public.is_platform_admin());

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (company_id, actor_id, action, table_name, row_id, detail)
  values ((r ->> 'company_id')::uuid, auth.uid(), lower(tg_op), tg_table_name,
          coalesce(r ->> 'id', r ->> 'membership_id')::uuid,
          case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
               else to_jsonb(coalesce(new, old)) end);
  return null;
end $$;
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function public.audit();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.audit();
create trigger audit_invoices after update of status or delete on public.invoices for each row execute function public.audit();
create trigger audit_expenses after update of status on public.expenses for each row execute function public.audit();
create trigger audit_pay_rates after insert or update or delete on public.member_pay_rates for each row execute function public.audit();
create trigger audit_time_edits after update on public.time_entries for each row
  when (old.clock_out is not null) execute function public.audit();

-- ───────────────────────── Grants ─────────────────────────
-- The public site is static; signed-out visitors get nothing from the database.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, authenticated, public;
grant execute on function public.is_member, public.is_staff, public.is_owner, public.my_membership_id,
  public.is_platform_admin, public.is_assigned, public.is_portal_client, public.is_portal_of_company,
  public.client_of_job, public.is_participant, public.plan_limits,
  public.create_company, public.accept_invite, public.team_directory, public.job_progress, public.rate_job,
  public.helper_jobs, public.portal_me, public.portal_jobs
  to authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;
