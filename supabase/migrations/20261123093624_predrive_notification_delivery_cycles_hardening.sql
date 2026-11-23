-- preDrive B4.7.2 hardening: preserve school_id when a device token is deleted
-- and return a reliable count from the escalation enqueue routine.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_device_school_fkey;

alter table public.notification_deliveries
  add constraint notification_deliveries_device_school_fkey
    foreign key (device_token_id, school_id)
    references public.device_tokens(id, school_id)
    on delete set null (device_token_id);

create or replace function public.enqueue_due_alert_escalations(p_batch_size integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_alert record;
  v_sequence integer;
  v_processed integer := 0;
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
