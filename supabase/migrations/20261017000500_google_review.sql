-- Tidyo · Google review link: after a 5-star rating the portal invites the client to post it on Google
alter table public.companies add column if not exists google_review_url text
  check (google_review_url is null or (length(google_review_url) <= 300 and google_review_url ~ '^https://'));

create or replace function public.portal_review_url() returns text
language sql stable security definer set search_path = '' as $$
  select co.google_review_url
    from public.clients c join public.companies co on co.id = c.company_id
   where c.portal_user_id = auth.uid() and c.archived_at is null
   limit 1;
$$;
revoke execute on function public.portal_review_url from anon, public;
grant execute on function public.portal_review_url to authenticated;
