-- Operational safety: bounded home geofences, stale GPS alerts, trip-end alias, and location retention.

-- Product policy permits only the three supported geofence radii.
update public.children
set home_radius_m = case
  when home_radius_m < 750 then 500
  when home_radius_m < 1500 then 1000
  else 2000
end
where home_radius_m not in (500, 1000, 2000);
alter table public.children drop constraint if exists children_home_radius_m_check;
alter table public.children add constraint children_home_radius_m_check
  check (home_radius_m in (500, 1000, 2000));
alter table public.children alter column home_radius_m set default 1000;

-- Keep the established complete_trip contract while exposing the requested end_trip name.
create or replace function public.end_trip(p_trip_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.complete_trip(p_trip_id)
$$;
revoke all on function public.end_trip(uuid) from public, anon;
grant execute on function public.end_trip(uuid) to authenticated;

-- One state row represents one stale-location episode per active trip.
create table if not exists private.stale_bus_location_state (
  trip_id uuid primary key references public.trips(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  stale_since timestamptz not null,
  alerted_at timestamptz not null default now(),
  recovered_at timestamptz
);
alter table private.stale_bus_location_state enable row level security;
revoke all on private.stale_bus_location_state from public, anon, authenticated;

create or replace function private.mark_bus_location_recovered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.stale_bus_location_state
  set recovered_at = now()
  where trip_id = new.trip_id and recovered_at is null;
  return new;
end
$$;
revoke all on function private.mark_bus_location_recovered() from public, anon, authenticated;
drop trigger if exists mark_bus_location_recovered on public.bus_live;
create trigger mark_bus_location_recovered
after insert or update of lat, lng, updated_at on public.bus_live
for each row execute function private.mark_bus_location_recovered();

create or replace function public.check_stale_bus_locations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale_trip record;
  newly_alerted uuid;
  alerts_created integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('predrive-stale-bus-location-check', 0));

  for stale_trip in
    select t.id as trip_id, t.bus_id, r.school_id,
           coalesce(bl.updated_at, t.started_at, t.created_at) as last_location_at
    from public.trips t
    join public.routes r on r.id = t.route_id
    left join public.bus_live bl on bl.trip_id = t.id
    where t.status = 'active'
      and coalesce(bl.updated_at, t.started_at, t.created_at) < now() - interval '60 seconds'
  loop
    newly_alerted := null;
    insert into private.stale_bus_location_state
      (trip_id, school_id, stale_since, alerted_at, recovered_at)
    values
      (stale_trip.trip_id, stale_trip.school_id, stale_trip.last_location_at, now(), null)
    on conflict (trip_id) do update
      set school_id = excluded.school_id,
          stale_since = excluded.stale_since,
          alerted_at = now(),
          recovered_at = null
      where private.stale_bus_location_state.recovered_at is not null
    returning trip_id into newly_alerted;

    if newly_alerted is not null then
      insert into public.notifications
        (user_id, school_id, type, title_key, body_key, params, priority)
      select p.id, stale_trip.school_id, 'bus_location_stale',
             'bus_location_stale', 'bus_location_stale',
             jsonb_build_object(
               'trip_id', stale_trip.trip_id,
               'bus_id', stale_trip.bus_id,
               'last_location_at', stale_trip.last_location_at
             ),
             'high'
      from public.profiles p
      where p.school_id = stale_trip.school_id and p.role = 'school_admin';
      alerts_created := alerts_created + 1;
    end if;
  end loop;

  return alerts_created;
end
$$;
revoke all on function public.check_stale_bus_locations() from public, anon, authenticated;

-- Retain GPS history for 90 days. Each run deletes a bounded batch to avoid long locks.
create or replace function public.purge_old_location_history()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with expired as (
    select ctid
    from public.location_history
    where recorded_at < now() - interval '90 days'
    order by recorded_at
    limit 10000
  )
  delete from public.location_history h
  using expired e
  where h.ctid = e.ctid;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end
$$;
revoke all on function public.purge_old_location_history() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'predrive-stale-bus-location-check') then
      perform cron.schedule(
        'predrive-stale-bus-location-check',
        '* * * * *',
        'select public.check_stale_bus_locations()'
      );
    end if;
    if not exists (select 1 from cron.job where jobname = 'predrive-location-history-retention') then
      perform cron.schedule(
        'predrive-location-history-retention',
        '17 * * * *',
        'select public.purge_old_location_history()'
      );
    end if;
  end if;
exception when others then
  raise notice 'preDrive stale-location/retention cron scheduling skipped: %', sqlerrm;
end
$$;
