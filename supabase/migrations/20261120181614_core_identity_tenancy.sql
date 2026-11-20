-- Core identity and school-tenancy foundation.
-- All school-owned records use school_id. The schools table is the tenant root;
-- profiles are global identities linked to Supabase Auth.

create schema if not exists private;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;

create type public.user_role as enum (
  'school_admin',
  'guardian',
  'supervisor',
  'driver',
  'teacher'
);

create type public.school_status as enum ('pending', 'active', 'suspended');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  status public.school_status not null default 'pending',
  address text not null check (char_length(btrim(address)) between 2 and 500),
  timezone text not null default 'Africa/Harare' check (timezone = 'Africa/Harare'),
  indicative_zig_per_usd numeric(14, 4) not null check (indicative_zig_per_usd > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.schools is
  'Tenant root. The school primary key is the tenant identifier; every dependent school-owned record carries school_id.';

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  language text not null default 'en' check (language in ('en', 'sn', 'nd')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_uidx
  on public.profiles (lower(email))
  where email is not null and btrim(email) <> '';

create table public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_memberships_school_user_key unique (school_id, user_id),
  constraint school_memberships_school_user_role_key unique (school_id, user_id, role)
);

create index school_memberships_user_active_idx
  on public.school_memberships (user_id, active, school_id);

create index school_memberships_school_role_active_idx
  on public.school_memberships (school_id, role, active);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  user_id uuid not null,
  role public.user_role not null check (role in ('supervisor', 'driver', 'teacher')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone text not null check (char_length(btrim(phone)) between 7 and 32),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_members_school_user_key unique (school_id, user_id),
  constraint staff_members_membership_fkey
    foreign key (school_id, user_id, role)
    references public.school_memberships (school_id, user_id, role)
    on delete cascade
);

create index staff_members_school_role_active_idx
  on public.staff_members (school_id, role, active);

create table public.school_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  email text not null check (
    email = lower(btrim(email))
    and position('@' in email) > 1
    and char_length(email) <= 254
  ),
  role public.user_role not null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_invitations_expiry_check check (expires_at > created_at),
  constraint school_invitations_acceptance_check check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  )
);

create unique index school_invitations_pending_email_uidx
  on public.school_invitations (school_id, email)
  where status = 'pending';

create index school_invitations_school_status_expiry_idx
  on public.school_invitations (school_id, status, expires_at);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger schools_set_updated_at
before update on public.schools
for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger school_memberships_set_updated_at
before update on public.school_memberships
for each row execute function private.set_updated_at();

create trigger staff_members_set_updated_at
before update on public.staff_members
for each row execute function private.set_updated_at();

create trigger school_invitations_set_updated_at
before update on public.school_invitations
for each row execute function private.set_updated_at();

create or replace function private.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Account holder'
    ),
    new.email,
    new.phone
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = excluded.phone,
        updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_auth_user_profile() from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.sync_auth_user_profile() to supabase_auth_admin;

create trigger on_auth_user_profile_sync
after insert or update of email, phone, raw_user_meta_data
on auth.users
for each row execute function private.sync_auth_user_profile();

create or replace function private.has_school_role(
  p_school_id uuid,
  p_roles public.user_role[] default null
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
    join public.schools as school on school.id = membership.school_id
    where membership.school_id = p_school_id
      and membership.user_id = (select auth.uid())
      and membership.active
      and school.status <> 'suspended'
      and (p_roles is null or membership.role = any (p_roles))
  );
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.school_memberships as viewer
      join public.school_memberships as subject
        on subject.school_id = viewer.school_id
      join public.schools as school
        on school.id = viewer.school_id
      where viewer.user_id = (select auth.uid())
        and viewer.active
        and subject.user_id = p_profile_id
        and subject.active
        and school.status <> 'suspended'
    );
$$;

revoke all on function private.has_school_role(uuid, public.user_role[]) from public, anon;
revoke all on function private.can_view_profile(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_school_role(uuid, public.user_role[]) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.school_memberships enable row level security;
alter table public.staff_members enable row level security;
alter table public.school_invitations enable row level security;

create policy schools_select_member
on public.schools
for select
to authenticated
using (private.has_school_role(id));

create policy schools_update_admin
on public.schools
for update
to authenticated
using (private.has_school_role(id, array['school_admin']::public.user_role[]))
with check (private.has_school_role(id, array['school_admin']::public.user_role[]));

create policy profiles_select_self_or_school_colleague
on public.profiles
for select
to authenticated
using (private.can_view_profile(id));

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy school_memberships_select_self_or_school_admin
on public.school_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.has_school_role(school_id, array['school_admin']::public.user_role[])
);

create policy staff_members_select_school_member
on public.staff_members
for select
to authenticated
using (private.has_school_role(school_id));

create policy school_invitations_select_school_admin
on public.school_invitations
for select
to authenticated
using (private.has_school_role(school_id, array['school_admin']::public.user_role[]));

revoke all on table
  public.schools,
  public.profiles,
  public.school_memberships,
  public.staff_members,
  public.school_invitations
from anon, authenticated, service_role;

grant usage on schema public to authenticated, service_role;

grant select on public.schools to authenticated;
grant update (name, address, indicative_zig_per_usd) on public.schools to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, language) on public.profiles to authenticated;

grant select on public.school_memberships to authenticated;
grant select on public.staff_members to authenticated;
grant select on public.school_invitations to authenticated;

grant all privileges on table
  public.schools,
  public.profiles,
  public.school_memberships,
  public.staff_members,
  public.school_invitations
to service_role;
