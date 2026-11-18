-- Only proximity alerts are one-shot per trip/child. Child-unaccounted alerts must
-- be repeatable every minute until the recipient acknowledges one.
drop index if exists public.notifications_dedupe_trip_child_type;
create unique index notifications_dedupe_trip_child_type
on public.notifications (user_id,(params->>'trip_id'),(params->>'child_id'),type)
where type in ('bus_near','arrived') and params ? 'trip_id' and params ? 'child_id';

create index if not exists guardianships_child_guardian_idx on public.guardianships(child_id,guardian_id);
create index if not exists route_children_child_route_idx on public.route_children(child_id,route_id);
create index if not exists trips_supervisor_status_idx on public.trips(supervisor_id,status);
create index if not exists trips_route_status_idx on public.trips(route_id,status);
create index if not exists trip_events_trip_child_type_idx on public.trip_events(trip_id,child_id,type);
create index if not exists notifications_school_created_idx on public.notifications(school_id,created_at desc);
