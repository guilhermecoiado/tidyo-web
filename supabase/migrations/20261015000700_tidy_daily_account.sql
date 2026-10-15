-- Tidyo · Tidy's morning review and account closing

-- Every morning: one notification per owner/manager summarising what needs attention.
create or replace function public.tidy_daily() returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; d jsonb; total integer; n integer := 0;
begin
  for c in select id from public.companies where deleted_at is null loop
    d := jsonb_build_object(
      'unassigned', (select count(*) from public.jobs j where j.company_id = c.id and j.status = 'scheduled'
                       and j.scheduled_start between now() and now() + interval '2 days'
                       and not exists (select 1 from public.job_assignments a where a.job_id = j.id)),
      'overdue', (select count(*) from public.invoices i where i.company_id = c.id and i.status = 'open' and i.due_on < current_date),
      'expenses', (select count(*) from public.expenses e where e.company_id = c.id and e.status = 'pending'),
      'renewals', (select count(*) from public.contracts k where k.company_id = c.id and k.status = 'active' and k.renews_on between current_date and current_date + 30),
      'issues', (select count(*) from public.job_issues x where x.company_id = c.id and x.resolved_at is null),
      'today', (select count(*) from public.jobs j where j.company_id = c.id and j.status = 'scheduled' and j.scheduled_start::date = current_date)
    );
    total := (d->>'unassigned')::int + (d->>'overdue')::int + (d->>'expenses')::int + (d->>'renewals')::int + (d->>'issues')::int;
    if total > 0 then
      perform public.notify_users(public.staff_user_ids(c.id), c.id, 'tidy_daily', d || jsonb_build_object('total', total), '/app');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.tidy_daily from anon, authenticated, public;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tidyo-tidy-daily', '0 10 * * *', 'select public.tidy_daily()');  -- 10:00 UTC ≈ 6am Eastern
  end if;
end $$;

-- Owner closes the business: data is hidden at once and kept 30 days for export, then purged by support.
create or replace function public.close_company(p_company uuid, p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner(p_company) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if upper(trim(p_confirm)) not in ('EXCLUIR', 'DELETE', 'ELIMINAR') then raise exception 'confirm_text' using errcode = 'P0001'; end if;
  update public.companies set deleted_at = now() where id = p_company;
  update public.subscriptions set status = 'canceled', cancel_at_period_end = true where company_id = p_company;
  perform set_config('tidyo.creating_company', 'on', true);
  update public.memberships set status = 'removed' where company_id = p_company;
  perform set_config('tidyo.creating_company', 'off', true);
  insert into public.audit_log (company_id, actor_id, action, table_name, row_id) values (p_company, auth.uid(), 'close_company', 'companies', p_company);
end $$;
revoke execute on function public.close_company from anon, public;
grant execute on function public.close_company to authenticated;
