-- B4.3: persist the minimum staff profile needed to activate a staff
-- membership when a school invitation is accepted.
-- This is additive. Existing invitations remain valid for guardian roles.
-- Existing pending staff invitations without these details must be revoked
-- and reissued; acceptance fails closed rather than creating incomplete staff.

alter table public.school_invitations
  add column if not exists full_name text,
  add column if not exists phone text;

comment on column public.school_invitations.full_name is
  'Invited staff member name used to create staff_members on invitation acceptance; null for guardian invitations.';
comment on column public.school_invitations.phone is
  'Invited staff member contact number used to create staff_members on invitation acceptance; null for guardian invitations.';

-- NOT VALID preserves historical pending invitations while enforcing complete
-- details on every new or updated non-guardian invitation.
do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.school_invitations'::regclass
      and conname = 'school_invitations_staff_details_check'
  ) then
    alter table public.school_invitations
      add constraint school_invitations_staff_details_check
      check (
        role = 'guardian'::public.user_role
        or (
          full_name is not null
          and char_length(btrim(full_name)) between 2 and 160
          and phone is not null
          and char_length(btrim(phone)) between 7 and 32
        )
      ) not valid;
  end if;
end;
$constraint$;

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

  if exists (
    select 1 from public.schools s
    where s.id = v_invitation.school_id
      and s.status = 'suspended'::public.school_status
  ) then
    raise exception using errcode = '42501', message = 'SCHOOL_SUSPENDED';
  end if;

  if v_invitation.role in (
    'driver'::public.user_role,
    'supervisor'::public.user_role,
    'teacher'::public.user_role
  ) and (
    v_invitation.full_name is null
    or char_length(btrim(v_invitation.full_name)) not between 2 and 160
    or v_invitation.phone is null
    or char_length(btrim(v_invitation.phone)) not between 7 and 32
  ) then
    raise exception using
      errcode = '22023',
      message = 'INVITATION_STAFF_DETAILS_REQUIRED';
  end if;

  select m.* into v_existing_membership
  from public.school_memberships m
  where m.school_id = v_invitation.school_id
    and m.user_id = v_user_id
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

  if v_invitation.role in (
    'driver'::public.user_role,
    'supervisor'::public.user_role,
    'teacher'::public.user_role
  ) then
    insert into public.staff_members (
      school_id,
      user_id,
      role,
      full_name,
      phone,
      active
    ) values (
      v_invitation.school_id,
      v_user_id,
      v_invitation.role,
      btrim(v_invitation.full_name),
      btrim(v_invitation.phone),
      true
    )
    on conflict (school_id, user_id)
    do update set
      role = excluded.role,
      full_name = excluded.full_name,
      phone = excluded.phone,
      active = true,
      updated_at = now();
  end if;

  update public.school_invitations
  set status = 'accepted'::public.invitation_status,
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  where id = v_invitation.id;

  insert into public.audit_log (
    school_id, actor_user_id, action, target_table, target_id, metadata
  ) values (
    v_invitation.school_id, v_user_id, 'school.invitation.accepted',
    'school_invitations', v_invitation.id::text,
    jsonb_build_object('role', v_invitation.role)
  );

  return v_invitation.school_id;
end;
$function$;

revoke all on function public.accept_school_invitation() from public, anon;
grant execute on function public.accept_school_invitation() to authenticated;
