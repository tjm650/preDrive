-- Source-only B5 demo history writer.
-- Review and convert to a migration only after the user authorizes the schema change.
-- The routine creates fictional Greenfield history only. It never touches real schools.

create or replace function public.seed_greenfield_demo_history()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_admin_id uuid;
  v_trip_count integer;
  v_trip_child_count integer;
  v_invoice_count integer;
  v_payment_count integer;
  v_receipt_count integer;
  v_incident_count integer;
  v_delay_count integer;
begin
  if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'SERVICE_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from public.schools
    where id = v_school_id and is_demo = true and status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'GREENFIELD_DEMO_SCHOOL_REQUIRED';
  end if;

  select p.id into v_admin_id
  from public.profiles p
  where lower(p.email) = 'admin@greenfield.predrive-demo.invalid';

  if v_admin_id is null or not exists (
    select 1 from public.school_memberships m
    where m.school_id = v_school_id and m.user_id = v_admin_id
      and m.role = 'school_admin' and m.active
  ) then
    raise exception using errcode = '23503', message = 'GREENFIELD_ADMIN_REQUIRED';
  end if;

  if (select count(*) from public.children where school_id = v_school_id and status = 'active') <> 64
     or (select count(*) from public.guardian_children where school_id = v_school_id and active) <> 64
     or (select count(*) from public.approved_collectors where school_id = v_school_id and active) <> 128
     or (select count(*) from public.route_schedules where school_id = v_school_id and active and driver_id is not null and supervisor_id is not null) <> 6 then
    raise exception using errcode = '23514', message = 'GREENFIELD_OPERATIONAL_FIXTURES_INCOMPLETE';
  end if;

  if (select count(*) from public.fee_items where school_id = v_school_id and active and currency = 'USD' and billing_period = 'term') <> 4 then
    raise exception using errcode = '23514', message = 'GREENFIELD_FEE_CATALOGUE_INCOMPLETE';
  end if;

  -- Historical trips: 20 weekdays, three routes, two directions.
  insert into public.trips (
    id, school_id, route_id, schedule_id, bus_id, supervisor_id, driver_id,
    direction, service_date, status, scheduled_at, started_at, ended_at,
    generation_key, started_by, ended_by
  )
  select
    md5('greenfield-trip:' || rs.id::text || ':' || d.service_date::text)::uuid,
    v_school_id,
    rs.route_id,
    rs.id,
    r.assigned_bus_id,
    rs.supervisor_id,
    rs.driver_id,
    rs.direction,
    d.service_date,
    'completed'::public.trip_status,
    (d.service_date + rs.departure_time) at time zone 'Africa/Harare',
    ((d.service_date + rs.departure_time) at time zone 'Africa/Harare') + interval '4 minutes',
    ((d.service_date + rs.departure_time) at time zone 'Africa/Harare') + interval '55 minutes',
    'greenfield-history:' || rs.id::text || ':' || d.service_date::text,
    supervisor.user_id,
    supervisor.user_id
  from public.route_schedules rs
  join public.transport_routes r
    on r.id = rs.route_id and r.school_id = rs.school_id and r.status = 'active'
  join public.staff_members supervisor
    on supervisor.id = rs.supervisor_id and supervisor.school_id = rs.school_id
    and supervisor.role = 'supervisor' and supervisor.active
  cross join generate_series(date '2026-10-26', date '2026-11-20', interval '1 day') as series(day_value)
  cross join lateral (select series.day_value::date as service_date) d
  where rs.school_id = v_school_id
    and rs.active
    and rs.driver_id is not null
    and rs.supervisor_id is not null
    and extract(isodow from d.service_date) between 1 and 5
  on conflict (id) do nothing;

  -- Attendance and handover states are explicitly synthetic demo events.
  insert into public.trip_children (
    id, school_id, trip_id, child_id, status, boarded_at, handed_over_at,
    recorded_by, idempotency_key, last_event_at
  )
  select
    md5('greenfield-trip-child:' || t.id::text || ':' || c.id::text)::uuid,
    v_school_id,
    t.id,
    c.id,
    case
      when mod(row_number() over (partition by t.id order by c.id)::integer + extract(day from t.service_date)::integer, 19) = 0
        then 'absent'::public.trip_child_status
      else 'handed_over'::public.trip_child_status
    end,
    case
      when mod(row_number() over (partition by t.id order by c.id)::integer + extract(day from t.service_date)::integer, 19) = 0
        then null
      else t.started_at + interval '8 minutes'
    end,
    case
      when mod(row_number() over (partition by t.id order by c.id)::integer + extract(day from t.service_date)::integer, 19) = 0
        then null
      else t.ended_at - interval '5 minutes'
    end,
    supervisor.user_id,
    md5('greenfield-trip-child-key:' || t.id::text || ':' || c.id::text)::uuid,
    t.ended_at
  from public.trips t
  join public.child_route_assignments a
    on a.school_id = t.school_id and a.route_id = t.route_id and a.active
  join public.children c
    on c.id = a.child_id and c.school_id = a.school_id and c.status = 'active'
  join public.staff_members supervisor
    on supervisor.id = t.supervisor_id and supervisor.school_id = t.school_id
  where t.school_id = v_school_id
    and t.generation_key like 'greenfield-history:%'
  on conflict (trip_id, child_id) do nothing;

  -- Trip lifecycle events are marked as demo simulations; they do not claim
  -- that a real guardian PIN was entered or a real bus location was recorded.
  insert into public.trip_events (
    id, school_id, trip_id, event_type, actor_user_id, idempotency_key,
    event_data, occurred_at
  )
  select
    md5('greenfield-trip-start-event:' || t.id::text)::uuid,
    v_school_id, t.id, 'trip_started', t.started_by,
    md5('greenfield-trip-start-key:' || t.id::text)::uuid,
    jsonb_build_object('demo_fixture', true), t.started_at
  from public.trips t
  where t.school_id = v_school_id and t.generation_key like 'greenfield-history:%'
  on conflict (id) do nothing;

  insert into public.trip_events (
    id, school_id, trip_id, trip_child_id, event_type, actor_user_id,
    idempotency_key, event_data, occurred_at
  )
  select
    md5('greenfield-child-event:' || tc.id::text || ':status')::uuid,
    v_school_id, tc.trip_id, tc.id,
    case when tc.status = 'absent' then 'child_marked_absent' else 'child_boarded' end,
    tc.recorded_by,
    md5('greenfield-child-event-key:' || tc.id::text || ':status')::uuid,
    jsonb_build_object('demo_fixture', true),
    coalesce(tc.boarded_at, tc.last_event_at)
  from public.trip_children tc
  join public.trips t on t.id = tc.trip_id and t.school_id = tc.school_id
  where tc.school_id = v_school_id and t.generation_key like 'greenfield-history:%'
  on conflict (id) do nothing;

  insert into public.trip_events (
    id, school_id, trip_id, trip_child_id, event_type, actor_user_id,
    idempotency_key, event_data, occurred_at
  )
  select
    md5('greenfield-child-event:' || tc.id::text || ':handover')::uuid,
    v_school_id, tc.trip_id, tc.id, 'child_handed_over',
    tc.recorded_by,
    md5('greenfield-child-event-key:' || tc.id::text || ':handover')::uuid,
    jsonb_build_object('demo_fixture', true, 'handover_mode', 'simulated'),
    tc.handed_over_at
  from public.trip_children tc
  join public.trips t on t.id = tc.trip_id and t.school_id = tc.school_id
  where tc.school_id = v_school_id
    and tc.status = 'handed_over'
    and t.generation_key like 'greenfield-history:%'
  on conflict (id) do nothing;

  insert into public.trip_events (
    id, school_id, trip_id, event_type, actor_user_id, idempotency_key,
    event_data, occurred_at
  )
  select
    md5('greenfield-trip-complete-event:' || t.id::text)::uuid,
    v_school_id, t.id, 'trip_completed', t.ended_by,
    md5('greenfield-trip-complete-key:' || t.id::text)::uuid,
    jsonb_build_object('demo_fixture', true), t.ended_at
  from public.trips t
  where t.school_id = v_school_id and t.generation_key like 'greenfield-history:%'
  on conflict (id) do nothing;

  -- Four term fee lines are copied into each immutable invoice.
  insert into public.invoices (
    id, school_id, child_id, guardian_user_id, invoice_number, currency,
    subtotal_minor, credit_minor, total_minor, paid_minor, balance_minor,
    status, due_date, issued_at, paid_at, created_by
  )
  select
    md5('greenfield-invoice:' || c.id::text)::uuid,
    v_school_id,
    c.id,
    gc.guardian_user_id,
    'GF-2026-T4-' || lpad(row_number() over (order by c.created_at, c.id)::text, 3, '0'),
    'USD'::public.currency_code,
    55500,
    0,
    55500,
    case when mod(row_number() over (order by c.id)::integer - 1, 4) = 0 then 55500
         when mod(row_number() over (order by c.id)::integer - 1, 4) = 1 then 27750
         else 0 end,
    case when mod(row_number() over (order by c.id)::integer - 1, 4) = 0 then 0
         when mod(row_number() over (order by c.id)::integer - 1, 4) = 1 then 27750
         else 55500 end,
    case when mod(row_number() over (order by c.id)::integer - 1, 4) = 0 then 'paid'::public.invoice_status
         when mod(row_number() over (order by c.id)::integer - 1, 4) = 1 then 'partially_paid'::public.invoice_status
         else 'overdue'::public.invoice_status end,
    case when mod(row_number() over (order by c.id)::integer - 1, 4) = 2 then date '2026-11-06'
         when mod(row_number() over (order by c.id)::integer - 1, 4) = 3 then date '2026-11-13'
         else date '2026-11-20' end,
    timestamptz '2026-10-15 09:00:00+02',
    case when mod(row_number() over (order by c.id)::integer - 1, 4) = 0
      then timestamptz '2026-11-16 10:00:00+02' else null end,
    v_admin_id
  from public.children c
  join public.guardian_children gc
    on gc.school_id = c.school_id and gc.child_id = c.id and gc.active and gc.primary_contact
  where c.school_id = v_school_id and c.status = 'active'
  on conflict (id) do nothing;

  insert into public.invoice_lines (
    id, school_id, invoice_id, fee_item_id, description,
    quantity, unit_amount_minor, line_total_minor, currency
  )
  select
    md5('greenfield-invoice-line:' || i.id::text || ':' || fi.id::text)::uuid,
    v_school_id, i.id, fi.id, fi.name,
    1, fi.amount_minor, fi.amount_minor, 'USD'::public.currency_code
  from public.invoices i
  cross join public.fee_items fi
  where i.school_id = v_school_id
    and i.invoice_number like 'GF-2026-T4-%'
    and fi.school_id = v_school_id and fi.active and fi.currency = 'USD'
  on conflict (id) do nothing;

  -- Simulated EcoCash records only. No external provider is contacted.
  insert into public.payments (
    id, school_id, invoice_id, amount_minor, currency, method, status,
    idempotency_key, request_hash, reference, provider_reference, provider,
    exchange_rate_snapshot, created_by, succeeded_at, created_at
  )
  select
    md5('greenfield-payment:' || i.id::text)::uuid,
    v_school_id,
    i.id,
    i.paid_minor,
    i.currency,
    'ecocash'::public.payment_method,
    'succeeded'::public.payment_status,
    'greenfield-demo-payment:' || i.invoice_number,
    encode(extensions.digest(convert_to(
      i.id::text || ':' || i.paid_minor::text || ':' || i.currency::text || ':ecocash',
      'UTF8'
    ), 'sha256'), 'hex'),
    'GF-DEMO-' || i.invoice_number,
    'SIMULATED-' || i.invoice_number,
    'simulated',
    27.00,
    i.guardian_user_id,
    timestamptz '2026-11-16 10:00:00+02',
    timestamptz '2026-11-16 09:55:00+02'
  from public.invoices i
  where i.school_id = v_school_id
    and i.invoice_number like 'GF-2026-T4-%'
    and i.paid_minor > 0
  on conflict (school_id, idempotency_key) do nothing;

  insert into public.receipts (school_id, payment_id, receipt_number, issued_at)
  select
    p.school_id,
    p.id,
    'GF-R-' || i.invoice_number,
    p.succeeded_at
  from public.payments p
  join public.invoices i on i.id = p.invoice_id and i.school_id = p.school_id
  where p.school_id = v_school_id
    and p.idempotency_key like 'greenfield-demo-payment:%'
    and p.status = 'succeeded'
  on conflict (school_id, payment_id) do nothing;

  -- Two historical resolved incidents, each tied to its relevant completed trip.
  insert into public.incidents (
    id, school_id, title, description, severity, status, trip_id,
    reported_by, occurred_at, resolved_at, resolved_by, resolution_notes
  )
  select
    md5('greenfield-incident:' || fixture.reference)::uuid,
    v_school_id,
    fixture.title,
    fixture.description,
    fixture.severity::public.incident_severity,
    'resolved'::public.incident_status,
    t.id,
    supervisor.user_id,
    fixture.occurred_at::timestamptz,
    fixture.resolved_at::timestamptz,
    v_admin_id,
    'Resolved as part of the fictional Greenfield demonstration history.'
  from (values
    ('GF-INC-001', 'Minor delay at Borrowdale Road',
     'Traffic congestion delayed the afternoon pickup. Guardians were notified and all children were accounted for.',
     'low', 'A', date '2026-11-04', timestamptz '2026-11-04 13:20:00+02', timestamptz '2026-11-04 14:05:00+02'),
    ('GF-INC-002', 'Vehicle door inspection',
     'A door sensor warning was inspected before departure. The bus was cleared for service after the latch was checked.',
     'medium', 'B', date '2026-11-12', timestamptz '2026-11-12 06:40:00+02', timestamptz '2026-11-12 07:10:00+02')
  ) as fixture(reference,title,description,severity,route_code,service_date,occurred_at,resolved_at)
  join public.transport_routes r on r.school_id = v_school_id and r.code = fixture.route_code
  join public.route_schedules rs on rs.school_id = v_school_id and rs.route_id = r.id
    and rs.direction = 'from_school' and rs.active
  join public.trips t on t.school_id = v_school_id and t.schedule_id = rs.id
    and t.service_date = fixture.service_date and t.status = 'completed'
  join public.staff_members supervisor on supervisor.id = t.supervisor_id
  on conflict (id) do nothing;

  -- Four delay reports are attached to the matching completed afternoon trips.
  insert into public.delay_reports (
    id, school_id, trip_id, reported_by, reason, description,
    estimated_delay_minutes, reported_at
  )
  select
    md5('greenfield-delay:' || fixture.reference)::uuid,
    v_school_id,
    t.id,
    driver.user_id,
    fixture.reason::public.delay_reason,
    'DEMO: ' || fixture.description,
    fixture.minutes,
    (fixture.service_date + time '15:20') at time zone 'Africa/Harare'
  from (values
    ('GF-DELAY-001', 'A', date '2026-10-29', 12, 'traffic', 'Traffic was slower than usual near Borrowdale Road.'),
    ('GF-DELAY-002', 'B', date '2026-11-03', 8, 'weather', 'Heavy rain reduced visibility around Mount Pleasant.'),
    ('GF-DELAY-003', 'C', date '2026-11-10', 15, 'road_closure', 'A temporary road closure required a short diversion.'),
    ('GF-DELAY-004', 'A', date '2026-11-18', 6, 'traffic', 'Traffic at the school approach added a short delay.')
  ) as fixture(reference,route_code,service_date,minutes,reason,description)
  join public.transport_routes r on r.school_id = v_school_id and r.code = fixture.route_code
  join public.route_schedules rs on rs.school_id = v_school_id and rs.route_id = r.id
    and rs.direction = 'from_school' and rs.active
  join public.trips t on t.school_id = v_school_id and t.schedule_id = rs.id
    and t.service_date = fixture.service_date and t.status = 'completed'
  join public.staff_members driver on driver.id = t.driver_id
  on conflict (id) do nothing;

  select count(*) into v_trip_count from public.trips
  where school_id = v_school_id and generation_key like 'greenfield-history:%';
  select count(*) into v_trip_child_count
  from public.trip_children tc join public.trips t on t.id = tc.trip_id and t.school_id = tc.school_id
  where tc.school_id = v_school_id and t.generation_key like 'greenfield-history:%';
  select count(*) into v_invoice_count from public.invoices
  where school_id = v_school_id and invoice_number like 'GF-2026-T4-%';
  select count(*) into v_payment_count from public.payments
  where school_id = v_school_id and idempotency_key like 'greenfield-demo-payment:%';
  select count(*) into v_receipt_count from public.receipts r
  join public.payments p on p.id = r.payment_id and p.school_id = r.school_id
  where r.school_id = v_school_id and p.idempotency_key like 'greenfield-demo-payment:%';
  select count(*) into v_incident_count from public.incidents
  where school_id = v_school_id and title in ('Minor delay at Borrowdale Road', 'Vehicle door inspection');
  select count(*) into v_delay_count from public.delay_reports
  where school_id = v_school_id and description like 'DEMO:%';

  if v_trip_count <> 120 or v_trip_child_count <> 2560
     or v_invoice_count <> 64 or v_payment_count <> 32
     or v_receipt_count <> 32 or v_incident_count <> 2 or v_delay_count <> 4 then
    raise exception using errcode = '23514', message = 'GREENFIELD_DEMO_HISTORY_VERIFICATION_FAILED';
  end if;

  return jsonb_build_object(
    'trips', v_trip_count,
    'tripChildren', v_trip_child_count,
    'invoices', v_invoice_count,
    'simulatedPayments', v_payment_count,
    'receipts', v_receipt_count,
    'resolvedIncidents', v_incident_count,
    'delayReports', v_delay_count
  );
end;
$function$;

revoke all on function public.seed_greenfield_demo_history() from public, anon, authenticated;
grant execute on function public.seed_greenfield_demo_history() to service_role;
