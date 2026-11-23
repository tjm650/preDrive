-- B5.4 Greenfield history and finance acceptance.
-- Read-only: run after the reviewed demo-history seed has completed.
-- All expected records are fictional and scoped to the single is_demo tenant.

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from public.trips where school_id = v_school_id and status = 'completed') <> 120 then
    raise exception 'B5.4: expected 120 completed historical trips across four school weeks';
  end if;

  if (
    select count(distinct service_date)
    from public.trips
    where school_id = v_school_id and status = 'completed'
      and service_date between date '2026-10-26' and date '2026-11-20'
  ) <> 20 then
    raise exception 'B5.4: expected 20 distinct historical school weekdays';
  end if;

  if (
    select count(*)
    from public.trip_children tc
    join public.trips t on t.id = tc.trip_id and t.school_id = tc.school_id
    where tc.school_id = v_school_id
      and t.generation_key like 'greenfield-history:%'
  ) <> 2560 then
    raise exception 'B5.4: expected 2,560 historical attendance rows';
  end if;

  if exists (
    select 1
    from public.trips t
    where t.school_id = v_school_id
      and t.status = 'completed'
      and (t.started_at is null or t.ended_at is null or t.ended_at < t.started_at)
  ) then
    raise exception 'B5.4: completed trip timestamps are invalid';
  end if;

  if exists (
    select 1
    from public.trips t
    where t.school_id = v_school_id
      and t.status = 'completed'
      and exists (select 1 from public.bus_positions bp where bp.trip_id = t.id)
  ) then
    raise exception 'B5.4: completed trips must not retain live bus positions';
  end if;

  if (
    select count(*)
    from public.invoices
    where school_id = v_school_id and status = 'paid'
  ) <> 16 or (
    select count(*)
    from public.invoices
    where school_id = v_school_id and status = 'partially_paid'
  ) <> 16 or (
    select count(*)
    from public.invoices
    where school_id = v_school_id and status = 'overdue'
  ) <> 32 then
    raise exception 'B5.4: expected 16 paid, 16 partially paid and 32 overdue invoices';
  end if;

  if exists (
    select 1 from public.payments
    where school_id = v_school_id
      and idempotency_key like 'greenfield-demo-payment:%'
      and (status <> 'succeeded' or provider <> 'simulated' or method <> 'ecocash')
  ) then
    raise exception 'B5.4: demo payments must remain simulated EcoCash records';
  end if;

  if (
    select count(*)
    from public.payments p
    where p.school_id = v_school_id and p.status = 'succeeded'
  ) <> 32 then
    raise exception 'B5.4: expected 32 simulated successful payment records';
  end if;

  if (
    select count(*)
    from public.receipts r
    join public.payments p on p.id = r.payment_id and p.school_id = r.school_id
    where r.school_id = v_school_id and p.status = 'succeeded'
  ) <> 32 then
    raise exception 'B5.4: every simulated successful payment must have a receipt';
  end if;

  if (
    select count(*)
    from public.incidents
    where school_id = v_school_id and status = 'resolved'
      and title in ('Minor delay at Borrowdale Road', 'Vehicle door inspection')
  ) <> 2 then
    raise exception 'B5.4: expected two resolved demo incidents';
  end if;

  if (
    select count(*)
    from public.delay_reports
    where school_id = v_school_id
      and description like 'DEMO:%'
  ) <> 4 then
    raise exception 'B5.4: expected four labelled demo delay reports';
  end if;
end;
$$;

select
  (select count(*) from public.trips where school_id = '10000000-0000-4000-8000-000000000001' and status = 'completed') as completed_trips,
  (select count(*) from public.invoices where school_id = '10000000-0000-4000-8000-000000000001') as invoices,
  (select count(*) from public.payments where school_id = '10000000-0000-4000-8000-000000000001') as payments,
  (select count(*) from public.receipts where school_id = '10000000-0000-4000-8000-000000000001') as receipts,
  (select count(*) from public.incidents where school_id = '10000000-0000-4000-8000-000000000001' and status = 'resolved') as resolved_incidents;
