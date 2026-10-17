-- Tidyo · "serviço concluído" opens the new charge for that client and job, with the price shown in the notice
create or replace function public.notify_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cname text; who text; uid uuid;
begin
  if tg_table_name = 'job_issues' then
    select c.name into cname from public.jobs j join public.clients c on c.id = j.client_id where j.id = new.job_id;
    select m.display_name into who from public.memberships m where m.id = new.reported_by;
    perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_issue',
      jsonb_build_object('client', cname, 'who', who, 'category', new.category, 'text', left(new.description, 140)), '/app/agenda');

  elsif tg_table_name = 'expenses' then
    if new.status = 'pending' then
      select m.display_name into who from public.memberships m where m.id = new.membership_id;
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'expense_pending',
        jsonb_build_object('who', who, 'amount_cents', new.amount_cents, 'category', new.category), '/app/financas/despesas');
    end if;

  elsif tg_table_name = 'jobs' then
    select c.name into cname from public.clients c where c.id = new.client_id;
    if new.status = 'completed' and old.status <> 'completed' then
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_completed',
        jsonb_build_object('client', cname, 'job', new.id, 'price_cents', new.price_cents),
        '/app/cobrancas?nova=' || new.client_id::text || '&job=' || new.id::text);
    end if;
    if new.rating_status = 'rated' and old.rating_status <> 'rated' then
      perform public.notify_users(public.staff_user_ids(new.company_id), new.company_id, 'job_rated',
        jsonb_build_object('client', cname, 'rating', new.rating, 'comment', left(coalesce(new.rating_comment, ''), 140)), '/app/agenda');
    end if;

  elsif tg_table_name = 'job_assignments' then
    select m.user_id into uid from public.memberships m where m.id = new.membership_id;
    select c.name into cname from public.jobs j join public.clients c on c.id = j.client_id where j.id = new.job_id;
    if uid is not null and uid is distinct from auth.uid() then
      perform public.notify_users(array[uid], new.company_id, 'job_assigned',
        jsonb_build_object('client', cname, 'start', (select scheduled_start from public.jobs where id = new.job_id)), '/dia');
    end if;

  elsif tg_table_name = 'support_messages' then
    if new.from_staff then
      select t.opened_by into uid from public.support_tickets t where t.id = new.ticket_id;
      perform public.notify_users(array[uid], null, 'support_reply', jsonb_build_object('ticket', new.ticket_id), '/ajuda');
    end if;
  end if;
  return null;
end $$;
