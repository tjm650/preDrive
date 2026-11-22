-- preDrive B2.2: school administration and staff metadata access.
-- This migration is additive and safe for the populated development database.
-- It does not change existing rows, memberships, policies on other tables, or
-- the migration history outside the normal migration runner bookkeeping.
--
-- This batch deliberately covers only administrative metadata. Child, guardian,
-- fleet, trip, GPS, safety and finance-record visibility is handled in later
-- dedicated B2 batches with narrower relationship and operational rules.
--
-- Authorization uses the existing, already-applied private.has_school_role()
-- helper. This avoids making B2.2 depend on the not-yet-approved B2.1 migration.

alter table public.class_groups enable row level security;
alter table public.fee_items enable row level security;
alter table public.settings enable row level security;
alter table public.setup_progress enable row level security;

drop policy if exists class_groups_select_school_admin_or_staff on public.class_groups;
create policy class_groups_select_school_admin_or_staff
on public.class_groups
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin', 'teacher', 'supervisor']::public.user_role[]
  )
);

drop policy if exists class_groups_insert_school_admin on public.class_groups;
create policy class_groups_insert_school_admin
on public.class_groups
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists class_groups_update_school_admin on public.class_groups;
create policy class_groups_update_school_admin
on public.class_groups
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

drop policy if exists class_groups_delete_school_admin on public.class_groups;
create policy class_groups_delete_school_admin
on public.class_groups
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists fee_items_select_school_admin on public.fee_items;
create policy fee_items_select_school_admin
on public.fee_items
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists fee_items_insert_school_admin on public.fee_items;
create policy fee_items_insert_school_admin
on public.fee_items
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists fee_items_update_school_admin on public.fee_items;
create policy fee_items_update_school_admin
on public.fee_items
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

drop policy if exists fee_items_delete_school_admin on public.fee_items;
create policy fee_items_delete_school_admin
on public.fee_items
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists settings_select_school_admin on public.settings;
create policy settings_select_school_admin
on public.settings
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists settings_insert_school_admin on public.settings;
create policy settings_insert_school_admin
on public.settings
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists settings_update_school_admin on public.settings;
create policy settings_update_school_admin
on public.settings
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

drop policy if exists settings_delete_school_admin on public.settings;
create policy settings_delete_school_admin
on public.settings
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists setup_progress_select_school_admin on public.setup_progress;
create policy setup_progress_select_school_admin
on public.setup_progress
for select
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists setup_progress_insert_school_admin on public.setup_progress;
create policy setup_progress_insert_school_admin
on public.setup_progress
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

drop policy if exists setup_progress_update_school_admin on public.setup_progress;
create policy setup_progress_update_school_admin
on public.setup_progress
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

drop policy if exists setup_progress_delete_school_admin on public.setup_progress;
create policy setup_progress_delete_school_admin
on public.setup_progress
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['school_admin']::public.user_role[]
  )
);

revoke all on table
  public.class_groups,
  public.fee_items,
  public.settings,
  public.setup_progress
from anon, authenticated;

grant select, insert, update, delete on table
  public.class_groups,
  public.fee_items,
  public.settings,
  public.setup_progress
to authenticated;

comment on table public.class_groups is
  'School-owned class groups. School admins manage records; teachers and supervisors may read class metadata.';
comment on table public.fee_items is
  'School-owned fee catalogue. Direct authenticated access is restricted to active school administrators.';
comment on table public.settings is
  'School-owned settings. Direct authenticated access is restricted to active school administrators.';
comment on table public.setup_progress is
  'School setup progress. Direct authenticated access is restricted to active school administrators.';
