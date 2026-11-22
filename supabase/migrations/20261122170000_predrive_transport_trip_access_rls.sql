-- preDrive B2.4: fleet, trip and active-trip location access.
-- Additive RLS migration. It creates no rows and does not alter existing data.
-- Driver assignment is resolved through staff_members.user_id and the
-- school-scoped trip foreign keys. Drivers never receive trip_children,
-- trip_events or approved_collectors access: handover remains supervisor-only.
--
-- Location visibility is deliberately limited to active trips. Historical GPS
-- positions are not granted to authenticated clients.

-- All operational tables remain RLS-protected.
alter table public.buses enable row level security;
alter table public.transport_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.route_schedules enable row level security;
alter table public.trips enable row level security;
alter table public.trip_children enable row level security;
alter table public.bus_positions enable row level security;
alter table public.bus_position_history enable row level security;
alter table public.vehicle_checks enable row level security;
alter table public.delay_reports enable row level security;
alter table public.trip_events enable row level security;
alter table public.approved_collectors enable row level security;

-- Fleet and route metadata is visible to school admins/supervisors and to
-- drivers/guardians only when a matching active trip gives them a relationship.
drop policy if exists buses_select_operational_relationship on public.buses;
create policy buses_select_operational_relationship
on public.buses
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or exists (
    select 1
    from public.trips as trip
    where trip.school_id = buses.school_id
      and trip.bus_id = buses.id
      and (
        private.is_assigned_to_trip(trip.id)
        or (
          trip.status = 'active'::public.trip_status
          and exists (
            select 1
            from public.trip_children as trip_child
            join public.guardian_children as guardian_link
              on guardian_link.school_id = trip_child.school_id
             and guardian_link.child_id = trip_child.child_id
            where trip_child.school_id = trip.school_id
              and trip_child.trip_id = trip.id
              and guardian_link.guardian_user_id = (select auth.uid())
              and guardian_link.active = true
              and private.has_school_role(
                guardian_link.school_id,
                array['guardian']::public.user_role[]
              )
          )
        )
      )
  )
);

drop policy if exists transport_routes_select_operational_relationship on public.transport_routes;
create policy transport_routes_select_operational_relationship
on public.transport_routes
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or exists (
    select 1
    from public.trips as trip
    where trip.school_id = transport_routes.school_id
      and trip.route_id = transport_routes.id
      and (
        private.is_assigned_to_trip(trip.id)
        or (
          trip.status = 'active'::public.trip_status
          and exists (
            select 1
            from public.trip_children as trip_child
            join public.guardian_children as guardian_link
              on guardian_link.school_id = trip_child.school_id
             and guardian_link.child_id = trip_child.child_id
            where trip_child.school_id = trip.school_id
              and trip_child.trip_id = trip.id
              and guardian_link.guardian_user_id = (select auth.uid())
              and guardian_link.active = true
              and private.has_school_role(
                guardian_link.school_id,
                array['guardian']::public.user_role[]
              )
          )
        )
      )
  )
);

drop policy if exists route_stops_select_operational_relationship on public.route_stops;
create policy route_stops_select_operational_relationship
on public.route_stops
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or exists (
    select 1
    from public.trips as trip
    where trip.school_id = route_stops.school_id
      and trip.route_id = route_stops.route_id
      and (
        private.is_assigned_to_trip(trip.id)
        or (
          trip.status = 'active'::public.trip_status
          and exists (
            select 1
            from public.trip_children as trip_child
            join public.guardian_children as guardian_link
              on guardian_link.school_id = trip_child.school_id
             and guardian_link.child_id = trip_child.child_id
            where trip_child.school_id = trip.school_id
              and trip_child.trip_id = trip.id
              and guardian_link.guardian_user_id = (select auth.uid())
              and guardian_link.active = true
              and private.has_school_role(
                guardian_link.school_id,
                array['guardian']::public.user_role[]
              )
          )
        )
      )
  )
);

drop policy if exists route_schedules_select_operational_relationship on public.route_schedules;
create policy route_schedules_select_operational_relationship
on public.route_schedules
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or exists (
    select 1
    from public.trips as trip
    where trip.school_id = route_schedules.school_id
      and trip.schedule_id = route_schedules.id
      and (
        private.is_assigned_to_trip(trip.id)
        or (
          trip.status = 'active'::public.trip_status
          and exists (
            select 1
            from public.trip_children as trip_child
            join public.guardian_children as guardian_link
              on guardian_link.school_id = trip_child.school_id
             and guardian_link.child_id = trip_child.child_id
            where trip_child.school_id = trip.school_id
              and trip_child.trip_id = trip.id
              and guardian_link.guardian_user_id = (select auth.uid())
              and guardian_link.active = true
              and private.has_school_role(
                guardian_link.school_id,
                array['guardian']::public.user_role[]
              )
          )
        )
      )
  )
);

-- Trip rows: school admins/supervisors can inspect school operations; drivers
-- only see their own assigned trips; guardians see only active trips carrying
-- one of their linked children.
drop policy if exists trips_select_assigned_or_linked on public.trips;
create policy trips_select_assigned_or_linked
on public.trips
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or private.is_assigned_to_trip(trips.id)
  or (
    status = 'active'::public.trip_status
    and exists (
      select 1
      from public.trip_children as trip_child
      join public.guardian_children as guardian_link
        on guardian_link.school_id = trip_child.school_id
       and guardian_link.child_id = trip_child.child_id
      where trip_child.school_id = trips.school_id
        and trip_child.trip_id = trips.id
        and guardian_link.guardian_user_id = (select auth.uid())
        and guardian_link.active = true
        and private.has_school_role(
          guardian_link.school_id,
          array['guardian']::public.user_role[]
        )
    )
  )
);

-- Child movement records are visible to school admins/supervisors and to the
-- guardian of that exact child. Drivers are intentionally excluded.
drop policy if exists trip_children_select_school_ops_or_guardian on public.trip_children;
create policy trip_children_select_school_ops_or_guardian
on public.trip_children
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or exists (
    select 1
    from public.guardian_children as guardian_link
    where guardian_link.school_id = trip_children.school_id
      and guardian_link.child_id = trip_children.child_id
      and guardian_link.guardian_user_id = (select auth.uid())
      and guardian_link.active = true
      and private.has_school_role(
        guardian_link.school_id,
        array['guardian']::public.user_role[]
      )
  )
);

-- Current position is readable only while the trip is active. Drivers must be
-- assigned to the trip; guardians must have a linked child on that trip.
drop policy if exists bus_positions_select_active_trip_relationship on public.bus_positions;
create policy bus_positions_select_active_trip_relationship
on public.bus_positions
for select
to authenticated
using (
  exists (
    select 1
    from public.trips as trip
    where trip.id = bus_positions.trip_id
      and trip.school_id = bus_positions.school_id
      and trip.bus_id = bus_positions.bus_id
      and trip.status = 'active'::public.trip_status
      and (
        private.has_school_role(
          trip.school_id,
          array['school_admin','supervisor']::public.user_role[]
        )
        or private.is_assigned_to_trip(trip.id)
        or exists (
          select 1
          from public.trip_children as trip_child
          join public.guardian_children as guardian_link
            on guardian_link.school_id = trip_child.school_id
           and guardian_link.child_id = trip_child.child_id
          where trip_child.school_id = trip.school_id
            and trip_child.trip_id = trip.id
            and guardian_link.guardian_user_id = (select auth.uid())
            and guardian_link.active = true
            and private.has_school_role(
              guardian_link.school_id,
              array['guardian']::public.user_role[]
            )
        )
      )
  )
);

-- GPS history is deliberately not readable directly by authenticated clients.
drop policy if exists bus_position_history_no_authenticated_access on public.bus_position_history;
create policy bus_position_history_no_authenticated_access
on public.bus_position_history
for select
to authenticated
using (false);

-- Operational check/report visibility is limited to school admins/supervisors
-- and the driver who created the record. Writes are reserved for trusted flows.
drop policy if exists vehicle_checks_select_school_ops_or_actor on public.vehicle_checks;
create policy vehicle_checks_select_school_ops_or_actor
on public.vehicle_checks
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or (
    checked_by = (select auth.uid())
    and private.has_school_role(school_id, array['driver']::public.user_role[])
  )
);

drop policy if exists delay_reports_select_school_ops_or_actor on public.delay_reports;
create policy delay_reports_select_school_ops_or_actor
on public.delay_reports
for select
to authenticated
using (
  private.has_school_role(school_id, array['school_admin','supervisor']::public.user_role[])
  or (
    reported_by = (select auth.uid())
    and private.has_school_role(school_id, array['driver']::public.user_role[])
  )
);

-- Sensitive operational records must be accessed through narrowly scoped
-- trusted workflows, not broad direct table reads.
drop policy if exists trip_events_no_authenticated_access on public.trip_events;
create policy trip_events_no_authenticated_access
on public.trip_events
for select
to authenticated
using (false);

drop policy if exists approved_collectors_no_authenticated_access on public.approved_collectors;
create policy approved_collectors_no_authenticated_access
on public.approved_collectors
for select
to authenticated
using (false);

-- Explicit read-only grants for the operational tables covered here.
-- No authenticated INSERT/UPDATE/DELETE privilege is introduced.
revoke all on table
  public.buses,
  public.transport_routes,
  public.route_stops,
  public.route_schedules,
  public.trips,
  public.trip_children,
  public.bus_positions,
  public.bus_position_history,
  public.vehicle_checks,
  public.delay_reports,
  public.trip_events,
  public.approved_collectors
from anon, authenticated;

grant select on table
  public.buses,
  public.transport_routes,
  public.route_stops,
  public.route_schedules,
  public.trips,
  public.trip_children,
  public.bus_positions,
  public.vehicle_checks,
  public.delay_reports
to authenticated;

comment on table public.bus_positions is
  'Current GPS position for an active trip only; authenticated visibility requires an active school operational role, assigned driver, or guardian linked to a child on that trip.';
comment on table public.bus_position_history is
  'Historical GPS positions are not exposed to authenticated clients; retention is governed by the location privacy lifecycle.';
comment on table public.approved_collectors is
  'Approved collector identity and PIN hashes are never directly exposed to authenticated clients; use trusted handover verification workflows.';
