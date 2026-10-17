-- Tidyo · hardening after the launch review
-- 1) tables created in later migrations kept the default grants to anon; RLS already blocked them, now the grant is gone too
revoke all on public.client_requests, public.platform_admin_emails, public.service_extras, public.support_notes, public.team_invite_links from anon;

-- 2) uploads: images only and a size cap per bucket (the app compresses photos to well under 1 MB)
update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id in ('job-photos', 'receipts', 'signatures', 'chat-files', 'support-files', 'company-assets');
