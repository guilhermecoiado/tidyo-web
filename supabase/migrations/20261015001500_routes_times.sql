-- Tidyo · office as a route starting point, and applying a route with the new arrival times

alter table public.companies add column if not exists lat double precision;
alter table public.companies add column if not exists lng double precision;

-- Same as apply_route, plus the arrival time of each stop (durations are kept)
create or replace function public.apply_route_times(p_membership uuid, p_date date, p_order uuid[], p_starts timestamptz[],
                                                    p_minutes_before integer, p_minutes_after integer)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; i integer; j public.jobs;
begin
  select company_id into cid from public.memberships where id = p_membership;
  if cid is null or not public.is_staff(cid) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(array_length(p_starts, 1), 0) <> coalesce(array_length(p_order, 1), 0) then raise exception 'not_allowed' using errcode = '42501'; end if;
  for i in 1 .. coalesce(array_length(p_order, 1), 0) loop
    select * into j from public.jobs where id = p_order[i] and company_id = cid and status = 'scheduled';
    if found then
      update public.jobs set route_position = i, scheduled_start = p_starts[i],
             scheduled_end = p_starts[i] + (j.scheduled_end - j.scheduled_start)
       where id = j.id;
    end if;
  end loop;
  insert into public.route_plans (company_id, membership_id, plan_date, job_order, minutes_before, minutes_after, applied_at, applied_by)
  values (cid, p_membership, p_date, p_order, p_minutes_before, p_minutes_after, now(), auth.uid())
  on conflict (membership_id, plan_date) do update set job_order = excluded.job_order, minutes_before = excluded.minutes_before,
    minutes_after = excluded.minutes_after, applied_at = now(), applied_by = auth.uid();
  perform public.notify_users(array[(select user_id from public.memberships where id = p_membership)], cid, 'route_ready',
    jsonb_build_object('date', p_date, 'stops', coalesce(array_length(p_order, 1), 0)), '/dia');
end $$;
revoke execute on function public.apply_route_times from anon, public;
grant execute on function public.apply_route_times to authenticated;

-- Some clients only receive the team after a given time (Rotas respects it)
alter table public.properties add column if not exists arrive_after time;
