-- Tidyo · checklist per visit and client portal access

-- Portal invite for a client (link sent by the owner; only the hash is stored)
alter table public.clients
  add column if not exists portal_invite_hash text,
  add column if not exists portal_invite_expires_at timestamptz;

-- Returns the visit checklist, creating it on first open (from the service template, or a standard list).
-- Standard tasks are stored as keys (std.*) and translated in the app, so each person reads them in their language.
create or replace function public.job_checklist(p_job uuid)
returns setof public.job_checklist_items
language plpgsql security definer set search_path = '' as $$
declare j public.jobs; k public.client_kind; tpl uuid;
begin
  select * into j from public.jobs where id = p_job;
  if not found or not (public.is_assigned(p_job) or public.is_staff(j.company_id) or public.is_portal_client(j.client_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.job_checklist_items where job_id = p_job)
     and (public.is_assigned(p_job) or public.is_staff(j.company_id)) then
    select s.checklist_template_id into tpl from public.services s where s.id = j.service_id;
    if tpl is not null and exists (select 1 from public.checklist_template_items where template_id = tpl) then
      insert into public.job_checklist_items (job_id, company_id, room, task, position)
      select p_job, j.company_id, ti.room, ti.task, ti.position from public.checklist_template_items ti where ti.template_id = tpl;
    else
      select c.kind into k from public.clients c where c.id = j.client_id;
      insert into public.job_checklist_items (job_id, company_id, room, task, position)
      select p_job, j.company_id, x.room, x.task, x.pos
      from (values
        ('residential', 'std.kitchen', 'std.counters', 1), ('residential', 'std.kitchen', 'std.stove', 2),
        ('residential', 'std.kitchen', 'std.sink', 3), ('residential', 'std.kitchen', 'std.floor', 4),
        ('residential', 'std.bathroom', 'std.toilet', 5), ('residential', 'std.bathroom', 'std.shower', 6),
        ('residential', 'std.bathroom', 'std.mirror', 7), ('residential', 'std.bathroom', 'std.floor', 8),
        ('residential', 'std.bedroom', 'std.dust', 9), ('residential', 'std.bedroom', 'std.beds', 10),
        ('residential', 'std.bedroom', 'std.vacuum', 11), ('residential', 'std.living', 'std.dust', 12),
        ('residential', 'std.living', 'std.vacuum', 13), ('residential', 'std.general', 'std.trash', 14),
        ('residential', 'std.general', 'std.final', 15),
        ('commercial', 'std.office', 'std.desks', 1), ('commercial', 'std.office', 'std.trash', 2),
        ('commercial', 'std.office', 'std.vacuum', 3), ('commercial', 'std.bathroom', 'std.toilet', 4),
        ('commercial', 'std.bathroom', 'std.restock', 5), ('commercial', 'std.bathroom', 'std.floor', 6),
        ('commercial', 'std.breakroom', 'std.counters', 7), ('commercial', 'std.breakroom', 'std.sink', 8),
        ('commercial', 'std.general', 'std.doors', 9), ('commercial', 'std.general', 'std.final', 10)
      ) as x(kind, room, task, pos)
      where x.kind = coalesce(k, 'residential')::text;
    end if;
  end if;
  return query select * from public.job_checklist_items where job_id = p_job order by position;
end $$;

-- Client accepts the portal link
create or replace function public.accept_portal_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  update public.clients
     set portal_user_id = auth.uid(), portal_invite_hash = null, portal_invite_expires_at = null
   where portal_invite_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and portal_invite_expires_at > now()
  returning id into cid;
  if cid is null then raise exception 'invite_invalid_or_expired' using errcode = 'P0001'; end if;
  return cid;
end $$;

-- Portal clients may open the photos of their own visits (path: {company}/{job}/{file})
create or replace function public.portal_can_read_photo(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare jid uuid;
begin
  begin
    jid := (string_to_array(p_name, '/'))[2]::uuid;
  exception when others then
    return false;
  end;
  return jid is not null and public.is_portal_client(public.client_of_job(jid))
     and exists (select 1 from public.job_photos ph where ph.job_id = jid and ph.storage_path = p_name and ph.kind in ('before', 'after'));
end $$;

create policy "portal clients read their visit photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and public.portal_can_read_photo(name));

-- Helpers see every photo of jobs assigned to them (not only their own uploads)
create policy "assigned helpers read job photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and exists (
    select 1 from public.job_photos ph where ph.storage_path = name and public.is_assigned(ph.job_id)));

revoke execute on function public.job_checklist, public.accept_portal_invite, public.portal_can_read_photo from anon, public;
grant execute on function public.job_checklist, public.accept_portal_invite, public.portal_can_read_photo to authenticated;
