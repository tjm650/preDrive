-- Tighten personal-data visibility after reviewing the initial policies.
-- Only the account owner and an administrator in the same school can read a profile.
-- Guardian accounts cannot browse staff phone numbers.

drop policy profiles_select_self_or_school_colleague on public.profiles;

create or replace function private.can_admin_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships as target_membership
    where target_membership.user_id = p_profile_id
      and target_membership.active
      and private.has_school_role(
        target_membership.school_id,
        array['school_admin']::public.user_role[]
      )
  );
$$;

revoke all on function private.can_admin_view_profile(uuid) from public, anon;
grant execute on function private.can_admin_view_profile(uuid) to authenticated;

create policy profiles_select_self_or_school_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.can_admin_view_profile(id)
);

drop function private.can_view_profile(uuid);

drop policy staff_members_select_school_member on public.staff_members;

create policy staff_members_select_school_operations
on public.staff_members
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin', 'supervisor', 'driver']::public.user_role[]
  )
);
