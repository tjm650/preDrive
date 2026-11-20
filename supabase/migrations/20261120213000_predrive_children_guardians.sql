-- preDrive B1.1: child, guardian and approved-collector schema.
-- Extends the existing identity/tenancy foundation; does not reset or recreate it.
-- All application writes remain server-controlled. RLS is enabled now; policies are
-- added in Phase B2 after the complete tenant/role matrix is defined.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'child_status'
  ) then
    create type public.child_status as enum ('active', 'inactive', 'withdrawn');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'collector_relationship'
  ) then
    create type public.collector_relationship as enum (
      'parent', 'guardian', 'relative', 'authorised_caregiver', 'other'
    );
  end if;
end
$$;

-- The tenant root is the school itself. Profiles remain global Auth identities.
alter table public.schools
  add column if not exists is_demo boolean not null default false;

comment on column public.schools.is_demo is
  'True only for the isolated Greenfield Early Learning Centre demo tenant. Real schools must remain false.';

create unique index if not exists schools_single_demo_tenant_uidx
  on public.schools ((is_demo))
  where is_demo = true;

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  age_range_label text not null check (char_length(btrim(age_range_label)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_groups_id_school_key unique (id, school_id),
  constraint class_groups_school_name_key unique (school_id, name)
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  class_group_id uuid not null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 100),
  date_of_birth date not null check (date_of_birth <= current_date),
  status public.child_status not null default 'active',
  profile_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_id_school_key unique (id, school_id),
  constraint children_class_group_school_fkey
    foreign key (class_group_id, school_id)
    references public.class_groups (id, school_id)
    on delete restrict,
  constraint children_profile_image_path_check check (
    profile_image_path is null
    or (
      char_length(profile_image_path) <= 512
      and left(profile_image_path, 1) <> '/'
      and position('..' in profile_image_path) = 0
    )
  )
);

comment on table public.children is
  'School-owned child records. Sensitive child details must never be exposed through broad profile or staff policies.';

create table if not exists public.guardian_children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  guardian_user_id uuid not null,
  child_id uuid not null,
  relationship public.collector_relationship not null,
  primary_contact boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guardian_children_id_school_key unique (id, school_id),
  constraint guardian_children_school_guardian_child_key
    unique (school_id, guardian_user_id, child_id),
  constraint guardian_children_guardian_membership_fkey
    foreign key (school_id, guardian_user_id)
    references public.school_memberships (school_id, user_id)
    on delete cascade,
  constraint guardian_children_child_school_fkey
    foreign key (child_id, school_id)
    references public.children (id, school_id)
    on delete cascade
);

create unique index if not exists guardian_children_one_primary_active_uidx
  on public.guardian_children (school_id, child_id)
  where primary_contact = true and active = true;

create table if not exists public.approved_collectors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  child_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  relationship public.collector_relationship not null,
  phone text not null check (phone ~ '^[+]263[0-9]{9}$'),
  pin_hash text not null check (char_length(pin_hash) between 40 and 100),
  active boolean not null default true,
  pin_failed_attempts smallint not null default 0
    check (pin_failed_attempts between 0 and 3),
  pin_locked_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approved_collectors_id_school_key unique (id, school_id),
  constraint approved_collectors_child_school_fkey
    foreign key (child_id, school_id)
    references public.children (id, school_id)
    on delete cascade,
  constraint approved_collectors_lock_state_check check (
    (pin_failed_attempts < 3 and pin_locked_until is null)
    or (pin_failed_attempts = 3 and pin_locked_until is not null)
  )
);

comment on column public.approved_collectors.pin_hash is
  'One-way pgcrypto crypt() hash only. Never store or log the raw handover PIN.';

comment on column public.approved_collectors.pin_locked_until is
  'Set by the handover verification RPC after three failed PIN attempts.';

-- A guardian link must point to an active guardian membership in the same school.
-- This trigger supplements the composite FK, which enforces tenant consistency.
create or replace function private.assert_guardian_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.school_memberships as membership
    where membership.school_id = new.school_id
      and membership.user_id = new.guardian_user_id
      and membership.role = 'guardian'::public.user_role
      and membership.active = true
  ) then
    raise exception using
      errcode = '23503',
      message = 'GUARDIAN_MEMBERSHIP_REQUIRED';
  end if;

  return new;
end;
$$;

revoke all on function private.assert_guardian_membership() from public, anon, authenticated, service_role;

drop trigger if exists guardian_children_assert_guardian_membership
  on public.guardian_children;

create trigger guardian_children_assert_guardian_membership
before insert or update of school_id, guardian_user_id
on public.guardian_children
for each row execute function private.assert_guardian_membership();

-- Keep updated_at consistent with the existing identity/tenancy foundation.
drop trigger if exists class_groups_set_updated_at on public.class_groups;
create trigger class_groups_set_updated_at
before update on public.class_groups
for each row execute function private.set_updated_at();

drop trigger if exists children_set_updated_at on public.children;
create trigger children_set_updated_at
before update on public.children
for each row execute function private.set_updated_at();

drop trigger if exists guardian_children_set_updated_at on public.guardian_children;
create trigger guardian_children_set_updated_at
before update on public.guardian_children
for each row execute function private.set_updated_at();

drop trigger if exists approved_collectors_set_updated_at on public.approved_collectors;
create trigger approved_collectors_set_updated_at
before update on public.approved_collectors
for each row execute function private.set_updated_at();

create index if not exists class_groups_school_active_name_idx
  on public.class_groups (school_id, active, name);

create index if not exists children_school_status_name_idx
  on public.children (school_id, status, last_name, first_name);

create index if not exists children_school_class_status_idx
  on public.children (school_id, class_group_id, status);

create index if not exists children_class_group_fkey_idx
  on public.children (class_group_id, school_id);

create index if not exists guardian_children_guardian_active_idx
  on public.guardian_children (school_id, guardian_user_id, active);

create index if not exists guardian_children_child_active_idx
  on public.guardian_children (school_id, child_id, active);

create index if not exists guardian_children_guardian_membership_fkey_idx
  on public.guardian_children (school_id, guardian_user_id);

create index if not exists approved_collectors_child_active_idx
  on public.approved_collectors (school_id, child_id, active, full_name);

create index if not exists approved_collectors_created_by_fkey_idx
  on public.approved_collectors (created_by)
  where created_by is not null;

alter table public.class_groups enable row level security;
alter table public.children enable row level security;
alter table public.guardian_children enable row level security;
alter table public.approved_collectors enable row level security;

revoke all on table
  public.class_groups,
  public.children,
  public.guardian_children,
  public.approved_collectors
from public, anon, authenticated, service_role;

grant all privileges on table
  public.class_groups,
  public.children,
  public.guardian_children,
  public.approved_collectors
to service_role;
