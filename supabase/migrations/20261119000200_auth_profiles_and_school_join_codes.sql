-- Authenticated account bootstrap and safe school-code enrolment.
-- User metadata is used only for a display name; it never assigns a role or tenant.

alter table public.profiles
  drop constraint if exists platform_owner_school_check;
alter table public.profiles
  add constraint profiles_school_membership_check
  check (role = 'platform_owner' or school_id is not null or role = 'parent');

create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  if display_name is null then
    display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if display_name is null then display_name := 'New parent'; end if;

  insert into public.profiles (id, school_id, role, full_name)
  values (new.id, null, 'parent', left(display_name, 120))
  on conflict (id) do nothing;

  return new;
end
$$;

revoke all on function private.handle_auth_user_created() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_auth_user_created();

-- Join codes are hashed and kept outside the exposed public schema.
create table if not exists private.school_join_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code_hash text not null,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null,
  max_uses integer not null check (max_uses between 1 and 500),
  uses_count integer not null default 0 check (uses_count >= 0 and uses_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists school_join_codes_school_expiry_idx
  on private.school_join_codes (school_id, expires_at desc);

create table if not exists private.school_join_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists school_join_attempts_actor_time_idx
  on private.school_join_attempts (actor_id, attempted_at desc);

alter table private.school_join_codes enable row level security;
alter table private.school_join_attempts enable row level security;
revoke all on private.school_join_codes from public, anon, authenticated;
revoke all on private.school_join_attempts from public, anon, authenticated;

-- The only plaintext copy of a code is returned once to the school administrator.
create or replace function public.create_school_join_code(
  p_expires_at timestamptz default (now() + interval '7 days'),
  p_max_uses integer default 20
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  school uuid;
  generated_code text;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select p.school_id into school
  from public.profiles p
  where p.id = actor and p.role = 'school_admin' and p.school_id is not null;

  if school is null then
    raise exception 'Only a school administrator can create a join code'
      using errcode = '42501';
  end if;

  if p_max_uses is null or p_max_uses not between 1 and 500
     or p_expires_at is null
     or p_expires_at < now() + interval '5 minutes'
     or p_expires_at > now() + interval '30 days' then
    raise exception 'Join code expiry or usage limit is invalid'
      using errcode = '22023';
  end if;

  generated_code := upper(encode(extensions.gen_random_bytes(16), 'hex'));

  insert into private.school_join_codes
    (school_id, code_hash, created_by, expires_at, max_uses)
  values
    (school, extensions.crypt(generated_code, extensions.gen_salt('bf', 12)),
     actor, p_expires_at, p_max_uses);

  insert into public.audit_log
    (school_id, actor_id, action, entity_type, metadata)
  values
    (school, actor, 'school_join_code_created', 'school_join_code',
     jsonb_build_object('expires_at', p_expires_at, 'max_uses', p_max_uses));

  return generated_code;
end
$$;

revoke all on function public.create_school_join_code(timestamptz, integer) from public, anon;
grant execute on function public.create_school_join_code(timestamptz, integer) to authenticated;

-- Returns the joined school UUID, or NULL for invalid/expired/exhausted codes.
-- Returning NULL for a bad code avoids exposing whether a school or code exists.
create or replace function public.join_school_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_school uuid;
  actor_role public.user_role;
  code_row private.school_join_codes%rowtype;
  recent_attempts integer;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_code is null or length(btrim(p_code)) not between 16 and 64 then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('school-join:' || actor::text, 0));

  insert into private.school_join_attempts(actor_id) values (actor);
  select count(*) into recent_attempts
  from private.school_join_attempts a
  where a.actor_id = actor
    and a.attempted_at > now() - interval '1 hour';

  if recent_attempts > 10 then return null; end if;

  select p.school_id, p.role into actor_school, actor_role
  from public.profiles p
  where p.id = actor;

  if actor_role is distinct from 'parent' or actor_school is not null then
    return null;
  end if;

  select c.* into code_row
  from private.school_join_codes c
  where c.revoked_at is null
    and c.expires_at > now()
    and c.uses_count < c.max_uses
    and extensions.crypt(upper(btrim(p_code)), c.code_hash) = c.code_hash
  for update;

  if not found then return null; end if;

  -- This transaction-local capability is set only after a valid, locked code
  -- has been verified. The profile trigger consumes it for this one RPC transaction.
  perform set_config('predrive.allow_profile_tenant_update', 'on', true);

  update public.profiles
  set school_id = code_row.school_id
  where id = actor and role = 'parent' and school_id is null;

  if not found then return null; end if;

  update private.school_join_codes
  set uses_count = uses_count + 1
  where id = code_row.id;

  insert into public.audit_log
    (school_id, actor_id, action, entity_type, entity_id, metadata)
  values
    (code_row.school_id, actor, 'parent_joined_school', 'profile', actor,
     jsonb_build_object('join_code_id', code_row.id));

  return code_row.school_id;
end
$$;

revoke all on function public.join_school_with_code(text) from public, anon;
grant execute on function public.join_school_with_code(text) to authenticated;

-- Allow trusted SECURITY DEFINER provisioning RPCs (including join_school_with_code)
-- while continuing to reject direct client attempts to change role or tenant.
create or replace function private.protect_profile_tenant_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $predrive$
declare
  request_role text;
  allowed_enrolment boolean;
begin
  request_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  allowed_enrolment := coalesce(current_setting('predrive.allow_profile_tenant_update', true), '') = 'on';

  if (new.role is distinct from old.role
      or new.school_id is distinct from old.school_id)
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and request_role <> 'service_role'
     and not allowed_enrolment then
    raise exception 'Profile role and school assignment can only be changed by trusted provisioning'
      using errcode = '42501';
  end if;

  return new;
end
$predrive$;

revoke all on function private.protect_profile_tenant_identity() from public, anon, authenticated;
