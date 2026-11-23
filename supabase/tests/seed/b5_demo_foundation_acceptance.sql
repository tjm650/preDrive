-- B5.1 Greenfield demo foundation acceptance.
-- Read-only: run after explicitly applying supabase/seed.sql to a development target.

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from public.schools where is_demo = true) <> 1 then
    raise exception 'B5.1: expected exactly one demo school';
  end if;

  if not exists (
    select 1 from public.schools
    where id = v_school_id
      and is_demo = true
      and status = 'active'
      and name = 'Greenfield Early Learning Centre'
      and timezone = 'Africa/Harare'
      and address = 'Borrowdale, Harare, Zimbabwe'
  ) then
    raise exception 'B5.1: canonical Greenfield demo school is missing or incorrect';
  end if;

  if (select count(*) from public.class_groups where school_id = v_school_id and active) <> 3 then
    raise exception 'B5.1: expected three active class groups';
  end if;

  if (select count(*) from public.buses where school_id = v_school_id and status = 'active') <> 3 then
    raise exception 'B5.1: expected three active demo buses';
  end if;

  if (select count(*) from public.transport_routes where school_id = v_school_id and status = 'active') <> 3 then
    raise exception 'B5.1: expected three active demo routes';
  end if;

  if (select count(*) from public.route_stops where school_id = v_school_id and active) <> 15 then
    raise exception 'B5.1: expected fifteen active route stops';
  end if;

  if exists (
    select 1
    from public.transport_routes r
    left join public.route_stops s
      on s.school_id = r.school_id and s.route_id = r.id and s.active
    where r.school_id = v_school_id
    group by r.id
    having count(s.id) <> 5
  ) then
    raise exception 'B5.1: every demo route must have exactly five active stops';
  end if;

  if exists (
    select 1
    from public.route_stops
    where school_id = v_school_id
      and (location is null or pickup_radius_meters not in (500, 1000, 2000))
  ) then
    raise exception 'B5.1: route stop geography or pickup radius is invalid';
  end if;

  if (select count(*) from public.fee_items where school_id = v_school_id and active and currency = 'USD' and billing_period = 'term') <> 4 then
    raise exception 'B5.1: expected four active USD term fee items';
  end if;

  if (select count(*) from public.settings where school_id = v_school_id) <> 6 then
    raise exception 'B5.1: expected six approved school settings';
  end if;

  if not exists (
    select 1 from public.settings
    where school_id = v_school_id
      and setting_key = 'guardian_location_visibility'
      and setting_value = '"active_trip_only"'::jsonb
  ) then
    raise exception 'B5.1: guardian active-trip-only location setting missing';
  end if;

end;
$$;

select
  (select count(*) from public.schools where is_demo = true) as demo_schools,
  (select count(*) from public.class_groups where school_id = '10000000-0000-4000-8000-000000000001') as classes,
  (select count(*) from public.buses where school_id = '10000000-0000-4000-8000-000000000001') as buses,
  (select count(*) from public.transport_routes where school_id = '10000000-0000-4000-8000-000000000001') as routes,
  (select count(*) from public.route_stops where school_id = '10000000-0000-4000-8000-000000000001') as stops,
  (select count(*) from public.fee_items where school_id = '10000000-0000-4000-8000-000000000001') as fee_items,
  (select count(*) from public.settings where school_id = '10000000-0000-4000-8000-000000000001') as settings;
