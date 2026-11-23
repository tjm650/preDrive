-- B3.3: child attendance transitions and verified collector handover.
-- A failed PIN is counted atomically. Three failures lock that collector for 15 minutes.

create unique index if not exists trip_events_school_idempotency_uidx
  on public.trip_events (school_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.record_child_status(
  p_school_id uuid,
  p_trip_id uuid,
  p_child_id uuid,
  p_recorded_at timestamptz,
  p_idempotency_key uuid,
  p_status public.trip_child_status default 'on_board'
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_trip public.trips%rowtype;
  v_trip_child public.trip_children%rowtype;
  v_existing_event public.trip_events%rowtype;
  v_actor uuid := auth.uid();
  v_event_type text;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_status is null or p_status not in ('on_board'::public.trip_child_status, 'absent'::public.trip_child_status)
     or p_idempotency_key is null
     or p_recorded_at is null
     or p_recorded_at > now() + interval '2 minutes'
     or p_recorded_at < now() - interval '24 hours' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select t.* into v_trip
  from public.trips t
  join public.staff_members s
    on s.id = t.supervisor_id and s.school_id = t.school_id
  where t.id = p_trip_id and t.school_id = p_school_id
    and t.status = 'active'::public.trip_status
    and s.user_id = v_actor and s.active
    and s.role = 'supervisor';
  if not found then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_school_id::text || p_idempotency_key::text, 0)
  );

  select e.* into v_existing_event
  from public.trip_events e
  where e.school_id = p_school_id and e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_event.trip_id = p_trip_id
       and v_existing_event.occurred_at = p_recorded_at
       and v_existing_event.event_type = case when p_status = 'absent'::public.trip_child_status
         then 'child_marked_absent' else 'child_boarded' end
       and exists (
         select 1 from public.trip_children tc
         where tc.id = v_existing_event.trip_child_id and tc.child_id = p_child_id
       ) then
      return;
    end if;
    raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;

  select tc.* into v_trip_child
  from public.trip_children tc
  where tc.school_id = p_school_id
    and tc.trip_id = p_trip_id
    and tc.child_id = p_child_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRIP_CHILD_NOT_FOUND';
  end if;
  if v_trip_child.status <> 'pending'::public.trip_child_status then
    raise exception using errcode = '40001', message = 'CHILD_STATUS_CONFLICT';
  end if;

  update public.trip_children
  set status = p_status,
      boarded_at = case when p_status = 'on_board' then p_recorded_at else null end,
      recorded_by = v_actor,
      last_event_at = p_recorded_at,
      updated_at = now()
  where id = v_trip_child.id;

  v_event_type := case when p_status = 'absent' then 'child_marked_absent' else 'child_boarded' end;
  insert into public.trip_events (
    school_id, trip_id, trip_child_id, event_type, actor_user_id,
    idempotency_key, occurred_at
  ) values (
    p_school_id, p_trip_id, v_trip_child.id, v_event_type, v_actor,
    p_idempotency_key, p_recorded_at
  );
end;
$function$;

create or replace function public.verify_handover(
  p_school_id uuid,
  p_trip_id uuid,
  p_child_id uuid,
  p_collector_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_trip_child public.trip_children%rowtype;
  v_collector public.approved_collectors%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.trips t
    join public.staff_members s
      on s.id = t.supervisor_id and s.school_id = t.school_id
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and s.user_id = v_actor and s.active and s.role = 'supervisor'
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  select tc.* into v_trip_child
  from public.trip_children tc
  where tc.school_id = p_school_id and tc.trip_id = p_trip_id
    and tc.child_id = p_child_id
  for update;
  if not found or v_trip_child.status <> 'on_board'::public.trip_child_status then
    raise exception using errcode = '40001', message = 'CHILD_NOT_ON_BOARD';
  end if;

  select ac.* into v_collector
  from public.approved_collectors ac
  where ac.id = p_collector_id and ac.school_id = p_school_id
    and ac.child_id = p_child_id and ac.active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPROVED_COLLECTOR_NOT_FOUND';
  end if;
  if v_collector.pin_locked_until is not null and v_collector.pin_locked_until > now() then
    raise exception using errcode = '42501', message = 'PIN_LOCKED';
  end if;

  if extensions.crypt(p_pin, v_collector.pin_hash) <> v_collector.pin_hash then
    update public.approved_collectors
    set pin_failed_attempts = least(pin_failed_attempts + 1, 3),
        pin_locked_until = case
          when pin_failed_attempts + 1 >= 3 then now() + interval '15 minutes'
          else null
        end,
        updated_at = now()
    where id = v_collector.id;
    insert into public.audit_log (
      school_id, actor_user_id, action, target_table, target_id, outcome
    ) values (
      p_school_id, v_actor, 'handover.pin_failed', 'approved_collectors',
      v_collector.id::text, 'denied'
    );
    return false;
  end if;

  update public.trip_children
  set status = 'handed_over'::public.trip_child_status,
      handed_over_at = now(),
      recorded_by = v_actor,
      last_event_at = now(),
      updated_at = now()
  where id = v_trip_child.id;

  update public.approved_collectors
  set pin_failed_attempts = 0, pin_locked_until = null, updated_at = now()
  where id = v_collector.id;

  insert into public.trip_events (
    school_id, trip_id, trip_child_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, v_trip_child.id, 'child_handed_over', v_actor,
    jsonb_build_object('collector_id', v_collector.id)
  );

  return true;
end;
$function$;

revoke all on function public.record_child_status(uuid, uuid, uuid, timestamptz, uuid, public.trip_child_status) from public, anon;
revoke all on function public.verify_handover(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.record_child_status(uuid, uuid, uuid, timestamptz, uuid, public.trip_child_status) to authenticated;
grant execute on function public.verify_handover(uuid, uuid, uuid, uuid, text) to authenticated;
 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.trips t
    join public.staff_members s
      on s.id = t.supervisor_id and s.school_id = t.school_id
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and s.user_id = v_actor and s.active and s.role = 'supervisor'
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  select tc.* into v_trip_child
  from public.trip_children tc
  where tc.school_id = p_school_id and tc.trip_id = p_trip_id
    and tc.child_id = p_child_id
  for update;
  if not found or v_trip_child.status <> 'on_board'::public.trip_child_status then
    raise exception using errcode = '40001', message = 'CHILD_NOT_ON_BOARD';
  end if;

  select ac.* into v_collector
  from public.approved_collectors ac
  where ac.id = p_collector_id and ac.school_id = p_school_id
    and ac.child_id = p_child_id and ac.active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPROVED_COLLECTOR_NOT_FOUND';
  end if;
  if v_collector.pin_locked_until is not null and v_collector.pin_locked_until > now() then
    raise exception using errcode = '42501', message = 'PIN_LOCKED';
  end if;

  if extensions.crypt(p_pin, v_collector.pin_hash) <> v_collector.pin_hash then
    update public.approved_collectors
    set pin_failed_attempts = least(pin_failed_attempts + 1, 3),
        pin_locked_until = case
          when pin_failed_attempts + 1 >= 3 then now() + interval '15 minutes'
          else null
        end,
        updated_at = now()
    where id = v_collector.id;
    insert into public.audit_log (
      school_id, actor_user_id, action, target_table, target_id, outcome
    ) values (
      p_school_id, v_actor, 'handover.pin_failed', 'approved_collectors',
      v_collector.id::text, 'denied'
    );
    return false;
  end if;

  update public.trip_children
  set status = 'handed_over'::public.trip_child_status,
      handed_over_at = now(),
      recorded_by = v_actor,
      last_event_at = now(),
      updated_at = now()
  where id = v_trip_child.id;

  update public.approved_collectors
  set pin_failed_attempts = 0, pin_locked_until = null, updated_at = now()
  where id = v_collector.id;

  insert into public.trip_events (
    school_id, trip_id, trip_child_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, v_trip_child.id, 'child_handed_over', v_actor,
    jsonb_build_object('collector_id', v_collector.id)
  );

  return true;
end;
$function$;

revoke all on function public.record_child_status(uuid, uuid, uuid, timestamptz, uuid, public.trip_child_status) from public, anon;
revoke all on function public.verify_handover(uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.record_child_status(uuid, uuid, uuid, timestamptz, uuid, public.trip_child_status) to authenticated;
grant execute on function public.verify_handover(uuid, uuid, uuid, uuid, text) to authenticated;
