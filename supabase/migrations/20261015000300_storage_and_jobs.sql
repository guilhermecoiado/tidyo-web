-- Tidyo · private file buckets and scheduled jobs
-- Paths always start with the company id: {company_id}/...
-- Clients never read buckets directly; the server hands them short-lived signed URLs.

insert into storage.buckets (id, name, public) values
  ('job-photos', 'job-photos', false),
  ('receipts',   'receipts',   false),
  ('signatures', 'signatures', false),
  ('company-assets', 'company-assets', false)
on conflict (id) do nothing;

create policy "members upload to their company"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('job-photos', 'receipts', 'signatures')
              and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "staff read company files, members read their own"
  on storage.objects for select to authenticated
  using (bucket_id in ('job-photos', 'receipts', 'signatures', 'company-assets')
         and (public.is_staff(((storage.foldername(name))[1])::uuid) or owner = auth.uid()));

create policy "staff manage company assets"
  on storage.objects for all to authenticated
  using (bucket_id = 'company-assets' and public.is_staff(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'company-assets' and public.is_staff(((storage.foldername(name))[1])::uuid));

create policy "staff delete company files"
  on storage.objects for delete to authenticated
  using (bucket_id in ('job-photos', 'receipts', 'signatures')
         and public.is_staff(((storage.foldername(name))[1])::uuid));

-- Scheduled work (requires the pg_cron extension, enabled in the Supabase dashboard).
-- The nightly Tidy review, reminders and translations run as Edge Functions called by cron.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('tidyo-auto-approve-ratings', '*/15 * * * *', 'select public.auto_approve_ratings()');
  end if;
end $$;
