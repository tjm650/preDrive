-- Allow parents to read only route and vehicle metadata for trips carrying their own child.
create policy routes_guardian_active_read on public.routes
  for select to authenticated using (
    exists(
      select 1 from public.trips t
      join public.route_children rc on rc.route_id=t.route_id
      where t.route_id=routes.id and t.status='active' and private.is_guardian(rc.child_id)
    )
  );

create policy buses_guardian_active_read on public.buses
  for select to authenticated using (
    exists(
      select 1 from public.trips t
      join public.routes r on r.id=t.route_id
      join public.route_children rc on rc.route_id=t.route_id
      where t.bus_id=buses.id and t.status='active' and private.is_guardian(rc.child_id)
    )
  );

-- Enforce event order and route-specific child outcomes at the database boundary.
create or replace function public.record_trip_event(
  p_trip_id uuid,
  p_child_id uuid,
  p_type public.trip_event_type,
  p_lat double precision default null,
  p_lng double precision default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_client_recorded_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare trip_row public.trips%rowtype;
declare route_kind public.route_type;
declare event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into trip_row from public.trips where id=p_trip_id for share;
  if not found then raise exception 'Trip not found' using errcode='P0002'; end if;
  if trip_row.supervisor_id <> auth.uid() then raise exception 'Only the assigned supervisor can record trip events' using errcode='42501'; end if;
  if trip_row.status <> 'active' then raise exception 'Trip is not active' using errcode='22023'; end if;
  if p_type not in ('boarded','arrived_school','dropped_home','absent','sos','delay','handover_rejected','handover_verified','child_missing') then
    raise exception 'Unsupported trip event' using errcode='22023';
  end if;
  select r.type into route_kind from public.routes r where r.id=trip_row.route_id;
  if p_child_id is not null and not exists(
    select 1 from public.route_children rc where rc.route_id=trip_row.route_id and rc.child_id=p_child_id
  ) then raise exception 'Child is not on this trip manifest' using errcode='42501'; end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'Latitude and longitude must be supplied together' using errcode='22023'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' or octet_length(p_metadata::text)>4096 then
    raise exception 'Event metadata must be a JSON object no larger than 4 KB' using errcode='22023';
  end if;
  if p_idempotency_key is not null and length(p_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid idempotency key' using errcode='22023';
  end if;
  if p_child_id is not null and p_type='boarded' and exists(
    select 1 from public.trip_events e where e.trip_id=p_trip_id and e.child_id=p_child_id
      and e.type in ('boarded','arrived_school','dropped_home','absent')
  ) then raise exception 'Child already has a boarding or final status' using errcode='23505'; end if;
  if p_child_id is not null and p_type='absent' and exists(
    select 1 from public.trip_events e where e.trip_id=p_trip_id and e.child_id=p_child_id and e.type='boarded'
  ) then raise exception 'A boarded child cannot be marked absent' using errcode='22023'; end if;
  if p_child_id is not null and p_type='arrived_school' and route_kind <> 'pickup' then
    raise exception 'School arrival is only valid on a pickup route' using errcode='22023';
  end if;
  if p_child_id is not null and p_type='dropped_home' and route_kind <> 'dropoff' then
    raise exception 'Home drop-off is only valid on a drop-off route' using errcode='22023';
  end if;
  if p_child_id is not null and p_type in ('arrived_school','dropped_home') and not exists(
    select 1 from public.trip_events e where e.trip_id=p_trip_id and e.child_id=p_child_id and e.type='boarded'
  ) then raise exception 'Child must be recorded as boarded before arrival or drop-off' using errcode='22023'; end if;
  if p_child_id is not null and p_type in ('arrived_school','dropped_home','absent') and exists(
    select 1 from public.trip_events e where e.trip_id=p_trip_id and e.child_id=p_child_id
      and e.type in ('arrived_school','dropped_home','absent')
  ) then raise exception 'A final child status has already been recorded' using errcode='23505'; end if;
  if p_child_id is not null and p_type='dropped_home' and not exists(
    select 1 from public.trip_events e where e.trip_id=p_trip_id and e.child_id=p_child_id and e.type='handover_verified'
  ) then raise exception 'Verify the authorised pickup PIN before recording child release' using errcode='42501'; end if;
  insert into public.trip_events(trip_id,child_id,type,recorded_by,lat,lng,metadata,idempotency_key,client_recorded_at)
  values(p_trip_id,p_child_id,p_type,auth.uid(),p_lat,p_lng,p_metadata,p_idempotency_key,p_client_recorded_at)
  on conflict (trip_id,idempotency_key) where idempotency_key is not null do nothing
  returning id into event_id;
  if event_id is null and p_idempotency_key is not null then
    select id into event_id from public.trip_events where trip_id=p_trip_id and idempotency_key=p_idempotency_key;
  end if;
  return event_id;
end
$$;
revoke all on function public.record_trip_event(uuid,uuid,public.trip_event_type,double precision,double precision,jsonb,text,timestamptz) from public,anon;
grant execute on function public.record_trip_event(uuid,uuid,public.trip_event_type,double precision,double precision,jsonb,text,timestamptz) to authenticated;
