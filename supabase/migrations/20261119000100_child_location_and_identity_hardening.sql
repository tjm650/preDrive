-- Child location privacy and identity immutability hardening.
-- Additive, safe to re-run, and deliberately does not change existing application UI.

-- 1. Historical GPS traces are never available to guardians.
-- Guardians receive only the current bus_live point for an active trip containing
-- one of their own children. Historical traces remain available to the assigned
-- supervisor, the child's school administrator and platform oversight.
drop policy if exists location_history_read on public.location_history;
create policy location_history_read on public.location_history
for select to authenticated
using (
  private.is_assigned_supervisor(trip_id)
  or private.can_read_school((
    select r.school_id
    from public.trips t
    join public.routes r on r.id = t.route_id
    where t.id = location_history.trip_id
  ))
);

-- 2. Give policy authors stable helper names matching the platform security model.
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_role()
$$;

create or replace function private.is_guardian_of(target_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_guardian(target_child)
$$;

create or replace function private.is_on_active_trip_for(target_child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips t
    join public.route_children rc on rc.route_id = t.route_id
    where rc.child_id = target_child
      and t.status = 'active'
      and private.is_guardian(target_child)
  )
$$;

revoke all on function private.current_user_role() from public, anon;
revoke all on function private.is_guardian_of(uuid) from public, anon;
revoke all on function private.is_on_active_trip_for(uuid) from public, anon;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_guardian_of(uuid) to authenticated;
grant execute on function private.is_on_active_trip_for(uuid) to authenticated;

-- 3. A school administrator may manage profile contact/display fields, but may
-- not promote themselves, change another user's role, or move an account across
-- tenants. Trusted service-role provisioning remains available to Edge Functions.
create or replace function private.protect_profile_tenant_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_role text;
begin
  request_role := coalesce(current_setting('request.jwt.claim.role', true), '');

  if (new.role is distinct from old.role
      or new.school_id is distinct from old.school_id)
     and request_role <> 'service_role' then
    raise exception 'Profile role and school assignment can only be changed by trusted provisioning'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function private.protect_profile_tenant_identity() from public, anon, authenticated;
drop trigger if exists protect_profile_tenant_identity on public.profiles;
create trigger protect_profile_tenant_identity
before update of role, school_id on public.profiles
for each row execute function private.protect_profile_tenant_identity();

-- 4. Add missing hot-path / foreign-key indexes without changing existing data.
create index if not exists profiles_school_role_idx on public.profiles(school_id, role);
create index if not exists children_home_stop_idx on public.children(home_stop_id) where home_stop_id is not null;
create index if not exists guardianships_guardian_child_idx on public.guardianships(guardian_id, child_id);
create index if not exists authorized_pickups_child_idx on public.authorized_pickups(child_id);
create index if not exists buses_school_idx on public.buses(school_id);
create index if not exists routes_school_idx on public.routes(school_id);
create index if not exists stops_route_idx on public.stops(route_id);
create index if not exists route_children_route_stop_idx on public.route_children(route_id, stop_id);
create index if not exists trips_route_idx on public.trips(route_id);
create index if not exists trips_bus_idx on public.trips(bus_id);
create index if not exists trips_supervisor_idx on public.trips(supervisor_id);
create index if not exists trip_events_child_idx on public.trip_events(child_id) where child_id is not null;
create index if not exists trip_events_recorded_by_idx on public.trip_events(recorded_by);
create index if not exists location_history_trip_recorded_idx on public.location_history(trip_id, recorded_at desc);
create index if not exists absences_reported_by_idx on public.absences(reported_by);
create index if not exists notifications_school_user_created_idx on public.notifications(school_id, user_id, created_at desc);
create index if not exists threads_school_idx on public.threads(school_id);
create index if not exists thread_members_user_thread_idx on public.thread_members(user_id, thread_id);
create index if not exists messages_thread_created_idx on public.messages(thread_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);
create index if not exists incidents_trip_idx on public.incidents(trip_id) where trip_id is not null;
create index if not exists incidents_reported_by_idx on public.incidents(reported_by);
create index if not exists invoices_guardian_due_idx on public.invoices(guardian_id, due_date);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists audit_log_actor_created_idx on public.audit_log(actor_id, created_at desc);
