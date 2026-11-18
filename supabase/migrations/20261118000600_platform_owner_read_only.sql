-- Separate read-across-tenant privilege from school-admin write privilege.
create or replace function private.is_school_admin(target_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.current_role() = 'school_admin' and private.current_school_id() = target_school,false)
$$;
create or replace function private.can_read_school(target_school uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.is_platform_owner() or private.is_school_admin(target_school),false)
$$;
revoke all on function private.can_read_school(uuid) from public,anon;
grant execute on function private.can_read_school(uuid) to authenticated;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
 id=(select auth.uid()) or private.can_read_school(school_id)
 or (private.current_role()='supervisor' and school_id=private.current_school_id())
);
drop policy if exists children_read on public.children;
create policy children_read on public.children for select to authenticated using (
 private.can_read_school(school_id) or (school_id=private.current_school_id() and (
  private.is_guardian(children.id) or exists(select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id where rc.child_id=children.id and t.supervisor_id=(select auth.uid()))
 ))
);
drop policy if exists guardianships_read on public.guardianships;
create policy guardianships_read on public.guardianships for select to authenticated using (
 guardian_id=(select auth.uid()) or private.can_read_school((select c.school_id from public.children c where c.id=guardianships.child_id))
 or exists(select 1 from public.children c join public.route_children rc on rc.child_id=c.id join public.trips t on t.route_id=rc.route_id where c.id=guardianships.child_id and t.supervisor_id=(select auth.uid()))
);
drop policy if exists authorized_pickups_read on public.authorized_pickups;
create policy authorized_pickups_read on public.authorized_pickups for select to authenticated using (
 private.is_guardian(child_id) or private.can_read_school((select c.school_id from public.children c where c.id=authorized_pickups.child_id))
);
drop policy if exists buses_read on public.buses;
create policy buses_read on public.buses for select to authenticated using (
 private.can_read_school(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.bus_id=buses.id and t.supervisor_id=(select auth.uid())))
);
drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes for select to authenticated using (
 private.can_read_school(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.route_id=routes.id and t.supervisor_id=(select auth.uid())))
);
drop policy if exists stops_read on public.stops;
create policy stops_read on public.stops for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=stops.route_id))
 or exists(select 1 from public.trips t where t.route_id=stops.route_id and t.supervisor_id=(select auth.uid()))
);
drop policy if exists route_children_read on public.route_children;
create policy route_children_read on public.route_children for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=route_children.route_id))
 or exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
 or private.is_guardian(child_id)
);
drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (
 private.can_read_school((select r.school_id from public.routes r where r.id=trips.route_id))
 or supervisor_id=(select auth.uid())
 or (status='active' and exists(select 1 from public.route_children rc where rc.route_id=trips.route_id and private.is_guardian(rc.child_id)))
);
drop policy if exists trip_events_read on public.trip_events;
create policy trip_events_read on public.trip_events for select to authenticated using (
 private.is_assigned_supervisor(trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_events.trip_id))
 or (child_id is not null and private.is_guardian(child_id))
);
drop policy if exists bus_live_guardian_read on public.bus_live;
create policy bus_live_guardian_read on public.bus_live for select to authenticated using (
 exists(select 1 from public.trips t join public.route_children rc on rc.route_id=t.route_id where t.id=bus_live.trip_id and t.status='active' and private.is_guardian(rc.child_id))
 or private.is_assigned_supervisor(trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=bus_live.trip_id))
);
drop policy if exists location_history_read on public.location_history;
create policy location_history_read on public.location_history for select to authenticated using (
 exists(select 1 from public.trips t join public.route_children rc on rc.route_id=t.route_id where t.id=location_history.trip_id and t.status='active' and private.is_guardian(rc.child_id))
 or private.is_assigned_supervisor(trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=location_history.trip_id))
);
drop policy if exists absences_read on public.absences;
drop policy if exists absences_read_scoped on public.absences;
create policy absences_read_scoped on public.absences for select to authenticated using (
 private.is_guardian(child_id) or private.can_read_school((select c.school_id from public.children c where c.id=absences.child_id))
);
drop policy if exists notifications_read_update on public.notifications;
create policy notifications_read_update on public.notifications for select to authenticated using (
 user_id=(select auth.uid()) or private.can_read_school(school_id)
);
drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads for select to authenticated using (
 private.can_read_school(school_id) or exists(select 1 from public.thread_members tm where tm.thread_id=threads.id and tm.user_id=(select auth.uid()))
);
drop policy if exists thread_members_read on public.thread_members;
create policy thread_members_read on public.thread_members for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.threads th where th.id=thread_members.thread_id and private.can_read_school(th.school_id))
);
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
 sender_id=(select auth.uid())
 or exists(select 1 from public.thread_members tm where tm.thread_id=messages.thread_id and tm.user_id=(select auth.uid()))
 or exists(select 1 from public.threads th where th.id=messages.thread_id and private.can_read_school(th.school_id))
);
drop policy if exists incidents_read on public.incidents;
create policy incidents_read on public.incidents for select to authenticated using (
 private.can_read_school(school_id) or reported_by=(select auth.uid())
 or (child_id is not null and private.is_guardian(child_id))
 or (trip_id is not null and private.is_assigned_supervisor(trip_id))
);
drop policy if exists subscriptions_admin on public.subscriptions;
create policy subscriptions_read on public.subscriptions for select to authenticated using (private.can_read_school(school_id));
create policy subscriptions_admin_write on public.subscriptions for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated using (
 guardian_id=(select auth.uid()) or private.can_read_school(school_id)
);
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
 exists(select 1 from public.invoices i where i.id=payments.invoice_id and (i.guardian_id=(select auth.uid()) or private.can_read_school(i.school_id)))
);
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using (private.can_read_school(school_id));
create policy app_settings_admin_write on public.app_settings for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated using (
 private.can_read_school(school_id) or actor_id=(select auth.uid())
);

-- Correct extension-qualified password hashing for environments with an empty search_path.
