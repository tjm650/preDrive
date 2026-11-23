-- preDrive B4.7.2: device-scoped notification delivery cycles and alert escalation.
-- This is the original applied migration. The following hardening migration
-- narrows the device-token FK delete action and fixes the RPC processed count.

alter table public.notification_deliveries
  add column if not exists delivery_sequence integer not null default 1,
  add column if not exists device_token_id uuid,
  add column if not exists receipt_status text,
  add column if not exists receipt_checked_at timestamptz,
  add column if not exists receipt_error_code text;

alter table public.notification_deliveries
  add constraint notification_deliveries_delivery_sequence_check
    check (delivery_sequence between 1 and 1000),
  add constraint notification_deliveries_receipt_status_check
    check (receipt_status is null or receipt_status in ('pending', 'ok', 'error')),
  add constraint notification_deliveries_receipt_error_code_check
    check (receipt_error_code is null or receipt_error_code ~ '^[A-Z0-9_]{1,80}$'),
  add constraint notification_deliveries_device_school_fkey
    foreign key (device_token_id, school_id)
    references public.device_tokens(id, school_id)
    on delete set null;

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_recipient_channel_key;

create unique index if not exists notification_deliveries_email_sequence_key
  on public.notification_deliveries(alert_recipient_id, delivery_sequence)
  where channel = 'email';

create unique index if not exists notification_deliveries_push_device_sequence_key
  on public.notification_deliveries(alert_recipient_id, device_token_id, delivery_sequence)
  where channel = 'push' and device_token_id is not null;

create index if not exists notification_deliveries_receipt_due_idx
  on public.notification_deliveries(receipt_checked_at, sent_at)
  where channel = 'push'
    and status = 'sent'
    and provider_message_id is not null
    and receipt_status is null;

create index if not exists notification_deliveries_alert_sequence_idx
  on public.notification_deliveries(alert_recipient_id, delivery_sequence, channel);

alter table public.alerts
  add column if not exists escalation_count integer not null default 0;

alter table public.alerts
  add constraint alerts_escalation_count_check
    check (escalation_count between 0 and 1000);

create or replace function private.enqueue_notification_deliveries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_locale text;
begin
  select coalesce(nullif(btrim(p.language), ''), 'en')
    into v_locale
  from public.profiles p
  where p.id = new.recipient_user_id;

  v_locale := coalesce(v_locale, 'en');

  insert into public.notification_deliveries (
    school_id, alert_recipient_id, channel, locale,
    delivery_sequence, device_token_id
  )
  select new.school_id, new.id, 'push', v_locale, 1, dt.id
  from public.device_tokens dt
  where dt.school_id = new.school_id
    and dt.user_id = new.recipient_user_id
    and dt.provider = 'expo'
    and dt.active = true
    and dt.revoked_at is null
  on conflict do nothing;

  if exists (
    select 1 from public.profiles p
    where p.id = new.recipient_user_id and p.email is not null
  ) and coalesce((
    select cr.status
    from public.consent_records cr
    where cr.school_id = new.school_id
      and cr.subject_user_id = new.recipient_user_id
      and cr.purpose = 'communications'
      and cr.effective_at <= now()
    order by cr.effective_at desc, cr.captured_at desc, cr.created_at desc, cr.id desc
    limit 1
  ), 'denied') = 'granted' then
    insert into public.notification_deliveries (
      school_id, alert_recipient_id, channel, locale, delivery_sequence
    ) values (new.school_id, new.id, 'email', v_locale, 1)
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

create or replace function public.enqueue_due_alert_escalations(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_alert record;
  v_sequence integer;
  v_processed integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 500 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  for v_alert in
    select a.id, a.school_id, a.escalation_count
    from public.alerts a
    join public.schools s on s.id = a.school_id and s.status = 'active'
    where a.status = 'open'
      and a.repeat_until_acknowledged = true
      and a.next_escalation_at is not null
      and a.next_escalation_at <= now()
      and exists (
        select 1 from public.alert_recipients ar
        where ar.alert_id = a.id and ar.school_id = a.school_id
          and ar.acknowledged_at is null
      )
    order by a.next_escalation_at, a.created_at
    limit p_batch_size
    for update of a skip locked
  loop
    if v_alert.escalation_count >= 1000 then
      update public.alerts
      set repeat_until_acknowledged = false,
          next_escalation_at = null,
          updated_at = now()
      where id = v_alert.id and school_id = v_alert.school_id;
      v_processed := v_processed + 1;
      continue;
    end if;

    v_sequence := v_alert.escalation_count + 2;

    update public.alerts
    set escalation_count = escalation_count + 1,
        next_escalation_at = now() + interval '5 minutes',
        updated_at = now()
    where id = v_alert.id and school_id = v_alert.school_id;

    insert into public.notification_deliveries (
      school_id, alert_recipient_id, channel, locale,
      delivery_sequence, device_token_id
    )
    select ar.school_id, ar.id, 'push',
      coalesce(nullif(btrim(p.language), ''), 'en'),
      v_sequence, dt.id
    from public.alert_recipients ar
    join public.school_memberships sm
      on sm.school_id = ar.school_id and sm.user_id = ar.recipient_user_id
      and sm.active = true
    join public.device_tokens dt
      on dt.school_id = ar.school_id and dt.user_id = ar.recipient_user_id
      and dt.provider = 'expo' and dt.active = true and dt.revoked_at is null
    left join public.profiles p on p.id = ar.recipient_user_id
    where ar.school_id = v_alert.school_id
      and ar.alert_id = v_alert.id
      and ar.acknowledged_at is null
    on conflict do nothing;

    insert into public.notification_deliveries (
      school_id, alert_recipient_id, channel, locale, delivery_sequence
    )
    select ar.school_id, ar.id, 'email',
      coalesce(nullif(btrim(p.language), ''), 'en'),
      v_sequence
    from public.alert_recipients ar
    join public.school_memberships sm
      on sm.school_id = ar.school_id and sm.user_id = ar.recipient_user_id
      and sm.active = true
    join public.profiles p on p.id = ar.recipient_user_id and p.email is not null
    where ar.school_id = v_alert.school_id
      and ar.alert_id = v_alert.id
      and ar.acknowledged_at is null
      and coalesce((
        select cr.status
        from public.consent_records cr
        where cr.school_id = ar.school_id
          and cr.subject_user_id = ar.recipient_user_id
          and cr.purpose = 'communications'
          and cr.effective_at <= now()
        order by cr.effective_at desc, cr.captured_at desc, cr.created_at desc, cr.id desc
        limit 1
      ), 'denied') = 'granted'
    on conflict do nothing;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$function$;

revoke all on function public.enqueue_due_alert_escalations(integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_due_alert_escalations(integer)
  to service_role;
