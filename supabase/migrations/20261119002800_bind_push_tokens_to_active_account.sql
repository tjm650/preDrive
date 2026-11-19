-- A device push token belongs to one active account at a time.
-- Clear it from any previous profile before assigning it to the authenticated user.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if p_token is not null and (
    length(p_token) > 512
    or p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$'
  ) then
    raise exception 'Invalid Expo push token' using errcode='22023';
  end if;

  if p_token is not null then
    update public.profiles
      set expo_push_token = null
      where expo_push_token = p_token and id <> auth.uid();
  end if;

  update public.profiles
    set expo_push_token = p_token
    where id = auth.uid();

  if not found then
    raise exception 'Profile not found' using errcode='P0002';
  end if;
end
$$;

revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
