-- Defence in depth: tenant relationships are enforced by the database, not only UI/RLS.
create or replace function private.is_guardian(target_child uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.guardianships g
  join public.profiles p on p.id=g.guardian_id
  join public.children c on c.id=g.child_id
  where g.child_id=target_child and g.guardian_id=(select auth.uid())
   and p.role='parent' and p.school_id=c.school_id
 )
$$;
create or replace function private.is_assigned_supervisor(target_trip uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(
  select 1 from public.trips t
  join public.routes r on r.id=t.route_id
  join public.profiles p on p.id=t.supervisor_id
  where t.id=target_trip and t.supervisor_id=(select auth.uid())
   and p.role='supervisor' and p.school_id=r.school_id
 )
$$;

create or replace function private.enforce_tenant_relationships()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a_school uuid;
declare b_school uuid;
declare c_school uuid;
declare actor_role public.user_role;
begin
 case tg_table_name
 when 'guardianships' then
  select school_id,role into a_school,actor_role from public.profiles where id=new.guardian_id;
  select school_id into b_school from public.children where id=new.child_id;
  if a_school is null or a_school<>b_school or actor_role<>'parent' then
   raise exception 'Guardian and child must belong to the same school and guardian must have parent role' using errcode='23514';
  end if;
 when 'children' then
  if new.home_stop_id is not null then
   select r.school_id into a_school from public.stops s join public.routes r on r.id=s.route_id where s.id=new.home_stop_id;
   if a_school is distinct from new.school_id then raise exception 'Home stop must belong to the child school' using errcode='23514'; end if;
  end if;
 when 'route_children' then
  select school_id into a_school from public.routes where id=new.route_id;
  select school_id into b_school from public.children where id=new.child_id;
  if a_school is null or a_school<>b_school then raise exception 'Route and child must belong to the same school' using errcode='23514'; end if;
  if new.stop_id is not null and not exists(select 1 from public.stops s where s.id=new.stop_id and s.route_id=new.route_id) then
   raise exception 'Manifest stop must belong to its route' using errcode='23514';
  end if;
 when 'trips' then
  select school_id into a_school from public.routes where id=new.route_id;
  select school_id into b_school from public.buses where id=new.bus_id;
  select school_id,role into c_school,actor_role from public.profiles where id=new.supervisor_id;
  if a_school is null or a_school<>b_school or a_school<>c_school or actor_role<>'supervisor' then
   raise exception 'Trip route, bus and supervisor must belong to the same school' using errcode='23514';
  end if;
 when 'trip_events' then
  select r.school_id into a_school from public.trips t join public.routes r on r.id=t.route_id where t.id=new.trip_id;
  select school_id into b_school from public.profiles where id=new.recorded_by;
  if a_school is null or a_school<>b_school then raise exception 'Trip event recorder must belong to the trip school' using errcode='23514'; end if;
  if new.child_id is not null then
   select school_id into c_school from public.children where id=new.child_id;
   if a_school<>c_school then raise exception 'Trip event child must belong to the trip school' using errcode='23514'; end if;
  end if;
 when 'notifications' then
  select school_id into a_school from public.profiles where id=new.user_id;
  if a_school is null or a_school<>new.school_id then raise exception 'Notification recipient must belong to the notification school' using errcode='23514'; end if;
 when 'invoices' then
  if new.guardian_id is not null then
   select school_id,role into a_school,actor_role from public.profiles where id=new.guardian_id;
   if a_school is distinct from new.school_id or actor_role<>'parent' then raise exception 'Invoice guardian must be a parent in the invoice school' using errcode='23514'; end if;
  end if;
 when 'absences' then
  select c.school_id into a_school from public.children c where c.id=new.child_id;
  if new.reported_by is not null then
   select school_id into b_school from public.profiles where id=new.reported_by;
   if a_school is null or a_school<>b_school then raise exception 'Absence reporter and child must belong to the same school' using errcode='23514'; end if;
  elsif a_school is null then
   raise exception 'Absence child must belong to a school' using errcode='23514';
  end if;
 when 'incidents' then
  if new.reported_by is not null then
   select school_id into a_school from public.profiles where id=new.reported_by;
   if a_school is distinct from new.school_id then raise exception 'Incident reporter must belong to the incident school' using errcode='23514'; end if;
  end if;
  if new.child_id is not null then
   select school_id into b_school from public.children where id=new.child_id;
   if b_school is distinct from new.school_id then raise exception 'Incident child must belong to the incident school' using errcode='23514'; end if;
  end if;
  if new.trip_id is not null then
   select r.school_id into c_school from public.trips t join public.routes r on r.id=t.route_id where t.id=new.trip_id;
   if c_school is distinct from new.school_id then raise exception 'Incident trip must belong to the incident school' using errcode='23514'; end if;
  end if;
 when 'thread_members' then
  select school_id into a_school from public.threads where id=new.thread_id;
  select school_id into b_school from public.profiles where id=new.user_id;
  if a_school is null or a_school<>b_school then raise exception 'Thread member must belong to the thread school' using errcode='23514'; end if;
 when 'messages' then
  select school_id into a_school from public.threads where id=new.thread_id;
  select school_id into b_school from public.profiles where id=new.sender_id;
  if a_school is null or a_school<>b_school then raise exception 'Message sender must belong to the thread school' using errcode='23514'; end if;
 end case;
 return new;
end $$;
revoke all on function private.enforce_tenant_relationships() from public,anon,authenticated;

create trigger guardianships_tenant_guard before insert or update on public.guardianships for each row execute function private.enforce_tenant_relationships();
create trigger children_home_stop_tenant_guard before insert or update of school_id,home_stop_id on public.children for each row execute function private.enforce_tenant_relationships();
create trigger route_children_tenant_guard before insert or update on public.route_children for each row execute function private.enforce_tenant_relationships();
create trigger trips_tenant_guard before insert or update on public.trips for each row execute function private.enforce_tenant_relationships();
create trigger trip_events_tenant_guard before insert or update on public.trip_events for each row execute function private.enforce_tenant_relationships();
create trigger notifications_tenant_guard before insert or update on public.notifications for each row execute function private.enforce_tenant_relationships();
create trigger invoices_tenant_guard before insert or update on public.invoices for each row execute function private.enforce_tenant_relationships();
create trigger absences_tenant_guard before insert or update on public.absences for each row execute function private.enforce_tenant_relationships();
create trigger incidents_tenant_guard before insert or update on public.incidents for each row execute function private.enforce_tenant_relationships();
create trigger thread_members_tenant_guard before insert or update on public.thread_members for each row execute function private.enforce_tenant_relationships();
create trigger messages_tenant_guard before insert or update on public.messages for each row execute function private.enforce_tenant_relationships();

drop policy if exists guardianships_read on public.guardianships;
create policy guardianships_read on public.guardianships for select to authenticated using (
 (guardian_id=(select auth.uid()) and exists(select 1 from public.children c where c.id=guardianships.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=guardianships.child_id))
 or exists(select 1 from public.children c join public.route_children rc on rc.child_id=c.id join public.trips t on t.route_id=rc.route_id where c.id=guardianships.child_id and t.supervisor_id=(select auth.uid()))
);

drop policy if exists authorized_pickups_read on public.authorized_pickups;
create policy authorized_pickups_read on public.authorized_pickups for select to authenticated using (
 (private.is_guardian(child_id) and exists(select 1 from public.children c where c.id=authorized_pickups.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=authorized_pickups.child_id))
);

drop policy if exists trip_events_read on public.trip_events;
create policy trip_events_read on public.trip_events for select to authenticated using (
 private.is_assigned_supervisor(trip_id)
 or private.can_read_school((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_events.trip_id))
 or (child_id is not null and private.is_guardian(child_id)
  and exists(select 1 from public.children c where c.id=trip_events.child_id and c.school_id=private.current_school_id()))
);

drop policy if exists absences_read_scoped on public.absences;
create policy absences_read_scoped on public.absences for select to authenticated using (
 (private.is_guardian(child_id) and exists(select 1 from public.children c where c.id=absences.child_id and c.school_id=private.current_school_id()))
 or private.can_read_school((select c.school_id from public.children c where c.id=absences.child_id))
);

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check (
 sender_id=(select auth.uid())
 and exists(select 1 from public.thread_members tm where tm.thread_id=messages.thread_id and tm.user_id=(select auth.uid()))
);
