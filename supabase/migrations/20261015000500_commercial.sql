-- Tidyo · commercial: location check when a job starts

alter table public.jobs
  add column if not exists start_lat double precision,
  add column if not exists start_lng double precision,
  add column if not exists start_distance_m integer,
  add column if not exists start_inside_geofence boolean;

create or replace function public.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns integer language sql immutable set search_path = '' as $$
  select round(6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::integer;
$$;

-- Records where the helper was when starting the job (called right before job_progress → in_progress).
create or replace function public.job_start_location(p_job uuid, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.jobs; plat double precision; plng double precision; radius integer; dist integer;
begin
  select * into j from public.jobs where id = p_job for update;
  if not found or not (public.is_assigned(p_job) or public.is_staff(j.company_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if j.status <> 'scheduled' then return; end if;
  select p.lat, p.lng into plat, plng from public.properties p where p.id = j.property_id;
  select k.geofence_radius_m into radius from public.contracts k where k.id = j.contract_id;
  radius := coalesce(radius, 150);
  if plat is not null and plng is not null then dist := public.distance_m(p_lat, p_lng, plat, plng); end if;
  update public.jobs set start_lat = p_lat, start_lng = p_lng, start_distance_m = dist,
         start_inside_geofence = case when dist is null then null else dist <= radius end
   where id = p_job;
end $$;

revoke execute on function public.job_start_location, public.distance_m from anon, public;
grant execute on function public.job_start_location, public.distance_m to authenticated;
