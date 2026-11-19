-- Allow the issuing school administrator (or platform owner) to revoke a leaked join code immediately.
create or replace function public.revoke_school_join_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  code_row private.school_join_codes%rowtype;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_code is null or length(btrim(p_code)) not between 16 and 64 then return false; end if;
  select c.* into code_row
  from private.school_join_codes c
  where extensions.crypt(upper(btrim(p_code)), c.code_hash) = c.code_hash
  for update;
  if not found then return false; end if;
  if not private.is_platform_owner() and not private.is_school_admin(code_row.school_id) then
    raise exception 'Only the issuing school administrator or platform owner can revoke this code'
      using errcode = '42501';
  end if;
  if code_row.revoked_at is not null then return true; end if;
  update private.school_join_codes set revoked_at = now() where id = code_row.id;
  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (code_row.school_id, actor, 'school_join_code_revoked', 'school_join_code', code_row.id,
    jsonb_build_object('uses_count', code_row.uses_count, 'max_uses', code_row.max_uses));
  return true;
end
$$;
revoke all on function public.revoke_school_join_code(text) from public, anon;
grant execute on function public.revoke_school_join_code(text) to authenticated;
