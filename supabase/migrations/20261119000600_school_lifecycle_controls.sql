-- School lifecycle controls. Join codes remain private hashed credentials, not a plaintext schools.code column.
alter table public.schools
  add column if not exists status text not null default 'active';
alter table public.schools
  add constraint schools_status_check check (status in ('active', 'suspended', 'archived'));
create index if not exists schools_status_idx on public.schools(status);

grant update(status) on public.schools to authenticated;
drop policy if exists schools_platform_owner_update on public.schools;
create policy schools_platform_owner_update on public.schools
for update to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

-- School staff and parents lose tenant-scoped access while a school is suspended/archived.
create or replace function private.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id
  from public.profiles p
  join public.schools s on s.id = p.school_id and s.status = 'active'
  where p.id = (select auth.uid())
  limit 1
$$;

create or replace function private.can_read_school(target_school uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.is_platform_owner()
    or (
      private.current_role() = 'school_admin'
      and private.current_school_id() = target_school
    ),
    false
  )
$$;
revoke all on function private.current_school_id() from public, anon;
revoke all on function private.can_read_school(uuid) from public, anon;
grant execute on function private.current_school_id() to authenticated;
grant execute on function private.can_read_school(uuid) to authenticated;

-- Do not issue new join codes for a suspended school.
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
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select p.school_id into school
  from public.profiles p
  join public.schools s on s.id = p.school_id and s.status = 'active'
  where p.id = actor and p.role = 'school_admin';
  if school is null then
    raise exception 'Only an administrator of an active school can create a join code' using errcode = '42501';
  end if;
  if p_max_uses is null or p_max_uses not between 1 and 500
     or p_expires_at is null
     or p_expires_at < now() + interval '5 minutes'
     or p_expires_at > now() + interval '30 days' then
    raise exception 'Join code expiry or usage limit is invalid' using errcode = '22023';
  end if;
  generated_code := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  insert into private.school_join_codes(school_id, code_hash, created_by, expires_at, max_uses)
  values (school, extensions.crypt(generated_code, extensions.gen_salt('bf', 12)), actor, p_expires_at, p_max_uses);
  insert into public.audit_log(school_id, actor_id, action, entity_type, metadata)
  values (school, actor, 'school_join_code_created', 'school_join_code',
    jsonb_build_object('expires_at', p_expires_at, 'max_uses', p_max_uses));
  return generated_code;
end
$$;

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
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_code is null or length(btrim(p_code)) not between 16 and 64 then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-join:' || actor::text, 0));
  insert into private.school_join_attempts(actor_id) values (actor);
  select count(*) into recent_attempts
  from private.school_join_attempts a
  where a.actor_id = actor and a.attempted_at > now() - interval '1 hour';
  if recent_attempts > 10 then return null; end if;
  select p.school_id, p.role into actor_school, actor_role
  from public.profiles p where p.id = actor;
  if actor_role is distinct from 'parent' or actor_school is not null then return null; end if;
  select c.* into code_row
  from private.school_join_codes c
  join public.schools s on s.id = c.school_id and s.status = 'active'
  where c.revoked_at is null and c.expires_at > now() and c.uses_count < c.max_uses
    and extensions.crypt(upper(btrim(p_code)), c.code_hash) = c.code_hash
  for update of c;
  if not found then return null; end if;
  perform set_config('predrive.allow_profile_tenant_update', 'on', true);
  update public.profiles set school_id = code_row.school_id
  where id = actor and role = 'parent' and school_id is null;
  if not found then return null; end if;
  update private.school_join_codes set uses_count = uses_count + 1 where id = code_row.id;
  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (code_row.school_id, actor, 'parent_joined_school', 'profile', actor,
    jsonb_build_object('join_code_id', code_row.id));
  return code_row.school_id;
end
$$;

revoke all on function public.create_school_join_code(timestamptz, integer) from public, anon;
revoke all on function public.join_school_with_code(text) from public, anon;
grant execute on function public.create_school_join_code(timestamptz, integer) to authenticated;
grant execute on function public.join_school_with_code(text) to authenticated;
