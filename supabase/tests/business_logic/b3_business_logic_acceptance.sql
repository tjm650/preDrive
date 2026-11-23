-- preDrive B3 business-logic catalog acceptance.
-- Read-only assertions. Run after B3 migrations have been applied to a disposable
-- or explicitly approved development database. This does not seed users or mutate rows.

begin;

do $test$
declare
  v_signature text;
  v_missing text[] := array[]::text[];
  v_record record;
begin
  for v_signature in
    select unnest(array[
      'public.register_school(text,text,numeric)',
      'public.accept_school_invitation()',
      'public.create_child(uuid,text,text,date,uuid)',
      'public.link_guardian_to_child(uuid,uuid,uuid,public.collector_relationship,boolean)',
      'public.create_approved_collector(uuid,uuid,text,public.collector_relationship,text,text)',
      'public.create_temporary_collector(uuid,uuid,text,text,public.collector_relationship,text,timestamptz)',
      'public.list_temporary_collectors(uuid,uuid)',
      'public.revoke_temporary_collector(uuid,uuid)',
      'public.verify_temporary_handover(uuid,uuid,uuid,uuid,text)',
      'public.list_approved_collectors(uuid,uuid)',
      'public.record_child_status(uuid,uuid,uuid,timestamptz,uuid,public.trip_child_status)',
      'public.verify_handover(uuid,uuid,uuid,uuid,text)',
      'public.start_trip(uuid,uuid,timestamptz)',
      'public.end_trip(uuid,uuid,timestamptz)',
      'public.record_bus_position(uuid,uuid,double precision,double precision,numeric,numeric,numeric,timestamptz,uuid)',
      'public.create_incident(uuid,text,text,public.incident_severity,uuid,uuid)',
      'public.raise_sos(uuid,uuid)',
      'public.report_trip_delay(uuid,uuid,public.delay_reason,text,smallint)',
      'public.acknowledge_alert(uuid,uuid)',
      'public.complete_vehicle_check(uuid,uuid,uuid,jsonb,boolean,timestamptz)',
      'public.resolve_incident(uuid,uuid,text)',
      'public.resolve_sos(uuid,uuid,text)',
      'public.set_guardian_notification_radius(uuid,uuid,integer)',
      'public.get_child_trip_eta(uuid,uuid,uuid)',
      'public.evaluate_trip_geofences(uuid,uuid)',
      'public.initiate_payment(uuid,uuid,bigint,public.currency_code,public.payment_method,text)',
      'public.apply_payment_result(uuid,boolean,text)',
      'public.request_refund(uuid,uuid,bigint,text)',
      'public.apply_refund_result(uuid,boolean,text)',
      'public.record_consent(uuid,uuid,uuid,text,text,text,jsonb)',
      'public.withdraw_consent(uuid,uuid)',
      'public.request_account_deletion(uuid,text)',
      'public.reorder_route_stops(uuid,uuid,uuid[])',
      'public.request_data_export(uuid,text)',
      'public.request_child_record_deletion(uuid,uuid,text)',
      'public.review_deletion_request(uuid,uuid,text,text,text)',
      'public.bulk_create_children(uuid,jsonb)',
      'public.assign_child_route_stop(uuid,uuid,uuid,uuid)',
      'public.cancel_scheduled_trip(uuid,uuid,text)'
    ])
  loop
    if to_regprocedure(v_signature) is null then
      v_missing := array_append(v_missing, v_signature);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    raise exception 'B3 functions missing: %', array_to_string(v_missing, ', ');
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guardian_children'
      and column_name = 'notification_radius_meters'
      and data_type = 'integer'
      and is_nullable = 'NO'
    ) then
    raise exception 'Guardian notification radius column missing or incorrectly nullable';
  end if;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'child_route_assignments'
      and c.relrowsecurity
  ) then
    raise exception 'child_route_assignments must have RLS enabled';
  end if;

  for v_record in
    select p.oid::regprocedure as signature, p.proconfig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'register_school', 'accept_school_invitation', 'create_child',
        'link_guardian_to_child', 'create_approved_collector',
        'create_temporary_collector', 'list_temporary_collectors',
        'revoke_temporary_collector', 'verify_temporary_handover', 'list_approved_collectors', 'record_child_status', 'verify_handover',
        'start_trip', 'end_trip', 'record_bus_position', 'create_incident',
        'raise_sos', 'report_trip_delay', 'acknowledge_alert',
        'complete_vehicle_check', 'resolve_incident', 'resolve_sos',
        'set_guardian_notification_radius',
        'get_child_trip_eta', 'evaluate_trip_geofences', 'initiate_payment', 'apply_payment_result',
        'request_refund', 'apply_refund_result', 'request_data_export',
        'request_child_record_deletion', 'review_deletion_request',
        'record_consent', 'withdraw_consent', 'request_account_deletion',
        'reorder_route_stops', 'bulk_create_children', 'assign_child_route_stop', 'cancel_scheduled_trip'
      )
      and p.prosecdef
  loop
    if coalesce(v_record.proconfig, array[]::text[]) @> array['search_path=""']::text[] is false then
      raise exception 'SECURITY DEFINER function has unsafe search_path: %', v_record.signature;
    end if;
  end loop;

  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'temporary_collectors'
      and c.relrowsecurity
  ) then
    raise exception 'temporary_collectors must have RLS enabled';
  end if;

  if has_table_privilege('authenticated', 'public.temporary_collectors', 'SELECT')
     or has_table_privilege('authenticated', 'public.temporary_collectors', 'INSERT') then
    raise exception 'temporary collectors must be accessed only through safe RPCs';
  end if;

  if has_function_privilege('anon', 'public.evaluate_trip_geofences(uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.evaluate_trip_geofences(uuid,uuid)', 'EXECUTE') then
    raise exception 'Geofence evaluator must be service_role-only';
  end if;

  if not has_function_privilege('service_role', 'public.evaluate_trip_geofences(uuid,uuid)', 'EXECUTE') then
    raise exception 'service_role cannot execute geofence evaluator';
  end if;

  if has_function_privilege('anon', 'public.apply_payment_result(uuid,boolean,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_payment_result(uuid,boolean,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.apply_payment_result(uuid,boolean,text)', 'EXECUTE') then
    raise exception 'Payment settlement must be service_role-only';
  end if;

  if has_function_privilege('anon', 'public.apply_refund_result(uuid,boolean,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.apply_refund_result(uuid,boolean,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.apply_refund_result(uuid,boolean,text)', 'EXECUTE') then
    raise exception 'Refund settlement must be service_role-only';
  end if;

  if has_function_privilege('anon', 'public.verify_handover(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.verify_handover(uuid,uuid,uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Handover verification grants are incorrect';
  end if;

  if has_table_privilege('authenticated', 'public.child_route_assignments', 'INSERT')
     or has_table_privilege('authenticated', 'public.child_route_assignments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.child_route_assignments', 'DELETE') then
    raise exception 'Child route assignments must be mutated through the checked RPC';
  end if;

  raise notice 'B3 catalog acceptance passed';
end;
$test$;

rollback;
