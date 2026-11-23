-- B3.2 extension: temporary, single-use approved collectors.
-- PINs are one-way hashed and are never exposed by list functions.

create table if not exists public.temporary_collectors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  child_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone text not null check (phone ~ '^\+263[0-9]{9}$'),
  relationship public.collector_relationship not null,
  pin_hash text not null check (char_length(pin_hash) between 40 and 100),
  active boolean not null default true,
  expires_at timestamptz not null,
  pin_failed_attempts smallint not null default 0 check (pin_failed_attempts between 0 and 3),
  pin_locked_until timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temporary_collectors_id_school_key unique (id, school_id),
  constraint temporary_collectors_child_school_fkey
    foreign key (child_id, school_id)
    references public.children(id, school_id) on delete cascade,
  constraint temporary_collectors_lock_state_check check (
    (pin_failed_attempts < 3 and pin_locked_until is null)
    or (pin_failed_attempts = 3 and pin_locked_until is not null)
  )
);

create index if not exists temporary_collectors_child_active_expiry_idx
  on public.temporary_collectors (school_id, child_id, expires_at)
  where active = true;

alter table public.temporary_collectors enable row level security;
revoke all on public.temporary_collectors from public, anon, authenticated;

create or replace function public.create_temporary_collector(
  p_school_id uuid,
  p_child_id uuid,
  p_full_name text,
  p_phone text,
  p_relationship public.collector_relationship,
  p_pin text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not (
    private.has_role(p_school_id, 'school_admin'::public.user_role)
    or (
      private.has_role(p_school_id, 'guardian'::public.user_role)
      and private.is_guardian_of(p_child_id)
    )
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 160
     or p_phone !~ '^\+263[0-9]{9}$'
     or p_pin !~ '^[0-9]{4,8}$'
     or p_expires_at is null
     or p_expires_at < now() + interval '5 minutes'
     or p_expires_at > now() + interval '72 hours' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  insert into public.temporary_collectors (
    school_id, child_id, full_name, phone, relationship, pin_hash,
    expires_at, created_by
  )
  select p_school_id, c.id, btrim(p_full_name), p_phone, p_relationship,
         extensions.crypt(p_pin, extensions.gen_salt('bf', 12)),
         p_expires_at, v_actor
  from public.children c
  where c.id = p_child_id and c.school_id = p_school_id
    and c.status = 'active'::public.child_status
  returning id into v_id;

  if v_id is null then
    raise exception using errcode = 'P0002', message = 'CHILD_NOT_FOUND';
  end if;

  return v_id;
end;
$function$;

create or replace function public.list_temporary_collectors(
  p_school_id uuid,
  p_child_id uuid
)
returns table (
  id uuid,
  school_id uuid,
  child_id uuid,
  full_name text,
  phone text,
  relationship public.collector_relationship,
  active boolean,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    tc.id, tc.school_id, tc.child_id, tc.full_name, tc.phone,
    tc.relationship, tc.active, tc.expires_at, tc.created_at
  from public.temporary_collectors tc
  where tc.school_id = p_school_id and tc.child_id = p_child_id
    and tc.active and tc.expires_at > now()
    and (
      private.has_role(p_school_id, 'school_admin'::public.user_role)
      or private.is_guardian_of(p_child_id)
      or exists (
        select 1 from public.trips t
        join public.trip_children tc
          on tc.trip_id = t.id and tc.school_id = t.school_id
        join public.staff_members sm
          on sm.id = t.supervisor_id and sm.school_id = t.school_id
        where t.school_id = p_school_id and t.status = 'active'::public.trip_status
          and tc.child_id = p_child_id
          and sm.user_id = auth.uid() and sm.active and sm.role = 'supervisor'
      )
    );
$function$;

create or replace function public.revoke_temporary_collector(
  p_school_id uuid,
  p_temporary_collector_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  update public.temporary_collectors tc
  set active = false, updated_at = now()
  where tc.id = p_temporary_collector_id and tc.school_id = p_school_id
    and tc.active
    and (
      private.has_role(p_school_id, 'school_admin'::public.user_role)
      or private.is_guardian_of(tc.child_id)
    );

  if not found then
    raise exception using errcode = '42501', message = 'FORBIDDEN_OR_NOT_FOUND';
  end if;
end;
$function$;

create or replace function public.verify_temporary_handover(
  p_school_id uuid,
  p_trip_id uuid,
  p_child_id uuid,
  p_temporary_collector_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_trip_child public.trip_children%rowtype;
  v_collector public.temporary_collectors%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.trips t
    join public.staff_members s
      on s.id = t.supervisor_id and s.school_id = t.school_id
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and s.user_id = v_actor and s.active and s.role = 'supervisor'
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  select tc.* into v_trip_child
  from public.trip_children tc
  where tc.school_id = p_school_id and tc.trip_id = p_trip_id
    and tc.child_id = p_child_id
  for update;
  if not found or v_trip_child.status <> 'on_board'::public.trip_child_status then
    raise exception using errcode = '40001', message = 'CHILD_NOT_ON_BOARD';
  end if;

  select tc.* into v_collector
  from public.temporary_collectors tc
  where tc.id = p_temporary_collector_id
    and tc.school_id = p_school_id and tc.child_id = p_child_id
    and tc.active and tc.expires_at > now()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEMPORARY_COLLECTOR_NOT_FOUND_OR_EXPIRED';
  end if;
  if v_collector.pin_locked_until is not null and v_collector.pin_locked_until > now() then
    raise exception using errcode = '42501', message = 'PIN_LOCKED';
  end if;

  if extensions.crypt(p_pin, v_collector.pin_hash) <> v_collector.pin_hash then
    update public.temporary_collectors
    set pin_failed_attempts = least(pin_failed_attempts + 1, 3),
        pin_locked_until = case
          when pin_failed_attempts + 1 >= 3 then now() + interval '15 minutes'
          else null
        end,
        updated_at = now()
    where id = v_collector.id;
    return false;
  end if;

  update public.trip_children
  set status = 'handed_over'::public.trip_child_status,
      handed_over_at = now(), recorded_by = v_actor,
      last_event_at = now(), updated_at = now()
  where id = v_trip_child.id;

  update public.temporary_collectors
  set active = false, pin_failed_attempts = 0,
      pin_locked_until = null, updated_at = now()
  where id = v_collector.id;

  insert into public.trip_events (
    school_id, trip_id, trip_child_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, v_trip_child.id, 'child_handed_over', v_actor,
    jsonb_build_object('temporary_collector_id', v_collector.id, 'temporary', true)
  );

  return true;
end;
$function$;

revoke all on function public.create_temporary_collector(uuid,uuid,text,text,public.collector_relationship,text,timestamptz) from public, anon;
revoke all on function public.list_temporary_collectors(uuid,uuid) from public, anon;
revoke all on function public.revoke_temporary_collector(uuid,uuid) from public, anon;
revoke all on function public.verify_temporary_handover(uuid,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.create_temporary_collector(uuid,uuid,text,text,public.collector_relationship,text,timestamptz) to authenticated;
grant execute on function public.list_temporary_collectors(uuid,uuid) to authenticated;
grant execute on function public.revoke_temporary_collector(uuid,uuid) to authenticated;
grant execute on function public.verify_temporary_handover(uuid,uuid,uuid,uuid,text) to authenticated;
 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.trips t
    join public.staff_members s
      on s.id = t.supervisor_id and s.school_id = t.school_id
    where t.id = p_trip_id and t.school_id = p_school_id
      and t.status = 'active'::public.trip_status
      and s.user_id = v_actor and s.active and s.role = 'supervisor'
  ) then
    raise exception using errcode = '42501', message = 'ACTIVE_SUPERVISOR_TRIP_REQUIRED';
  end if;

  select tc.* into v_trip_child
  from public.trip_children tc
  where tc.school_id = p_school_id and tc.trip_id = p_trip_id
    and tc.child_id = p_child_id
  for update;
  if not found or v_trip_child.status <> 'on_board'::public.trip_child_status then
    raise exception using errcode = '40001', message = 'CHILD_NOT_ON_BOARD';
  end if;

  select tc.* into v_collector
  from public.temporary_collectors tc
  where tc.id = p_temporary_collector_id
    and tc.school_id = p_school_id and tc.child_id = p_child_id
    and tc.active and tc.expires_at > now()
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEMPORARY_COLLECTOR_NOT_FOUND_OR_EXPIRED';
  end if;
  if v_collector.pin_locked_until is not null and v_collector.pin_locked_until > now() then
    raise exception using errcode = '42501', message = 'PIN_LOCKED';
  end if;

  if extensions.crypt(p_pin, v_collector.pin_hash) <> v_collector.pin_hash then
    update public.temporary_collectors
    set pin_failed_attempts = least(pin_failed_attempts + 1, 3),
        pin_locked_until = case
          when pin_failed_attempts + 1 >= 3 then now() + interval '15 minutes'
          else null
        end,
        updated_at = now()
    where id = v_collector.id;
    return false;
  end if;

  update public.trip_children
  set status = 'handed_over'::public.trip_child_status,
      handed_over_at = now(), recorded_by = v_actor,
      last_event_at = now(), updated_at = now()
  where id = v_trip_child.id;

  update public.temporary_collectors
  set active = false, pin_failed_attempts = 0,
      pin_locked_until = null, updated_at = now()
  where id = v_collector.id;

  insert into public.trip_events (
    school_id, trip_id, trip_child_id, event_type, actor_user_id, event_data
  ) values (
    p_school_id, p_trip_id, v_trip_child.id, 'child_handed_over', v_actor,
    jsonb_build_object('temporary_collector_id', v_collector.id, 'temporary', true)
  );

  return true;
end;
$function$;

revoke all on function public.create_temporary_collector(uuid,uuid,text,text,public.collector_relationship,text,timestamptz) from public, anon;
revoke all on function public.list_temporary_collectors(uuid,uuid) from public, anon;
revoke all on function public.revoke_temporary_collector(uuid,uuid) from public, anon;
revoke all on function public.verify_temporary_handover(uuid,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.create_temporary_collector(uuid,uuid,text,text,public.collector_relationship,text,timestamptz) to authenticated;
grant execute on function public.list_temporary_collectors(uuid,uuid) to authenticated;
grant execute on function public.revoke_temporary_collector(uuid,uuid) to authenticated;
grant execute on function public.verify_temporary_handover(uuid,uuid,uuid,uuid,text) to authenticated;
