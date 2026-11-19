-- Replace broad FOR ALL policies with explicit writes. This keeps school admins
-- fully capable while avoiding accidental SELECT-policy widening and duplicate OR checks.

-- Admin-only CRUD policies whose SELECT branch is already covered by dedicated read policies.
drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_insert on public.app_settings for insert to authenticated
with check (private.is_school_admin(school_id));
create policy app_settings_admin_update on public.app_settings for update to authenticated
using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy app_settings_admin_delete on public.app_settings for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists authorized_pickups_admin_write on public.authorized_pickups;
create policy authorized_pickups_admin_insert on public.authorized_pickups for insert to authenticated
with check (private.is_school_admin((select c.school_id from public.children c where c.id = authorized_pickups.child_id)));
create policy authorized_pickups_admin_update on public.authorized_pickups for update to authenticated
using (private.is_school_admin((select c.school_id from public.children c where c.id = authorized_pickups.child_id)))
with check (private.is_school_admin((select c.school_id from public.children c where c.id = authorized_pickups.child_id)));
create policy authorized_pickups_admin_delete on public.authorized_pickups for delete to authenticated
using (private.is_school_admin((select c.school_id from public.children c where c.id = authorized_pickups.child_id)));

drop policy if exists children_admin_write on public.children;
create policy children_admin_insert on public.children for insert to authenticated
with check (private.is_school_admin(school_id));
create policy children_admin_update on public.children for update to authenticated
using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy children_admin_delete on public.children for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists guardianships_admin_write on public.guardianships;
create policy guardianships_admin_insert on public.guardianships for insert to authenticated
with check (private.is_school_admin((select c.school_id from public.children c where c.id = guardianships.child_id)));
create policy guardianships_admin_update on public.guardianships for update to authenticated
using (private.is_school_admin((select c.school_id from public.children c where c.id = guardianships.child_id)))
with check (private.is_school_admin((select c.school_id from public.children c where c.id = guardianships.child_id)));
create policy guardianships_admin_delete on public.guardianships for delete to authenticated
using (private.is_school_admin((select c.school_id from public.children c where c.id = guardianships.child_id)));

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated
with check (private.is_school_admin(school_id));
create policy profiles_admin_update on public.profiles for update to authenticated
using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy profiles_admin_delete on public.profiles for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists invoices_admin_write on public.invoices;
create policy invoices_admin_insert on public.invoices for insert to authenticated
with check (private.is_school_admin(school_id));
create policy invoices_admin_update on public.invoices for update to authenticated
using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy invoices_admin_delete on public.invoices for delete to authenticated
using (private.is_school_admin(school_id));

drop policy if exists payments_admin_write on public.payments;
create policy payments_admin_insert on public.payments for insert to authenticated
with check (exists (select 1 from public.invoices i where i.id = payments.invoice_id and private.is_school_admin(i.school_id)));
create policy payments_admin_update on public.payments for update to authenticated
using (exists (select 1 from public.invoices i where i.id = payments.invoice_id and private.is_school_admin(i.school_id)))
with check (exists (select 1 from public.invoices i where i.id = payments.invoice_id and private.is_school_admin(i.school_id)));
create policy payments_admin_delete on public.payments for delete to authenticated
using (exists (select 1 from public.invoices i where i.id = payments.invoice_id and private.is_school_admin(i.school_id)));

drop policy if exists subscriptions_admin_write on public.subscriptions;
create policy subscriptions_admin_insert on public.subscriptions for insert to authenticated
with check (private.is_school_admin(school_id));
create policy subscriptions_admin_update on public.subscriptions for update to authenticated
using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy subscriptions_admin_delete on public.subscriptions for delete to authenticated
using (private.is_school_admin(school_id));

-- These broad policies were introduced by the suspension hardening migration;
-- the preceding migrations already define explicit admin write policies.
drop policy if exists buses_admin_write on public.buses;
drop policy if exists routes_admin_write on public.routes;
drop policy if exists threads_admin_write on public.threads;

drop policy if exists stops_admin_write on public.stops;
create policy stops_admin_insert on public.stops for insert to authenticated
with check (private.is_school_admin((select r.school_id from public.routes r where r.id = stops.route_id)));
create policy stops_admin_update on public.stops for update to authenticated
using (private.is_school_admin((select r.school_id from public.routes r where r.id = stops.route_id)))
with check (private.is_school_admin((select r.school_id from public.routes r where r.id = stops.route_id)));
create policy stops_admin_delete on public.stops for delete to authenticated
using (private.is_school_admin((select r.school_id from public.routes r where r.id = stops.route_id)));

drop policy if exists route_children_admin_write on public.route_children;
create policy route_children_admin_insert on public.route_children for insert to authenticated
with check (private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id)));
create policy route_children_admin_update on public.route_children for update to authenticated
using (private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id)))
with check (private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id)));
create policy route_children_admin_delete on public.route_children for delete to authenticated
using (private.is_school_admin((select r.school_id from public.routes r where r.id = route_children.route_id)));

drop policy if exists incidents_admin_write on public.incidents;
drop policy if exists incidents_insert on public.incidents;
drop policy if exists incidents_member_insert on public.incidents;
create policy incidents_insert on public.incidents for insert to authenticated with check (
  reported_by = (select auth.uid())
  and school_id = private.current_school_id()
  and (
    private.is_school_admin(school_id)
    or (child_id is not null and private.is_guardian(child_id))
    or (trip_id is not null and private.is_assigned_supervisor(trip_id)
        and (child_id is null or exists (
          select 1 from public.trips t
          join public.route_children rc on rc.route_id = t.route_id
          where t.id = incidents.trip_id and rc.child_id = incidents.child_id
        )))
  )
);

drop policy if exists thread_members_admin_manage on public.thread_members;
create policy thread_members_admin_insert on public.thread_members for insert to authenticated
with check (private.is_thread_school_admin(thread_id));
create policy thread_members_admin_update on public.thread_members for update to authenticated
using (private.is_thread_school_admin(thread_id)) with check (private.is_thread_school_admin(thread_id));
create policy thread_members_admin_delete on public.thread_members for delete to authenticated
using (private.is_thread_school_admin(thread_id));

drop policy if exists bus_live_admin_delete on public.bus_live;

drop policy if exists trip_events_admin_insert on public.trip_events;
drop policy if exists trip_events_supervisor_insert on public.trip_events;
create policy trip_events_insert on public.trip_events for insert to authenticated with check (
  recorded_by = (select auth.uid())
  and (private.is_assigned_supervisor(trip_id) or private.is_trip_school_admin(trip_id))
  and (child_id is null or exists (
    select 1 from public.trips t
    join public.route_children rc on rc.route_id = t.route_id
    where t.id = trip_events.trip_id and rc.child_id = trip_events.child_id
  ))
);

drop policy if exists trips_admin_update on public.trips;
drop policy if exists trips_supervisor_update on public.trips;
create policy trips_update on public.trips for update to authenticated
using (private.is_trip_school_admin(id) or private.is_assigned_supervisor(id))
with check (private.is_trip_school_admin(id) or private.is_assigned_supervisor(id));
