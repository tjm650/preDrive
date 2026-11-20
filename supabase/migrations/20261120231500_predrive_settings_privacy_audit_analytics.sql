-- preDrive B1.5: school settings, consent, device registrations, deletion workflow,
-- immutable audit records, rate-limit events, webhook inbox and tenant analytics.
-- RLS is enabled with no client policies; B2 adds the role matrix and B3 adds RPCs.

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  setting_key text not null check (setting_key in (
    'default_pickup_radius_meters',
    'arrival_notification_lead_minutes',
    'trip_generation_days_ahead',
    'on_time_tolerance_minutes',
    'location_history_retention_hours',
    'guardian_location_visibility'
  )),
  setting_value jsonb not null,
  description text check (description is null or char_length(btrim(description)) <= 240),
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settings_id_school_key unique (id, school_id),
  constraint settings_school_key unique (school_id, setting_key),
  constraint settings_value_size_check check (pg_column_size(setting_value) <= 2048),
  constraint settings_value_shape_check check (
    case setting_key
      when 'default_pickup_radius_meters' then
        jsonb_typeof(setting_value) = 'number'
        and (setting_value #>> '{}')::numeric in (500, 1000, 2000)
      when 'arrival_notification_lead_minutes' then
        jsonb_typeof(setting_value) = 'number'
        and (setting_value #>> '{}')::numeric between 1 and 60
      when 'trip_generation_days_ahead' then
        jsonb_typeof(setting_value) = 'number'
        and (setting_value #>> '{}')::numeric between 1 and 14
      when 'on_time_tolerance_minutes' then
        jsonb_typeof(setting_value) = 'number'
        and (setting_value #>> '{}')::numeric between 0 and 60
      when 'location_history_retention_hours' then
        jsonb_typeof(setting_value) = 'number'
        and (setting_value #>> '{}')::numeric between 0 and 24
      when 'guardian_location_visibility' then
        jsonb_typeof(setting_value) = 'string'
        and setting_value #>> '{}' in ('active_trip_only')
      else false
    end
  )
);

comment on table public.settings is
  'Allowlisted school configuration only. Exchange-rate source of truth remains schools.indicative_zig_per_usd; this table is not an unrestricted JSON settings bucket.';

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  subject_user_id uuid references public.profiles(id) on delete restrict,
  child_id uuid,
  purpose text not null check (purpose in (
    'child_transport',
    'child_location_tracking',
    'emergency_contact',
    'incident_media',
    'communications',
    'data_processing'
  )),
  policy_version text not null check (char_length(btrim(policy_version)) between 1 and 40),
  status text not null check (status in ('granted', 'denied', 'withdrawn')),
  captured_by uuid not null references public.profiles(id) on delete restrict,
  captured_at timestamptz not null default now(),
  effective_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint consent_records_id_school_key unique (id, school_id),
  constraint consent_records_child_school_fkey
    foreign key (child_id, school_id)
    references public.children(id, school_id) on delete restrict,
  constraint consent_records_subject_check check (
    (subject_user_id is not null)::integer + (child_id is not null)::integer = 1
  ),
  constraint consent_records_evidence_size_check check (pg_column_size(evidence) <= 4096),
  constraint consent_records_evidence_object_check check (jsonb_typeof(evidence) = 'object')
);

comment on table public.consent_records is
  'Append-only consent history. A withdrawal is a new record; prior consent evidence is not overwritten. Evidence must not contain raw PINs, passwords or payment credentials.';

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  provider text not null default 'expo' check (provider in ('expo')),
  push_token text not null check (char_length(push_token) between 20 and 512),
  device_label text check (device_label is null or char_length(btrim(device_label)) <= 120),
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_tokens_id_school_key unique (id, school_id),
  constraint device_tokens_membership_fkey
    foreign key (school_id, user_id)
    references public.school_memberships(school_id, user_id) on delete cascade,
  constraint device_tokens_school_token_unique unique (school_id, push_token),
  constraint device_tokens_revocation_check check (
    (active = true and revoked_at is null)
    or (active = false and revoked_at is not null)
  )
);

comment on column public.device_tokens.push_token is
  'Expo push token. Never include this token in application logs or analytics exports.';

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  subject_user_id uuid references public.profiles(id) on delete restrict,
  child_id uuid,
  request_type text not null check (request_type in ('account', 'child_record', 'data_export')),
  status text not null default 'pending'
    check (status in ('pending', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'cancelled')),
  reason text check (reason is null or char_length(btrim(reason)) <= 2000),
  decision_note text check (decision_note is null or char_length(btrim(decision_note)) <= 2000),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_hold boolean not null default false,
  retention_hold_reason text check (
    retention_hold_reason is null or char_length(btrim(retention_hold_reason)) <= 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deletion_requests_id_school_key unique (id, school_id),
  constraint deletion_requests_child_school_fkey
    foreign key (child_id, school_id)
    references public.children(id, school_id) on delete restrict,
  constraint deletion_requests_subject_check check (
    (subject_user_id is not null)::integer + (child_id is not null)::integer = 1
  ),
  constraint deletion_requests_review_state_check check (
    (status in ('pending', 'cancelled') and reviewed_by is null and reviewed_at is null)
    or (status in ('under_review', 'approved', 'rejected', 'processing', 'completed')
        and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint deletion_requests_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint deletion_requests_hold_check check (
    (retention_hold = false and retention_hold_reason is null)
    or (retention_hold = true and retention_hold_reason is not null)
  )
);

comment on column public.deletion_requests.retention_hold is
  'A legal or financial retention exception blocks destructive deletion. The reason must be documented and reviewed; financial source records remain immutable.';

create table if not exists public.setup_progress (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  step_key text not null check (step_key ~ '^[a-z][a-z0-9_.-]*$'),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
  details jsonb not null default '{}'::jsonb,
  completed_by uuid references public.profiles(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setup_progress_id_school_key unique (id, school_id),
  constraint setup_progress_school_step_key unique (school_id, step_key),
  constraint setup_progress_details_check check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096
  ),
  constraint setup_progress_state_check check (
    (status = 'pending' and started_at is null and completed_at is null)
    or (status = 'in_progress' and started_at is not null and completed_at is null)
    or (status in ('completed', 'skipped') and completed_at is not null)
    or (status = 'blocked' and completed_at is null)
  )
);

comment on table public.setup_progress is
  'School onboarding checklist state. Details contain operational checklist metadata only, never secrets or child-sensitive data.';
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  target_table text not null check (target_table ~ '^[a-z][a-z0-9_]{1,62}$'),
  target_id text check (target_id is null or char_length(target_id) <= 160),
  request_id text check (request_id is null or char_length(request_id) <= 120),
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'failure')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_log_metadata_size_check check (pg_column_size(metadata) <= 8192),
  constraint audit_log_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

comment on table public.audit_log is
  'Append-only security and administrative audit trail. Metadata must be minimised and must never contain credentials, raw PINs, full payment payloads or precise GPS coordinates.';

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools(id) on delete cascade,
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint rate_limit_events_expiry_check check (expires_at > occurred_at)
);

comment on table public.rate_limit_events is
  'Short-lived rate-limit ledger. subject_hash is a keyed digest generated by trusted server code; raw email, phone, IP and PIN values are forbidden.';

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete restrict,
  provider text not null check (provider in ('paynow', 'manual_bank', 'other')),
  provider_event_id text not null check (char_length(btrim(provider_event_id)) between 1 and 200),
  event_type text not null check (char_length(btrim(event_type)) between 1 and 120),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature_verified boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'processed', 'ignored', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 100),
  constraint webhook_events_provider_event_key unique (provider, provider_event_id),
  constraint webhook_events_payload_size_check check (pg_column_size(payload) <= 65536),
  constraint webhook_events_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint webhook_events_processing_check check (
    (processing_status in ('processed', 'ignored') and processed_at is not null)
    or (processing_status in ('received', 'processing', 'failed') and processed_at is null)
  )
);

comment on table public.webhook_events is
  'Durable, deduplicated provider webhook inbox. Store only the minimum provider payload required for verification/reconciliation; never store secrets or card data. Unverified events must not mutate payment state.';

-- Updated timestamps on mutable operational records.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'settings', 'device_tokens', 'deletion_requests', 'setup_progress'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end
$$;

-- Tenant and operational indexes.
create index if not exists settings_school_key_idx
  on public.settings (school_id, setting_key);
create index if not exists settings_updated_by_fkey_idx
  on public.settings (updated_by) where updated_by is not null;

create index if not exists consent_records_child_purpose_time_idx
  on public.consent_records (school_id, child_id, purpose, effective_at desc)
  where child_id is not null;
create index if not exists consent_records_subject_purpose_time_idx
  on public.consent_records (school_id, subject_user_id, purpose, effective_at desc)
  where subject_user_id is not null;
create index if not exists consent_records_captured_by_idx
  on public.consent_records (captured_by);

create index if not exists device_tokens_user_active_idx
  on public.device_tokens (school_id, user_id, active, last_seen_at desc);
create index if not exists device_tokens_updated_at_idx
  on public.device_tokens (updated_at desc);

create index if not exists deletion_requests_school_status_requested_idx
  on public.deletion_requests (school_id, status, requested_at);
create index if not exists deletion_requests_requested_by_fkey_idx
  on public.deletion_requests (requested_by);
create index if not exists deletion_requests_reviewed_by_fkey_idx
  on public.deletion_requests (reviewed_by) where reviewed_by is not null;
create index if not exists deletion_requests_subject_user_idx
  on public.deletion_requests (subject_user_id)
  where subject_user_id is not null;
create index if not exists deletion_requests_child_idx
  on public.deletion_requests (school_id, child_id)
  where child_id is not null;

create index if not exists setup_progress_school_status_idx
  on public.setup_progress (school_id, status, step_key);

create index if not exists setup_progress_completed_by_fkey_idx
  on public.setup_progress (completed_by) where completed_by is not null;

create index if not exists audit_log_school_time_idx
  on public.audit_log (school_id, occurred_at desc);
create index if not exists audit_log_school_actor_time_idx
  on public.audit_log (school_id, actor_user_id, occurred_at desc)
  where actor_user_id is not null;
create index if not exists audit_log_target_idx
  on public.audit_log (school_id, target_table, target_id, occurred_at desc);

create index if not exists rate_limit_events_subject_action_time_idx
  on public.rate_limit_events (subject_hash, action, occurred_at desc);
create index if not exists rate_limit_events_expiry_idx
  on public.rate_limit_events (expires_at);
create index if not exists rate_limit_events_school_expiry_idx
  on public.rate_limit_events (school_id, expires_at) where school_id is not null;

create index if not exists webhook_events_school_status_received_idx
  on public.webhook_events (school_id, processing_status, received_at desc)
  where school_id is not null;
create index if not exists webhook_events_status_received_idx
  on public.webhook_events (processing_status, received_at desc);
create index if not exists webhook_events_school_fkey_idx
  on public.webhook_events (school_id) where school_id is not null;
create index if not exists webhook_events_payload_hash_idx
  on public.webhook_events (payload_sha256);

-- Append-only guards protect audit/consent history even from trusted application roles.
create or replace function private.reject_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception using
    errcode = '55000',
    message = 'APPEND_ONLY_RECORD';
end;
$function$;

revoke all on function private.reject_append_only_mutation() from public, anon, authenticated, service_role;

drop trigger if exists audit_log_reject_mutation on public.audit_log;
create trigger audit_log_reject_mutation
before update or delete on public.audit_log
for each row execute function private.reject_append_only_mutation();

drop trigger if exists consent_records_reject_mutation on public.consent_records;
create trigger consent_records_reject_mutation
before update or delete on public.consent_records
for each row execute function private.reject_append_only_mutation();

-- RLS is mandatory on every tenant-owned table. Policies and narrow client grants
-- are deliberately deferred to B2; service_role is the only writer in B1.
alter table public.settings enable row level security;
alter table public.consent_records enable row level security;
alter table public.device_tokens enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.setup_progress enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.webhook_events enable row level security;

revoke all on table
  public.settings, public.consent_records, public.device_tokens,
  public.deletion_requests, public.setup_progress, public.audit_log, public.rate_limit_events,
  public.webhook_events
from public, anon, authenticated, service_role;

grant all privileges on table
  public.settings, public.device_tokens,
  public.deletion_requests, public.setup_progress, public.rate_limit_events, public.webhook_events
to service_role;

grant select, insert on public.consent_records, public.audit_log to service_role;
revoke update, delete, truncate on public.audit_log from service_role;

grant usage, select on sequence public.audit_log_id_seq, public.rate_limit_events_id_seq to service_role;

-- Tenant-safe analytics: security_invoker ensures underlying table RLS applies.
-- No direct grants are made to client roles in this phase.
create or replace view public.analytics_attendance_daily
with (security_invoker = true)
as
select
  tc.school_id,
  t.service_date,
  count(*) filter (where tc.status = 'on_board') as boarded_count,
  count(*) filter (where tc.status = 'absent') as absent_count,
  count(*) filter (where tc.status = 'handed_over') as handed_over_count,
  count(*) filter (where tc.status = 'pending') as pending_count,
  count(*) as manifest_count
from public.trip_children as tc
join public.trips as t
  on t.id = tc.trip_id and t.school_id = tc.school_id
group by tc.school_id, t.service_date;

create or replace view public.analytics_trip_duration_daily
with (security_invoker = true)
as
select
  school_id,
  service_date,
  count(*) filter (where status = 'completed') as completed_trip_count,
  round(avg(extract(epoch from (ended_at - started_at)) / 60.0)
    filter (where status = 'completed' and started_at is not null and ended_at is not null), 1)
    as average_duration_minutes,
  max(extract(epoch from (ended_at - started_at)) / 60.0)
    filter (where status = 'completed' and started_at is not null and ended_at is not null)
    as longest_duration_minutes
from public.trips
group by school_id, service_date;

create or replace view public.analytics_delay_reasons
with (security_invoker = true)
as
select
  school_id,
  reason,
  date_trunc('day', reported_at) as report_day,
  count(*) as report_count,
  round(avg(estimated_delay_minutes), 1) as average_estimated_delay_minutes
from public.delay_reports
group by school_id, reason, date_trunc('day', reported_at);

create or replace view public.analytics_incidents_by_type
with (security_invoker = true)
as
select
  school_id,
  severity,
  status,
  date_trunc('day', occurred_at) as incident_day,
  count(*) as incident_count
from public.incidents
group by school_id, severity, status, date_trunc('day', occurred_at);

create or replace view public.analytics_fee_collection_trend
with (security_invoker = true)
as
select
  school_id,
  currency,
  date_trunc('month', succeeded_at) as collection_month,
  count(*) as successful_payment_count,
  sum(amount_minor) as collected_minor_units
from public.payments
where status = 'succeeded' and succeeded_at is not null
group by school_id, currency, date_trunc('month', succeeded_at);

comment on view public.analytics_attendance_daily is
  'Daily manifest counts by server-recorded child trip status; pending is not treated as attendance.';
comment on view public.analytics_trip_duration_daily is
  'Completed trip duration from started_at to ended_at. This is not an on-time-arrival metric.';
comment on view public.analytics_fee_collection_trend is
  'Successful collections grouped by original payment currency and month; values remain integer minor units.';

revoke all on public.analytics_attendance_daily,
  public.analytics_trip_duration_daily,
  public.analytics_delay_reasons,
  public.analytics_incidents_by_type,
  public.analytics_fee_collection_trend
from public, anon, authenticated, service_role;
