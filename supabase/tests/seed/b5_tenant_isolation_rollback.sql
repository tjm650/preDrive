-- B5.5 rollback-only RLS tenant-isolation test.
-- Requires the Greenfield operational seed. All temporary rows are rolled back.
-- The guardian remains an active member of both schools to test child-level isolation,
-- not merely the absence of a school membership.

begin;

do $$
declare
  v_school_id constant uuid := '10000000-0000-4000-8000-000000000001';
  v_other_school_id constant uuid := '20000000-0000-4000-8000-000000000001';
  v_guardian_id uuid;
begin
  select p.id into v_guardian_id
  from public.profiles p
  where lower(p.email) = 'guardian.household.32@greenfield.predrive-demo.invalid';
  if v_guardian_id is null then
    raise exception 'B5.5: supporting guardian fixture identity is missing';
  end if;

  if not exists (
    select 1 from public.school_memberships
    where school_id = v_school_id and user_id = v_guardian_id
      and role = 'guardian' and active
  ) then
    raise exception 'B5.5: guardian must retain active Greenfield membership';
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

  insert into public.school_memberships (school_id, user_id, role, active)
  values (v_other_school_id, v_guardian_id, 'guardian', true);

  insert into public.guardian_children (
    school_id, guardian_user_id, child_id, relationship, primary_contact, active
  ) values (
    v_other_school_id, v_guardian_id,
    '20000000-0000-4000-8000-000000000201',
    'parent', true, true
  );
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
  v_greenfield_linked integer;
  v_other_visible integer;
begin
  select count(*) into v_greenfield_visible
  from public.children
  where school_id = '10000000-0000-4000-8000-000000000001';

  select count(*) into v_greenfield_linked
  from public.guardian_children
  where school_id = '10000000-0000-4000-8000-000000000001'
    and active;

  select count(*) into v_other_visible
  from public.children
  where school_id = '20000000-0000-4000-8000-000000000001';

  if v_greenfield_visible <> v_greenfield_linked
     or v_greenfield_visible >= 64
     or v_other_visible <> 1 then
    raise exception 'B5.5: guardian RLS did not restrict visibility to linked children in each active tenant';
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
