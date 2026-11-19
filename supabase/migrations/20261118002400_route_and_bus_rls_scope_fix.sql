-- Route and vehicle visibility must not recurse through trips and routes RLS.
create or replace function private.can_read_route(target_route uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.routes r
    where r.id = target_route
      and (
        private.can_read_school(r.school_id)
        or exists (
          select 1 from public.trips t
          where t.route_id = r.id and t.supervisor_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.trips t
          join public.route_children rc on rc.route_id = t.route_id
          where t.route_id = r.id
            and t.status = 'active'
            and private.is_guardian(rc.child_id)
        )
      )
  )
$$;

create or replace function private.can_read_bus(target_bus uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.buses b
    where b.id = target_bus
      and (
        private.can_read_school(b.school_id)
        or exists (
          select 1 from public.trips t
          where t.bus_id = b.id and t.supervisor_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.trips t
          join public.route_children rc on rc.route_id = t.route_id
          where t.bus_id = b.id
            and t.status = 'active'
            and private.is_guardian(rc.child_id)
        )
      )
  )
$$;

revoke all on function private.can_read_route(uuid) from public, anon;
revoke all on function private.can_read_bus(uuid) from public, anon;
grant execute on function private.can_read_route(uuid) to authenticated;
grant execute on function private.can_read_bus(uuid) to authenticated;

drop policy if exists routes_read on public.routes;
create policy routes_read on public.routes
for select to authenticated
using (private.can_read_route(routes.id));

drop policy if exists buses_read on public.buses;
create policy buses_read on public.buses
for select to authenticated
using (private.can_read_bus(buses.id));
