-- Read-only B4.6 catalog acceptance checks.
-- Run after migration 20261123110000 is applied to the target project.
do $$
declare
  v_source_check text;
  v_rls_enabled boolean;
  v_recipient_unique boolean;
begin
  select pg_get_constraintdef(c.oid)
    into v_source_check
  from pg_constraint c
  where c.conrelid = 'public.alerts'::regclass
    and c.conname = 'alerts_source_type_check';

  if v_source_check is null
     or position('payment_reminder' in v_source_check) = 0 then
    raise exception 'B4.6: alerts_source_type_check does not allow payment_reminder';
  end if;

  select relrowsecurity
    into v_rls_enabled
  from pg_class
  where oid = 'public.alerts'::regclass;

  if v_rls_enabled is distinct from true then
    raise exception 'B4.6: alerts RLS must remain enabled';
  end if;

  select exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'alerts'
      and indexname = 'alerts_school_dedupe_key_uidx'
  ) into v_recipient_unique;

  if v_recipient_unique is distinct from true then
    raise exception 'B4.6: alert deduplication index is missing';
  end if;

  select exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'alert_recipients'
      and indexname = 'alert_recipients_school_alert_user_key'
  ) into v_recipient_unique;

  if v_recipient_unique is distinct from true then
    raise exception 'B4.6: alert recipient idempotency index is missing';
  end if;
end;
$$;

select
  'B4.6 finance catalog checks passed' as result,
  (select count(*) from public.receipts) as existing_receipts,
  (select count(*) from public.refunds) as existing_refunds;
