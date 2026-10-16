-- Tidyo · the extras the client asked for, shown to the assigned helper on the checklist
create or replace function public.job_extras(p_job uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_agg(e ->> 'name') from public.jobs j, jsonb_array_elements(j.extras) e
                    where j.id = p_job and (public.is_assigned(p_job) or public.is_staff(j.company_id)) and e ? 'name'), '[]'::jsonb);
$$;
revoke execute on function public.job_extras from anon, public;
grant execute on function public.job_extras to authenticated;
