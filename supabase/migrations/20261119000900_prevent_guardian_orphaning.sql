-- Prevent concurrent account deletions from orphaning the final guardian of a child.
create or replace function private.prevent_last_guardian_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_child uuid;
begin
  if old.role <> 'parent' then return old; end if;

  for linked_child in
    select g.child_id
    from public.guardianships g
    where g.guardian_id = old.id
    order by g.child_id
  loop
    perform pg_advisory_xact_lock(hashtextextended('child-guardian:' || linked_child::text, 0));
    if not exists (
      select 1
      from public.guardianships g
      join public.profiles p on p.id = g.guardian_id
      where g.child_id = linked_child
        and g.guardian_id <> old.id
        and p.role = 'parent'
    ) then
      raise exception 'A parent account cannot be deleted while it is the only registered guardian of a child'
        using errcode = '23514';
    end if;
  end loop;

  return old;
end
$$;
revoke all on function private.prevent_last_guardian_deletion() from public, anon, authenticated;
drop trigger if exists prevent_last_guardian_deletion on public.profiles;
create trigger prevent_last_guardian_deletion
before delete on public.profiles
for each row execute function private.prevent_last_guardian_deletion();
