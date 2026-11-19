-- Do not trust a request JWT role GUC as the authority for privileged profile changes.
-- The trigger is SECURITY INVOKER, so current_user is the actual Postgres role.
create or replace function private.protect_profile_tenant_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.school_id is distinct from old.school_id)
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Profile role and school assignment can only be changed by trusted provisioning'
      using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function private.protect_profile_tenant_identity() from public, anon, authenticated;

-- PostgreSQL's regular-expression engine limits bounded repetition to 255.
-- Keep Expo token validation strict without an invalid upper repetition bound.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_token is not null and (
    length(p_token) > 512
    or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'
  ) then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;
  if p_token is not null then
    update public.profiles
    set expo_push_token = null
    where expo_push_token = p_token and id <> actor;
  end if;
  update public.profiles
  set expo_push_token = p_token, updated_at = now()
  where id = actor;
  if not found then raise exception 'Profile not found' using errcode = 'P0002'; end if;
end
$$;
revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
