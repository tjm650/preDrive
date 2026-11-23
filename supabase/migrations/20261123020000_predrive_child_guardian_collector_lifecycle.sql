-- B3.2: child, guardian relationship and approved-collector lifecycle.
-- Raw PINs are accepted only as function arguments and are never persisted or logged.

create or replace function public.create_child(
  p_school_id uuid,
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_class_group_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_child_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_first_name is null or char_length(btrim(p_first_name)) not between 1 and 100
     or p_last_name is null or char_length(btrim(p_last_name)) not between 1 and 100
     or p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  insert into public.children (
    school_id, class_group_id, first_name, last_name, date_of_birth
  )
  select p_school_id, g.id, btrim(p_first_name), btrim(p_last_name), p_date_of_birth
  from public.class_groups g
  where g.id = p_class_group_id
    and g.school_id = p_school_id
    and g.active = true
  returning id into v_child_id;

  if v_child_id is null then
    raise exception using errcode = '23503', message = 'CLASS_GROUP_NOT_FOUND';
  end if;

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, target_id
  ) values (
    p_school_id, auth.uid(), 'child.created', 'children', v_child_id::text
  );

  return v_child_id;
end;
$function$;

create or replace function public.link_guardian_to_child(
  p_school_id uuid,
  p_guardian_user_id uuid,
  p_child_id uuid,
  p_relationship public.collector_relationship,
  p_primary_contact boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_link_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = p_guardian_user_id
      and m.role = 'guardian'::public.user_role
      and m.active
  ) then
    raise exception using errcode = '23503', message = 'GUARDIAN_MEMBERSHIP_REQUIRED';
  end if;
  if not exists (
    select 1 from public.children c
    where c.id = p_child_id and c.school_id = p_school_id
  ) then
    raise exception using errcode = '23503', message = 'CHILD_NOT_FOUND';
  end if;

  insert into public.guardian_children (
    school_id, guardian_user_id, child_id, relationship, primary_contact, active
  ) values (
    p_school_id, p_guardian_user_id, p_child_id, p_relationship, p_primary_contact, true
  )
  on conflict (school_id, guardian_user_id, child_id) do update
    set relationship = excluded.relationship,
        primary_contact = excluded.primary_contact,
        active = true,
        updated_at = now()
  returning id into v_link_id;

  return v_link_id;
end;
$function$;

create or replace function public.create_approved_collector(
  p_school_id uuid,
  p_child_id uuid,
  p_full_name text,
  p_relationship public.collector_relationship,
  p_phone text,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_collector_id uuid;
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
     or p_phone !~ '^\+[+]263[0-9]{9}$'
     or p_pin !~ '^[0-9]{4,8}$' then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  insert into public.approved_collectors (
    school_id, child_id, full_name, relationship, phone, pin_hash, created_by
  )
  select p_school_id, c.id, btrim(p_full_name), p_relationship, p_phone,
         extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), v_actor
  from public.children c
  where c.id = p_child_id and c.school_id = p_school_id
  returning id into v_collector_id;

  if v_collector_id is null then
    raise exception using errcode = 'P0002', message = 'CHILD_NOT_FOUND';
  end if;

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, target_id
  ) values (
    p_school_id, v_actor, 'collector.created', 'approved_collectors', v_collector_id::text
  );

  return v_collector_id;
end;
$function$;

revoke all on function public.create_child(uuid, text, text, date, uuid) from public, anon;
revoke all on function public.link_guardian_to_child(uuid, uuid, uuid, public.collector_relationship, boolean) from public, anon;
revoke all on function public.create_approved_collector(uuid, uuid, text, public.collector_relationship, text, text) from public, anon;
grant execute on function public.create_child(uuid, text, text, date, uuid) to authenticated;
grant execute on function public.link_guardian_to_child(uuid, uuid, uuid, public.collector_relationship, boolean) to authenticated;
grant execute on function public.create_approved_collector(uuid, uuid, text, public.collector_relationship, text, text) to authenticated;
