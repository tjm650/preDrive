-- B3.6: guardian-selected arrival radius and child-to-stop assignment.
-- Notifications are persisted as alerts; delivery is handled by B4 Edge Functions.

alter table public.guardian_children
  add column if not exists notification_radius_meters integer not null default 1000
  check (notification_radius_meters in (500, 1000, 2000));

create table if not exists public.child_route_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  child_id uuid not null,
  route_id uuid not null,
  route_stop_id uuid not null,
  active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_route_assignments_id_school_key unique (id, school_id),
  constraint child_route_assignments_child_school_fkey
    foreign key (child_id, school_id)
    references public.children(id, school_id) on delete cascade,
  constraint child_route_assignments_route_school_fkey
    foreign key (route_id, school_id)
    references public.transport_routes(id, school_id) on delete restrict,
  constraint child_route_assignments_stop_school_fkey
    foreign key (route_stop_id, school_id)
    references public.route_stops(id, school_id) on delete restrict
);

create unique index if not exists child_route_assignments_one_active_child_uidx
  on public.child_route_assignments (school_id, child_id)
  where active = true;

create index if not exists child_route_assignments_route_stop_active_idx
  on public.child_route_assignments (school_id, route_id, route_stop_id)
  where active = true;

alter table public.child_route_assignments enable row level security;

drop policy if exists child_route_assignments_select_policy on public.child_route_assignments;
create policy child_route_assignments_select_policy
on public.child_route_assignments
for select to authenticated
using (
  private.has_role(school_id, 'school_admin'::public.user_role)
  or private.is_guardian_of(child_id)
);

drop policy if exists child_route_assignments_admin_write_policy on public.child_route_assignments;
create policy child_route_assignments_admin_write_policy
on public.child_route_assignments
for all to authenticated
using (private.has_role(school_id, 'school_admin'::public.user_role))
with check (private.has_role(school_id, 'school_admin'::public.user_role));

grant select, insert, update, delete on public.child_route_assignments to authenticated;

create unique index if not exists alerts_school_dedupe_key_uidx
  on public.alerts (school_id, dedupe_key)
  where dedupe_key is not null;

create or replace function public.evaluate_trip_geofences(
  p_school_id uuid,
  p_trip_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_position public.bus_positions%rowtype;
  v_assignment record;
  v_alert_id uuid;
  v_created integer := 0;
  v_dedupe text;
begin
  -- This is a trusted automation entry point, not a client callable function.
  -- EXECUTE is granted only to service_role below.
  select bp.* into v_position
  from public.bus_positions bp
  join public.trips t on t.id = bp.trip_id and t.school_id = bp.school_id
  where bp.school_id = p_school_id and bp.trip_id = p_trip_id
    and t.status = 'active'::public.trip_status
    and bp.recorded_at >= now() - interval '5 minutes';

  if not found then
    return 0;
  end if;

  for v_assignment in
    select
      gc.guardian_user_id,
      gc.child_id,
      gc.notification_radius_meters,
      c.first_name,
      rs.id as stop_id,
      rs.name as stop_name
    from public.trip_children tc
    join public.children c
      on c.id = tc.child_id and c.school_id = tc.school_id
    join public.child_route_assignments cra
      on cra.school_id = tc.school_id and cra.child_id = tc.child_id
      and cra.route_id = (select t.route_id from public.trips t where t.id = p_trip_id and t.school_id = p_school_id)
      and cra.active
    join public.route_stops rs
      on rs.id = cra.route_stop_id and rs.school_id = cra.school_id
    join public.guardian_children gc
      on gc.school_id = tc.school_id and gc.child_id = tc.child_id and gc.active
    where tc.school_id = p_school_id and tc.trip_id = p_trip_id
      and tc.status not in (
        'handed_over'::public.trip_child_status,
        'absent'::public.trip_child_status
      )
      and rs.location is not null
      and extensions.st_dwithin(
        v_position.location,
        rs.location,
        gc.notification_radius_meters
      )
  loop
    v_dedupe := 'geofence:' || p_trip_id::text || ':' ||
      v_assignment.child_id::text || ':' || v_assignment.guardian_user_id::text;

    if exists (
      select 1 from public.alerts a
      where a.school_id = p_school_id and a.dedupe_key = v_dedupe
    ) then
      continue;
    end if;

    insert into public.alerts (
      school_id, title, message, severity, source_type,
      source_id, dedupe_key, created_by
    ) values (
      p_school_id,
      'Bus approaching',
      'The bus is approaching ' || v_assignment.stop_name ||
        '. Please get ' || v_assignment.first_name || ' ready.',
      'info'::public.alert_severity,
      'geofence',
      p_trip_id,
      v_dedupe,
      null
    ) returning id into v_alert_id;

    insert into public.alert_recipients (
      school_id, alert_id, recipient_user_id
    ) values (
      p_school_id, v_alert_id, v_assignment.guardian_user_id
    )
    on conflict (school_id, alert_id, recipient_user_id) do nothing;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$function$;

revoke all on function public.evaluate_trip_geofences(uuid, uuid) from public, anon, authenticated;
grant execute on function public.evaluate_trip_geofences(uuid, uuid) to service_role;

comment on function public.evaluate_trip_geofences(uuid, uuid) is
  'Trusted B4 scheduler/edge entry point. Creates one deduplicated arrival alert per linked guardian while the trip is active.';
