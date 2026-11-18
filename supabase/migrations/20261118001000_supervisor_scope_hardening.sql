-- Supervisors see only guardian contacts and pickup authorizations for children
-- on their own assigned trips, never the entire school's user directory.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
 id=(select auth.uid())
 or private.can_read_school(school_id)
 or exists(
  select 1 from public.guardianships g
  join public.route_children rc on rc.child_id=g.child_id
  join public.trips t on t.route_id=rc.route_id
  where g.guardian_id=profiles.id and t.supervisor_id=(select auth.uid())
 )
);

drop policy if exists authorized_pickups_read on public.authorized_pickups;
create policy authorized_pickups_read on public.authorized_pickups for select to authenticated using (
 (private.is_guardian(child_id) and exists(select 1 from public.children c where c.id=authorized_pickups.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=authorized_pickups.child_id))
 or exists(
  select 1 from public.route_children rc
  join public.trips t on t.route_id=rc.route_id
  where rc.child_id=authorized_pickups.child_id and t.supervisor_id=(select auth.uid()) and t.status='active'
 )
);

-- Supervisors may create/update the live point for their assigned active trip,
-- but cannot delete the live record or modify another trip's location.
drop policy if exists bus_live_supervisor_write on public.bus_live;
create policy bus_live_supervisor_insert on public.bus_live for insert to authenticated with check (
 private.is_assigned_supervisor(trip_id)
 or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
);
create policy bus_live_supervisor_update on public.bus_live for update to authenticated
using (
 private.is_assigned_supervisor(trip_id)
 or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
)
with check (
 private.is_assigned_supervisor(trip_id)
 or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
);
create policy bus_live_admin_delete on public.bus_live for delete to authenticated using (
 private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
);
