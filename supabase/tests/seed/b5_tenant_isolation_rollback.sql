-- B5.5 rollback-only RLS tenant-isolation test.
-- Requires the Greenfield operational seed. All temporary rows are rolled back.
-- This script writes only inside a transaction and must be reviewed before execution.

begin;

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_other_school_id constant uuid := '20000000-0000-4000-8000-000000000001';
  v_guardian_id uuid;
  v_admin_id uuid;
begin
  select p.id into v_guardian_id
  from public.profiles p
  where lower(p.email) = 'guardian.household.32@greenfield.predrive-demo.invalid';
  if v_guardian_id is null then
    raise exception 'B5.5: supporting guardian fixture identity is missing';
  end if;

  select p.id into v_admin_id
  from public.profiles p
  where lower(p.email) = 'admin@greenfield.predrive-demo.invalid';
  if v_admin_id is null then
    raise exception 'B5.5: primary admin fixture identity is missing';
  end if;

  insert into public.schools (
    id, name, status, address, timezone, indicative_zig_per_usd, is_demo
  ) values (
    v_other_school_id, 'Isolation Test School', 'active',
    'Test address, Harare, Zimbabwe', 'Africa/Harare', 27.00, false
  );

  insert into public.class_groups (id, school_id, name, age_range_label, active)
  values (
    '20000000-0000-4000-8000-000000000101',
    v_other_school_id, 'Isolation Class', '3–4 years', true
  );

  insert into public.children (
    id, school_id, class_group_id, first_name, last_name, date_of_birth
  ) values (
    '20000000-0000-4000-8000-000000000201',
    v_other_school_id,
    '20000000-0000-4000-8000-000000000101',
    'Test', 'Pupil', date '2022-06-15'
  );

  update public.school_memberships
  set active = false, updated_at = now()
  where school_id = v_school_id and user_id = v_guardian_id and role = 'guardian';

  insert into public.school_memberships (school_id, user_id, role, active)
  values (v_other_school_id, v_guardian_id, 'guardian', true);
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where lower(email) = 'guardian.household.32@greenfield.predrive-demo.invalid'),
  true
);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id::text from public.profiles where lower(email) = 'guardian.household.32@greenfield.predrive-demo.invalid'),
  'role', 'authenticated'
)::text, true);
set local role authenticated;

do $$
declare
  v_greenfield_visible integer;
  v_other_visible integer;
begin
  select count(*) into v_greenfield_visible
  from public.children
  where school_id = '10000000-0000-4000-8000-000000000001';

  select count(*) into v_other_visible
  from public.children
  where school_id = '20000000-0000-4000-8000-000000000001';

  if v_greenfield_visible <> 0 or v_other_visible <> 1 then
    raise exception 'B5.5: guardian RLS did not isolate the two school tenants';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claim.sub',
  (select id::text from public.profiles where lower(email) = 'admin@greenfield.predrive-demo.invalid'),
  true
);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id::text from public.profiles where lower(email) = 'admin@greenfield.predrive-demo.invalid'),
  'role', 'authenticated'
)::text, true);
set local role authenticated;

do $$
declare
  v_greenfield_visible integer;
  v_other_visible integer;
begin
  select count(*) into v_greenfield_visible
  from public.children
  where school_id = '10000000-0000-4000-8000-000000000001';

  select count(*) into v_other_visible
  from public.children
  where school_id = '20000000-0000-4000-8000-000000000001';

  if v_greenfield_visible <> 64 or v_other_visible <> 0 then
    raise exception 'B5.5: school administrator RLS crossed the tenant boundary';
  end if;
end;
$$;

reset role;
rollback;
