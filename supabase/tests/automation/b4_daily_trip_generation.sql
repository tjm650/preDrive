-- B4.2 catalog acceptance. This suite is read-only and does not generate trips.
do $test$
declare
  v_function oid;
  v_config text[];
  v_count integer;
begin
  v_function := to_regprocedure('public.generate_daily_trips(date)');
  if v_function is null then
    raise exception 'B4.2: generate_daily_trips(date) is missing';
  end if;

  select p.proconfig into v_config
  from pg_proc p where p.oid = v_function;

  if not exists (
    select 1 from pg_proc p
    where p.oid = v_function
      and p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[]
  ) then
    raise exception 'B4.2: trip generator must be SECURITY DEFINER with an empty search_path';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'B4.2: trip generator must be service_role-only';
  end if;

  if to_regprocedure('public.assign_route_schedule_staff(uuid,uuid,uuid,uuid)') is null then
    raise exception 'B4.2: schedule staff assignment RPC is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_schedules'
      and column_name = 'driver_id'
      and data_type = 'uuid'
  ) then
    raise exception 'B4.2: route_schedules.driver_id is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'route_schedules'
      and column_name = 'supervisor_id'
      and data_type = 'uuid'
  ) then
    raise exception 'B4.2: route_schedules.supervisor_id is missing';
  end if;

  select count(*) into v_count
  from pg_constraint
  where conrelid = 'public.route_schedules'::regclass
    and conname in (
      'route_schedules_driver_school_fkey',
      'route_schedules_supervisor_school_fkey'
    )
    and contype = 'f';

  if v_count <> 2 then
    raise exception 'B4.2: schedule staff composite school foreign keys are missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.route_schedules'::regclass
      and tgname = 'route_schedules_assert_staff_roles'
      and not tgisinternal
  ) then
    raise exception 'B4.2: schedule staff-role validation trigger is missing';
  end if;

  if not has_table_privilege('authenticated', 'public.route_schedules', 'SELECT') then
    raise exception 'B4.2: existing route schedule read access was unexpectedly removed';
  end if;
end;
$test$;
