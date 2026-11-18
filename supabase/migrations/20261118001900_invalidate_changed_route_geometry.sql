-- Any stop change invalidates the route geometry and requires recalculation + field check.
create or replace function private.invalidate_route_geometry_on_stop_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.routes set
      geometry_status='unverified',
      geometry_source=null,
      geometry_verified_at=null,
      distance_m=null,
      duration_s=null,
      polyline='[]'::jsonb
    where id=old.route_id;
    return old;
  elsif tg_op = 'UPDATE' then
    update public.routes set
      geometry_status='unverified',
      geometry_source=null,
      geometry_verified_at=null,
      distance_m=null,
      duration_s=null,
      polyline='[]'::jsonb
    where id in (old.route_id,new.route_id);
    return new;
  else
    update public.routes set
      geometry_status='unverified',
      geometry_source=null,
      geometry_verified_at=null,
      distance_m=null,
      duration_s=null,
      polyline='[]'::jsonb
    where id=new.route_id;
    return new;
  end if;
end
$$;
revoke all on function private.invalidate_route_geometry_on_stop_change() from public,anon,authenticated;

drop trigger if exists invalidate_route_geometry_after_stop_change on public.stops;
create trigger invalidate_route_geometry_after_stop_change
after insert or update or delete on public.stops
for each row execute function private.invalidate_route_geometry_on_stop_change();
