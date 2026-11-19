create extension if not exists pg_net with schema extensions;

create table if not exists private.push_dispatch_attempts (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null check (status in ('queued','missing_secrets','enqueue_failed')),
  request_id bigint,
  error_message text,
  created_at timestamptz not null default now()
);
revoke all on private.push_dispatch_attempts from public, anon, authenticated;

create or replace function private.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  webhook_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'notification_webhook_secret' limit 1;

  if project_url is null or webhook_secret is null then
    insert into private.push_dispatch_attempts(notification_id,status,error_message)
    values(new.id,'missing_secrets','Add project_url and notification_webhook_secret to Supabase Vault.')
    on conflict (notification_id) do update
      set status=excluded.status,error_message=excluded.error_message,created_at=now();
    return new;
  end if;

  request_id := net.http_post(
    url := rtrim(project_url,'/') || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),
    body := jsonb_build_object('record',to_jsonb(new))
  );

  insert into private.push_dispatch_attempts(notification_id,status,request_id)
  values(new.id,'queued',request_id)
  on conflict (notification_id) do update
    set status=excluded.status,request_id=excluded.request_id,error_message=null,created_at=now();
  return new;
exception when others then
  insert into private.push_dispatch_attempts(notification_id,status,error_message)
  values(new.id,'enqueue_failed',left(sqlerrm,500))
  on conflict (notification_id) do update
    set status=excluded.status,error_message=excluded.error_message,created_at=now();
  return new;
end
$$;
revoke all on function private.dispatch_notification_push() from public,anon,authenticated;

drop trigger if exists dispatch_notification_push on public.notifications;
create trigger dispatch_notification_push
after insert on public.notifications
for each row execute function private.dispatch_notification_push();

create or replace function private.enqueue_push_receipt_check()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  webhook_secret text;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets where name='project_url' limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name='notification_webhook_secret' limit 1;
  if project_url is null or webhook_secret is null then return; end if;

  perform net.http_post(
    url := rtrim(project_url,'/') || '/functions/v1/check-push-receipts',
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',webhook_secret),
    body := '{}'::jsonb
  );
exception when others then
  raise log 'preDrive push receipt check enqueue failed: %', sqlerrm;
end
$$;
revoke all on function private.enqueue_push_receipt_check() from public,anon,authenticated;

select cron.schedule(
  'predrive-check-push-receipts',
  '*/15 * * * *',
  'select private.enqueue_push_receipt_check();'
);
