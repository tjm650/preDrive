-- Keep platform-owner access strictly read-only after the trip RLS recursion repair.
create or replace function private.is_trip_school_admin(target_trip uuid)
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
      and private.is_school_admin(r.school_id)
  )
$$;

revoke all on function private.is_trip_school_admin(uuid) from public, anon;
grant execute on function private.is_trip_school_admin(uuid) to authenticated;

drop policy if exists trip_events_admin_all on public.trip_events;
create policy trip_events_admin_all on public.trip_events
for all to authenticated
using (private.is_trip_school_admin(trip_id))
with check (private.is_trip_school_admin(trip_id));
