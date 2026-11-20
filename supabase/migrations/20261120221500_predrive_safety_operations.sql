-- preDrive B1.3: vehicle checks, delays, incidents, alerts, SOS and broadcasts.
-- Uses frontend-defined alert/incident enums and existing school/transport identities.
-- All writes remain service-controlled until B2 policies and B3 RPCs are installed.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'alert_severity'
  ) then
    create type public.alert_severity as enum ('info', 'warning', 'urgent');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'alert_status'
  ) then
    create type public.alert_status as enum ('open', 'acknowledged', 'resolved');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'incident_status'
  ) then
    create type public.incident_status as enum ('open', 'investigating', 'resolved');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'incident_severity'
  ) then
    create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'delay_reason'
  ) then
    create type public.delay_reason as enum (
      'traffic', 'vehicle_issue', 'road_closure', 'weather', 'other'
    );
  end if;
end
$$;

create table if not exists public.vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  bus_id uuid not null,
  trip_id uuid,
  checked_by uuid not null references public.profiles(id) on delete restrict,
  items jsonb not null,
  safe_to_operate boolean not null,
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint vehicle_checks_id_school_key unique (id, school_id),
  constraint vehicle_checks_bus_school_fkey
    foreign key (bus_id, school_id)
    references public.buses (id, school_id) on delete restrict,
  constraint vehicle_checks_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete restrict,
  constraint vehicle_checks_items_shape_check check (
    case
      when jsonb_typeof(items) = 'array' then jsonb_array_length(items) = 8
      else false
    end
  ),
  constraint vehicle_checks_checked_at_check check (checked_at <= created_at + interval '5 minutes')
);

comment on table public.vehicle_checks is
  'Append-only pre-trip vehicle inspection. Eight keyed checklist items retain key, label, passed and optional notes; the B3 RPC validates item structure and derives safe_to_operate.';
comment on column public.vehicle_checks.items is
  'JSON array of exactly eight objects: {key,label,passed,notes?}. Item keys and labels are validated by the server against the current checklist.';
comment on column public.vehicle_checks.safe_to_operate is
  'Server-derived value. A failed item blocks trip start; clients cannot set this through direct table access.';

create table if not exists public.delay_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  trip_id uuid not null,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  reason public.delay_reason not null,
  description text check (description is null or char_length(btrim(description)) between 2 and 1000),
  estimated_delay_minutes smallint check (estimated_delay_minutes between 1 and 720),
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint delay_reports_id_school_key unique (id, school_id),
  constraint delay_reports_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete restrict
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null check (char_length(btrim(description)) between 2 and 5000),
  severity public.incident_severity not null,
  status public.incident_status not null default 'open',
  trip_id uuid,
  child_id uuid,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution_notes text check (resolution_notes is null or char_length(btrim(resolution_notes)) between 2 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_id_school_key unique (id, school_id),
  constraint incidents_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete restrict,
  constraint incidents_child_school_fkey
    foreign key (child_id, school_id)
    references public.children (id, school_id) on delete restrict,
  constraint incidents_resolution_state_check check (
    (status = 'resolved' and resolved_at is not null and resolved_by is not null)
    or (status <> 'resolved' and resolved_at is null and resolved_by is null)
  )
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  message text not null check (char_length(btrim(message)) between 2 and 3000),
  severity public.alert_severity not null,
  status public.alert_status not null default 'open',
  source_type text not null default 'manual'
    check (source_type in (
      'manual', 'sos', 'delay', 'incident', 'geofence',
      'unaccounted_child', 'vehicle_check'
    )),
  source_id uuid,
  dedupe_key text check (dedupe_key is null or char_length(btrim(dedupe_key)) between 1 and 200),
  created_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  repeat_until_acknowledged boolean not null default false,
  next_escalation_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_id_school_key unique (id, school_id),
  constraint alerts_acknowledgement_state_check check (
    (status = 'open' and acknowledged_at is null and acknowledged_by is null)
    or (status in ('acknowledged', 'resolved') and acknowledged_at is not null and acknowledged_by is not null)
  ),
  constraint alerts_resolution_state_check check (
    (status = 'resolved' and resolved_at is not null and resolved_by is not null)
    or (status <> 'resolved' and resolved_at is null and resolved_by is null)
  ),
  constraint alerts_escalation_state_check check (
    (repeat_until_acknowledged = false or (severity = 'urgent' and status = 'open'))
    and (next_escalation_at is null or (repeat_until_acknowledged and status = 'open'))
  )
);

create unique index if not exists alerts_school_dedupe_key_uidx
  on public.alerts (school_id, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.alert_recipients (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  alert_id uuid not null,
  recipient_user_id uuid not null,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  delivery_attempts smallint not null default 0 check (delivery_attempts between 0 and 20),
  last_delivery_error text check (last_delivery_error is null or char_length(last_delivery_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alert_recipients_id_school_key unique (id, school_id),
  constraint alert_recipients_alert_school_fkey
    foreign key (alert_id, school_id)
    references public.alerts (id, school_id) on delete cascade,
  constraint alert_recipients_membership_fkey
    foreign key (school_id, recipient_user_id)
    references public.school_memberships (school_id, user_id) on delete restrict,
  constraint alert_recipients_school_alert_user_key
    unique (school_id, alert_id, recipient_user_id)
);

create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  raised_by uuid not null references public.profiles(id) on delete restrict,
  trip_id uuid,
  alert_id uuid,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_notes text check (resolution_notes is null or char_length(btrim(resolution_notes)) between 2 and 2000),
  created_at timestamptz not null default now(),
  constraint sos_events_id_school_key unique (id, school_id),
  constraint sos_events_trip_school_fkey
    foreign key (trip_id, school_id)
    references public.trips (id, school_id) on delete restrict,
  constraint sos_events_alert_school_fkey
    foreign key (alert_id, school_id)
    references public.alerts (id, school_id) on delete restrict,
  constraint sos_events_resolution_state_check check (
    (resolved_at is null and resolved_by is null)
    or (resolved_at is not null and resolved_by is not null)
  )
);

comment on table public.sos_events is
  'Durable SOS audit record. Exact coordinates supplied to the SOS action are transient delivery data and are intentionally not persisted, consistent with the brief location-privacy promise.';

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  message text not null check (char_length(btrim(message)) between 2 and 5000),
  target_roles public.user_role[] not null default array[
    'school_admin', 'guardian', 'supervisor', 'driver', 'teacher'
  ]::public.user_role[],
  status text not null default 'draft'
    check (status in ('draft', 'published', 'expired', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broadcasts_id_school_key unique (id, school_id),
  constraint broadcasts_target_roles_check check (cardinality(target_roles) between 1 and 5),
  constraint broadcasts_schedule_check check (
    expires_at is null or (published_at is not null and expires_at > published_at)
  ),
  constraint broadcasts_publish_state_check check (
    (status = 'draft' and published_at is null)
    or (status in ('published', 'expired', 'cancelled') and published_at is not null)
  )
);

-- Keep mutable records' timestamps consistent with the existing foundation.
drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function private.set_updated_at();

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
before update on public.alerts
for each row execute function private.set_updated_at();

drop trigger if exists alert_recipients_set_updated_at on public.alert_recipients;
create trigger alert_recipients_set_updated_at
before update on public.alert_recipients
for each row execute function private.set_updated_at();

drop trigger if exists broadcasts_set_updated_at on public.broadcasts;
create trigger broadcasts_set_updated_at
before update on public.broadcasts
for each row execute function private.set_updated_at();

create index if not exists vehicle_checks_school_bus_checked_idx
  on public.vehicle_checks (school_id, bus_id, checked_at desc);
create index if not exists vehicle_checks_school_trip_checked_idx
  on public.vehicle_checks (school_id, trip_id, checked_at desc)
  where trip_id is not null;
create index if not exists vehicle_checks_checked_by_fkey_idx
  on public.vehicle_checks (checked_by);

create index if not exists delay_reports_school_trip_reported_idx
  on public.delay_reports (school_id, trip_id, reported_at desc);
create index if not exists delay_reports_school_reason_reported_idx
  on public.delay_reports (school_id, reason, reported_at desc);
create index if not exists delay_reports_reported_by_fkey_idx
  on public.delay_reports (reported_by);

create index if not exists incidents_school_status_severity_created_idx
  on public.incidents (school_id, status, severity, created_at desc);
create index if not exists incidents_school_trip_occurred_idx
  on public.incidents (school_id, trip_id, occurred_at desc)
  where trip_id is not null;
create index if not exists incidents_school_child_occurred_idx
  on public.incidents (school_id, child_id, occurred_at desc)
  where child_id is not null;
create index if not exists incidents_reported_by_fkey_idx
  on public.incidents (reported_by);

create index if not exists alerts_school_status_severity_created_idx
  on public.alerts (school_id, status, severity, created_at desc);
create index if not exists alerts_school_escalation_idx
  on public.alerts (school_id, next_escalation_at)
  where repeat_until_acknowledged = true and status = 'open';
create index if not exists alerts_source_idx
  on public.alerts (school_id, source_type, source_id)
  where source_id is not null;

create index if not exists alert_recipients_user_ack_idx
  on public.alert_recipients (school_id, recipient_user_id, acknowledged_at);
create index if not exists alert_recipients_alert_delivery_idx
  on public.alert_recipients (school_id, alert_id, delivered_at);
create index if not exists alert_recipients_membership_fkey_idx
  on public.alert_recipients (school_id, recipient_user_id);

create index if not exists sos_events_school_raised_idx
  on public.sos_events (school_id, raised_at desc);
create index if not exists sos_events_raised_by_fkey_idx
  on public.sos_events (raised_by);
create index if not exists sos_events_alert_fkey_idx
  on public.sos_events (alert_id, school_id)
  where alert_id is not null;

create index if not exists broadcasts_school_status_published_idx
  on public.broadcasts (school_id, status, published_at desc);

-- Inspection and delay submissions are immutable records; only trusted RPCs can insert.
-- Alert, incident, recipient and broadcast state transitions are server-controlled.
alter table public.vehicle_checks enable row level security;
alter table public.delay_reports enable row level security;
alter table public.incidents enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_recipients enable row level security;
alter table public.sos_events enable row level security;
alter table public.broadcasts enable row level security;

revoke all on table
  public.vehicle_checks,
  public.delay_reports,
  public.incidents,
  public.alerts,
  public.alert_recipients,
  public.sos_events,
  public.broadcasts
from public, anon, authenticated, service_role;

grant all privileges on table
  public.vehicle_checks,
  public.delay_reports,
  public.incidents,
  public.alerts,
  public.alert_recipients,
  public.sos_events,
  public.broadcasts
to service_role;

revoke update, delete, truncate on public.vehicle_checks, public.delay_reports
from service_role;
