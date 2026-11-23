-- B4.8: controlled child-record withdrawal for approved privacy requests.
-- Financial, safety, consent, trip and audit history is retained.

create or replace function public.execute_approved_deletion_request(
  p_school_id uuid,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.deletion_requests%rowtype;
  v_child_id uuid;
  v_has_active_trip boolean;
  v_has_open_incident boolean;
begin
  select dr.* into v_request
  from public.deletion_requests dr
  where dr.id = p_request_id
    and dr.school_id = p_school_id
  for update;

  if not found
     or v_request.status <> 'processing'
     or v_request.retention_hold then
    raise exception using errcode = '40001', message = 'DELETION_REQUEST_NOT_COMPLETABLE';
  end if;

  -- Account-wide identity deactivation is deliberately held for a coordinated
  -- review across every school and the Auth lifecycle. This worker never bans
  -- or deletes Auth users and never disables access in another tenant.
  if v_request.request_type = 'account' then
    update public.deletion_requests
    set retention_hold = true,
        retention_hold_reason =
          'Account-wide deactivation requires coordinated review across all linked schools and the Auth lifecycle.',
        decision_note =
          'Held for coordinated account-closure review. No account or membership was deactivated.',
        updated_at = now()
    where id = p_request_id and school_id = p_school_id;

    return 'held';
  end if;

  if v_request.request_type <> 'child_record' or v_request.child_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select c.id into v_child_id
  from public.children c
  where c.id = v_request.child_id
    and c.school_id = p_school_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'CHILD_NOT_FOUND';
  end if;

  select exists (
    select 1
    from public.trip_children tc
    join public.trips t
      on t.id = tc.trip_id
     and t.school_id = tc.school_id
    where tc.child_id = v_request.child_id
      and tc.school_id = p_school_id
      and t.status::text = 'active'
  ) into v_has_active_trip;

  select exists (
    select 1
    from public.incidents i
    where i.child_id = v_request.child_id
      and i.school_id = p_school_id
      and i.status::text in ('open', 'investigating')
  ) into v_has_open_incident;

  if v_has_active_trip or v_has_open_incident then
    update public.deletion_requests
    set retention_hold = true,
        retention_hold_reason = case
          when v_has_active_trip and v_has_open_incident then
            'An active trip and unresolved safety incident must be closed before withdrawal.'
          when v_has_active_trip then
            'An active trip must be closed before withdrawal.'
          else
            'An unresolved safety incident must be closed before withdrawal.'
        end,
        decision_note = 'Held automatically; no child or linked records were changed.',
        updated_at = now()
    where id = p_request_id and school_id = p_school_id;

    return 'held';
  end if;

  update public.children
  set status = 'withdrawn'::public.child_status,
      updated_at = now()
  where id = v_request.child_id
    and school_id = p_school_id;

  update public.guardian_children
  set active = false,
      updated_at = now()
  where child_id = v_request.child_id
    and school_id = p_school_id
    and active;

  update public.approved_collectors
  set active = false,
      updated_at = now()
  where child_id = v_request.child_id
    and school_id = p_school_id
    and active;

  update public.temporary_collectors
  set active = false,
      updated_at = now()
  where child_id = v_request.child_id
    and school_id = p_school_id
    and active;

  update public.child_route_assignments
  set active = false,
      updated_at = now()
  where child_id = v_request.child_id
    and school_id = p_school_id
    and active;

  insert into public.audit_log (
    school_id,
    actor_user_id,
    action,
    target_table,
    target_id,
    request_id,
    outcome,
    metadata
  ) values (
    p_school_id,
    null,
    'privacy.child_withdrawn',
    'children',
    v_request.child_id::text,
    p_request_id::text,
    'success',
    jsonb_build_object('automation', 'approved_deletion_worker')
  );

  update public.deletion_requests
  set status = 'completed',
      completed_at = now(),
      decision_note =
        'Child access withdrawn. Financial, safety, consent, trip and audit history retained.',
      updated_at = now()
  where id = p_request_id
    and school_id = p_school_id
    and status = 'processing'
    and retention_hold = false;

  return 'completed';
end;
$function$;

revoke all on function public.execute_approved_deletion_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.execute_approved_deletion_request(uuid, uuid)
  to service_role;
