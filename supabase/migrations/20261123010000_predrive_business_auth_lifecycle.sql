-- B3.1: authenticated school registration and invitation acceptance.
-- All functions derive the actor from auth.uid(); caller-supplied user IDs are never trusted.

create or replace function public.register_school(
  p_name text,
  p_address text,
  p_indicative_zig_per_usd numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_school_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 160
     or p_address is null or char_length(btrim(p_address)) not between 2 and 300
     or p_indicative_zig_per_usd is null or p_indicative_zig_per_usd <= 0 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_user_id) then
    raise exception using errcode = '23503', message = 'PROFILE_REQUIRED';
  end if;

  insert into public.schools (name, status, address, timezone, indicative_zig_per_usd)
  values (btrim(p_name), 'pending'::public.school_status, btrim(p_address),
          'Africa/Harare', p_indicative_zig_per_usd)
  returning id into v_school_id;

  insert into public.school_memberships (school_id, user_id, role, active)
  values (v_school_id, v_user_id, 'school_admin'::public.user_role, true);

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, target_id, metadata
  ) values (
    v_school_id, v_user_id, 'school.registered', 'schools', v_school_id::text,
    jsonb_build_object('initial_status', 'pending')
  );

  return v_school_id;
end;
$function$;

create or replace function public.accept_school_invitation()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invitation public.school_invitations%rowtype;
  v_existing_membership public.school_memberships%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;

  select lower(p.email) into v_email
  from public.profiles p
  where p.id = v_user_id;

  if v_email is null then
    raise exception using errcode = '23503', message = 'PROFILE_REQUIRED';
  end if;

  select i.* into v_invitation
  from public.school_invitations i
  where lower(i.email) = v_email
    and i.status = 'pending'::public.invitation_status
    and i.expires_at > now()
  order by i.created_at
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'INVITATION_NOT_FOUND';
  end if;

  select m.* into v_existing_membership
  from public.school_memberships m
  where m.school_id = v_invitation.school_id and m.user_id = v_user_id
  for update;

  if found then
    if v_existing_membership.role <> v_invitation.role then
      raise exception using errcode = '23505', message = 'MEMBERSHIP_ROLE_CONFLICT';
    end if;
    update public.school_memberships
    set active = true, updated_at = now()
    where id = v_existing_membership.id;
  else
    insert into public.school_memberships (school_id, user_id, role, active)
    values (v_invitation.school_id, v_user_id, v_invitation.role, true);
  end if;

  update public.school_invitations
  set status = 'accepted'::public.invitation_status,
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_invitation.id;

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, target_id
  ) values (
    v_invitation.school_id, v_user_id, 'school.invitation.accepted',
    'school_invitations', v_invitation.id::text
  );

  return v_invitation.school_id;
end;
$function$;

revoke all on function public.register_school(text, text, numeric) from public, anon;
revoke all on function public.accept_school_invitation() from public, anon;
grant execute on function public.register_school(text, text, numeric) to authenticated;
grant execute on function public.accept_school_invitation() to authenticated;
