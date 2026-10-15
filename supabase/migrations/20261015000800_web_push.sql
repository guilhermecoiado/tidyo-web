-- Tidyo · web push for notifications
-- VAPID keys live in Supabase Vault (names: vapid_public, vapid_private, vapid_subject), never in the repo.

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

alter table public.notifications add column if not exists pushed_at timestamptz;

-- Only the push function (service role) can read the keys.
create or replace function public.push_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(name, decrypted_secret) from vault.decrypted_secrets
  where name in ('vapid_public', 'vapid_private', 'vapid_subject');
$$;
revoke execute on function public.push_config from anon, authenticated, public;
grant execute on function public.push_config to service_role;

-- Each new notification asks the push function to deliver it. The function only takes an id,
-- sends once (pushed_at) and only to that user's own devices, so the endpoint cannot be abused.
create or replace function public.push_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://dydppwblbknosekojgwc.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('id', new.id),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 5000);
  return null;
exception when others then
  return null;  -- push is best effort; never block the notification
end $$;
revoke execute on function public.push_notification from anon, authenticated, public;

create trigger push_notification after insert on public.notifications
  for each row execute function public.push_notification();
