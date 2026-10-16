-- Tidyo · what a helper sees about her own pay and rating (rates stay readable only by the office)
create or replace function public.my_pay_weeks(p_weeks integer default 6)
returns table (week_start date, minutes integer, jobs_done integer, pay_cents bigint, tips_cents bigint, reimb_cents bigint)
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.id from public.memberships m where m.user_id = auth.uid() and m.status = 'active' order by m.created_at limit 1
  ), r as (
    select coalesce(pr.hourly_cents, 0) as h, pr.per_job_cents as pj from me left join public.member_pay_rates pr on pr.membership_id = me.id
  ), w as (
    select (date_trunc('week', now())::date - 7 * g)::date as ws from generate_series(0, greatest(1, least(coalesce(p_weeks, 6), 26)) - 1) as g
  ), s as (
    select w.ws,
      coalesce((select sum(extract(epoch from (coalesce(te.clock_out, now()) - te.clock_in)) / 60)::int
                  from public.time_entries te join me on te.membership_id = me.id
                 where te.clock_in >= w.ws and te.clock_in < w.ws + 7), 0) as minutes,
      coalesce((select count(*)::int from public.jobs j join public.job_assignments ja on ja.job_id = j.id join me on ja.membership_id = me.id
                 where j.status = 'completed' and j.completed_at >= w.ws and j.completed_at < w.ws + 7), 0) as jobs_done,
      coalesce((select sum(t.amount_cents) from public.tips t join me on t.membership_id = me.id
                 where t.received_at >= w.ws and t.received_at < w.ws + 7), 0)::bigint as tips,
      coalesce((select sum(e.amount_cents) from public.expenses e join me on e.membership_id = me.id
                 where e.reimbursable and e.status = 'approved' and e.incurred_on >= w.ws and e.incurred_on < w.ws + 7), 0)::bigint as reimb
    from w
  )
  select s.ws, s.minutes, s.jobs_done,
         (case when r.pj is not null then s.jobs_done::bigint * r.pj else round(s.minutes * r.h / 60.0)::bigint end),
         s.tips, s.reimb
    from s cross join r
   where exists (select 1 from me)
   order by s.ws desc;
$$;

create or replace function public.my_rating()
returns table (avg_rating numeric, rated integer)
language sql stable security definer set search_path = '' as $$
  select round(avg(x.rating)::numeric, 1), count(*)::int from (
    select j.rating from public.jobs j
      join public.job_assignments ja on ja.job_id = j.id
      join public.memberships m on m.id = ja.membership_id and m.user_id = auth.uid()
     where j.rating is not null order by j.completed_at desc nulls last limit 30) x;
$$;

revoke execute on function public.my_pay_weeks, public.my_rating from anon, public;
grant execute on function public.my_pay_weeks, public.my_rating to authenticated;
