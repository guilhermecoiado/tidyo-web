-- Tidyo · keep the phone (WhatsApp) and the marketing consent given at sign-up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, language, phone, marketing_opt_in_at)
  values (new.id,
          coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          coalesce((new.raw_user_meta_data ->> 'language')::public.app_language, 'en'),
          nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 30), ''),
          case when (new.raw_user_meta_data ->> 'marketing_opt_in') = 'true' then now() end);
  if exists (select 1 from public.platform_admin_emails e where lower(e.email) = lower(new.email)) then
    insert into public.platform_admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;
