-- Freeze manifests, stops and assigned assets while trips are scheduled or active.
create or replace function private.guard_route_manifest_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_route uuid;
declare new_route uuid;
begin
  if tg_op <> 'INSERT' then old_route := old.route_id; end if;
  if tg_op <> 'DELETE' then new_route := new.route_id; end if;
  if old_route is not null and exists(select 1 from public.trips t where t.route_id=old_route and t.status in ('scheduled','active')) then
    raise exception 'A scheduled or active trip locks this route manifest' using errcode='55000';
  end if;
  if new_route is not null and new_route is distinct from old_route
    and exists(select 1 from public.trips t where t.route_id=new_route and t.status in ('scheduled','active')) then
    raise exception 'A scheduled or active trip locks this route manifest' using errcode='55000';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$$;
revoke all on function private.guard_route_manifest_change() from public,anon,authenticated;
drop trigger if exists guard_route_manifest_change on public.route_children;
create trigger guard_route_manifest_change
before insert or update or delete on public.route_children
for each row execute function private.guard_route_manifest_change();

create or replace function private.guard_route_stop_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_route uuid;
declare new_route uuid;
begin
  if tg_op <> 'INSERT' then old_route := old.route_id; end if;
  if tg_op <> 'DELETE' then new_route := new.route_id; end if;
  if old_route is not null and exists(select 1 from public.trips t where t.route_id=old_route and t.status in ('scheduled','active')) then
    raise exception 'Stops cannot change while a trip is scheduled or active on this route' using errcode='55000';
  end if;
  if new_route is not null and new_route is distinct from old_route
    and exists(select 1 from public.trips t where t.route_id=new_route and t.status in ('scheduled','active')) then
    raise exception 'Stops cannot change while a trip is scheduled or active on this route' using errcode='55000';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$$;
revoke all on function private.guard_route_stop_change() from public,anon,authenticated;
drop trigger if exists guard_route_stop_change on public.stops;
create trigger guard_route_stop_change
before insert or update or delete on public.stops
for each row execute function private.guard_route_stop_change();

create or replace function private.guard_route_type_or_archive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.type is distinct from old.type or new.archived_at is distinct from old.archived_at)
    and exists(select 1 from public.trips t where t.route_id=old.id and t.status in ('scheduled','active')) then
    raise exception 'Route type and archival are locked while trips are scheduled or active' using errcode='55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_route_type_or_archive_change() from public,anon,authenticated;
drop trigger if exists guard_route_type_or_archive_change on public.routes;
create trigger guard_route_type_or_archive_change
before update of type,archived_at on public.routes
for each row execute function private.guard_route_type_or_archive_change();

create or replace function private.guard_bus_archive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.active is distinct from old.active or new.archived_at is distinct from old.archived_at)
    and exists(select 1 from public.trips t where t.bus_id=old.id and t.status in ('scheduled','active')) then
    raise exception 'Vehicle availability is locked while trips are scheduled or active' using errcode='55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_bus_archive_change() from public,anon,authenticated;
drop trigger if exists guard_bus_archive_change on public.buses;
create trigger guard_bus_archive_change
before update of active,archived_at on public.buses
for each row execute function private.guard_bus_archive_change();

create or replace function private.guard_child_archive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null
    and exists(select 1 from public.route_children rc where rc.child_id=old.id) then
    raise exception 'Remove the child from all route manifests before archiving' using errcode='55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_child_archive_change() from public,anon,authenticated;
drop trigger if exists guard_child_archive_change on public.children;
create trigger guard_child_archive_change
before update of archived_at on public.children
for each row execute function private.guard_child_archive_change();
