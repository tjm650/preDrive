-- B4.8 transactional runtime acceptance.
-- This script creates synthetic fixtures and rolls the entire transaction back.
-- Run only after B4.8 deletion and export-lease migrations are applied.

begin;

do $test$
declare
  v_user uuid := 'f8100000-0000-4000-8000-000000000001';
  v_school uuid := 'f8100000-0000-4000-8000-000000000010';
  v_other_school uuid := 'f8100000-0000-4000-8000-000000000011';
  v_class uuid := 'f8100000-0000-4000-8000-000000000020';
  v_child_withdraw uuid := 'f8100000-0000-4000-8000-000000000030';
  v_child_hold uuid := 'f8100000-0000-4000-8000-000000000031';
  v_request_withdraw uuid := 'f8100000-0000-4000-8000-000000000040';
  v_request_hold uuid := 'f8100000-0000-4000-8000-000000000041';
  v_request_account uuid := 'f8100000-0000-4000-8000-000000000042';
  v_request_tenant uuid := 'f8100000-0000-4000-8000-000000000043';
  v_request_export uuid := 'f8100000-0000-4000-8000-000000000044';
  v_lease_id uuid;
  v_second_claim_count integer;
  v_released boolean;
  v_result text;
begin
  insert into auth.users (
    id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
    email_confirmed_at, created_at, updated_at
  ) values (
    v_user, 'authenticated', 'authenticated',
    'b4-privacy-runtime@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"B4 Privacy Test User"}'::jsonb,
    now(), now(), now()
  );

  insert into public.schools (
    id, name, status, address, timezone, indicative_zig_per_usd
  ) values
    (v_school, 'B4 Privacy Test School', 'active',
     'Synthetic test address, Harare', 'Africa/Harare', 27.0),
    (v_other_school, 'B4 Privacy Other School', 'active',
     'Synthetic other address, Harare', 'Africa/Harare', 27.0);

  insert into public.class_groups (id, school_id, name, age_range_label)
  values (v_class, v_school, 'Privacy Test Class', '3-4 years');

  insert into public.children (
    id, school_id, class_group_id, first_name, last_name, date_of_birth
  ) values
    (v_child_withdraw, v_school, v_class, 'Test', 'Withdrawn',
     date '2022-01-01'),
    (v_child_hold, v_school, v_class, 'Test', 'Protected',
     date '2022-02-01');

  insert into public.incidents (
    school_id, title, description, severity, child_id, reported_by, occurred_at
  ) values (
    v_school, 'Synthetic unresolved incident',
    'Synthetic test incident to verify privacy retention hold.',
    'medium', v_child_hold, v_user, now()
  );

  insert into public.deletion_requests (
    id, school_id, requested_by, child_id, request_type, status,
    reviewed_by, reviewed_at
  ) values
    (v_request_withdraw, v_school, v_user, v_child_withdraw,
     'child_record', 'processing', v_user, now()),
    (v_request_hold, v_school, v_user, v_child_hold,
     'child_record', 'processing', v_user, now()),
    (v_request_tenant, v_school, v_user, v_child_withdraw,
     'child_record', 'processing', v_user, now());

  insert into public.deletion_requests (
    id, school_id, requested_by, subject_user_id, request_type, status,
    reviewed_by, reviewed_at
  ) values
    (v_request_account, v_school, v_user, v_user,
     'account', 'processing', v_user, now()),
    (v_request_export, v_school, v_user, v_user,
     'data_export', 'processing', v_user, now());

  -- Normal child withdrawal completes and preserves the child row.
  v_result := public.execute_approved_deletion_request(v_school, v_request_withdraw);
  if v_result <> 'completed' then
    raise exception 'Expected child withdrawal to complete; got %', v_result;
  end if;

  if not exists (
    select 1 from public.children
    where id = v_child_withdraw and status = 'withdrawn'
  ) then
    raise exception 'Child status was not changed to withdrawn';
  end if;

  if not exists (
    select 1 from public.deletion_requests
    where id = v_request_withdraw and status = 'completed'
      and completed_at is not null and retention_hold = false
  ) then
    raise exception 'Child deletion request was not completed';
  end if;

  if not exists (
    select 1 from public.audit_log
    where school_id = v_school
      and action = 'privacy.child_withdrawn'
      and target_id = v_child_withdraw::text
      and request_id = v_request_withdraw::text
  ) then
    raise exception 'Child withdrawal audit entry was not written';
  end if;

  -- An unresolved incident creates a hold and leaves child status untouched.
  v_result := public.execute_approved_deletion_request(v_school, v_request_hold);
  if v_result <> 'held' then
    raise exception 'Expected incident hold; got %', v_result;
  end if;

  if not exists (
    select 1 from public.children
    where id = v_child_hold and status = 'active'
  ) then
    raise exception 'Child changed despite unresolved incident hold';
  end if;

  if not exists (
    select 1 from public.deletion_requests
    where id = v_request_hold and status = 'processing'
      and retention_hold = true
      and retention_hold_reason is not null
  ) then
    raise exception 'Incident hold was not recorded';
  end if;

  -- Account-wide deletion is held for coordinated cross-school/Auth review.
  v_result := public.execute_approved_deletion_request(v_school, v_request_account);
  if v_result <> 'held' then
    raise exception 'Expected account-wide hold; got %', v_result;
  end if;

  if not exists (
    select 1 from public.deletion_requests
    where id = v_request_account and status = 'processing'
      and retention_hold = true
      and retention_hold_reason is not null
  ) then
    raise exception 'Account-wide hold was not recorded';
  end if;

  -- A mismatched school identifier must not operate on another tenant's request.
  begin
    perform public.execute_approved_deletion_request(v_other_school, v_request_tenant);
    raise exception 'Cross-school request unexpectedly succeeded';
  exception
    when sqlstate '40001' then
      null;
  end;

  if not exists (
    select 1 from public.children
    where id = v_child_withdraw and status = 'withdrawn'
  ) then
    raise exception 'Tenant mismatch changed the child record';
  end if;

  if not exists (
    select 1 from public.deletion_requests
    where id = v_request_tenant and status = 'processing'
      and retention_hold = false
  ) then
    raise exception 'Tenant mismatch changed the request';
  end if;

  -- The export worker must claim each request atomically and only once.
  select claimed.processing_lease_id
  into v_lease_id
  from public.claim_data_export_requests(10, 900) claimed
  where claimed.id = v_request_export;

  if v_lease_id is null then
    raise exception 'Export request was not claimed';
  end if;

  select count(*)::integer
  into v_second_claim_count
  from public.claim_data_export_requests(10, 900) claimed
  where claimed.id = v_request_export;

  if v_second_claim_count <> 0 then
    raise exception 'An active export lease was claimed more than once';
  end if;

  v_released := public.release_data_export_request(
    v_school, v_request_export, v_lease_id
  );

  if not v_released then
    raise exception 'Current export lease could not be released';
  end if;

  select claimed.processing_lease_id
  into v_lease_id
  from public.claim_data_export_requests(10, 900) claimed
  where claimed.id = v_request_export;

  if v_lease_id is null then
    raise exception 'Released export request could not be reclaimed';
  end if;

  perform public.complete_data_export_request(
    v_school,
    v_request_export,
    v_lease_id,
    v_school::text || '/privacy/' || v_request_export::text || '/' ||
      v_lease_id::text || '.json'
  );

  if not exists (
    select 1 from public.deletion_requests
    where id = v_request_export and status = 'completed'
      and completed_at is not null
      and processing_lease_id is null
      and processing_lease_expires_at is null
      and export_object_path =
        v_school::text || '/privacy/' || v_request_export::text || '/' ||
        v_lease_id::text || '.json'
  ) then
    raise exception 'Leased export completion did not clear the lease';
  end if;
end;
$test$;

rollback;
