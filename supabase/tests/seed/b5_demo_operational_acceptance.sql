-- B5.3 Greenfield household, transport and collector acceptance.
-- Read-only: run only after the authenticated operational seed has completed.
-- No PIN hashes, collector PINs or Auth credentials are selected.

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from public.children where school_id = v_school_id and status = 'active') <> 64 then
    raise exception 'B5.3: expected exactly 64 active Greenfield children';
  end if;

  if exists (
    select 1 from public.class_groups g
    left join public.children c on c.school_id = g.school_id and c.class_group_id = g.id and c.status = 'active'
    where g.school_id = v_school_id
    group by g.id, g.name
    having
      (g.name = 'Sunbeams' and count(c.id) <> 22) or
      (g.name = 'Little Stars' and count(c.id) <> 21) or
      (g.name = 'Explorers' and count(c.id) <> 21)
  ) then
    raise exception 'B5.3: child class distribution must be 22/21/21';
  end if;

  if (
    select count(*)
    from public.guardian_children gc
    join public.children c on c.id = gc.child_id and c.school_id = gc.school_id
    where gc.school_id = v_school_id and gc.active and c.status = 'active'
  ) <> 64 then
    raise exception 'B5.3: expected one active guardian link for every active child';
  end if;

  if (
    select count(distinct gc.guardian_user_id)
    from public.guardian_children gc
    where gc.school_id = v_school_id and gc.active
  ) <> 32 then
    raise exception 'B5.3: expected 32 active guardian household identities';
  end if;

  if (
    select count(*)
    from public.guardian_children gc
    join public.profiles p on p.id = gc.guardian_user_id
    join public.children c on c.id = gc.child_id and c.school_id = gc.school_id
    where gc.school_id = v_school_id
      and lower(p.email) = 'chipo.moyo@greenfield.predrive-demo.invalid'
      and c.first_name in ('Tendai', 'Tadiwa')
      and c.last_name = 'Moyo'
      and gc.active
      and gc.relationship = 'parent'
      and gc.primary_contact
  ) <> 2 then
    raise exception 'B5.3: Chipo Moyo must be the primary guardian for Tendai and Tadiwa Moyo';
  end if;

  if exists (
    select 1
    from public.children c
    left join public.child_route_assignments a
      on a.school_id = c.school_id and a.child_id = c.id and a.active
    left join public.route_stops s
      on s.id = a.route_stop_id and s.school_id = a.school_id and s.route_id = a.route_id and s.active
    where c.school_id = v_school_id and c.status = 'active'
    group by c.id
    having count(a.id) <> 1 or count(s.id) <> 1
  ) then
    raise exception 'B5.3: every active child must have exactly one active, valid route-stop assignment';
  end if;

  if exists (
    select 1
    from public.transport_routes r
    join public.buses b on b.id = r.assigned_bus_id and b.school_id = r.school_id
    join public.child_route_assignments a on a.route_id = r.id and a.school_id = r.school_id and a.active
    where r.school_id = v_school_id
    group by r.id, b.capacity
    having count(a.child_id) > b.capacity
  ) then
    raise exception 'B5.3: a route has more assigned children than its bus capacity';
  end if;

  if (
    select count(*)
    from public.approved_collectors ac
    join public.children c on c.id = ac.child_id and c.school_id = ac.school_id
    where ac.school_id = v_school_id and ac.active and c.status = 'active'
  ) <> 128 then
    raise exception 'B5.3: expected exactly two active approved collectors per child';
  end if;

  if exists (
    select 1
    from public.approved_collectors ac
    where ac.school_id = v_school_id
      and (char_length(ac.pin_hash) not between 40 and 100 or ac.pin_hash ~ '^[0-9]{4,8}$')
  ) then
    raise exception 'B5.3: collector PIN storage must contain only password hashes';
  end if;

  if (
    select count(*)
    from public.staff_members s
    where s.school_id = v_school_id and s.active and s.role = 'supervisor'
  ) <> 3 or (
    select count(*)
    from public.staff_members s
    where s.school_id = v_school_id and s.active and s.role = 'driver'
  ) <> 3 or (
    select count(*)
    from public.staff_members s
    where s.school_id = v_school_id and s.active and s.role = 'teacher'
  ) <> 6 then
    raise exception 'B5.3: expected 3 supervisors, 3 drivers and 6 teachers';
  end if;

  if (
    select count(*)
    from public.route_schedules rs
    join public.staff_members d on d.id = rs.driver_id and d.school_id = rs.school_id and d.role = 'driver' and d.active
    join public.staff_members s on s.id = rs.supervisor_id and s.school_id = rs.school_id and s.role = 'supervisor' and s.active
    where rs.school_id = v_school_id and rs.active
  ) <> 6 then
    raise exception 'B5.3: expected six active weekday schedules with valid driver and supervisor assignments';
  end if;

  if exists (
    select 1
    from public.school_memberships m
    join public.profiles p on p.id = m.user_id
    where lower(p.email) like '%@greenfield.predrive-demo.invalid'
      and m.school_id <> v_school_id
  ) then
    raise exception 'B5.3: a reserved Greenfield fixture identity is linked to another school';
  end if;
end;
$$;

select
  (select count(*) from public.children where school_id = '10000000-0000-4000-8000-000000000001') as children,
  (select count(distinct guardian_user_id) from public.guardian_children where school_id = '10000000-0000-4000-8000-000000000001' and active) as guardian_households,
  (select count(*) from public.approved_collectors where school_id = '10000000-0000-4000-8000-000000000001' and active) as approved_collectors,
  (select count(*) from public.staff_members where school_id = '10000000-0000-4000-8000-000000000001' and active) as staff_members,
  (select count(*) from public.route_schedules where school_id = '10000000-0000-4000-8000-000000000001' and active) as route_schedules;
