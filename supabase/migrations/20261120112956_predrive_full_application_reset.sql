
begin;
do $$
declare r record;
begin
  for r in select jobid from cron.job loop
    perform cron.unschedule(r.jobid);
  end loop;
end $$;

delete from vault.secrets;
delete from auth.users;

drop schema if exists private cascade;
create schema private;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('drop function if exists %s cascade', r.signature);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p','v','m','S','f')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_class'::regclass
          and d.objid = c.oid
          and d.deptype = 'e'
      )
  loop
    if r.relkind = 'v' then
      execute format('drop view if exists public.%I cascade', r.relname);
    elsif r.relkind = 'm' then
      execute format('drop materialized view if exists public.%I cascade', r.relname);
    elsif r.relkind = 'S' then
      execute format('drop sequence if exists public.%I cascade', r.relname);
    elsif r.relkind = 'f' then
      execute format('drop foreign table if exists public.%I cascade', r.relname);
    else
      execute format('drop table if exists public.%I cascade', r.relname);
    end if;
  end loop;
end $$;

do $$
declare r record;
begin
  for r in
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype in ('e','c','d','r','m')
      and not exists (
        select 1 from pg_depend d
        where d.classid = 'pg_type'::regclass
          and d.objid = t.oid
          and d.deptype = 'e'
      )
      and not exists (select 1 from pg_class c where c.reltype = t.oid)
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

delete from supabase_migrations.schema_migrations;
commit;
