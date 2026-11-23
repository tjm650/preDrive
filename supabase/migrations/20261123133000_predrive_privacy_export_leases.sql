-- B4.8 export-worker concurrency leases.
-- A lease prevents overlapping workers from completing or cleaning up the
-- same export artifact. No existing request is automatically claimed.

alter table public.deletion_requests
  add column if not exists processing_lease_id uuid,
  add column if not exists processing_lease_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.deletion_requests'::regclass
      and conname = 'deletion_requests_processing_lease_pair_check'
  ) then
    alter table public.deletion_requests
      add constraint deletion_requests_processing_lease_pair_check
      check (
        (processing_lease_id is null and processing_lease_expires_at is null)
        or
        (processing_lease_id is not null and processing_lease_expires_at is not null)
      );
  end if;
end;
$$;

create index if not exists deletion_requests_export_lease_idx
  on public.deletion_requests (processing_lease_expires_at, requested_at)
  where request_type = 'data_export'
    and status = 'processing'
    and retention_hold = false;

create or replace function public.claim_data_export_requests(
  p_batch_size integer default 10,
  p_lease_seconds integer default 900
)
returns table (
  id uuid,
  school_id uuid,
  requested_by uuid,
  subject_user_id uuid,
  processing_lease_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 10
     or p_lease_seconds is null or p_lease_seconds < 60
     or p_lease_seconds > 1800 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  return query
  with candidates as (
    select dr.id
    from public.deletion_requests dr
    where dr.request_type = 'data_export'
      and dr.status = 'processing'
      and dr.retention_hold = false
      and (
        dr.processing_lease_expires_at is null
        or dr.processing_lease_expires_at <= now()
      )
    order by dr.requested_at asc
    for update skip locked
    limit p_batch_size
  ),
  claimed as (
    update public.deletion_requests dr
    set processing_lease_id = gen_random_uuid(),
        processing_lease_expires_at =
          now() + make_interval(secs => p_lease_seconds),
        updated_at = now()
    from candidates c
    where dr.id = c.id
    returning
      dr.id,
      dr.school_id,
      dr.requested_by,
      dr.subject_user_id,
      dr.processing_lease_id
  )
  select
    claimed.id,
    claimed.school_id,
    claimed.requested_by,
    claimed.subject_user_id,
    claimed.processing_lease_id
  from claimed;
end;
$function$;

create or replace function public.complete_data_export_request(
  p_school_id uuid,
  p_request_id uuid,
  p_lease_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.deletion_requests
  set status = 'completed',
      completed_at = now(),
      decision_note =
        'Personal data export prepared. Download is available for seven days.',
      processing_lease_id = null,
      processing_lease_expires_at = null,
      updated_at = now()
  where id = p_request_id
    and school_id = p_school_id
    and request_type = 'data_export'
    and status = 'processing'
    and retention_hold = false
    and processing_lease_id = p_lease_id
    and processing_lease_expires_at > now();

  if not found then
    raise exception using errcode = '40001', message = 'DATA_EXPORT_LEASE_LOST';
  end if;
end;
$function$;

create or replace function public.release_data_export_request(
  p_school_id uuid,
  p_request_id uuid,
  p_lease_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.deletion_requests
  set processing_lease_id = null,
      processing_lease_expires_at = null,
      updated_at = now()
  where id = p_request_id
    and school_id = p_school_id
    and request_type = 'data_export'
    and status = 'processing'
    and processing_lease_id = p_lease_id;

  return found;
end;
$function$;

revoke all on function public.claim_data_export_requests(integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_data_export_request(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.release_data_export_request(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_data_export_requests(integer, integer)
  to service_role;
grant execute on function public.complete_data_export_request(uuid, uuid, uuid)
  to service_role;
grant execute on function public.release_data_export_request(uuid, uuid, uuid)
  to service_role;
