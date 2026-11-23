-- preDrive deterministic Greenfield demo foundation.
--
-- Safe to run repeatedly against a development database:
--   * refuses to proceed if another school already owns the single demo slot;
--   * uses fixed IDs and school-scoped upserts;
--   * never deletes rows, Auth users, secrets, or customer-school data;
--   * creates only the demo school, classes, buses, routes, route stops,
--     fee catalogue, and approved school settings.
--
-- Auth users, profiles, memberships, children, trips, invoices, and history
-- are added by later B5 seed stages after their dependencies are verified.
--
-- The 27.00 ZiG/USD value is an illustrative demo rate, not a live FX quote.

begin;

do $guard$
declare
  v_demo_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  if exists (
    select 1
    from public.schools
    where is_demo = true
      and id <> v_demo_school_id
  ) then
    raise exception
      'A different demo school already exists. Refusing to overwrite the single-demo tenant.';
  end if;
end;
$guard$;

insert into public.schools (
  id,
  name,
  status,
  address,
  timezone,
  indicative_zig_per_usd,
  is_demo
)
values (
  '10000000-0000-4000-8000-000000000001',
  'Greenfield Early Learning Centre',
  'active',
  'Borrowdale, Harare, Zimbabwe',
  'Africa/Harare',
  27.00,
  true
)
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  address = excluded.address,
  timezone = excluded.timezone,
  indicative_zig_per_usd = excluded.indicative_zig_per_usd,
  is_demo = true,
  updated_at = now()
where public.schools.is_demo = true;

-- Classes
insert into public.class_groups (id, school_id, name, age_range_label, active)
values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'Sunbeams', '2–3 years', true),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000001', 'Little Stars', '3–4 years', true),
  ('10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000001', 'Explorers', '4–6 years', true)
on conflict (id) do update
set
  name = excluded.name,
  age_range_label = excluded.age_range_label,
  active = excluded.active,
  updated_at = now()
where public.class_groups.school_id = excluded.school_id;

-- Fleet: Zimbabwean registration format; no real GPS device identifiers.
insert into public.buses (
  id, school_id, registration_number, make, model, capacity, status
)
values
  ('10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000001', 'AGH 4521', 'Toyota', 'Coaster', 28, 'active'),
  ('10000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000001', 'AFR 3186', 'Nissan', 'Civilian', 24, 'active'),
  ('10000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000001', 'AEX 9074', 'Toyota', 'Hiace', 18, 'active')
on conflict (id) do update
set
  registration_number = excluded.registration_number,
  make = excluded.make,
  model = excluded.model,
  capacity = excluded.capacity,
  status = excluded.status,
  updated_at = now()
where public.buses.school_id = excluded.school_id;

-- Route definitions
insert into public.transport_routes (
  id, school_id, name, code, status, assigned_bus_id, estimated_duration_minutes
)
values
  ('10000000-0000-4000-8000-000000000301', '10000000-0000-4000-8000-000000000001', 'Borrowdale–Avondale', 'A', 'active', '10000000-0000-4000-8000-000000000201', 55),
  ('10000000-0000-4000-8000-000000000302', '10000000-0000-4000-8000-000000000001', 'Mount Pleasant–Highlands', 'B', 'active', '10000000-0000-4000-8000-000000000202', 60),
  ('10000000-0000-4000-8000-000000000303', '10000000-0000-4000-8000-000000000001', 'Mabelreign–Greendale', 'C', 'active', '10000000-0000-4000-8000-000000000203', 65)
on conflict (id) do update
set
  name = excluded.name,
  code = excluded.code,
  status = excluded.status,
  assigned_bus_id = excluded.assigned_bus_id,
  estimated_duration_minutes = excluded.estimated_duration_minutes,
  updated_at = now()
where public.transport_routes.school_id = excluded.school_id;

-- Fifteen realistic suburb stops. Coordinates are approximate demo map points,
-- not surveyed pickup-gate coordinates. Each stop is intentionally labelled
-- for demo use and can be refined by the school before operational use.
insert into public.route_stops (
  id, school_id, route_id, name, address, stop_order,
  location, pickup_radius_meters, active
)
values
  -- Route A: Borrowdale to Avondale
  ('10000000-0000-4000-8000-000000000401', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000301', 'Borrowdale Village', 'Borrowdale Road, Borrowdale, Harare, Zimbabwe', 1, st_setsrid(st_makepoint(31.0888, -17.7556), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000402', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000301', 'Sam Levy’s Village', 'Borrowdale Road, Borrowdale, Harare, Zimbabwe', 2, st_setsrid(st_makepoint(31.0972, -17.7650), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000403', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000301', 'Chisipite Shops', 'Enterprise Road, Chisipite, Harare, Zimbabwe', 3, st_setsrid(st_makepoint(31.0902, -17.7892), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000404', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000301', 'Alexandra Park', 'King George Road, Alexandra Park, Harare, Zimbabwe', 4, st_setsrid(st_makepoint(31.0447, -17.7898), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000405', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000301', 'Avondale Shopping Centre', 'King George Road, Avondale, Harare, Zimbabwe', 5, st_setsrid(st_makepoint(31.0368, -17.7870), 4326)::geography, 500, true),

  -- Route B: Mount Pleasant to Highlands
  ('10000000-0000-4000-8000-000000000411', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000302', 'Mount Pleasant Shops', 'Sam Nujoma Street, Mount Pleasant, Harare, Zimbabwe', 1, st_setsrid(st_makepoint(31.0356, -17.7775), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000412', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000302', 'University of Zimbabwe', 'Churchill Avenue, Mount Pleasant, Harare, Zimbabwe', 2, st_setsrid(st_makepoint(31.0494, -17.7840), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000413', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000302', 'Newlands Shops', 'Newlands Shopping Centre, Newlands, Harare, Zimbabwe', 3, st_setsrid(st_makepoint(31.0750, -17.7974), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000414', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000302', 'Highlands Park', 'Enterprise Road, Highlands, Harare, Zimbabwe', 4, st_setsrid(st_makepoint(31.0858, -17.8052), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000415', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000302', 'Highlands Shopping Centre', 'Robert Mugabe Road, Highlands, Harare, Zimbabwe', 5, st_setsrid(st_makepoint(31.0917, -17.8125), 4326)::geography, 500, true),

  -- Route C: Mabelreign to Greendale
  ('10000000-0000-4000-8000-000000000421', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000303', 'Mabelreign Shopping Centre', 'Quendon Road, Mabelreign, Harare, Zimbabwe', 1, st_setsrid(st_makepoint(30.9694, -17.7906), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000422', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000303', 'Sentosa Shops', 'Sentosa Road, Mabelreign, Harare, Zimbabwe', 2, st_setsrid(st_makepoint(30.9802, -17.8020), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000423', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000303', 'Warren Park Junction', 'High Glen Road, Harare, Zimbabwe', 3, st_setsrid(st_makepoint(30.9955, -17.8295), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000424', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000303', 'Eastlea Shops', 'Robert Mugabe Road, Eastlea, Harare, Zimbabwe', 4, st_setsrid(st_makepoint(31.0750, -17.8310), 4326)::geography, 500, true),
  ('10000000-0000-4000-8000-000000000425', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000303', 'Greendale Shopping Centre', 'Greendale Avenue, Greendale, Harare, Zimbabwe', 5, st_setsrid(st_makepoint(31.1120, -17.8330), 4326)::geography, 500, true)
on conflict (id) do update
set
  route_id = excluded.route_id,
  name = excluded.name,
  address = excluded.address,
  stop_order = excluded.stop_order,
  location = excluded.location,
  pickup_radius_meters = excluded.pickup_radius_meters,
  active = excluded.active,
  updated_at = now()
where public.route_stops.school_id = excluded.school_id;

-- Approved settings only. The FX rate is an illustrative demo value.
insert into public.settings (
  id, school_id, setting_key, setting_value, description
)
values
  ('10000000-0000-4000-8000-000000000601', '10000000-0000-4000-8000-000000000001', 'default_pickup_radius_meters', '1000'::jsonb, 'Default guardian arrival radius for the demo school.'),
  ('10000000-0000-4000-8000-000000000602', '10000000-0000-4000-8000-000000000001', 'indicative_zig_per_usd', '27.00'::jsonb, 'Illustrative demo conversion rate; replace with a school-approved current rate.'),
  ('10000000-0000-4000-8000-000000000603', '10000000-0000-4000-8000-000000000001', 'arrival_notification_lead_minutes', '5'::jsonb, 'Guardian arrival notification lead time.'),
  ('10000000-0000-4000-8000-000000000604', '10000000-0000-4000-8000-000000000001', 'trip_generation_days_ahead', '7'::jsonb, 'Number of days of scheduled trips generated ahead.'),
  ('10000000-0000-4000-8000-000000000605', '10000000-0000-4000-8000-000000000001', 'on_time_tolerance_minutes', '5'::jsonb, 'Illustrative operational tolerance; analytics must use an agreed arrival timestamp.'),
  ('10000000-0000-4000-8000-000000000606', '10000000-0000-4000-8000-000000000001', 'guardian_location_visibility', '"active_trip_only"'::jsonb, 'Guardian bus location is visible only during an active trip.')
on conflict (school_id, setting_key) do update
set
  setting_value = excluded.setting_value,
  description = excluded.description,
  updated_at = now()
where public.settings.school_id = excluded.school_id;

-- USD term fees. ZiG equivalents are derived from the school's indicative rate.
insert into public.fee_items (
  id, school_id, name, description, amount_minor, currency,
  billing_period, active, effective_from
)
values
  ('10000000-0000-4000-8000-000000000501', '10000000-0000-4000-8000-000000000001', 'Tuition', 'Core early-learning programme for one term.', 30000, 'USD', 'term', true, date '2026-01-01'),
  ('10000000-0000-4000-8000-000000000502', '10000000-0000-4000-8000-000000000001', 'Transport', 'School transport service for one term.', 12000, 'USD', 'term', true, date '2026-01-01'),
  ('10000000-0000-4000-8000-000000000503', '10000000-0000-4000-8000-000000000001', 'Meals', 'Daily meals and refreshments for one term.', 9000, 'USD', 'term', true, date '2026-01-01'),
  ('10000000-0000-4000-8000-000000000504', '10000000-0000-4000-8000-000000000001', 'Activity levy', 'Learning materials and supervised activities for one term.', 4500, 'USD', 'term', true, date '2026-01-01')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  amount_minor = excluded.amount_minor,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  active = excluded.active,
  effective_from = excluded.effective_from,
  updated_at = now()
where public.fee_items.school_id = excluded.school_id;

commit;
