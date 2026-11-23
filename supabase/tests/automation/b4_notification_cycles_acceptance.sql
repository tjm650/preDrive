-- B4.7.2 read-only catalog acceptance. No rows are inserted or changed.
do $$
declare
  v_definer boolean;
  v_search_path text[];
  v_service_execute boolean;
  v_authenticated_execute boolean;
  v_fk_action text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notification_deliveries'
      and column_name='delivery_sequence' and is_nullable='NO'
  ) then raise exception 'delivery_sequence missing or nullable'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notification_deliveries'
      and column_name='device_token_id'
  ) then raise exception 'device_token_id missing'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='notification_deliveries_email_sequence_key'
  ) then raise exception 'email sequence unique index missing'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='notification_deliveries_push_device_sequence_key'
  ) then raise exception 'push device sequence unique index missing'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='notification_deliveries_receipt_due_idx'
  ) then raise exception 'receipt due index missing'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='notification_deliveries_alert_sequence_idx'
  ) then raise exception 'alert sequence index missing'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.notification_deliveries'::regclass
      and conname='notification_deliveries_device_school_fkey'
      and pg_get_constraintdef(oid) like '%ON DELETE SET NULL (device_token_id)%'
  ) then raise exception 'device-token FK must null only device_token_id'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.alerts'::regclass
      and conname='alerts_escalation_count_check'
  ) then raise exception 'alert escalation count constraint missing'; end if;

  if not (select relrowsecurity from pg_class where oid='public.notification_deliveries'::regclass)
  then raise exception 'notification outbox RLS disabled'; end if;

  select p.prosecdef, coalesce(p.proconfig, '{}'::text[])
    into v_definer, v_search_path
  from pg_proc p
  where p.oid='private.enqueue_notification_deliveries()'::regprocedure;
  if not v_definer or not ('search_path=' = any(v_search_path)) then
    raise exception 'notification enqueue trigger function must be SECURITY DEFINER with empty search_path';
  end if;

  select p.prosecdef, coalesce(p.proconfig, '{}'::text[])
    into v_definer, v_search_path
  from pg_proc p
  where p.oid='public.enqueue_due_alert_escalations(integer)'::regprocedure;
  if not v_definer or not ('search_path=' = any(v_search_path)) then
    raise exception 'escalation function must be SECURITY DEFINER with empty search_path';
  end if;

  select has_function_privilege('service_role',
    'public.enqueue_due_alert_escalations(integer)', 'EXECUTE')
    into v_service_execute;
  select has_function_privilege('authenticated',
    'public.enqueue_due_alert_escalations(integer)', 'EXECUTE')
    into v_authenticated_execute;
  if not v_service_execute or v_authenticated_execute then
    raise exception 'escalation RPC grants are incorrect';
  end if;

  if has_table_privilege('authenticated','public.notification_deliveries','SELECT')
     or has_table_privilege('anon','public.notification_deliveries','SELECT') then
    raise exception 'client roles must not read notification outbox';
  end if;

  if (select count(*) from public.notification_deliveries) <> 0 then
    raise exception 'acceptance expects an empty notification outbox';
  end if;
  if (select count(*) from public.alerts where escalation_count > 0) <> 0 then
    raise exception 'acceptance expects no escalations to have run';
  end if;
end;
$$;
