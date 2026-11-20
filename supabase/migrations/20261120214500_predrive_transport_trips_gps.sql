-- preDrive B1.2: fleet, routes, schedules, trips and location schema.
-- Extends the identity and child/guardian migrations without resetting existing data.
-- RLS is enabled and client privileges are withheld; role policies are added in B2.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='bus_status') then
    create type public.bus_status as enum ('active', 'maintenance', 'inactive');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='route_status') then
    create type public.route_status as enum ('active', 'inactive');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='trip_status') then
    create type public.trip_status as enum ('scheduled', 'active', 'completed', 'cancelled', 'attention_required');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='trip_direction') then
    create type public.trip_direction as enum ('to_school', 'from_school');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='trip_child_status') then
    create type public.trip_child_status as enum ('pending', 'on_board', 'absent', 'handed_over');
  end if;
end
$$;

-- Composite staff references allow the database to enforce same-school assignments.
create unique index if not exists staff_members_id_school_uidx
  on public.staff_members (id, school_id);

create or replace function private.is_unique_smallint_array(p_values smallint[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $
  select cardinality(p_values) = (
    select count(distinct item)::integer
    from unnest(p_values) as input_values(item)
  );
$;

revoke all on function private.is_unique_smallint_array(smallint[]) from public, anon, authenticated, service_role;

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  registration_number text not null check (char_length(btrim(registration_number)) between 2 and 24),
  make text not null check (char_length(btrim(make)) between 1 and 80),
  model text not null check (char_length(btrim(model)) between 1 and 80),
  capacity smallint not null check (capacity between 1 and 100),
  status public.bus_status not null default 'active',
  active_device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buses_id_school_key unique (id, school_id),
  constraint buses_school_registration_key unique (school_id, registration_number),
  constraint buses_device_id_length_check check (active_device_id is null or char_length(active_device_id) between 8 and 160)
);

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  code text not null check (char_length(btrim(code)) between 1 and 24),
  status public.route_status not null default 'active',
  assigned_bus_id uuid,
  estimated_duration_minutes smallint check (estimated_duration_minutes between 1 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transport_routes_id_school_key unique (id, school_id),
  constraint transport_routes_school_code_key unique (school_id, code),
  constraint transport_routes_assigned_bus_school_fkey
    foreign key (assigned_bus_id, school_id)
    references public.buses (id, school_id) on delete restrict
);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  route_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null check (char_length(btrim(address)) between 2 and 300),
  stop_order smallint not null check (stop_order between 1 and 200),
  location extensions.geography(Point, 4326),
  pickup_radius_meters smallint not null default 200 check (pickup_radius_meters between 50 and 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_stops_id_school_key unique (id, school_id),
  constraint route_stops_route_order_key unique (route_id, stop_order),
  constraint route_stops_route_school_fkey
    foreign key (route_id, school_id)
    references public.transport_routes (id, school_id) on delete cascade
);

create table if not exists public.route_schedules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  route_id uuid not null,
  direction public.trip_direction not null,
  departure_time time not null,
  days_of_week smallint[] not null check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  effective_from date not null,
  effective_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_schedules_id_school_key unique (id, school_id),
  constraint route_schedules_route_school_fkey
    foreign key (route_id, school_id)
    references public.transport_routes (id, school_id) on delete cascade,
  constraint route_schedules_effective_dates_check check (
    effective_until is null or effective_until >= effective_from
  ),
  constraint route_schedules_days_unique_check check (
    private.is_unique_smallint_array(days_of_week)
  )
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  route_id uuid not null,
  schedule_id uuid,
  bus_id uuid not null,
  supervisor_id uuid,
  driver_id uuid not null,
  direction public.trip_direction not null,
  service_date date not null,
  status public.trip_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  started_at timestamptz,
  ended_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  generation_key text,
  started_by uuid references public.profiles(id) on delete set null,
  ended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_id_school_key unique (id, school_id),
  constraint trips_route_school_fkey
    foreign key (route_id, school_id)
    references public.transport_routes (id, school_id) on delete restrict,
  constraint trips_schedule_school_fkey
    foreign key (schedule_id, school_id)
    references public.route_schedules (id, school_id) on delete restrict,
  constraint trips_bus_school_fkey
    foreign key (bus_id, school_id)
    references public.buses (id, school_id) on delete restrict,
  constraint trips_supervisor_school_fkey
    foreign key (supervisor_id, school_id)
    references public.staff_members (id, school_id) on delete restrict,
  constraint trips_driver_school_fkey
    foreign key (driver_id, school_id)
    references public.staff_members (id, school_id) on delete restrict,
  constraint trips_time_order_check check (
    (started_at is null or started_at >= scheduled_at - interval '12 hours')
    and (ended_at is null or started_at is not null and ended_at >= started_at)
  ),
  constraint trips_terminal_state_check check (
    (status <> 'completed' or ended_at is not null)
    and (status <> 'cancelled' or cancelled_at is not null)
  ),
  constraint trips_cancellation_reason_check check (
    (status = 'cancelled' and cancellation_reason is not null and char_length(btrim(cancellation_reason)) between 2 and 500)
    or (status <> 'cancelled' and cancellation_reason is null)
  )
);

create unique index if not exists trips_schedule_service_date_direction_uidx
  on public.trips (school_id, schedule_id, service_date, direction)
  where schedule_id is not null;

create unique index if not exists trips_generation_key_uidx
  on public.trips (school_id, generation_key)
  where generation_key is not null;

create table if not exists public.trip_children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  trip_id uuid not null,
  child_id uuid not null,
  status public.trip_child_status not null default 'pending',
  boarded_at timestamptz,
  handed_over_at timestamptz,
  recorded_by uuid references public.profiles(id) on delete set null,
  idempotency_key uuid not null,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_children_id_school_key unique (id, school_id),
  constraint trip_children_trip_child_key unique (trip_id, child_id),
  constraint trip_children_idempotency_school_key unique (school_id, idempotency_key),
  constraint trip_children_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete cascade,
  constraint trip_children_child_school_fkey
    foreign key (child_id, school_id)
    references public.children (id, school_id) on delete restrict,
  constraint trip_children_status_timestamps_check check (
    (status <> 'on_board' or boarded_at is not null)
    and (status <> 'handed_over' or handed_over_at is not null)
  )
);

create table if not exists public.trip_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  trip_id uuid not null,
  trip_child_id uuid,
  event_type text not null check (event_type in (
    'trip_started', 'trip_completed', 'trip_cancelled',
    'child_boarded', 'child_marked_absent', 'child_handed_over',
    'position_recorded', 'delay_reported', 'sos_raised',
    'incident_reported', 'alert_acknowledged', 'vehicle_check_completed'
  )),
  actor_user_id uuid references public.profiles(id) on delete set null,
  idempotency_key uuid,
  event_data jsonb not null default '{}'::jsonb check (pg_column_size(event_data) <= 16384),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  constraint trip_events_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete restrict,
  constraint trip_events_trip_child_school_fkey
    foreign key (trip_child_id, school_id)
    references public.trip_children (id, school_id) on delete restrict,
  constraint trip_events_idempotency_key_check check (
    idempotency_key is null or idempotency_key::text <> '00000000-0000-0000-0000-000000000000'
  )
);

create unique index if not exists trip_events_school_idempotency_uidx
  on public.trip_events (school_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.bus_positions (
  trip_id uuid primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  bus_id uuid not null,
  location extensions.geography(Point, 4326) not null,
  heading_degrees numeric(5,2) check (heading_degrees >= 0 and heading_degrees < 360),
  speed_kph numeric(6,2) check (speed_kph >= 0 and speed_kph <= 200),
  accuracy_meters numeric(7,2) check (accuracy_meters >= 0 and accuracy_meters <= 1000),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint bus_positions_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete cascade,
  constraint bus_positions_bus_school_fkey
    foreign key (bus_id, school_id)
    references public.buses (id, school_id) on delete restrict
);

create table if not exists public.bus_position_history (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  trip_id uuid not null,
  bus_id uuid not null,
  location extensions.geography(Point, 4326) not null,
  heading_degrees numeric(5,2) check (heading_degrees >= 0 and heading_degrees < 360),
  speed_kph numeric(6,2) check (speed_kph >= 0 and speed_kph <= 200),
  accuracy_meters numeric(7,2) check (accuracy_meters >= 0 and accuracy_meters <= 1000),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  constraint bus_position_history_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete cascade,
  constraint bus_position_history_bus_school_fkey
    foreign key (bus_id, school_id)
    references public.buses (id, school_id) on delete restrict
);

-- Append-only event journal: even trusted application roles cannot mutate or delete events.
create or replace function private.reject_trip_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'TRIP_EVENTS_APPEND_ONLY';
end;
$$;

revoke all on function private.reject_trip_event_mutation() from public, anon, authenticated, service_role;

drop trigger if exists trip_events_reject_update on public.trip_events;
create trigger trip_events_reject_update
before update or delete on public.trip_events
for each row execute function private.reject_trip_event_mutation();

drop trigger if exists buses_set_updated_at on public.buses;
create trigger buses_set_updated_at before update on public.buses
for each row execute function private.set_updated_at();

drop trigger if exists transport_routes_set_updated_at on public.transport_routes;
create trigger transport_routes_set_updated_at before update on public.transport_routes
for each row execute function private.set_updated_at();

drop trigger if exists route_stops_set_updated_at on public.route_stops;
create trigger route_stops_set_updated_at before update on public.route_stops
for each row execute function private.set_updated_at();

drop trigger if exists route_schedules_set_updated_at on public.route_schedules;
create trigger route_schedules_set_updated_at before update on public.route_schedules
for each row execute function private.set_updated_at();

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at before update on public.trips
for each row execute function private.set_updated_at();

drop trigger if exists trip_children_set_updated_at on public.trip_children;
create trigger trip_children_set_updated_at before update on public.trip_children
for each row execute function private.set_updated_at();

create index if not exists buses_school_status_registration_idx
  on public.buses (school_id, status, registration_number);

create index if not exists transport_routes_school_status_name_idx
  on public.transport_routes (school_id, status, name);

create index if not exists transport_routes_assigned_bus_fkey_idx
  on public.transport_routes (assigned_bus_id, school_id)
  where assigned_bus_id is not null;

create index if not exists route_stops_route_school_order_idx
  on public.route_stops (route_id, school_id, stop_order);

create index if not exists route_stops_location_gist_idx
  on public.route_stops using gist (location)
  where location is not null;

create index if not exists route_schedules_route_active_days_idx
  on public.route_schedules (school_id, route_id, active, effective_from, effective_until);

create index if not exists trips_school_service_date_status_idx
  on public.trips (school_id, service_date desc, status, scheduled_at);

create index if not exists trips_driver_schedule_idx
  on public.trips (school_id, driver_id, scheduled_at desc);

create index if not exists trips_supervisor_schedule_idx
  on public.trips (school_id, supervisor_id, scheduled_at desc)
  where supervisor_id is not null;

create index if not exists trips_bus_schedule_idx
  on public.trips (school_id, bus_id, scheduled_at desc);

create index if not exists trips_route_schedule_idx
  on public.trips (school_id, route_id, scheduled_at desc);

create index if not exists trip_children_child_status_idx
  on public.trip_children (school_id, child_id, status, updated_at desc);

create index if not exists trip_children_trip_status_idx
  on public.trip_children (school_id, trip_id, status);

create index if not exists trip_events_trip_occurred_idx
  on public.trip_events (school_id, trip_id, occurred_at desc);

create index if not exists trip_events_school_type_occurred_idx
  on public.trip_events (school_id, event_type, occurred_at desc);

create index if not exists bus_positions_location_gist_idx
  on public.bus_positions using gist (location);

create index if not exists bus_positions_school_received_idx
  on public.bus_positions (school_id, received_at desc);

create index if not exists bus_position_history_trip_recorded_idx
  on public.bus_position_history (school_id, trip_id, recorded_at desc);

create index if not exists bus_position_history_school_received_idx
  on public.bus_position_history (school_id, received_at desc);

alter table public.buses enable row level security;
alter table public.transport_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.route_schedules enable row level security;
alter table public.trips enable row level security;
alter table public.trip_children enable row level security;
alter table public.trip_events enable row level security;
alter table public.bus_positions enable row level security;
alter table public.bus_position_history enable row level security;

revoke all on table
  public.buses, public.transport_routes, public.route_stops, public.route_schedules,
  public.trips, public.trip_children, public.trip_events, public.bus_positions,
  public.bus_position_history
from public, anon, authenticated, service_role;

grant all privileges on table
  public.buses, public.transport_routes, public.route_stops, public.route_schedules,
  public.trips, public.trip_children, public.trip_events, public.bus_positions,
  public.bus_position_history
to service_role;

grant usage, select on sequence public.bus_position_history_id_seq to service_role;
