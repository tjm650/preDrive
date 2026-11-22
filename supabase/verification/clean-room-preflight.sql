-- preDrive clean-room replay preflight
-- READ-ONLY: this script performs catalog and row-count checks only.
-- Run against a separate, disposable, empty hosted Supabase project BEFORE
-- deploying the repository migration chain. It does not prepare or mutate it.

do $preflight$
declare
  v_count bigint;
  v_missing text[] := array[]::text[];
begin
  -- Platform objects referenced by the historical one-time reset migration.
  if to_regclass('cron.job') is null then
    v_missing := array_append(v_missing, 'cron.job');
  end if;
  if to_regprocedure('cron.unschedule(bigint)') is null then
    v_missing := array_append(v_missing, 'cron.unschedule(bigint)');
  end if;
  if to_regclass('vault.secrets') is null then
    v_missing := array_append(v_missing, 'vault.secrets');
  end if;
  if to_regclass('auth.users') is null then
    v_missing := array_append(v_missing, 'auth.users');
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    v_missing := array_append(v_missing, 'supabase_migrations.schema_migrations');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: required Supabase platform objects are missing: %',
      array_to_string(v_missing, ', ');
  end if;

  -- The reset migration deletes these records. A clean replay target must
  -- already be empty; this preflight intentionally refuses to clear them.
  execute 'select count(*) from cron.job' into v_count;
  if v_count <> 0 then
    raise exception 'CLEAN-ROOM PREFLIGHT FAILED: cron.job contains % scheduled jobs', v_count;
  end if;

  execute 'select count(*) from vault.secrets' into v_count;
  if v_count <> 0 then
    raise exception 'CLEAN-ROOM PREFLIGHT FAILED: vault.secrets contains % secrets', v_count;
  end if;

  execute 'select count(*) from auth.users' into v_count;
  if v_count <> 0 then
    raise exception 'CLEAN-ROOM PREFLIGHT FAILED: auth.users contains % users', v_count;
  end if;

  execute 'select count(*) from supabase_migrations.schema_migrations' into v_count;
  if v_count <> 0 then
    raise exception 'CLEAN-ROOM PREFLIGHT FAILED: migration ledger contains % rows', v_count;
  end if;

  -- The first migration drops non-extension objects in public and recreates
  -- private. Refuse to run if either schema already contains app objects.
  select count(*)
    into v_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'private')
     and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_class'::regclass
          and d.objid = c.oid
          and d.deptype = 'e'
     );

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: public/private contain % non-extension relations',
      v_count;
  end if;

  select count(*)
    into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'private')
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
     );

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: public/private contain % non-extension functions',
      v_count;
  end if;

  -- The reset migration also drops custom public types. Check both schemas
  -- so a supposedly empty target cannot silently lose pre-existing types.
  select count(*)
    into v_count
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname in ('public', 'private')
     and t.typtype in ('e', 'c', 'd', 'r', 'm')
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_type'::regclass
          and d.objid = t.oid
          and d.deptype = 'e'
     )
     and not exists (
       select 1
         from pg_class c
        where c.reltype = t.oid
     );

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: public/private contain % non-extension custom types',
      v_count;
  end if;

  -- Check the reset migration's effective permissions before declaring
  -- the target ready. The final SELECT below remains as an auditable report.
  if not has_table_privilege(current_user, 'cron.job', 'SELECT')
     or not has_function_privilege(current_user, 'cron.unschedule(bigint)', 'EXECUTE')
     or not has_table_privilege(current_user, 'vault.secrets', 'DELETE')
     or not has_table_privilege(current_user, 'auth.users', 'DELETE')
     or not has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE')
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % lacks one or more privileges required by the historical reset migration',
      current_user;
  end if;

  raise notice
    'CLEAN-ROOM PREFLIGHT PASSED: required platform objects exist; cron, Vault, Auth, migration ledger, application schemas and custom types are empty; required reset privileges are present. Current role: %',
    current_user;
end
$preflight$;

-- Retain an explicit privilege report in the query output for the replay log.
select
  current_user as migration_role,
  has_table_privilege(current_user, 'cron.job', 'SELECT') as can_read_cron_jobs,
  has_function_privilege(current_user, 'cron.unschedule(bigint)', 'EXECUTE') as can_unschedule_cron_jobs,
  has_table_privilege(current_user, 'vault.secrets', 'DELETE') as can_delete_vault_secrets,
  has_table_privilege(current_user, 'auth.users', 'DELETE') as can_delete_auth_users,
  has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'DELETE') as can_clear_migration_ledger;
