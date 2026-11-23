-- B3.8: privacy request lifecycle, child bulk creation and trip administration.

-- Route-stop reordering is a single transaction. Deferring uniqueness allows
-- safe swaps without exposing an intermediate duplicate order.
alter table public.route_stops
  drop constraint if exists route_stops_route_order_key;
alter table public.route_stops
  add constraint route_stops_route_order_key
  unique (route_id, stop_order)
  deferrable initially deferred;

create or replace function public.record_consent(
  p_school_id uuid,
  p_subject_user_id uuid,
  p_child_id uuid,
  p_purpose text,
  p_policy_version text,
  p_status text,
  p_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if ((p_subject_user_id is not null)::integer + (p_child_id is not null)::integer) <> 1
     or p_policy_version is null
     or char_length(btrim(p_policy_version)) not between 1 and 40
     or p_status not in ('granted', 'denied')
     or jsonb_typeof(coalesce(p_evidence, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_evidence, '{}'::jsonb)) > 4096 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  if p_subject_user_id is not null and p_subject_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'SELF_CONSENT_ONLY';
  end if;
  if p_child_id is not null and not exists (
    select 1 from public.guardian_children gc
    where gc.school_id = p_school_id and gc.child_id = p_child_id
      and gc.guardian_user_id = auth.uid() and gc.active
  ) then
    raise exception using errcode = '42501', message = 'GUARDIAN_CHILD_LINK_REQUIRED';
  end if;

  insert into public.consent_records (
    school_id, subject_user_id, child_id, purpose, policy_version,
    status, captured_by, evidence
  ) values (
    p_school_id, p_subject_user_id, p_child_id, p_purpose, btrim(p_policy_version),
    p_status, auth.uid(), coalesce(p_evidence, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.withdraw_consent(
  p_school_id uuid,
  p_consent_record_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous public.consent_records%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  select cr.* into v_previous
  from public.consent_records cr
  where cr.id = p_consent_record_id and cr.school_id = p_school_id
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'CONSENT_RECORD_NOT_FOUND';
  end if;

  if not (
    v_previous.subject_user_id = auth.uid()
    or (
      v_previous.child_id is not null
      and exists (
        select 1 from public.guardian_children gc
        where gc.school_id = p_school_id and gc.child_id = v_previous.child_id
          and gc.guardian_user_id = auth.uid() and gc.active
      )
    )
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.consent_records (
    school_id, subject_user_id, child_id, purpose, policy_version,
    status, captured_by, evidence
  ) values (
    p_school_id, v_previous.subject_user_id, v_previous.child_id,
    v_previous.purpose, v_previous.policy_version, 'withdrawn',
    auth.uid(), jsonb_build_object('withdraws_record_id', v_previous.id)
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.request_account_deletion(
  p_school_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null or not private.is_school_member(p_school_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.deletion_requests (
    school_id, requested_by, subject_user_id, request_type, reason
  ) values (
    p_school_id, auth.uid(), auth.uid(), 'account', p_reason
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.reorder_route_stops(
  p_school_id uuid,
  p_route_id uuid,
  p_stop_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total integer;
  v_distinct integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_stop_ids is null or cardinality(p_stop_ids) < 1 or cardinality(p_stop_ids) > 200 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select count(*) into v_total
  from public.route_stops rs
  where rs.school_id = p_school_id and rs.route_id = p_route_id and rs.active;

  select count(distinct x.stop_id) into v_distinct
  from unnest(p_stop_ids) as x(stop_id);

  if v_total <> cardinality(p_stop_ids) or v_distinct <> cardinality(p_stop_ids)
     or exists (
       select 1
       from unnest(p_stop_ids) as x(stop_id)
       where not exists (
         select 1 from public.route_stops rs
         where rs.id = x.stop_id and rs.school_id = p_school_id
           and rs.route_id = p_route_id and rs.active
       )
     ) then
    raise exception using errcode = '22023', message = 'ROUTE_STOP_SET_MISMATCH';
  end if;

  set constraints route_stops_route_order_key deferred;

  update public.route_stops rs
  set stop_order = x.ordinality::smallint,
      updated_at = now()
  from unnest(p_stop_ids) with ordinality as x(stop_id, ordinality)
  where rs.id = x.stop_id and rs.school_id = p_school_id
    and rs.route_id = p_route_id;
end;
$function$;


create or replace function public.request_data_export(p_school_id uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_school_member(p_school_id) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.deletion_requests (
    school_id, requested_by, subject_user_id, request_type, reason
  ) values (
    p_school_id, auth.uid(), auth.uid(), 'data_export', p_reason
  ) returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.request_child_record_deletion(
  p_school_id uuid,
  p_child_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.is_guardian_of(p_child_id)
     or not exists (
       select 1 from public.guardian_children gc
       where gc.school_id = p_school_id and gc.child_id = p_child_id
         and gc.guardian_user_id = auth.uid() and gc.active
     ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.deletion_requests (
    school_id, requested_by, child_id, request_type, reason
  ) values (
    p_school_id, auth.uid(), p_child_id, 'child_record', p_reason
  ) returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.review_deletion_request(
  p_school_id uuid,
  p_request_id uuid,
  p_decision text,
  p_decision_note text default null,
  p_retention_hold_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_decision not in ('under_review', 'approved', 'rejected', 'processing', 'completed')
     or (p_retention_hold_reason is not null and char_length(btrim(p_retention_hold_reason)) not between 2 and 1000) then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  update public.deletion_requests
  set status = p_decision,
      decision_note = nullif(btrim(p_decision_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      completed_at = case when p_decision = 'completed' then now() else null end,
      retention_hold = p_retention_hold_reason is not null,
      retention_hold_reason = nullif(btrim(p_retention_hold_reason), ''),
      updated_at = now()
  where id = p_request_id and school_id = p_school_id
    and status not in ('completed', 'cancelled', 'rejected');

  if not found then
    raise exception using errcode = '40001', message = 'DELETION_REQUEST_NOT_REVIEWABLE';
  end if;
end;
$function$;

create or replace function public.bulk_create_children(
  p_school_id uuid,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row jsonb;
  v_count integer := 0;
  v_first_name text;
  v_last_name text;
  v_dob date;
  v_class_group_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) < 1
     or jsonb_array_length(p_rows) > 100 then
    raise exception using errcode = '22023', message = 'BULK_ROW_COUNT_INVALID';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_first_name := btrim(v_row ->> 'firstName');
    v_last_name := btrim(v_row ->> 'lastName');
    v_dob := (v_row ->> 'dateOfBirth')::date;
    v_class_group_id := (v_row ->> 'classGroupId')::uuid;

    if v_first_name is null or char_length(v_first_name) not between 1 and 100
       or v_last_name is null or char_length(v_last_name) not between 1 and 100
       or v_dob is null or v_dob > current_date
       or not exists (
         select 1 from public.class_groups g
         where g.id = v_class_group_id and g.school_id = p_school_id and g.active
       ) then
      raise exception using errcode = '22023', message = 'BULK_ROW_VALIDATION_FAILED';
    end if;

    insert into public.children (
      school_id, class_group_id, first_name, last_name, date_of_birth
    ) values (
      p_school_id, v_class_group_id, v_first_name, v_last_name, v_dob
    );
    v_count := v_count + 1;
  end loop;

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, metadata
  ) values (
    p_school_id, auth.uid(), 'children.bulk_created', 'children',
    jsonb_build_object('count', v_count)
  );

  return v_count;
end;
$function$;

create or replace function public.assign_child_route_stop(
  p_school_id uuid,
  p_child_id uuid,
  p_route_id uuid,
  p_route_stop_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assignment_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.route_stops rs
    where rs.id = p_route_stop_id and rs.route_id = p_route_id
      and rs.school_id = p_school_id and rs.active
  ) then
    raise exception using errcode = '23503', message = 'ROUTE_STOP_MISMATCH';
  end if;

  update public.child_route_assignments
  set active = false, updated_at = now()
  where school_id = p_school_id and child_id = p_child_id and active;

  insert into public.child_route_assignments (
    school_id, child_id, route_id, route_stop_id, active, assigned_by
  ) values (
    p_school_id, p_child_id, p_route_id, p_route_stop_id, true, auth.uid()
  ) returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

create or replace function public.cancel_scheduled_trip(
  p_school_id uuid,
  p_trip_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 2 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not (
    private.has_role(p_school_id, 'school_admin'::public.user_role)
    or exists (
      select 1 from public.trips t
      join public.staff_members s
        on s.id = t.supervisor_id and s.school_id = t.school_id
      where t.id = p_trip_id and t.school_id = p_school_id
        and s.user_id = v_actor and s.active and s.role = 'supervisor'
    )
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.trips
  set status = 'cancelled'::public.trip_status,
      cancelled_at = now(),
      cancellation_reason = btrim(p_reason),
      updated_at = now()
  where id = p_trip_id and school_id = p_school_id
    and status = 'scheduled'::public.trip_status;

  if not found then
    raise exception using errcode = '40001', message = 'TRIP_NOT_CANCELLABLE';
  end if;

  insert into public.trip_events (
    school_id, trip_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, 'trip_cancelled', v_actor,
    jsonb_build_object('reason', btrim(p_reason))
  );
end;
$function$;

revoke all on function public.record_consent(uuid,uuid,uuid,text,text,text,jsonb) from public, anon;
revoke all on function public.withdraw_consent(uuid,uuid) from public, anon;
revoke all on function public.request_account_deletion(uuid,text) from public, anon;
revoke all on function public.reorder_route_stops(uuid,uuid,uuid[]) from public, anon;
grant execute on function public.record_consent(uuid,uuid,uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.withdraw_consent(uuid,uuid) to authenticated;
grant execute on function public.request_account_deletion(uuid,text) to authenticated;
grant execute on function public.reorder_route_stops(uuid,uuid,uuid[]) to authenticated;

revoke all on function public.request_data_export(uuid, text) from public, anon;
revoke all on function public.request_child_record_deletion(uuid, uuid, text) from public, anon;
revoke all on function public.review_deletion_request(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.bulk_create_children(uuid, jsonb) from public, anon;
revoke all on function public.assign_child_route_stop(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.cancel_scheduled_trip(uuid, uuid, text) from public, anon;
grant execute on function public.request_data_export(uuid, text) to authenticated;
grant execute on function public.request_child_record_deletion(uuid, uuid, text) to authenticated;
grant execute on function public.review_deletion_request(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.bulk_create_children(uuid, jsonb) to authenticated;
grant execute on function public.assign_child_route_stop(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.cancel_scheduled_trip(uuid, uuid, text) to authenticated;
