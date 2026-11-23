-- B4.8 privacy workflow catalog acceptance.
-- Read-only: run only after migration 20261123114538 is applied.

do $$
declare
  v_function oid;
  v_config text[];
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'exports' and public = false
      and file_size_limit >= 20971520
  ) then
    raise exception 'B4.8: private exports bucket or 20 MiB capacity missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'bus_position_history_recorded_retention_idx'
  ) then
    raise exception 'B4.8: GPS retention index missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'notification_deliveries_terminal_retention_idx'
  ) then
    raise exception 'B4.8: terminal delivery retention index missing';
  end if;

  select p.oid, p.proconfig into v_function, v_config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'execute_approved_deletion_request'
    and pg_get_function_identity_arguments(p.oid) = 'p_school_id uuid, p_request_id uuid';

  if v_function is null then
    raise exception 'B4.8: controlled deletion RPC missing';
  end if;

  if not (select prosecdef from pg_proc where oid = v_function) then
    raise exception 'B4.8: deletion RPC must be SECURITY DEFINER';
  end if;

  if not coalesce(v_config @> array['search_path=""'], false) then
    raise exception 'B4.8: deletion RPC must have an empty search_path';
  end if;

  if not has_function_privilege('service_role', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'B4.8: deletion RPC execution grants are not restricted to service_role';
  end if;
end;
$$;

select
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select count(*) from public.deletion_requests where status = 'processing') as processing_requests,
  (select count(*) from public.bus_position_history) as gps_history_rows,
  (select count(*) from public.notification_deliveries) as notification_delivery_rows;
