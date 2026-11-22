-- preDrive B2.6: atomic database rate limiting.
-- This function is callable only by trusted service_role Edge Functions. It
-- serializes requests for each (school, action, subject hash) key using a
-- transaction-scoped advisory lock, then counts and records attempts atomically.
-- Raw IP addresses, PINs, emails or other secrets must never be stored here:
-- callers provide a lowercase SHA-256 digest in subject_hash.

create or replace function private.consume_rate_limit(
  p_school_id uuid,
  p_action text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_key text;
  v_count bigint;
begin
  if p_action is null
     or p_action !~ '^[a-z][a-z0-9_.-]{1,79}$' then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate-limit action';
  end if;

  if p_subject_hash is null
     or p_subject_hash !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'Subject must be a lowercase SHA-256 digest';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Rate-limit threshold must be between 1 and 1000';
  end if;

  if p_window_seconds is null
     or p_window_seconds < 1
     or p_window_seconds > 86400 then
    raise exception using
      errcode = '22023',
      message = 'Rate-limit window must be between 1 and 86400 seconds';
  end if;

  v_key := coalesce(p_school_id::text, 'global')
    || ':' || p_action
    || ':' || p_subject_hash;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_key, 0)
  );

  v_now := pg_catalog.clock_timestamp();

  delete from public.rate_limit_events as event
  where event.school_id is not distinct from p_school_id
    and event.action = p_action
    and event.subject_hash = p_subject_hash
    and event.expires_at <= v_now;

  select count(*)
    into v_count
  from public.rate_limit_events as event
  where event.school_id is not distinct from p_school_id
    and event.action = p_action
    and event.subject_hash = p_subject_hash
    and event.occurred_at > v_now - pg_catalog.make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_events (
    school_id,
    action,
    subject_hash,
    occurred_at,
    expires_at
  )
  values (
    p_school_id,
    p_action,
    p_subject_hash,
    v_now,
    v_now + pg_catalog.make_interval(secs => p_window_seconds)
  );

  return true;
end;
$$;

-- Keep the implementation private. The Edge Function reaches it through a
-- narrowly granted public-schema RPC because private is intentionally not an
-- exposed Data API schema and service_role has no USAGE on private.
revoke all on function private.consume_rate_limit(uuid, text, text, integer, integer)
from public, anon, authenticated, service_role;

create or replace function public.consume_rate_limit(
  p_school_id uuid,
  p_action text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $
  select private.consume_rate_limit(
    p_school_id,
    p_action,
    p_subject_hash,
    p_limit,
    p_window_seconds
  );
$;

revoke all on function public.consume_rate_limit(uuid, text, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function public.consume_rate_limit(uuid, text, text, integer, integer)
to service_role;

comment on function private.consume_rate_limit(uuid, text, text, integer, integer) is
  'Private atomic per-school/action/subject rate-limit implementation. Subject input must be a lowercase SHA-256 digest; returns true when the attempt is accepted and false when the threshold is reached.';

comment on function public.consume_rate_limit(uuid, text, text, integer, integer) is
  'Service-role-only PostgREST entry point for the private atomic rate limiter; invoke only from trusted Edge Functions.';
