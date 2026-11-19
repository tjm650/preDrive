-- Avoid RLS recursion when trip-scoped policies need to resolve a trip's school.
create or replace function private.can_read_trip_school(target_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.routes r on r.id = t.route_id
    where t.id = target_trip
      and private.can_read_school(r.school_id)
  )
$$;

revoke all on function private.can_read_trip_school(uuid) from public, anon;
grant execute on function private.can_read_trip_school(uuid) to authenticated;

drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips
for select to authenticated
using (
  private.can_read_trip_school(trips.id)
  or supervisor_id = (select auth.uid())
  or (status = 'active' and private.is_guardian_on_active_trip(trips.id))
);

drop policy if exists trip_events_read on public.trip_events;
create policy trip_events_read on public.trip_events
for select to authenticated
using (
  private.is_assigned_supervisor(trip_id)
  or private.can_read_trip_school(trip_id)
  or (
    child_id is not null
    and private.is_guardian(child_id)
    and exists (
      select 1 from public.children c
      where c.id = trip_events.child_id
        and c.school_id = private.current_school_id()
    )
  )
);

drop policy if exists trip_events_admin_all on public.trip_events;
create policy trip_events_admin_all on public.trip_events
for all to authenticated
using (private.can_read_trip_school(trip_id))
with check (private.can_read_trip_school(trip_id));

drop policy if exists bus_live_guardian_read on public.bus_live;
create policy bus_live_guardian_read on public.bus_live
for select to authenticated
using (
  private.is_guardian_on_active_trip(bus_live.trip_id)
  or private.is_assigned_supervisor(bus_live.trip_id)
  or private.can_read_trip_school(bus_live.trip_id)
);

drop policy if exists location_history_read on public.location_history;
create policy location_history_read on public.location_history
for select to authenticated
using (
  private.is_guardian_on_active_trip(location_history.trip_id)
  or private.is_assigned_supervisor(location_history.trip_id)
  or private.can_read_trip_school(location_history.trip_id)
);
