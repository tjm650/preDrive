-- B4.3 invitation onboarding catalog acceptance.
-- Read-only: no invitation, Auth user, membership or staff row is created.

do $test$
declare
  v_function oid;
  v_columns integer;
begin
  select count(*) into v_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'school_invitations'
    and column_name in ('full_name', 'phone')
    and data_type = 'text';

  if v_columns <> 2 then
    raise exception 'B4.3: invitation staff detail columns are missing';
  end if;

  v_function := to_regprocedure('public.accept_school_invitation()');
  if v_function is null then
    raise exception 'B4.3: invitation acceptance RPC is missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid = v_function
      and p.prosecdef
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[]
  ) then
    raise exception 'B4.3: invitation acceptance must be SECURITY DEFINER with empty search_path';
  end if;

  if has_function_privilege('anon', v_function, 'EXECUTE')
     or not has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'B4.3: invitation acceptance grants are incorrect';
  end if;

  if not exists (
    select 1 from pg_class c
    where c.oid = 'public.school_invitations'::regclass
      and c.relrowsecurity
  ) then
    raise exception 'B4.3: school_invitations RLS was unexpectedly disabled';
  end if;

  if to_regprocedure('public.consume_rate_limit(uuid,text,text,integer,integer)') is null
     or not has_function_privilege(
       'service_role',
       'public.consume_rate_limit(uuid,text,text,integer,integer)',
       'EXECUTE'
     ) then
    raise exception 'B4.3: service-role rate-limit RPC is unavailable';
  end if;
end;
$test$;
