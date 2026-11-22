-- preDrive clean-room replay preflight
-- READ-ONLY: this script performs catalog and row-count checks only.
-- Run against a separate, disposable, empty hosted Supabase project BEFORE
-- deploying the repository migration chain. It does not prepare or mutate it.

do $preflight$
declare
  v_count bigint;
  v_missing text[] := array[]::text[];
begin
  -- Supabase roles referenced directly by the ordered migration chain.
  -- In particular, the Auth profile-sync trigger grants execution to
  -- supabase_auth_admin, while the foundation migrations alter defaults for
  -- postgres and grant/revoke privileges for the API roles.
  select coalesce(array_agg(required.role_name order by required.role_name), array[]::text[])
    into v_missing
    from (values
      ('anon'),
      ('authenticated'),
      ('postgres'),
      ('service_role'),
      ('supabase_admin'),
      ('supabase_auth_admin')
    ) as required(role_name)
   where not exists (
     select 1 from pg_roles r where r.rolname = required.role_name
   );

  if cardinality(v_missing) > 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: required Supabase roles are missing: %',
      array_to_string(v_missing, ', ');
  end if;

  -- The repository's default-privilege hardening is defined for objects
  -- created by postgres. Supabase-managed supabase_admin defaults cannot be
  -- changed by project roles, so migrations must not run under another owner.
  if current_user <> 'postgres' then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: run migrations as postgres, not %; default-privilege hardening is scoped to postgres-created objects',
      current_user;
  end if;

  if pg_has_role('postgres', 'supabase_admin', 'MEMBER') then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: postgres unexpectedly has supabase_admin membership; stop and review platform role configuration';
  end if;

  -- The reset migration drops and recreates private, then creates objects
  -- in public. Verify the migration role can perform those DDL operations.
  if not has_database_privilege(current_user, current_database(), 'CREATE') then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % cannot create the private schema',
      current_user;
  end if;

  if to_regnamespace('public') is null
     or not has_schema_privilege(current_user, 'public', 'CREATE')
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % cannot create objects in public',
      current_user;
  end if;

  -- DROP SCHEMA requires ownership (or equivalent effective owner-role
  -- privileges). Do not infer this from DELETE/EXECUTE grants on platform
  -- tables or functions.
  if to_regnamespace('private') is not null
     and not exists (
       select 1
         from pg_namespace n
        where n.nspname = 'private'
          and pg_has_role(current_user, n.nspowner, 'USAGE')
     )
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % lacks effective ownership privileges on schema private',
      current_user;
  end if;

  -- A schema can itself be an extension member. DROP SCHEMA ... CASCADE
  -- must not be allowed to tear down an extension-owned namespace.
  if exists (
    select 1
      from pg_namespace n
      join pg_depend d
        on d.refclassid = 'pg_namespace'::regclass
       and d.refobjid = n.oid
       and d.classid = 'pg_extension'::regclass
      join pg_extension e on e.oid = d.objid
     where n.nspname = 'private'
  ) then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: schema private is owned by an extension and cannot be reset safely';
  end if;

  -- Later migrations create a trigger on auth.users and install PostGIS
  -- and pgcrypto into extensions. Verify these platform capabilities before
  -- the ordered chain is attempted.
  if not has_schema_privilege(current_user, 'auth', 'USAGE')
     or not has_table_privilege(current_user, 'auth.users', 'TRIGGER')
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % lacks auth schema usage or TRIGGER privilege on auth.users',
      current_user;
  end if;

  if to_regnamespace('extensions') is not null
     and not has_schema_privilege(current_user, 'extensions', 'CREATE')
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: migration role % cannot create extensions in schema extensions',
      current_user;
  end if;

  if not exists (select 1 from pg_available_extensions where name = 'postgis')
     or not exists (select 1 from pg_available_extensions where name = 'pgcrypto')
  then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: required PostGIS or pgcrypto extension is unavailable';
  end if;

  if exists (
    select 1
      from pg_extension e
      join pg_namespace n on n.oid = e.extnamespace
     where e.extname in ('postgis', 'pgcrypto')
       and n.nspname <> 'extensions'
  ) then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: PostGIS or pgcrypto is already installed outside schema extensions; CREATE EXTENSION IF NOT EXISTS will not relocate it';
  end if;

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

  -- Verify the platform extensions themselves, not merely lookalike
  -- schemas/tables/functions with the expected names.
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    v_missing := array_append(v_missing, 'extension pg_cron');
  end if;
  if not exists (
    select 1 from pg_extension where extname = 'supabase_vault'
  ) then
    v_missing := array_append(v_missing, 'extension supabase_vault');
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

  -- The historical reset migration drops enums, composites, domains,
  -- ranges and multiranges in public, but does not remove user-defined base
  -- or pseudo types. Refuse every non-extension custom type in either
  -- application schema so an incomplete reset cannot leave objects behind.
  -- Exclude automatically generated array types (typelem <> 0) and table row
  -- types, which are represented by pg_class.reltype and caught above.
  select count(*)
    into v_count
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname in ('public', 'private')
     and t.typtype in ('b', 'e', 'c', 'd', 'r', 'm', 'p')
     and t.typelem = 0
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
      'CLEAN-ROOM PREFLIGHT FAILED: public/private contain % non-extension custom types (including base or pseudo types)',
      v_count;
  end if;

  -- The historical reset drops private with CASCADE, unlike public where
  -- extension-owned objects are explicitly preserved. Refuse a target that
  -- has any extension-owned relation, routine, or type in private.
  select count(*)
    into v_count
    from (
      select d.classid, d.objid
        from pg_depend d
        join pg_class c
          on d.classid = 'pg_class'::regclass
         and c.oid = d.objid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'private'
         and d.deptype = 'e'
      union all
      select d.classid, d.objid
        from pg_depend d
        join pg_proc p
          on d.classid = 'pg_proc'::regclass
         and p.oid = d.objid
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
         and d.deptype = 'e'
      union all
      select d.classid, d.objid
        from pg_depend d
        join pg_type t
          on d.classid = 'pg_type'::regclass
         and t.oid = d.objid
        join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'private'
         and d.deptype = 'e'
    ) extension_objects;

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: private contains % extension-owned relations, functions, or types that the reset migration could drop',
      v_count;
  end if;

  -- Check every object directly owned by the private schema, not only
  -- relations, routines, and types. DROP SCHEMA ... CASCADE can also remove
  -- operators, casts, collations, text-search objects, and other namespace
  -- objects. A clean replay target must not contain any of them.
  select count(*)
    into v_count
    from pg_depend d
   where d.refclassid = 'pg_namespace'::regclass
     and d.refobjid = (
       select n.oid
         from pg_namespace n
        where n.nspname = 'private'
     )
     and d.deptype = 'n'
     and d.classid <> 'pg_namespace'::regclass;

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: private contains % namespace-owned objects that DROP SCHEMA ... CASCADE could remove',
      v_count;
  end if;

  -- Public is not dropped wholesale, but DROP ... CASCADE on a public
  -- function, relation, or type can remove dependent namespace objects such
  -- as operators, casts, and text-search objects. Fail closed if any
  -- non-extension object is directly owned by public; extension-owned
  -- objects are preserved by the historical reset migration.
  select count(*)
    into v_count
    from pg_depend d
   where d.refclassid = 'pg_namespace'::regclass
     and d.refobjid = (
       select n.oid
         from pg_namespace n
        where n.nspname = 'public'
     )
     and d.deptype = 'n'
     and d.classid <> 'pg_namespace'::regclass
     and not exists (
       select 1
         from pg_depend extension_membership
        where extension_membership.classid = d.classid
          and extension_membership.objid = d.objid
          and extension_membership.deptype = 'e'
     );

  if v_count <> 0 then
    raise exception
      'CLEAN-ROOM PREFLIGHT FAILED: public contains % non-extension namespace-owned objects that cascading drops could remove',
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
