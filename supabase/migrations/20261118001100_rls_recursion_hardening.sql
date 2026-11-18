-- RLS policies must not recursively query other RLS-protected tables.
-- These SECURITY DEFINER predicates inspect relationship tables with owner privileges
-- while still deriving the caller exclusively from auth.uid().
create or replace function private.is_route_assigned(target_route uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips t where t.route_id=target_route and private.is_assigned_supervisor(t.id))
$$;
create or replace function private.is_bus_on_assigned_trip(target_bus uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips t where t.bus_id=target_bus and private.is_assigned_supervisor(t.id))
$$;
create or replace function private.is_child_on_assigned_trip(target_child uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id where rc.child_id=target_child and private.is_assigned_supervisor(t.id))
$$;
create or replace function private.is_child_on_assigned_active_trip(target_child uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id where rc.child_id=target_child and t.status='active' and private.is_assigned_supervisor(t.id))
$$;
create or replace function private.is_child_on_trip(target_child uuid,target_trip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id where rc.child_id=target_child and t.id=target_trip and private.is_assigned_supervisor(t.id))
$$;
create or replace function private.is_guardian_on_active_trip(target_trip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips t join public.route_children rc on rc.route_id=t.route_id where t.id=target_trip and t.status='active' and private.is_guardian(rc.child_id))
$$;
create or replace function private.is_guardian_profile_for_assigned_trip(target_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.guardianships g
  join public.route_children rc on rc.child_id=g.child_id
  join public.trips t on t.route_id=rc.route_id
  where g.guardian_id=target_profile and private.is_assigned_supervisor(t.id)
 )
$$;
create or replace function private.is_thread_member(target_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.thread_members tm where tm.thread_id=target_thread and tm.user_id=(select auth.uid()))
$$;
create or replace function private.can_read_thread(target_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.threads th where th.id=target_thread and private.can_read_school(th.school_id))
$$;
create or replace function private.is_thread_school_admin(target_thread uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.threads th where th.id=target_thread and private.is_school_admin(th.school_id))
$$;
revoke all on function private.is_route_assigned(uuid) from public,anon;
revoke all on function private.is_bus_on_assigned_trip(uuid) from public,anon;
revoke all on function private.is_child_on_assigned_trip(uuid) from public,anon;
revoke all on function private.is_child_on_assigned_active_trip(uuid) from public,anon;
revoke all on function private.is_child_on_trip(uuid,uuid) from public,anon;
revoke all on function private.is_guardian_on_active_trip(uuid) from public,anon;
revoke all on function private.is_guardian_profile_for_assigned_trip(uuid) from public,anon;
revoke all on function private.is_thread_member(uuid) from public,anon;
revoke all on function private.can_read_thread(uuid) from public,anon;
revoke all on function private.is_thread_school_admin(uuid) from public,anon;
grant execute on function private.is_route_assigned(uuid) to authenticated;
grant execute on function private.is_bus_on_assigned_trip(uuid) to authenticated;
grant execute on function private.is_child_on_assigned_trip(uuid) to authenticated;
grant execute on function private.is_child_on_assigned_active_trip(uuid) to authenticated;
grant execute on function private.is_child_on_trip(uuid,uuid) to authenticated;
grant execute on function private.is_guardian_on_active_trip(uuid) to authenticated;
grant execute on function private.is_guardian_profile_for_assigned_trip(uuid) to authenticated;
grant execute on function private.is_thread_member(uuid) to authenticated;
grant execute on function private.can_read_thread(uuid) to authenticated;
grant execute on function private.is_thread_school_admin(uuid) to authenticated;

-- Family and supervisor scope without policy-to-policy recursion.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
 id=(select auth.uid()) or private.can_read_school(school_id)
 or private.is_guardian_profile_for_assigned_trip(profiles.id)
);
drop policy if exists children_read on public.children;
create policy children_read on public.children for select to authenticated using (
 private.can_read_school(school_id)
 or (school_id=private.current_school_id() and (private.is_guardian(children.id) or private.is_child_on_assigned_trip(children.id)))
);
drop policy if exists guardianships_read on public.guardianships;
create policy guardianships_read on public.guardianships for select to authenticated using (
 (guardian_id=(select auth.uid()) and exists(select 1 from public.children c where c.id=guardianships.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=guardianships.child_id))
 or private.is_child_on_assigned_trip(guardianships.child_id)
);
drop policy if exists authorized_pickups_read on public.authorized_pickups;
create policy authorized_pickups_read on public.authorized_pickups for select to authenticated using (
 (private.is_guardian(child_id) and exists(select 1 from public.children c where c.id=authorized_pickups.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=authorized_pickups.child_id))
 or private.is_child_on_assigned_active_trip(authorized_pickups.child_id)
);
drop policy if exists buses_read on public.buses;
create policy buses_read on public.buses for select to authenticated using (
 private.can_read_school(school_id) or private.is_bus_on_assigned_trip(buses.id)
);
drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes for select to authenticated using (
 private.can_read_school(school_id) or private.is_route_assigned(routes.id)
);
drop policy if exists stops_read on public.stops;
create policy stops_read on public.stops for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=stops.route_id))
 or private.is_route_assigned(stops.route_id)
);
drop policy if exists route_children_read on public.route_children;
create policy route_children_read on public.route_children for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=route_children.route_id))
 or private.is_route_assigned(route_children.route_id)
 or private.is_guardian(route_children.child_id)
);
drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=trips.route_id))
 or supervisor_id=(select auth.uid())
 or (status='active' and private.is_guardian_on_active_trip(trips.id))
);
drop policy if exists trip_events_read on public.trip_events;
create policy trip_events_read on public.trip_events for select to authenticated using (
 private.is_assigned_supervisor(trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_events.trip_id))
 or (child_id is not null and private.is_guardian(child_id) and exists(select 1 from public.children c where c.id=trip_events.child_id and c.school_id=private.current_school_id()))
);
drop policy if exists bus_live_guardian_read on public.bus_live;
create policy bus_live_guardian_read on public.bus_live for select to authenticated using (
 private.is_guardian_on_active_trip(bus_live.trip_id)
 or private.is_assigned_supervisor(bus_live.trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
);
drop policy if exists location_history_read on public.location_history;
create policy location_history_read on public.location_history for select to authenticated using (
 private.is_guardian_on_active_trip(location_history.trip_id)
 or private.is_assigned_supervisor(location_history.trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=location_history.trip_id))
);

-- Supervisor writes remain limited to assigned trips and manifest members.
drop policy if exists route_children_supervisor_write on public.route_children;
create policy route_children_supervisor_write on public.route_children for insert to authenticated with check (
 private.is_route_assigned(route_id)
 and exists(select 1 from public.children c where c.id=route_children.child_id and c.school_id=private.current_school_id())
);
drop policy if exists route_children_supervisor_update on public.route_children;
create policy route_children_supervisor_update on public.route_children for update to authenticated
using (private.is_route_assigned(route_id))
with check (
 private.is_route_assigned(route_id)
 and exists(select 1 from public.children c where c.id=route_children.child_id and c.school_id=private.current_school_id())
);
drop policy if exists trip_events_supervisor_insert on public.trip_events;
create policy trip_events_supervisor_insert on public.trip_events for insert to authenticated with check (
 recorded_by=(select auth.uid())
 and private.is_assigned_supervisor(trip_id)
 and (child_id is null or private.is_child_on_trip(child_id,trip_id))
);

-- Thread policies use security-definer membership predicates, avoiding recursive
-- RLS evaluation between threads, thread_members and messages.
drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads for select to authenticated using (
 private.can_read_school(school_id) or private.is_thread_member(threads.id)
);
drop policy if exists thread_members_read on public.thread_members;
create policy thread_members_read on public.thread_members for select to authenticated using (
 user_id=(select auth.uid()) or private.can_read_thread(thread_members.thread_id)
);
drop policy if exists thread_members_admin_manage on public.thread_members;
create policy thread_members_admin_manage on public.thread_members for all to authenticated
using (private.is_thread_school_admin(thread_members.thread_id))
with check (private.is_thread_school_admin(thread_members.thread_id));
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
 sender_id=(select auth.uid()) or private.is_thread_member(messages.thread_id) or private.can_read_thread(messages.thread_id)
);
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and private.is_thread_member(messages.thread_id)
);
