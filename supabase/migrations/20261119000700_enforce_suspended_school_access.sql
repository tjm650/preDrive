-- Ensure school suspension is enforced by all role helper predicates, not only direct school queries.
create or replace function private.is_guardian(target_child uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.guardianships g
    join public.profiles p on p.id = g.guardian_id
    join public.children c on c.id = g.child_id
    where g.child_id = target_child
      and g.guardian_id = (select auth.uid())
      and p.role = 'parent'
      and p.school_id = c.school_id
      and private.current_school_id() = c.school_id
  )
$$;

create or replace function private.is_assigned_supervisor(target_trip uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.routes r on r.id = t.route_id
    join public.profiles p on p.id = t.supervisor_id
    where t.id = target_trip
      and t.supervisor_id = (select auth.uid())
      and p.role = 'supervisor'
      and p.school_id = r.school_id
      and private.current_school_id() = r.school_id
  )
$$;

create or replace function private.is_guardian_on_active_trip(target_trip uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.routes r on r.id = t.route_id
    join public.route_children rc on rc.route_id = t.route_id
    where t.id = target_trip
      and t.status = 'active'
      and private.is_guardian(rc.child_id)
      and private.current_school_id() = r.school_id
  )
$$;

create or replace function private.is_thread_member(target_thread uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.thread_members tm
    join public.threads th on th.id = tm.thread_id
    where tm.thread_id = target_thread
      and tm.user_id = (select auth.uid())
      and private.current_school_id() = th.school_id
  )
$$;

revoke all on function private.is_guardian(uuid) from public, anon;
revoke all on function private.is_assigned_supervisor(uuid) from public, anon;
revoke all on function private.is_guardian_on_active_trip(uuid) from public, anon;
revoke all on function private.is_thread_member(uuid) from public, anon;
grant execute on function private.is_guardian(uuid) to authenticated;
grant execute on function private.is_assigned_supervisor(uuid) to authenticated;
grant execute on function private.is_guardian_on_active_trip(uuid) to authenticated;
grant execute on function private.is_thread_member(uuid) to authenticated;

create or replace function private.can_read_route(target_route uuid)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.routes r
    where r.id = target_route
      and (
        private.can_read_school(r.school_id)
        or private.is_route_assigned(r.id)
        or exists (
          select 1 from public.trips t
          where t.route_id = r.id and t.status = 'active'
            and private.is_guardian_on_active_trip(t.id)
        )
      )
  )
$;

create or replace function private.can_read_bus(target_bus uuid)
returns boolean language sql stable security definer set search_path = ''
as $
  select exists (
    select 1 from public.buses b
    where b.id = target_bus
      and (
        private.can_read_school(b.school_id)
        or private.is_bus_on_assigned_trip(b.id)
        or exists (
          select 1 from public.trips t
          where t.bus_id = b.id and t.status = 'active'
            and private.is_guardian_on_active_trip(t.id)
        )
      )
  )
$;
revoke all on function private.can_read_route(uuid) from public, anon;
revoke all on function private.can_read_bus(uuid) from public, anon;
grant execute on function private.can_read_route(uuid) to authenticated;
grant execute on function private.can_read_bus(uuid) to authenticated;

-- Re-check school membership for rows whose owner id alone previously bypassed tenant status.
drop policy if exists trips_read on public.trips;
create policy trips_read on public.trips for select to authenticated using (
  private.can_read_school((select r.school_id from public.routes r where r.id = trips.route_id))
  or private.is_assigned_supervisor(trips.id)
  or (status = 'active' and private.is_guardian_on_active_trip(trips.id))
);

drop policy if exists invoices_read on public.invoices;
create policy invoices_read on public.invoices for select to authenticated using (
  private.can_read_school(school_id)
  or (guardian_id = (select auth.uid()) and private.current_school_id() = school_id)
);

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (
  exists (
    select 1 from public.invoices i
    where i.id = payments.invoice_id
      and (private.can_read_school(i.school_id)
        or (i.guardian_id = (select auth.uid()) and private.current_school_id() = i.school_id))
  )
);

drop policy if exists notifications_read_update on public.notifications;
create policy notifications_read_update on public.notifications for select to authenticated using (
  private.can_read_school(school_id)
  or (user_id = (select auth.uid()) and private.current_school_id() = school_id)
);
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
using (user_id = (select auth.uid()) and private.current_school_id() = school_id)
with check (user_id = (select auth.uid()) and private.current_school_id() = school_id);

drop policy if exists incidents_read on public.incidents;
create policy incidents_read on public.incidents for select to authenticated using (
  private.can_read_school(school_id)
  or (reported_by = (select auth.uid()) and private.current_school_id() = school_id)
  or (child_id is not null and private.is_guardian(child_id))
  or (trip_id is not null and private.is_assigned_supervisor(trip_id))
);

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated using (
  private.can_read_school(school_id)
  or (actor_id = (select auth.uid()) and school_id = private.current_school_id())
);

drop policy if exists thread_members_read on public.thread_members;
create policy thread_members_read on public.thread_members for select to authenticated using (
  (user_id = (select auth.uid()) and private.is_thread_member(thread_id))
  or private.can_read_thread(thread_id)
);
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated using (
  private.is_thread_member(thread_id) or private.can_read_thread(thread_id)
);
