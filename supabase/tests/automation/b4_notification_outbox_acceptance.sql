-- B4.7 notification outbox acceptance checks.
-- Read-only catalog assertions; creates no users, alerts, recipients or delivery rows.

do $$
declare
  v_rls boolean;
  v_count integer;
begin
  select c.relrowsecurity
    into v_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'notification_deliveries'
    and c.relkind = 'r';

  if v_rls is distinct from true then
    raise exception 'B4.7: notification_deliveries RLS is not enabled';
  end if;

  select count(*) into v_count
  from pg_constraint
  where conrelid = 'public.notification_deliveries'::regclass
    and conname in (
      'notification_deliveries_recipient_school_fkey',
      'notification_deliveries_lock_state_check',
      'notification_deliveries_sent_state_check'
    );

  -- B4.7.2 replaced the original recipient/channel unique constraint with
  -- sequence-aware email and per-device push unique indexes. Those are
  -- asserted by b4_notification_cycles_acceptance.sql.
  if v_count <> 3 then
    raise exception 'B4.7: expected three notification delivery constraints, found %', v_count;
  end if;

  select count(*) into v_count
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'notification_deliveries'
    and indexname in (
      'notification_deliveries_due_idx',
      'notification_deliveries_stale_lease_idx',
      'notification_deliveries_school_status_idx'
    );

  if v_count <> 3 then
    raise exception 'B4.7: expected three notification delivery indexes, found %', v_count;
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.alert_recipients'::regclass
      and tgname = 'alert_recipients_enqueue_notification_deliveries'
      and not tgisinternal
  ) then
    raise exception 'B4.7: alert recipient enqueue trigger is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.broadcasts'::regclass
      and tgname = 'broadcasts_materialize_published_insert'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.broadcasts'::regclass
      and tgname = 'broadcasts_materialize_published_update'
      and not tgisinternal
  ) then
    raise exception 'B4.7: broadcast publication triggers are incomplete';
  end if;

  if has_table_privilege('authenticated', 'public.notification_deliveries', 'select')
     or has_table_privilege('authenticated', 'public.notification_deliveries', 'insert')
     or has_table_privilege('anon', 'public.notification_deliveries', 'select')
     or has_table_privilege('anon', 'public.notification_deliveries', 'insert') then
    raise exception 'B4.7: client role unexpectedly has notification delivery table privileges';
  end if;

  if not has_table_privilege('service_role', 'public.notification_deliveries', 'select')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'insert')
     or not has_table_privilege('service_role', 'public.notification_deliveries', 'update')
     or has_table_privilege('service_role', 'public.notification_deliveries', 'delete') then
    raise exception 'B4.7: service role notification delivery privileges are incorrect';
  end if;

  if (select count(*) from public.notification_deliveries) <> 0 then
    raise exception 'B4.7: unexpected notification delivery rows exist after migration';
  end if;
end
$$;
