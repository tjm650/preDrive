-- preDrive B2.3: guardian/child relationship isolation.
-- Additive migration for the existing development database. No records are
-- inserted, updated or deleted. No Auth, Storage or migration-ledger reset occurs.
--
-- Guardian access is derived from auth.uid(), an active guardian membership,
-- and an active guardian_children link. School admins and teaching/supervisory
-- staff retain school-scoped operational read access. Direct child/link writes
-- remain restricted to school administrators; privileged workflows can use
-- trusted Edge Functions with service_role as required by the product brief.

alter table public.children enable row level security;
alter table public.guardian_children enable row level security;

-- Children: guardians can read only children linked to their own active account.
-- School administrators, teachers and supervisors can read children in their
-- own active school. Only school administrators can mutate child records.
drop policy if exists children_select_linked_guardian_or_school_staff on public.children;
create policy children_select_linked_guardian_or_school_staff
on public.children
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin', 'teacher', 'supervisor']::public.user_role[]
  )
  or exists (
    select 1
    from public.guardian_children as guardian_link
    where guardian_link.school_id = children.school_id
      and guardian_link.child_id = children.id
      and guardian_link.guardian_user_id = (select auth.uid())
      and guardian_link.active = true
      and private.has_school_role(
        guardian_link.school_id,
        array['guardian']::public.user_role[]
      )
  )
);

drop policy if exists children_insert_school_admin on public.children;
create policy children_insert_school_admin
on public.children
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists children_update_school_admin on public.children;
create policy children_update_school_admin
on public.children
for update
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
)
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists children_delete_school_admin on public.children;
create policy children_delete_school_admin
on public.children
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

-- Guardian-child links: a guardian can read only their own active links.
-- School admins and school staff can read links for operational purposes.
-- Only school administrators can create, change or remove relationships.
drop policy if exists guardian_children_select_self_or_school_staff on public.guardian_children;
create policy guardian_children_select_self_or_school_staff
on public.guardian_children
for select
to authenticated
using (
  (
    guardian_user_id = (select auth.uid())
    and active = true
    and private.has_school_role(
      school_id,
      array['guardian']::public.user_role[]
    )
  )
  or private.has_school_role(
    school_id,
    array['school_admin', 'teacher', 'supervisor']::public.user_role[]
  )
);

drop policy if exists guardian_children_insert_school_admin on public.guardian_children;
create policy guardian_children_insert_school_admin
on public.guardian_children
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists guardian_children_update_school_admin on public.guardian_children;
create policy guardian_children_update_school_admin
on public.guardian_children
for update
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
)
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists guardian_children_delete_school_admin on public.guardian_children;
create policy guardian_children_delete_school_admin
on public.guardian_children
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

-- A guardian may read the class label associated with their linked child,
-- without gaining visibility into unrelated classes in the same school.
drop policy if exists class_groups_select_linked_guardian on public.class_groups;
create policy class_groups_select_linked_guardian
on public.class_groups
for select
to authenticated
using (
  exists (
    select 1
    from public.children as child
    join public.guardian_children as guardian_link
      on guardian_link.school_id = child.school_id
     and guardian_link.child_id = child.id
    where child.school_id = class_groups.school_id
      and child.class_group_id = class_groups.id
      and guardian_link.guardian_user_id = (select auth.uid())
      and guardian_link.active = true
      and private.has_school_role(
        guardian_link.school_id,
        array['guardian']::public.user_role[]
      )
  )
);

-- PostgREST needs table privileges before RLS can filter the rows. Grant only
-- SELECT here; no authenticated direct write privilege is introduced.
revoke all on table public.children, public.guardian_children from anon, authenticated;
grant select on table public.children, public.guardian_children to authenticated;

comment on table public.children is
  'School-owned child records. Guardians may select only children linked to their active guardian membership; school staff access is school-scoped.';
comment on table public.guardian_children is
  'School-owned guardian-child relationships. Guardians may select only their own active links; school staff access is school-scoped.';
