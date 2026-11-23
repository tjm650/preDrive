-- B5.4 history-writer catalog acceptance. Read-only.
-- Run after the migration is applied and before invoking the writer.

do $$
declare
  v_function oid := to_regprocedure('public.seed_greenfield_demo_history()');
begin
  if v_function is null then
    raise exception 'B5.4: Greenfield history writer function is missing';
  end if;

  if not (select prosecdef from pg_proc where oid = v_function) then
    raise exception 'B5.4: history writer must be SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid = v_function
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=""%'
  ) then
    raise exception 'B5.4: history writer must use an empty search_path';
  end if;

  if not has_function_privilege('service_role', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE')
     or has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('public', v_function, 'EXECUTE') then
    raise exception 'B5.4: history writer must be executable only by service_role';
  end if;
end;
$$;

select
  p.prosecdef as security_definer,
  p.proconfig as function_settings,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
from pg_proc p
where p.oid = to_regprocedure('public.seed_greenfield_demo_history()');
