-- preDrive B4.7: notification delivery outbox and broadcast fan-out.
-- Additive only. Existing alerts, recipients, broadcasts and device tokens are untouched.

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  alert_recipient_id uuid not null,
  channel text not null check (channel in ('push', 'email')),
  locale text not null default 'en'
    check (char_length(btrim(locale)) between 2 and 12),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'suppressed')),
  attempt_count smallint not null default 0
    check (attempt_count between 0 and 12),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by uuid,
  provider_message_id text
    check (provider_message_id is null or char_length(provider_message_id) <= 200),
  last_error_code text
    check (last_error_code is null or last_error_code ~ '^[A-Z0-9_]{1,80}$'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_recipient_school_fkey
    foreign key (alert_recipient_id, school_id)
    references public.alert_recipients (id, school_id) on delete cascade,
  constraint notification_deliveries_recipient_channel_key
    unique (alert_recipient_id, channel),
  constraint notification_deliveries_lock_state_check check (
    (status = 'processing' and locked_at is not null and locked_by is not null)
    or (status <> 'processing' and locked_at is null and locked_by is null)
  ),
  constraint notification_deliveries_sent_state_check check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

comment on table public.notification_deliveries is
  'Transactional outbox for per-recipient push and consented email delivery. Payload content is resolved from the linked alert at send time; provider credentials and raw provider responses are never stored here.';
comment on column public.notification_deliveries.locale is
  'Recipient profile language captured when the delivery is enqueued; delivery templates must support English, Shona and Ndebele.';
comment on column public.notification_deliveries.last_error_code is
  'Sanitised allowlisted provider or delivery error code only; never store provider response bodies or personal data.';

create index if not exists notification_deliveries_due_idx
  on public.notification_deliveries (next_attempt_at, created_at)
  where status = 'pending';

create index if not exists notification_deliveries_stale_lease_idx
  on public.notification_deliveries (locked_at)
  where status = 'processing';

create index if not exists notification_deliveries_school_status_idx
  on public.notification_deliveries (school_id, status, created_at desc);

drop trigger if exists notification_deliveries_set_updated_at
  on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function private.set_updated_at();

alter table public.notification_deliveries enable row level security;

revoke all on table public.notification_deliveries
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.notification_deliveries
  to service_role;

create or replace function private.enqueue_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text;
begin
  select coalesce(nullif(btrim(p.language), ''), 'en')
    into v_locale
  from public.profiles p
  where p.id = new.recipient_user_id;

  v_locale := coalesce(v_locale, 'en');

  -- A registered, active Expo device token is the user's explicit push endpoint.
  if exists (
    select 1
    from public.device_tokens dt
    where dt.school_id = new.school_id
      and dt.user_id = new.recipient_user_id
      and dt.provider = 'expo'
      and dt.active = true
      and dt.revoked_at is null
  ) then
    insert into public.notification_deliveries (
      school_id, alert_recipient_id, channel, locale
    )
    values (new.school_id, new.id, 'push', v_locale)
    on conflict (alert_recipient_id, channel) do nothing;
  end if;

  -- Email is queued only when the latest effective communications consent is granted.
  if exists (
    select 1
    from public.profiles p
    where p.id = new.recipient_user_id
      and p.email is not null
      and exists (
        select 1
        from public.consent_records cr
        where cr.school_id = new.school_id
          and cr.subject_user_id = new.recipient_user_id
          and cr.purpose = 'communications'
          and cr.effective_at <= now()
        order by cr.effective_at desc, cr.captured_at desc, cr.created_at desc, cr.id desc
        limit 1
      )
      and (
        select cr.status
        from public.consent_records cr
        where cr.school_id = new.school_id
          and cr.subject_user_id = new.recipient_user_id
          and cr.purpose = 'communications'
          and cr.effective_at <= now()
        order by cr.effective_at desc, cr.captured_at desc, cr.created_at desc, cr.id desc
        limit 1
      ) = 'granted'
  ) then
    insert into public.notification_deliveries (
      school_id, alert_recipient_id, channel, locale
    )
    values (new.school_id, new.id, 'email', v_locale)
    on conflict (alert_recipient_id, channel) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_notification_deliveries()
  from public, anon, authenticated, service_role;

drop trigger if exists alert_recipients_enqueue_notification_deliveries
  on public.alert_recipients;
create trigger alert_recipients_enqueue_notification_deliveries
after insert on public.alert_recipients
for each row execute function private.enqueue_notification_deliveries();

create or replace function private.materialize_published_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_id uuid;
begin
  if new.status <> 'published'
     or new.published_at is null
     or new.published_at > now()
     or (new.expires_at is not null and new.expires_at <= now()) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;
  end if;

  insert into public.alerts (
    school_id,
    title,
    message,
    severity,
    status,
    source_type,
    source_id,
    dedupe_key,
    created_by,
    repeat_until_acknowledged
  )
  values (
    new.school_id,
    new.title,
    new.message,
    'info',
    'open',
    'manual',
    new.id,
    'broadcast:' || new.id::text,
    new.created_by,
    false
  )
  on conflict (school_id, dedupe_key)
    where dedupe_key is not null
  do nothing
  returning id into v_alert_id;

  if v_alert_id is null then
    select a.id
      into v_alert_id
    from public.alerts a
    where a.school_id = new.school_id
      and a.dedupe_key = 'broadcast:' || new.id::text;
  end if;

  if v_alert_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'BROADCAST_ALERT_MATERIALIZATION_FAILED';
  end if;

  insert into public.alert_recipients (
    school_id,
    alert_id,
    recipient_user_id
  )
  select
    new.school_id,
    v_alert_id,
    sm.user_id
  from public.school_memberships sm
  where sm.school_id = new.school_id
    and sm.active = true
    and sm.role = any(new.target_roles)
  on conflict (school_id, alert_id, recipient_user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.materialize_published_broadcast()
  from public, anon, authenticated, service_role;

drop trigger if exists broadcasts_materialize_published_insert
  on public.broadcasts;
create trigger broadcasts_materialize_published_insert
after insert on public.broadcasts
for each row
when (new.status = 'published')
execute function private.materialize_published_broadcast();

drop trigger if exists broadcasts_materialize_published_update
  on public.broadcasts;
create trigger broadcasts_materialize_published_update
after update of status on public.broadcasts
for each row
when (new.status = 'published' and old.status is distinct from new.status)
execute function private.materialize_published_broadcast();
