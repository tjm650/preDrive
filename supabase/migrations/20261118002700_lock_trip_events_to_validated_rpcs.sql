-- Trip events are append-only and can only be created through validated RPCs.
drop policy if exists trip_events_supervisor_insert on public.trip_events;
drop policy if exists trip_events_admin_insert on public.trip_events;
drop policy if exists trip_events_admin_update on public.trip_events;
drop policy if exists trip_events_admin_delete on public.trip_events;
revoke insert, update, delete on public.trip_events from anon, authenticated;

create or replace function private.prevent_duplicate_verified_handover()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type <> 'handover_verified' then
    return new;
  end if;

  -- Preserve safe retries: the RPC's same idempotency key is allowed to reach
  -- the unique-index conflict handler, which returns the original event.
  if new.idempotency_key is not null and exists (
    select 1 from public.trip_events e
    where e.trip_id = new.trip_id and e.idempotency_key = new.idempotency_key
  ) then
    return new;
  end if;

  if exists (
    select 1 from public.trip_events e
    where e.trip_id = new.trip_id
      and e.child_id = new.child_id
      and e.type = 'handover_verified'
  ) then
    raise exception 'A pickup handover has already been verified for this child'
      using errcode = '23505';
  end if;
  return new;
end
$$;

revoke all on function private.prevent_duplicate_verified_handover() from public, anon, authenticated;
drop trigger if exists prevent_duplicate_verified_handover on public.trip_events;
create trigger prevent_duplicate_verified_handover
before insert on public.trip_events
for each row execute function private.prevent_duplicate_verified_handover();
