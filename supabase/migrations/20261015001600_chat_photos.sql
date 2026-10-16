-- Tidyo · photos in chat. Path: {company_id}/{conversation_id}/{file}. Only the people in the conversation see them.
insert into storage.buckets (id, name, public) values ('chat-files', 'chat-files', false) on conflict (id) do nothing;

create policy "chat participants upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-files' and public.is_participant(((storage.foldername(name))[2])::uuid));

create policy "chat participants read"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-files' and (public.is_participant(((storage.foldername(name))[2])::uuid)
         or public.is_staff(((storage.foldername(name))[1])::uuid)));
