-- preDrive B2 security acceptance tests.
-- Run only after the B2.1-B2.6 migrations have been reviewed and applied to a
-- disposable or backed-up development database. This script runs in one
-- transaction and rolls back its temporary rate-limit events.
--
-- No test fixtures are inserted into application tables. The checks validate
-- policy/grant/catalog invariants plus the live rate-limiter's atomic threshold
-- behavior. Role-by-role row visibility tests require the separate seeded
-- multi-school identity suite in B5 and are an explicit additional gate.

begin;

do $$
declare
  v_tests integer := 0;
  v_ok boolean;
  v_result boolean;
  v_hash text := pg_catalog.repeat('a', 64);
  v_other_hash text := pg_catalog.repeat('b', 64);
  v_definition text;
begin
  -- B2.1 authorization helper inventory, SECURITY DEFINER configuration and grants.
  -- Keep the signatures explicit so an overload cannot silently satisfy a check.
  for v_definition in
    select unnest(array[
      'private.current_school_ids()',
      'private.is_school_member(uuid)',
      'private.has_role(uuid,public.user_role)',
      'private.is_guardian_of(uuid)',
      'private.is_assigned_to_trip(uuid)',
      'private.is_demo_school(uuid)'
    ])
  loop
    if to_regprocedure(v_definition) is null then
      raise exception 'B2 security helper missing: %', v_definition;
    end if;

    if not exists (
      select 1
      from pg_proc as p
      where p.oid = to_regprocedure(v_definition)
        and p.prosecdef = true
        and p.provolatile = 's'
        and p.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception 'B2 security helper configuration invalid: %', v_definition;
    end if;

    if not has_function_privilege('authenticated', v_definition, 'EXECUTE') then
      raise exception 'B2 security helper unavailable to authenticated: %', v_definition;
    end if;

    if has_function_privilege('anon', v_definition, 'EXECUTE')
       or has_function_privilege('service_role', v_definition, 'EXECUTE') then
      raise exception 'B2 security helper has an unexpected role grant: %', v_definition;
    end if;

    v_tests := v_tests + 1;
  end loop;

  -- Child and guardian policy inventory.
  select c.relrowsecurity into v_ok
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='children';
  if v_ok is distinct from true then raise exception 'B2 security test 01 failed: children RLS'; end if;
  v_tests := v_tests + 1;

  select c.relrowsecurity into v_ok
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='guardian_children';
  if v_ok is distinct from true then raise exception 'B2 security test 02 failed: guardian_children RLS'; end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='children' and policyname='children_select_linked_guardian_or_school_staff' and cmd='SELECT') then
    raise exception 'B2 security test 03 failed: child SELECT policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='children' and policyname='children_insert_school_admin' and cmd='INSERT') then
    raise exception 'B2 security test 04 failed: child INSERT policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='children' and policyname='children_update_school_admin' and cmd='UPDATE') then
    raise exception 'B2 security test 05 failed: child UPDATE policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='children' and policyname='children_delete_school_admin' and cmd='DELETE') then
    raise exception 'B2 security test 06 failed: child DELETE policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guardian_children' and policyname='guardian_children_select_self_or_school_staff' and cmd='SELECT') then
    raise exception 'B2 security test 07 failed: guardian link SELECT policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guardian_children' and policyname='guardian_children_insert_school_admin' and cmd='INSERT') then
    raise exception 'B2 security test 08 failed: guardian link INSERT policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guardian_children' and policyname='guardian_children_update_school_admin' and cmd='UPDATE') then
    raise exception 'B2 security test 09 failed: guardian link UPDATE policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='guardian_children' and policyname='guardian_children_delete_school_admin' and cmd='DELETE') then
    raise exception 'B2 security test 10 failed: guardian link DELETE policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='class_groups' and policyname='class_groups_select_linked_guardian' and cmd='SELECT') then
    raise exception 'B2 security test 11 failed: guardian class metadata policy';
  end if;
  v_tests := v_tests + 1;

  -- Transport policy inventory and GPS/handover denial.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trips' and policyname='trips_select_assigned_or_linked' and cmd='SELECT') then
    raise exception 'B2 security test 12 failed: trip relationship policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trip_children' and policyname='trip_children_select_school_ops_or_guardian' and cmd='SELECT') then
    raise exception 'B2 security test 13 failed: trip-child policy';
  end if;
  v_tests := v_tests + 1;

  select qual into v_definition from pg_policies
  where schemaname='public' and tablename='trip_children'
    and policyname='trip_children_select_school_ops_or_guardian';
  if v_definition is null or v_definition ~* 'driver' then
    raise exception 'B2 security test 14 failed: driver must not be included in trip-child read policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bus_positions' and policyname='bus_positions_select_active_trip_relationship' and cmd='SELECT') then
    raise exception 'B2 security test 15 failed: active GPS policy';
  end if;
  v_tests := v_tests + 1;

  select qual into v_definition from pg_policies
  where schemaname='public' and tablename='bus_positions'
    and policyname='bus_positions_select_active_trip_relationship';
  if v_definition is null or v_definition !~ 'active' then
    raise exception 'B2 security test 16 failed: GPS policy must require active trip';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bus_position_history' and policyname='bus_position_history_no_authenticated_access' and qual='false') then
    raise exception 'B2 security test 17 failed: historical GPS deny policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='trip_events' and policyname='trip_events_no_authenticated_access' and qual='false') then
    raise exception 'B2 security test 18 failed: trip event deny policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approved_collectors' and policyname='approved_collectors_no_authenticated_access' and qual='false') then
    raise exception 'B2 security test 19 failed: collector deny policy';
  end if;
  v_tests := v_tests + 1;

  if has_table_privilege('authenticated','public.trip_events','SELECT') then
    raise exception 'B2 security test 20 failed: authenticated trip_events grant';
  end if;
  v_tests := v_tests + 1;

  if has_table_privilege('authenticated','public.approved_collectors','SELECT') then
    raise exception 'B2 security test 21 failed: authenticated approved_collectors grant';
  end if;
  v_tests := v_tests + 1;

  if has_table_privilege('authenticated','public.bus_position_history','SELECT') then
    raise exception 'B2 security test 22 failed: authenticated GPS history grant';
  end if;
  v_tests := v_tests + 1;

  if not has_table_privilege('authenticated','public.bus_positions','SELECT') then
    raise exception 'B2 security test 23 failed: current GPS SELECT grant missing';
  end if;
  v_tests := v_tests + 1;

  -- B2.2 school-admin metadata access policy inventory.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='fee_items' and policyname='fee_items_select_school_admin') then
    raise exception 'B2 security test 24 failed: fee catalogue policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='settings' and policyname='settings_update_school_admin') then
    raise exception 'B2 security test 25 failed: settings admin policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='setup_progress' and policyname='setup_progress_select_school_admin') then
    raise exception 'B2 security test 26 failed: setup progress policy';
  end if;
  v_tests := v_tests + 1;

  -- Storage buckets are private and correctly constrained.
  if (select count(*) from storage.buckets where id in ('incident-photos','payment-proofs','avatars','receipts','exports')) <> 5 then
    raise exception 'B2 security test 27 failed: expected five preDrive buckets';
  end if;
  v_tests := v_tests + 1;

  if exists (select 1 from storage.buckets where id in ('incident-photos','payment-proofs','avatars','receipts','exports') and public is distinct from false) then
    raise exception 'B2 security test 28 failed: all preDrive buckets must be private';
  end if;
  v_tests := v_tests + 1;

  if (select file_size_limit from storage.buckets where id='avatars') <> 2097152 then
    raise exception 'B2 security test 29 failed: avatar size limit';
  end if;
  v_tests := v_tests + 1;

  if (select file_size_limit from storage.buckets where id='exports') <> 26214400 then
    raise exception 'B2 security test 30 failed: export size limit';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='predrive_payment_proofs_insert') then
    raise exception 'B2 security test 31 failed: payment proof upload policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='predrive_avatars_update') then
    raise exception 'B2 security test 32 failed: avatar update policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='predrive_receipts_select') then
    raise exception 'B2 security test 33 failed: receipt read policy';
  end if;
  v_tests := v_tests + 1;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='predrive_exports_select') then
    raise exception 'B2 security test 34 failed: export read policy';
  end if;
  v_tests := v_tests + 1;

  -- Security-definer functions must have an empty search_path and narrow grants.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='consume_rate_limit'
      and p.prosecdef and p.proconfig @> array['search_path=""']::text[]
  ) then
    raise exception 'B2 security test 35 failed: rate limiter security configuration';
  end if;
  v_tests := v_tests + 1;

  if has_function_privilege('authenticated','private.consume_rate_limit(uuid,text,text,integer,integer)','EXECUTE') then
    raise exception 'B2 security test 36 failed: authenticated can execute rate limiter';
  end if;
  v_tests := v_tests + 1;

  if not has_function_privilege('service_role','private.consume_rate_limit(uuid,text,text,integer,integer)','EXECUTE') then
    raise exception 'B2 security test 37 failed: service_role cannot execute rate limiter';
  end if;
  v_tests := v_tests + 1;

  if has_function_privilege('anon','private.storage_school_id(text)','EXECUTE') then
    raise exception 'B2 security test 38 failed: anon can execute storage path parser';
  end if;
  v_tests := v_tests + 1;

  if private.storage_school_id('not-a-uuid/user/file') is not null then
    raise exception 'B2 security test 39 failed: malformed storage path was accepted';
  end if;
  v_tests := v_tests + 1;

  if private.storage_school_id('00000000-0000-4000-8000-000000000001/user/file')
     <> '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'B2 security test 40 failed: valid storage school path was not parsed';
  end if;
  v_tests := v_tests + 1;

  -- Atomic rate-limit threshold behavior. These rows are rolled back below.
  v_result := private.consume_rate_limit(null,'security_test_rate_limit',v_hash,2,60);
  if v_result is distinct from true then
    raise exception 'B2 security test 41 failed: first rate-limit attempt must pass';
  end if;
  v_tests := v_tests + 1;

  v_result := private.consume_rate_limit(null,'security_test_rate_limit',v_hash,2,60);
  if v_result is distinct from true then
    raise exception 'B2 security test 42 failed: second rate-limit attempt must pass';
  end if;
  v_tests := v_tests + 1;

  v_result := private.consume_rate_limit(null,'security_test_rate_limit',v_hash,2,60);
  if v_result is distinct from false then
    raise exception 'B2 security test 43 failed: attempt above threshold must be denied';
  end if;
  v_tests := v_tests + 1;

  v_result := private.consume_rate_limit(null,'security_test_rate_limit',v_other_hash,2,60);
  if v_result is distinct from true then
    raise exception 'B2 security test 44 failed: rate limit must isolate subject hashes';
  end if;
  v_tests := v_tests + 1;

  v_result := private.consume_rate_limit(null,'security_test_other_action',v_hash,2,60);
  if v_result is distinct from true then
    raise exception 'B2 security test 45 failed: rate limit must isolate actions';
  end if;
  v_tests := v_tests + 1;

  begin
    perform private.consume_rate_limit(null,'Invalid Action',v_hash,2,60);
    raise exception 'B2 security test 46 failed: invalid action was accepted';
  exception when sqlstate '22023' then
    v_tests := v_tests + 1;
  end;

  begin
    perform private.consume_rate_limit(null,'security_test_invalid_hash','not-a-hash',2,60);
    raise exception 'B2 security test 47 failed: invalid subject hash was accepted';
  exception when sqlstate '22023' then
    v_tests := v_tests + 1;
  end;

  begin
    perform private.consume_rate_limit(null,'security_test_invalid_limit',v_hash,0,60);
    raise exception 'B2 security test 48 failed: zero threshold was accepted';
  exception when sqlstate '22023' then
    v_tests := v_tests + 1;
  end;

  begin
    perform private.consume_rate_limit(null,'security_test_invalid_window',v_hash,2,86401);
    raise exception 'B2 security test 49 failed: oversized window was accepted';
  exception when sqlstate '22023' then
    v_tests := v_tests + 1;
  end;

  if v_tests <> 55 then
    raise exception 'B2 security test count mismatch: expected 55, got %', v_tests;
  end if;

  raise notice 'preDrive B2 security catalog and rate-limit tests passed: % cases', v_tests;
end;
$$;

rollback;
