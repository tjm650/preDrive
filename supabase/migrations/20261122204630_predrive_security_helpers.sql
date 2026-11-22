-- preDrive B2.1: authenticated tenant and relationship helpers.
-- These functions are private authorization primitives for the RLS policies added
-- in B2.2-B2.4. They intentionally return only booleans or the caller's own
-- active school IDs; they never trust client-supplied role or school claims.
--
-- SECURITY DEFINER is required because the source membership/link tables are
-- themselves protected by RLS. Every function has an empty search_path and uses
-- schema-qualified object references. EXECUTE is limited to authenticated users.

create or replace function private.current_school_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(membership.school_id order by membership.school_id),
    '{}'::uuid[]
  )
  from public.school_memberships as membership
  join public.schools as school
    on school.id = membership.school_id
  where membership.user_id = (select auth.uid())
    and membership.active = true
    and school.status <> 'suspended';
$$;

create or replace function private.is_school_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships as membership
    join public.schools as school
      on school.id = membership.school_id
    where membership.school_id = p_school_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
      and school.status <> 'suspended'
  );
$$;

create or replace function private.has_role(
  p_school_id uuid,
  p_role public.user_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships as membership
    join public.schools as school
      on school.id = membership.school_id
    where membership.school_id = p_school_id
      and membership.user_id = (select auth.uid())
      and membership.role = p_role
      and membership.active = true
      and school.status <> 'suspended'
  );
$$;

create or replace function private.is_guardian_of(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_children as guardian_link
    join public.school_memberships as membership
      on membership.school_id = guardian_link.school_id
     and membership.user_id = guardian_link.guardian_user_id
    join public.schools as school
      on school.id = guardian_link.school_id
    where guardian_link.child_id = p_child_id
      and guardian_link.guardian_user_id = (select auth.uid())
      and guardian_link.active = true
      and membership.role = 'guardian'::public.user_role
      and membership.active = true
      and school.status <> 'suspended'
  );
$$;

create or replace function private.is_assigned_to_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trips as trip
    join public.staff_members as staff
      on staff.school_id = trip.school_id
     and (
       (staff.id = trip.driver_id and staff.role = 'driver'::public.user_role)
       or
       (staff.id = trip.supervisor_id and staff.role = 'supervisor'::public.user_role)
     )
    join public.school_memberships as membership
      on membership.school_id = staff.school_id
     and membership.user_id = staff.user_id
     and membership.role = staff.role
    join public.schools as school
      on school.id = trip.school_id
    where trip.id = p_trip_id
      and staff.user_id = (select auth.uid())
      and staff.active = true
      and membership.active = true
      and school.status <> 'suspended'
  );
$$;

create or replace function private.is_demo_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schools as school
    join public.school_memberships as membership
      on membership.school_id = school.id
    where school.id = p_school_id
      and school.is_demo = true
      and school.status <> 'suspended'
      and membership.user_id = (select auth.uid())
      and membership.active = true
  );
$$;

revoke all on function private.current_school_ids() from public, anon, authenticated;
revoke all on function private.is_school_member(uuid) from public, anon, authenticated;
revoke all on function private.has_role(uuid, public.user_role) from public, anon, authenticated;
revoke all on function private.is_guardian_of(uuid) from public, anon, authenticated;
revoke all on function private.is_assigned_to_trip(uuid) from public, anon, authenticated;
revoke all on function private.is_demo_school(uuid) from public, anon, authenticated;

grant execute on function private.current_school_ids() to authenticated;
grant execute on function private.is_school_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.user_role) to authenticated;
grant execute on function private.is_guardian_of(uuid) to authenticated;
grant execute on function private.is_assigned_to_trip(uuid) to authenticated;
grant execute on function private.is_demo_school(uuid) to authenticated;

comment on function private.current_school_ids() is
  'Active, non-suspended school IDs belonging to auth.uid(); intended for tenant RLS policies.';
comment on function private.is_school_member(uuid) is
  'True only when auth.uid() has an active membership in the specified non-suspended school.';
comment on function private.has_role(uuid, public.user_role) is
  'True only when auth.uid() has the specified active role in the specified non-suspended school.';
comment on function private.is_guardian_of(uuid) is
  'True only for an active guardian-child link owned by auth.uid() in a non-suspended school.';
comment on function private.is_assigned_to_trip(uuid) is
  'True only when auth.uid() is the active assigned driver or supervisor for the trip.';
comment on function private.is_demo_school(uuid) is
  'True only when auth.uid() has an active membership in the specified demo school.';
