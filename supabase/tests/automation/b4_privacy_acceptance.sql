-- B4.8 privacy workflow catalog acceptance.
-- Read-only: run only after privacy migrations 20261123114538 and
-- the export-lease migration are applied.

do $$
declare
  v_function oid;
  v_config text[];
begin

  if not (
    '11111111-1111-4111-8111-111111111111/privacy/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.json'
    ~ '^[0-9a-f-]{36}/privacy/[0-9a-f-]{36}/[0-9a-f-]{36}\.json
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

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'deletion_requests_export_lease_idx'
  ) then
    raise exception 'B4.8: export lease index missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_expires_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'export_object_path'
  ) then
    raise exception 'B4.8: export lease columns missing';
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

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_data_export_requests'
      and pg_get_function_identity_arguments(p.oid) =
        'p_batch_size integer, p_lease_seconds integer'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export claim RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid, p_object_path text'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export completion RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'release_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export release RPC missing or incorrectly secured';
  end if;
end;
$$;

select
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select count(*) from public.deletion_requests where status = 'processing') as processing_requests,
  (select count(*) from public.bus_position_history) as gps_history_rows,
  (select count(*) from public.notification_deliveries) as notification_delivery_rows;

  ) then
    raise exception 'B4.8: canonical lease export path rejected';
  end if;

  if (
    '11111111-1111-4111-8111-111111111111/privacy/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333Xjson'
    ~ '^[0-9a-f-]{36}/privacy/[0-9a-f-]{36}/[0-9a-f-]{36}\.json
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

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'deletion_requests_export_lease_idx'
  ) then
    raise exception 'B4.8: export lease index missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_expires_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'export_object_path'
  ) then
    raise exception 'B4.8: export lease columns missing';
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

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_data_export_requests'
      and pg_get_function_identity_arguments(p.oid) =
        'p_batch_size integer, p_lease_seconds integer'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export claim RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid, p_object_path text'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export completion RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'release_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export release RPC missing or incorrectly secured';
  end if;
end;
$$;

select
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select count(*) from public.deletion_requests where status = 'processing') as processing_requests,
  (select count(*) from public.bus_position_history) as gps_history_rows,
  (select count(*) from public.notification_deliveries) as notification_delivery_rows;

  ) then
    raise exception 'B4.8: malformed lease export path accepted';
  end if;

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

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'deletion_requests_export_lease_idx'
  ) then
    raise exception 'B4.8: export lease index missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'processing_lease_expires_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'deletion_requests'
      and column_name = 'export_object_path'
  ) then
    raise exception 'B4.8: export lease columns missing';
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

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_data_export_requests'
      and pg_get_function_identity_arguments(p.oid) =
        'p_batch_size integer, p_lease_seconds integer'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export claim RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'complete_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid, p_object_path text'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export completion RPC missing or incorrectly secured';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'release_data_export_request'
      and pg_get_function_identity_arguments(p.oid) =
        'p_school_id uuid, p_request_id uuid, p_lease_id uuid'
      and p.prosecdef
      and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'B4.8: export release RPC missing or incorrectly secured';
  end if;
end;
$$;

select
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select count(*) from public.deletion_requests where status = 'processing') as processing_requests,
  (select count(*) from public.bus_position_history) as gps_history_rows,
  (select count(*) from public.notification_deliveries) as notification_delivery_rows;
