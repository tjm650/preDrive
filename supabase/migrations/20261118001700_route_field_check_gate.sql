-- Road geometry must be provider-calculated and field-checked before a trip can start.
revoke update on public.routes from authenticated;
grant update(name,type) on public.routes to authenticated;

create or replace function public.verify_route_field_check(p_route_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare route_row public.routes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into route_row from public.routes where id=p_route_id for update;
  if not found then raise exception 'Route not found' using errcode='P0002'; end if;
  if private.current_role() <> 'school_admin' or private.current_school_id() <> route_row.school_id then
    raise exception 'Only this school administrator can attest route field checks' using errcode='42501';
  end if;
  if route_row.geometry_status <> 'provider_verified'
    or route_row.geometry_verified_at is null
    or jsonb_typeof(route_row.polyline) <> 'array'
    or jsonb_array_length(route_row.polyline) < 2 then
    raise exception 'A provider-calculated road route is required before field verification' using errcode='22023';
  end if;
  update public.routes
    set geometry_status='manually_verified',
        geometry_verified_at=now(),
        geometry_source='openrouteservice+school_field_check'
    where id=p_route_id;
  insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
  values(route_row.school_id,auth.uid(),'route_field_check_attested','route',p_route_id,
    jsonb_build_object('provider',route_row.geometry_source,'distance_m',route_row.distance_m,'duration_s',route_row.duration_s));
  return jsonb_build_object('verified',true,'route_id',p_route_id,'verified_at',now());
end
$$;
revoke all on function public.verify_route_field_check(uuid) from public,anon;
grant execute on function public.verify_route_field_check(uuid) to authenticated;

create or replace function public.start_trip(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare trip_row public.trips%rowtype;
declare route_verified boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into trip_row from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Trip not found' using errcode='P0002'; end if;
  if trip_row.supervisor_id <> auth.uid() then raise exception 'Only the assigned supervisor can start this trip' using errcode='42501'; end if;
  if trip_row.status <> 'scheduled' then raise exception 'Only scheduled trips can be started' using errcode='22023'; end if;
  select (r.geometry_status='manually_verified' and r.geometry_verified_at is not null)
    into route_verified from public.routes r where r.id=trip_row.route_id;
  if not coalesce(route_verified,false) then
    raise exception 'Route road geometry must be provider-calculated and field-checked before the trip starts' using errcode='22023';
  end if;
  if not exists(select 1 from public.buses b where b.id=trip_row.bus_id and b.active and b.archived_at is null) then
    raise exception 'The assigned bus is not active' using errcode='22023';
  end if;
  if not exists(select 1 from public.route_children rc where rc.route_id=trip_row.route_id) then
    raise exception 'The route has no children assigned' using errcode='22023';
  end if;
  update public.trips set status='active',started_at=now() where id=p_trip_id;
  return p_trip_id;
end
$$;
revoke all on function public.start_trip(uuid) from public,anon;
grant execute on function public.start_trip(uuid) to authenticated;
