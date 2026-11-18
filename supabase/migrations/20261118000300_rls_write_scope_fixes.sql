-- Tighten write scopes: parents may read route manifests but cannot mutate them.
drop policy if exists buses_school_access on public.buses;
create policy buses_read on public.buses for select to authenticated using (
 private.is_school_admin(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.bus_id=id and t.supervisor_id=(select auth.uid())))
);
create policy buses_admin_write on public.buses for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));

drop policy if exists routes_school_access on public.routes;
create policy routes_read on public.routes for select to authenticated using (
 private.is_school_admin(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.route_id=id and t.supervisor_id=(select auth.uid())))
);
create policy routes_admin_write on public.routes for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));

drop policy if exists stops_access on public.stops;
create policy stops_read on public.stops for select to authenticated using (
 private.is_school_admin((select r.school_id from public.routes r where r.id=route_id))
 or exists(select 1 from public.trips t where t.route_id=stops.route_id and t.supervisor_id=(select auth.uid()))
);
create policy stops_admin_write on public.stops for all to authenticated using (
 private.is_school_admin((select r.school_id from public.routes r where r.id=route_id))
) with check (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)));

drop policy if exists route_children_access on public.route_children;
create policy route_children_read on public.route_children for select to authenticated using (
 private.is_school_admin((select r.school_id from public.routes r where r.id=route_id))
 or exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
 or private.is_guardian(child_id)
);
create policy route_children_admin_write on public.route_children for all to authenticated using (
 private.is_school_admin((select r.school_id from public.routes r where r.id=route_id))
) with check (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)));
create policy route_children_supervisor_write on public.route_children for insert to authenticated with check (
 exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
);
create policy route_children_supervisor_update on public.route_children for update to authenticated using (
 exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
) with check (
 exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
);

-- An acknowledgement for a child/trip suppresses all future reminders, even if an older
-- notification remains unacknowledged.
create or replace function public.renotify_unaccounted_children()
returns integer language plpgsql security definer set search_path = '' as $$
declare pending record;
declare sent_count integer := 0;
begin
 for pending in
  select n.user_id,n.school_id,n.params
  from public.notifications n
  where n.type='child_unaccounted' and n.acknowledged_at is null
   and n.created_at < now()-interval '55 seconds'
   and not exists(
    select 1 from public.notifications newer
    where newer.user_id=n.user_id and newer.type=n.type
     and newer.params->>'trip_id'=n.params->>'trip_id'
     and newer.params->>'child_id'=n.params->>'child_id'
     and newer.created_at>n.created_at and newer.acknowledged_at is null
   )
   and not exists(
    select 1 from public.notifications ack
    where ack.user_id=n.user_id and ack.type=n.type
     and ack.params->>'trip_id'=n.params->>'trip_id'
     and ack.params->>'child_id'=n.params->>'child_id'
     and ack.acknowledged_at is not null
   )
 loop
  insert into public.notifications(user_id,school_id,type,title_key,body_key,params,priority)
  values(pending.user_id,pending.school_id,'child_unaccounted','child_unaccounted','child_unaccounted',pending.params,'critical');
  sent_count := sent_count+1;
 end loop;
 return sent_count;
end $$;
revoke all on function public.renotify_unaccounted_children() from public,anon,authenticated;
