-- B5.2 Greenfield demo Auth acceptance.
-- Read-only: run only after B5.1 seed.sql and scripts/seed-auth-users.ts complete.

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_expected_emails text[] := array[
    'admin@greenfield.predrive-demo.invalid',
    'chipo.moyo@greenfield.predrive-demo.invalid',
    'supervisor.route-a@greenfield.predrive-demo.invalid',
    'driver.route-a@greenfield.predrive-demo.invalid',
    'teacher.sunbeams@greenfield.predrive-demo.invalid'
  ];
begin
  if (
    select count(*)
    from auth.users
    where lower(email) = any(v_expected_emails)
      and raw_app_meta_data ->> 'predrive_demo_seed' = 'greenfield-demo-v1'
      and email_confirmed_at is not null
  ) <> 5 then
    raise exception 'B5.2: expected five confirmed Auth users with the canonical seed marker';
  end if;

  if (
    select count(*)
    from public.profiles
    where lower(email) = any(v_expected_emails)
  ) <> 5 then
    raise exception 'B5.2: expected five matching profiles';
  end if;

  if (
    select count(*)
    from public.school_memberships m
    join public.profiles p on p.id = m.user_id
    where m.school_id = v_school_id
      and lower(p.email) = any(v_expected_emails)
      and m.active
  ) <> 5 then
    raise exception 'B5.2: expected five active Greenfield memberships';
  end if;

  if exists (
    select 1
    from (
      values
        ('admin@greenfield.predrive-demo.invalid', 'school_admin'::public.user_role, 'en'),
        ('chipo.moyo@greenfield.predrive-demo.invalid', 'guardian'::public.user_role, 'sn'),
        ('supervisor.route-a@greenfield.predrive-demo.invalid', 'supervisor'::public.user_role, 'en'),
        ('driver.route-a@greenfield.predrive-demo.invalid', 'driver'::public.user_role, 'en'),
        ('teacher.sunbeams@greenfield.predrive-demo.invalid', 'teacher'::public.user_role, 'nd')
    ) as expected(email, role, language)
    left join public.profiles p on lower(p.email) = expected.email
    left join public.school_memberships m
      on m.user_id = p.id
     and m.school_id = v_school_id
    where p.id is null
       or p.language <> expected.language
       or m.id is null
       or m.role <> expected.role
       or not m.active
  ) then
    raise exception 'B5.2: a demo profile language or school role does not match the canonical fixture';
  end if;

  if (
    select count(*)
    from public.staff_members s
    join public.profiles p on p.id = s.user_id
    where s.school_id = v_school_id
      and lower(p.email) = any(v_expected_emails)
      and s.active
  ) <> 3 then
    raise exception 'B5.2: expected three active staff records for supervisor, driver and teacher';
  end if;

  if exists (
    select 1
    from public.staff_members s
    join public.profiles p on p.id = s.user_id
    where s.school_id = v_school_id
      and lower(p.email) = any(v_expected_emails)
      and (
        s.role not in ('supervisor', 'driver', 'teacher')
        or s.full_name <> p.full_name
        or s.phone <> p.phone
        or not s.active
      )
  ) then
    raise exception 'B5.2: staff role, name, phone or active state is inconsistent';
  end if;

  if exists (
    select 1
    from public.school_memberships m
    join public.profiles p on p.id = m.user_id
    where lower(p.email) = any(v_expected_emails)
      and m.school_id <> v_school_id
  ) then
    raise exception 'B5.2: a reserved demo identity is linked to a non-demo school';
  end if;
end;
$$;

select
  (select count(*) from auth.users where raw_app_meta_data ->> 'predrive_demo_seed' = 'greenfield-demo-v1') as marked_auth_users,
  (select count(*) from public.profiles where lower(email) like '%@greenfield.predrive-demo.invalid') as profiles,
  (select count(*) from public.school_memberships where school_id = '10000000-0000-4000-8000-000000000001') as memberships,
  (select count(*) from public.staff_members where school_id = '10000000-0000-4000-8000-000000000001') as staff_members;
