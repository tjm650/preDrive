-- Split write policies from read policies so broad FOR ALL policies cannot
-- recursively participate in SELECT policy evaluation.
create or replace function private.is_guardian_on_active_route(target_route uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trips t
    join public.route_children rc on rc.route_id = t.route_id
    join public.guardianships g on g.child_id = rc.child_id
    where t.route_id = target_route
      and t.status = 'active'
      and g.guardian_id = (select auth.uid())
  )
$$;

create or replace function private.is_guardian_on_active_bus(target_bus uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.trips t
    join public.route_children rc on rc.route_id = t.route_id
    join public.guardianships g on g.child_id = rc.child_id
    where t.bus_id = target_bus
      and t.status = 'active'
      and g.guardian_id = (select auth.uid())
  )
$$;

revoke all on function private.is_guardian_on_active_route(uuid) from public, anon;
revoke all on function private.is_guardian_on_active_bus(uuid) from public, anon;
grant execute on function private.is_guardian_on_active_route(uuid) to authenticated;
grant execute on function private.is_guardian_on_active_bus(uuid) to authenticated;

drop policy if exists can_read_route_legacy on public.routes;
drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes
for select to authenticated
using (
  private.can_read_school(school_id)
  or private.is_route_assigned(routes.id)
  or private.is_guardian_on_active_route(routes.id)
);

drop policy if exists routes_admin_write on public.routes;
create policy routes_admin_insert on public.routes
for insert to authenticated
with check (private.is_school_admin(school_id));
create policy routes_admin_update on public.routes
for update to authenticated
using (private.is_school_admin(school_id))
with check (private.is_school_admin(school_id));
create policy routes_admin_delete on public.routes
for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists buses_read on public.buses;
create policy buses_read on public.buses
for select to authenticated
using (
  private.can_read_school(school_id)
  or private.is_bus_on_assigned_trip(buses.id)
  or private.is_guardian_on_active_bus(buses.id)
);

drop policy if exists buses_admin_write on public.buses;
create policy buses_admin_insert on public.buses
for insert to authenticated
with check (private.is_school_admin(school_id));
create policy buses_admin_update on public.buses
for update to authenticated
using (private.is_school_admin(school_id))
with check (private.is_school_admin(school_id));
create policy buses_admin_delete on public.buses
for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists trips_admin_write on public.trips;
create policy trips_admin_insert on public.trips
for insert to authenticated
with check (
  private.is_school_admin((select r.school_id from public.routes r where r.id = route_id))
);
create policy trips_admin_update on public.trips
for update to authenticated
using (private.is_trip_school_admin(trips.id))
with check (private.is_trip_school_admin(trips.id));
create policy trips_admin_delete on public.trips
for delete to authenticated
using (private.is_trip_school_admin(trips.id));

drop policy if exists trip_events_admin_all on public.trip_events;
create policy trip_events_admin_insert on public.trip_events
for insert to authenticated
with check (private.is_trip_school_admin(trip_id));
create policy trip_events_admin_update on public.trip_events
for update to authenticated
using (private.is_trip_school_admin(trip_id))
with check (private.is_trip_school_admin(trip_id));
create policy trip_events_admin_delete on public.trip_events
for delete to authenticated
using (private.is_trip_school_admin(trip_id));

drop policy if exists bus_live_supervisor_write on public.bus_live;
create policy bus_live_supervisor_insert on public.bus_live
for insert to authenticated
with check (private.is_assigned_supervisor(trip_id) or private.is_trip_school_admin(trip_id));
create policy bus_live_supervisor_update on public.bus_live
for update to authenticated
using (private.is_assigned_supervisor(trip_id) or private.is_trip_school_admin(trip_id))
with check (private.is_assigned_supervisor(trip_id) or private.is_trip_school_admin(trip_id));
create policy bus_live_supervisor_delete on public.bus_live
for delete to authenticated
using (private.is_assigned_supervisor(trip_id) or private.is_trip_school_admin(trip_id));
