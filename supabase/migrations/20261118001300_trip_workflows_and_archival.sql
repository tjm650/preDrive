-- Operational workflow primitives: auditable, idempotent trip events and soft archival.
alter table public.trip_events
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists client_recorded_at timestamptz;

create unique index if not exists trip_events_idempotency_idx
  on public.trip_events(trip_id,idempotency_key)
  where idempotency_key is not null;

alter table public.children add column if not exists archived_at timestamptz;
alter table public.buses add column if not exists archived_at timestamptz;
alter table public.routes add column if not exists archived_at timestamptz;

create index if not exists children_school_active_idx on public.children(school_id,first_name) where archived_at is null;
create index if not exists buses_school_active_idx on public.buses(school_id,registration) where archived_at is null;
create index if not exists routes_school_active_idx on public.routes(school_id,name) where archived_at is null;

-- Trip state transitions are performed through narrow RPCs, not broad table updates.
revoke update(status,started_at,ended_at) on public.trips from authenticated;

create or replace function public.start_trip(p_trip_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare trip_row public.trips%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into trip_row from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Trip not found' using errcode='P0002'; end if;
  if trip_row.supervisor_id <> auth.uid() then raise exception 'Only the assigned supervisor can start this trip' using errcode='42501'; end if;
  if trip_row.status <> 'scheduled' then raise exception 'Only scheduled trips can be started' using errcode='22023'; end if;
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

create or replace function public.complete_trip(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare trip_row public.trips%rowtype;
declare missing_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into trip_row from public.trips where id=p_trip_id for update;
  if not found then raise exception 'Trip not found' using errcode='P0002'; end if;
  if trip_row.supervisor_id <> auth.uid() then raise exception 'Only the assigned supervisor can complete this trip' using errcode='42501'; end if;
  if trip_row.status <> 'active' then raise exception 'Trip is not active' using errcode='22023'; end if;
  select count(*) into missing_count
  from public.route_children rc
  where rc.route_id=trip_row.route_id
    and not exists (
      select 1 from public.trip_events e
      where e.trip_id=p_trip_id and e.child_id=rc.child_id
        and e.type in ('dropped_home','absent','arrived_school')
    );
  if missing_count > 0 then
    return jsonb_build_object('completed',false,'unaccounted_children',missing_count);
  end if;
  update public.trips set status='completed',ended_at=now() where id=p_trip_id;
  return jsonb_build_object('completed',true,'unaccounted_children',0);
end
$$;
revoke all on function public.complete_trip(uuid) from public,anon;
grant execute on function public.complete_trip(uuid) to authenticated;

-- Verify PIN and record the handover atomically from the supervisor's perspective.
create or replace function public.verify_pickup_handover(
  p_trip_id uuid,p_child_id uuid,p_pickup_id uuid,p_pin text,
  p_lat double precision default null,p_lng double precision default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare trip_row public.trips%rowtype;
declare verified boolean;
declare event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into trip_row from public.trips where id=p_trip_id for share;
  if not found or trip_row.supervisor_id <> auth.uid() or trip_row.status <> 'active' then
    raise exception 'Active trip assigned to the current supervisor is required' using errcode='42501';
  end if;
  if not exists(select 1 from public.route_children rc where rc.route_id=trip_row.route_id and rc.child_id=p_child_id) then
    raise exception 'Child is not on this trip manifest' using errcode='42501';
  end if;
  verified := public.verify_pickup_pin(p_child_id,p_pickup_id,p_pin);
  event_id := public.record_trip_event(
    p_trip_id,p_child_id,
    case when verified then 'handover_verified'::public.trip_event_type else 'handover_rejected'::public.trip_event_type end,
    p_lat,p_lng,
    jsonb_build_object('authorized_pickup_id',p_pickup_id,'pin_verified',verified),
    p_idempotency_key,now()
  );
  return jsonb_build_object('verified',verified,'event_id',event_id);
end
$$;
revoke all on function public.verify_pickup_handover(uuid,uuid,uuid,text,double precision,double precision,text) from public,anon;
grant execute on function public.verify_pickup_handover(uuid,uuid,uuid,text,double precision,double precision,text) to authenticated;

-- Event history is append-only for clients; RPCs above are the only supervisor write path.
revoke insert,update,delete on public.trip_events from authenticated;
