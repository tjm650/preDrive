-- B3.5: incident, delay, SOS, vehicle-check and alert acknowledgement workflows.

create or replace function public.create_incident(
  p_school_id uuid,
  p_title text,
  p_description text,
  p_severity public.incident_severity,
  p_trip_id uuid default null,
  p_child_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_incident_id uuid;
  v_alert_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not (
    private.has_role(p_school_id, 'school_admin'::public.user_role)
    or private.has_role(p_school_id, 'supervisor'::public.user_role)
    or private.has_role(p_school_id, 'driver'::public.user_role)
    or private.has_role(p_school_id, 'teacher'::public.user_role)
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 2 and 160
     or p_description is null or char_length(btrim(p_description)) not between 2 and 5000 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if p_trip_id is not null and not exists (
    select 1 from public.trips t where t.id = p_trip_id and t.school_id = p_school_id
  ) then
    raise exception using errcode = '23503', message = 'TRIP_NOT_FOUND';
  end if;
  if p_child_id is not null and not exists (
    select 1 from public.children c where c.id = p_child_id and c.school_id = p_school_id
  ) then
    raise exception using errcode = '23503', message = 'CHILD_NOT_FOUND';
  end if;

  insert into public.incidents (
    school_id, title, description, severity, trip_id, child_id, reported_by, occurred_at
  ) values (
    p_school_id, btrim(p_title), btrim(p_description), p_severity,
    p_trip_id, p_child_id, v_actor, now()
  ) returning id into v_incident_id;

  insert into public.alerts (
    school_id, title, message, severity, source_type, source_id, created_by,
    repeat_until_acknowledged, next_escalation_at
  ) values (
    p_school_id, btrim(p_title), left(btrim(p_description), 3000),
    case when p_severity in ('high'::public.incident_severity, 'critical'::public.incident_severity)
         then 'urgent'::public.alert_severity
         when p_severity = 'medium'::public.incident_severity
         then 'warning'::public.alert_severity
         else 'info'::public.alert_severity end,
    'incident', v_incident_id, v_actor,
    p_severity = 'critical'::public.incident_severity,
    case when p_severity = 'critical'::public.incident_severity then now() + interval '5 minutes' else null end
  ) returning id into v_alert_id;

  insert into public.alert_recipients (school_id, alert_id, recipient_user_id)
  select p_school_id, v_alert_id, m.user_id
  from public.school_memberships m
  where m.school_id = p_school_id and m.active
    and (m.role = 'school_admin'::public.user_role
         or (p_child_id is not null and exists (
           select 1 from public.guardian_children gc
           where gc.school_id = p_school_id and gc.child_id = p_child_id
             and gc.guardian_user_id = m.user_id and gc.active
         )))
  on conflict (school_id, alert_id, recipient_user_id) do nothing;

  return v_incident_id;
end;
$function$;

create or replace function public.raise_sos(p_school_id uuid, p_trip_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_alert_id uuid;
  v_sos_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not (
    private.has_role(p_school_id, 'school_admin'::public.user_role)
    or private.has_role(p_school_id, 'supervisor'::public.user_role)
    or private.has_role(p_school_id, 'driver'::public.user_role)
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_trip_id is not null and not exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and exists (
        select 1 from public.staff_members s
        where s.school_id = t.school_id and s.user_id = v_actor
          and s.active and s.id in (t.driver_id, t.supervisor_id)
      )
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_ASSIGNED_TRIP_REQUIRED';
  end if;

  insert into public.alerts (
    school_id, title, message, severity, source_type, source_id, created_by,
    repeat_until_acknowledged, next_escalation_at
  ) values (
    p_school_id, 'Emergency SOS', 'An emergency SOS has been raised. Immediate attention is required.',
    'urgent'::public.alert_severity, 'sos', p_trip_id, v_actor, true, now() + interval '2 minutes'
  ) returning id into v_alert_id;

  insert into public.sos_events (school_id, raised_by, trip_id, alert_id)
  values (p_school_id, v_actor, p_trip_id, v_alert_id)
  returning id into v_sos_id;

  insert into public.alert_recipients (school_id, alert_id, recipient_user_id)
  select p_school_id, v_alert_id, m.user_id
  from public.school_memberships m
  where m.school_id = p_school_id and m.active
  on conflict (school_id, alert_id, recipient_user_id) do nothing;

  if p_trip_id is not null then
    insert into public.trip_events (
      school_id, trip_id, event_type, actor_user_id, event_data
    ) values (
      p_school_id, p_trip_id, 'sos_raised', v_actor,
      jsonb_build_object('sos_event_id', v_sos_id)
    );
  end if;

  return v_sos_id;
end;
$function$;

create or replace function public.report_trip_delay(
  p_school_id uuid,
  p_trip_id uuid,
  p_reason public.delay_reason,
  p_description text default null,
  p_estimated_delay_minutes smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_delay_id uuid;
  v_alert_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not exists (
    select 1 from public.trips t
    join public.staff_members s
      on s.school_id = t.school_id and s.id in (t.driver_id, t.supervisor_id)
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and s.user_id = v_actor and s.active
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_ASSIGNED_TRIP_REQUIRED';
  end if;

  insert into public.delay_reports (
    school_id, trip_id, reported_by, reason, description, estimated_delay_minutes
  ) values (
    p_school_id, p_trip_id, v_actor, p_reason, p_description, p_estimated_delay_minutes
  ) returning id into v_delay_id;

  insert into public.alerts (
    school_id, title, message, severity, source_type, source_id, created_by
  ) values (
    p_school_id, 'Transport delay reported',
    coalesce(nullif(btrim(p_description), ''), 'A delay has been reported for an active school trip.'),
    'warning'::public.alert_severity, 'delay', v_delay_id, v_actor
  ) returning id into v_alert_id;

  insert into public.alert_recipients (school_id, alert_id, recipient_user_id)
  select p_school_id, v_alert_id, m.user_id
  from public.school_memberships m
  where m.school_id = p_school_id and m.active
    and (m.role = 'school_admin'::public.user_role
      or exists (
        select 1 from public.trip_children tc
        join public.guardian_children gc
          on gc.school_id = tc.school_id and gc.child_id = tc.child_id and gc.active
        where tc.trip_id = p_trip_id and gc.guardian_user_id = m.user_id
      ))
  on conflict (school_id, alert_id, recipient_user_id) do nothing;

  insert into public.trip_events (
    school_id, trip_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, 'delay_reported', v_actor,
    jsonb_build_object('delay_report_id', v_delay_id)
  );

  return v_delay_id;
end;
$function$;

create or replace function public.acknowledge_alert(p_school_id uuid, p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  update public.alert_recipients
  set acknowledged_at = coalesce(acknowledged_at, now()), updated_at = now()
  where school_id = p_school_id and alert_id = p_alert_id
    and recipient_user_id = v_actor;

  if not found then
    raise exception using errcode = '42501', message = 'ALERT_RECIPIENT_REQUIRED';
  end if;

  if not exists (
    select 1 from public.alert_recipients ar
    where ar.school_id = p_school_id and ar.alert_id = p_alert_id
      and ar.acknowledged_at is null
  ) then
    update public.alerts
    set status = 'acknowledged'::public.alert_status,
        acknowledged_at = coalesce(acknowledged_at, now()),
        acknowledged_by = v_actor,
        repeat_until_acknowledged = false,
        next_escalation_at = null,
        updated_at = now()
    where id = p_alert_id and school_id = p_school_id and status = 'open'::public.alert_status;
  end if;
end;
$function$;

create or replace function public.complete_vehicle_check(
  p_school_id uuid,
  p_bus_id uuid,
  p_trip_id uuid,
  p_items jsonb,
  p_safe_to_operate boolean,
  p_checked_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_check_id uuid;
  v_alert_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not (
    private.has_role(p_school_id, 'driver'::public.user_role)
    or private.has_role(p_school_id, 'supervisor'::public.user_role)
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 8
     or p_checked_at is null or p_checked_at > now() + interval '2 minutes' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.staff_members sm
    where sm.school_id = p_school_id and sm.user_id = v_actor
      and sm.active and sm.role in ('driver', 'supervisor')
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_STAFF_REQUIRED';
  end if;

  insert into public.vehicle_checks (
    school_id, bus_id, trip_id, checked_by, items, safe_to_operate, checked_at
  ) values (
    p_school_id, p_bus_id, p_trip_id, v_actor, p_items, p_safe_to_operate, p_checked_at
  ) returning id into v_check_id;

  if not p_safe_to_operate then
    update public.buses set status = 'maintenance'::public.bus_status, updated_at = now()
    where id = p_bus_id and school_id = p_school_id;

    insert into public.alerts (
      school_id, title, message, severity, source_type, source_id, created_by
    ) values (
      p_school_id, 'Vehicle marked unsafe',
      'A vehicle check failed. The bus has been moved to maintenance status.',
      'urgent'::public.alert_severity, 'vehicle_check', v_check_id, v_actor
    ) returning id into v_alert_id;

    insert into public.alert_recipients (school_id, alert_id, recipient_user_id)
    select p_school_id, v_alert_id, m.user_id
    from public.school_memberships m
    where m.school_id = p_school_id and m.active
      and m.role = 'school_admin'::public.user_role
    on conflict (school_id, alert_id, recipient_user_id) do nothing;
  end if;

  return v_check_id;
end;
$function$;

revoke all on function public.create_incident(uuid, text, text, public.incident_severity, uuid, uuid) from public, anon;
revoke all on function public.raise_sos(uuid, uuid) from public, anon;
revoke all on function public.report_trip_delay(uuid, uuid, public.delay_reason, text, smallint) from public, anon;
revoke all on function public.acknowledge_alert(uuid, uuid) from public, anon;
revoke all on function public.complete_vehicle_check(uuid, uuid, uuid, jsonb, boolean, timestamptz) from public, anon;
grant execute on function public.create_incident(uuid, text, text, public.incident_severity, uuid, uuid) to authenticated;
grant execute on function public.raise_sos(uuid, uuid) to authenticated;
grant execute on function public.report_trip_delay(uuid, uuid, public.delay_reason, text, smallint) to authenticated;
grant execute on function public.acknowledge_alert(uuid, uuid) to authenticated;
grant execute on function public.complete_vehicle_check(uuid, uuid, uuid, jsonb, boolean, timestamptz) to authenticated;
