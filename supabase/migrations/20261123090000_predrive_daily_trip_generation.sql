-- B4.2: assign drivers/supervisors to recurring route schedules and generate
-- the current Harare service day's trips idempotently. This migration is additive.
-- The scheduler invokes the RPC through the service-role-only Edge Function.

alter table public.route_schedules
  add column if not exists driver_id uuid,
  add column if not exists supervisor_id uuid;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.route_schedules'::regclass
      and conname = 'route_schedules_driver_school_fkey'
  ) then
    alter table public.route_schedules
      add constraint route_schedules_driver_school_fkey
      foreign key (driver_id, school_id)
      references public.staff_members (id, school_id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.route_schedules'::regclass
      and conname = 'route_schedules_supervisor_school_fkey'
  ) then
    alter table public.route_schedules
      add constraint route_schedules_supervisor_school_fkey
      foreign key (supervisor_id, school_id)
      references public.staff_members (id, school_id)
      on delete restrict;
  end if;
end;
$constraints$;

create index if not exists route_schedules_driver_active_idx
  on public.route_schedules (school_id, driver_id, active)
  where driver_id is not null;

create index if not exists route_schedules_supervisor_active_idx
  on public.route_schedules (school_id, supervisor_id, active)
  where supervisor_id is not null;

create or replace function private.assert_route_schedule_staff_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.driver_id is not null and not exists (
    select 1
    from public.staff_members staff
    where staff.id = new.driver_id
      and staff.school_id = new.school_id
      and staff.role = 'driver'::public.user_role
      and staff.active = true
  ) then
    raise exception using errcode = '23514', message = 'ROUTE_SCHEDULE_DRIVER_ROLE_REQUIRED';
  end if;

  if new.supervisor_id is not null and not exists (
    select 1
    from public.staff_members staff
    where staff.id = new.supervisor_id
      and staff.school_id = new.school_id
      and staff.role = 'supervisor'::public.user_role
      and staff.active = true
  ) then
    raise exception using errcode = '23514', message = 'ROUTE_SCHEDULE_SUPERVISOR_ROLE_REQUIRED';
  end if;

  return new;
end;
$function$;

revoke all on function private.assert_route_schedule_staff_roles()
  from public, anon, authenticated, service_role;

drop trigger if exists route_schedules_assert_staff_roles on public.route_schedules;
create trigger route_schedules_assert_staff_roles
before insert or update of school_id, driver_id, supervisor_id
on public.route_schedules
for each row
execute function private.assert_route_schedule_staff_roles();

create or replace function public.assign_route_schedule_staff(
  p_school_id uuid,
  p_schedule_id uuid,
  p_driver_id uuid,
  p_supervisor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_schedule_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  if p_driver_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  update public.route_schedules
  set driver_id = p_driver_id,
      supervisor_id = p_supervisor_id,
      updated_at = now()
  where id = p_schedule_id
    and school_id = p_school_id
  returning id into v_schedule_id;

  if v_schedule_id is null then
    raise exception using errcode = 'P0002', message = 'ROUTE_SCHEDULE_NOT_FOUND';
  end if;

  return v_schedule_id;
end;
$function$;

revoke all on function public.assign_route_schedule_staff(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.assign_route_schedule_staff(uuid, uuid, uuid, uuid)
  to authenticated;

create or replace function public.generate_daily_trips(
  p_service_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_service_date date := coalesce(
    p_service_date,
    (now() at time zone 'Africa/Harare')::date
  );
  v_today date := (now() at time zone 'Africa/Harare')::date;
  v_schedule record;
  v_trip_id uuid;
  v_scheduled_at timestamptz;
  v_created integer := 0;
  v_skipped_assignment integer := 0;
  v_children_added integer := 0;
  v_children_count integer := 0;
begin
  if v_service_date <> v_today then
    raise exception using errcode = '22023', message = 'SERVICE_DATE_MUST_BE_TODAY';
  end if;

  for v_schedule in
    select
      schedule.id as schedule_id,
      schedule.school_id,
      schedule.route_id,
      schedule.direction,
      schedule.departure_time,
      schedule.driver_id,
      schedule.supervisor_id,
      route.assigned_bus_id as bus_id,
      school.timezone,
      bus.status as bus_status,
      driver.id as active_driver_id,
      supervisor.id as active_supervisor_id
    from public.route_schedules schedule
    join public.transport_routes route
      on route.id = schedule.route_id
     and route.school_id = schedule.school_id
    join public.schools school
      on school.id = schedule.school_id
     and school.status = 'active'::public.school_status
    join pg_catalog.pg_timezone_names zone
      on zone.name = school.timezone
    left join public.buses bus
      on bus.id = route.assigned_bus_id
     and bus.school_id = schedule.school_id
    left join public.staff_members driver
      on driver.id = schedule.driver_id
     and driver.school_id = schedule.school_id
     and driver.role = 'driver'::public.user_role
     and driver.active = true
    left join public.staff_members supervisor
      on supervisor.id = schedule.supervisor_id
     and supervisor.school_id = schedule.school_id
     and supervisor.role = 'supervisor'::public.user_role
     and supervisor.active = true
    where schedule.active = true
      and route.status = 'active'::public.route_status
      and schedule.effective_from <= v_service_date
      and (schedule.effective_until is null or schedule.effective_until >= v_service_date)
      and extract(dow from v_service_date)::smallint = any(schedule.days_of_week)
  loop
    if v_schedule.bus_id is null
       or v_schedule.bus_status is distinct from 'active'::public.bus_status
       or v_schedule.active_driver_id is null
       or (
         v_schedule.supervisor_id is not null
         and v_schedule.active_supervisor_id is null
       ) then
      v_skipped_assignment := v_skipped_assignment + 1;
      continue;
    end if;

    v_scheduled_at := (
      (v_service_date + v_schedule.departure_time)
      at time zone v_schedule.timezone
    );

    v_trip_id := null;
    insert into public.trips (
      school_id,
      route_id,
      schedule_id,
      bus_id,
      supervisor_id,
      driver_id,
      direction,
      service_date,
      status,
      scheduled_at,
      generation_key
    ) values (
      v_schedule.school_id,
      v_schedule.route_id,
      v_schedule.schedule_id,
      v_schedule.bus_id,
      v_schedule.supervisor_id,
      v_schedule.driver_id,
      v_schedule.direction,
      v_service_date,
      'scheduled'::public.trip_status,
      v_scheduled_at,
      'schedule:' || v_schedule.schedule_id::text || ':' ||
        v_service_date::text || ':' || v_schedule.direction::text
    )
    on conflict (school_id, schedule_id, service_date, direction)
      where schedule_id is not null
    do nothing
    returning id into v_trip_id;

    if v_trip_id is null then
      continue;
    end if;

    v_created := v_created + 1;

    insert into public.trip_children (
      school_id,
      trip_id,
      child_id,
      idempotency_key
    )
    select
      assignment.school_id,
      v_trip_id,
      assignment.child_id,
      gen_random_uuid()
    from public.child_route_assignments assignment
    join public.children child
      on child.id = assignment.child_id
     and child.school_id = assignment.school_id
     and child.status = 'active'::public.child_status
    where assignment.school_id = v_schedule.school_id
      and assignment.route_id = v_schedule.route_id
      and assignment.active = true
    on conflict (trip_id, child_id) do nothing;

    get diagnostics v_children_count = row_count;
    v_children_added := v_children_added + v_children_count;
  end loop;

  return jsonb_build_object(
    'serviceDate', v_service_date,
    'timezone', 'Africa/Harare',
    'createdTrips', v_created,
    'skippedUnassignedSchedules', v_skipped_assignment,
    'createdTripChildren', v_children_added
  );
end;
$function$;

revoke all on function public.generate_daily_trips(date)
  from public, anon, authenticated, service_role;
grant execute on function public.generate_daily_trips(date)
  to service_role;

comment on column public.route_schedules.driver_id is
  'School-scoped active driver assigned to this recurring schedule; required before daily trip generation.';
comment on column public.route_schedules.supervisor_id is
  'Optional school-scoped active supervisor assigned to this recurring schedule.';
comment on function public.generate_daily_trips(date) is
  'Creates today's trips in Africa/Harare only, with idempotent schedule/date/direction keys and active route-assigned children. Service-role only.';
