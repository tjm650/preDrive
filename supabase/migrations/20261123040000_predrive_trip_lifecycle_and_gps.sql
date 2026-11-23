-- B3.4: trip lifecycle, active-trip GPS and offline-safe event writes.

create or replace function public.start_trip(p_school_id uuid, p_trip_id uuid, p_started_at timestamptz)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_trip public.trips%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_started_at is null or p_started_at > now() + interval '2 minutes'
     or p_started_at < now() - interval '12 hours' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  update public.trips t
  set status = 'active'::public.trip_status,
      started_at = p_started_at,
      started_by = v_actor,
      updated_at = now()
  where t.id = p_trip_id and t.school_id = p_school_id
    and t.status = 'scheduled'::public.trip_status
    and exists (
      select 1 from public.staff_members s
      where s.id = t.supervisor_id and s.school_id = t.school_id
        and s.user_id = v_actor and s.role = 'supervisor' and s.active
    )
  returning t.* into v_trip;

  if not found then
    raise exception using errcode = '40001', message = 'TRIP_NOT_STARTABLE';
  end if;

  insert into public.trip_events (
    school_id, trip_id, event_type, actor_user_id, occurred_at
  ) values (p_school_id, p_trip_id, 'trip_started', v_actor, p_started_at);

  return v_trip;
end;
$function$;

create or replace function public.end_trip(p_school_id uuid, p_trip_id uuid, p_ended_at timestamptz)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_trip public.trips%rowtype;
  v_actor uuid := auth.uid();
  v_unaccounted integer;
  v_alert_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_ended_at is null or p_ended_at > now() + interval '2 minutes' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select t.* into v_trip
  from public.trips t
  join public.staff_members s
    on s.id = t.supervisor_id and s.school_id = t.school_id
  where t.id = p_trip_id and t.school_id = p_school_id
    and t.status = 'active'::public.trip_status
    and s.user_id = v_actor and s.active and s.role = 'supervisor'
  for update of t;
  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  select count(*) into v_unaccounted
  from public.trip_children tc
  where tc.school_id = p_school_id and tc.trip_id = p_trip_id
    and tc.status not in ('handed_over'::public.trip_child_status, 'absent'::public.trip_child_status);

  update public.trips
  set status = case when v_unaccounted > 0
                    then 'attention_required'::public.trip_status
                    else 'completed'::public.trip_status end,
      ended_at = p_ended_at,
      ended_by = v_actor,
      updated_at = now()
  where id = p_trip_id
  returning * into v_trip;

  delete from public.bus_positions where trip_id = p_trip_id;

  if v_unaccounted > 0 then
    insert into public.incidents (
      school_id, title, description, severity, trip_id, child_id,
      reported_by, occurred_at
    )
    select
      p_school_id,
      'Child unaccounted at trip end',
      'The trip ended while ' || c.first_name || ' ' || c.last_name || ' was not marked absent or handed over.',
      'critical'::public.incident_severity,
      p_trip_id,
      tc.child_id,
      v_actor,
      p_ended_at
    from public.trip_children tc
    join public.children c on c.id = tc.child_id and c.school_id = tc.school_id
    where tc.school_id = p_school_id and tc.trip_id = p_trip_id
      and tc.status not in ('handed_over'::public.trip_child_status, 'absent'::public.trip_child_status);

    insert into public.alerts (
      school_id, title, message, severity, source_type, source_id,
      dedupe_key, created_by, repeat_until_acknowledged, next_escalation_at
    ) values (
      p_school_id, 'Trip requires attention',
      'One or more children have not been accounted for at the end of this trip.',
      'urgent'::public.alert_severity, 'unaccounted_child', p_trip_id,
      'unaccounted:' || p_trip_id::text, v_actor, true, now() + interval '5 minutes'
    )
    returning id into v_alert_id;

    insert into public.alert_recipients (school_id, alert_id, recipient_user_id)
    select p_school_id, v_alert_id, m.user_id
    from public.school_memberships m
    where m.school_id = p_school_id and m.active
      and (
        m.role = 'school_admin'::public.user_role
        or exists (
          select 1 from public.guardian_children gc
          join public.trip_children tc on tc.child_id = gc.child_id
          where gc.school_id = p_school_id and gc.active
            and tc.trip_id = p_trip_id and tc.status not in (
              'handed_over'::public.trip_child_status, 'absent'::public.trip_child_status
            )
            and gc.guardian_user_id = m.user_id
        )
      )
    on conflict (school_id, alert_id, recipient_user_id) do nothing;
  end if;

  insert into public.trip_events (
    school_id, trip_id, event_type, actor_user_id, event_data, occurred_at
  ) values (
    p_school_id, p_trip_id, 'trip_completed', v_actor,
    jsonb_build_object('unaccounted_children', v_unaccounted), p_ended_at
  );

  return v_trip;
end;
$function$;

create or replace function public.record_bus_position(
  p_school_id uuid,
  p_trip_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_heading_degrees numeric,
  p_speed_kph numeric,
  p_accuracy_meters numeric,
  p_recorded_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_bus_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_longitude not between -180 and 180 or p_latitude not between -90 and 90
     or p_recorded_at is null
     or p_recorded_at > now() + interval '2 minutes'
     or p_recorded_at < now() - interval '10 minutes'
     or (p_heading_degrees is not null and (p_heading_degrees < 0 or p_heading_degrees >= 360))
     or (p_speed_kph is not null and (p_speed_kph < 0 or p_speed_kph > 200))
     or (p_accuracy_meters is not null and (p_accuracy_meters < 0 or p_accuracy_meters > 1000)) then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select t.bus_id into v_bus_id
  from public.trips t
  where t.id = p_trip_id and t.school_id = p_school_id
    and t.status = 'active'::public.trip_status
    and exists (
      select 1 from public.staff_members s
      where s.school_id = t.school_id and s.user_id = v_actor
        and s.active and s.role in ('driver', 'supervisor')
        and s.id in (t.driver_id, t.supervisor_id)
    );
  if v_bus_id is null then
    raise exception using errcode = '42501', message = 'ACTIVE_ASSIGNED_TRIP_REQUIRED';
  end if;

  insert into public.bus_positions (
    trip_id, school_id, bus_id, location, heading_degrees,
    speed_kph, accuracy_meters, recorded_at
  ) values (
    p_trip_id, p_school_id, v_bus_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_heading_degrees, p_speed_kph, p_accuracy_meters, p_recorded_at
  )
  on conflict (trip_id) do update
    set location = excluded.location,
        heading_degrees = excluded.heading_degrees,
        speed_kph = excluded.speed_kph,
        accuracy_meters = excluded.accuracy_meters,
        recorded_at = excluded.recorded_at,
        received_at = now()
    where public.bus_positions.recorded_at < excluded.recorded_at;

  insert into public.bus_position_history (
    school_id, trip_id, bus_id, location, heading_degrees,
    speed_kph, accuracy_meters, recorded_at
  ) values (
    p_school_id, p_trip_id, v_bus_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_heading_degrees, p_speed_kph, p_accuracy_meters, p_recorded_at
  );

  insert into public.trip_events (
    school_id, trip_id, event_type, actor_user_id, occurred_at
  ) values (p_school_id, p_trip_id, 'position_recorded', v_actor, p_recorded_at);
end;
$function$;

revoke all on function public.start_trip(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.end_trip(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.record_bus_position(uuid, uuid, double precision, double precision, numeric, numeric, numeric, timestamptz) from public, anon;
grant execute on function public.start_trip(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.end_trip(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.record_bus_position(uuid, uuid, double precision, double precision, numeric, numeric, numeric, timestamptz) to authenticated;
