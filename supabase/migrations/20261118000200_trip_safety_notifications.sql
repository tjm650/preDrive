create unique index notifications_dedupe_trip_child_type
on public.notifications ((params->>'trip_id'),(params->>'child_id'),type)
where params ? 'trip_id' and params ? 'child_id';

create function private.distance_metres(a_lat double precision,a_lng double precision,b_lat double precision,b_lng double precision)
returns double precision language sql immutable strict set search_path = '' as $$
 select 6371000 * 2 * asin(sqrt(least(1,
   power(sin(radians(b_lat-a_lat)/2),2) +
   cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng-a_lng)/2),2)
 )))
$$;

create function private.notify_child_guardians(target_child uuid,target_school uuid,notification_type text,priority public.notification_priority,notification_params jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare guardian record;
declare title text;
begin
 title := notification_type;
 for guardian in select g.guardian_id from public.guardianships g where g.child_id=target_child loop
  insert into public.notifications(user_id,school_id,type,title_key,body_key,params,priority)
  values(guardian.guardian_id,target_school,notification_type,title,notification_type,notification_params,priority)
  on conflict do nothing;
 end loop;
 insert into public.notifications(user_id,school_id,type,title_key,body_key,params,priority)
 select p.id,target_school,notification_type,title,notification_type,notification_params,priority
 from public.profiles p where p.school_id=target_school and p.role='school_admin'
 on conflict do nothing;
end $$;
revoke all on function private.notify_child_guardians(uuid,uuid,text,public.notification_priority,jsonb) from public,anon,authenticated;

create function public.handle_location_update()
returns trigger language plpgsql security definer set search_path = '' as $$
declare manifest record;
declare distance double precision;
declare eta integer;
declare notification_type text;
begin
 if not exists(select 1 from public.trips t where t.id=new.trip_id and t.status='active') then return new; end if;
 insert into public.location_history(trip_id,lat,lng,speed,recorded_at)
 values(new.trip_id,new.lat,new.lng,new.speed,new.updated_at);
 for manifest in
  select c.id child_id,c.school_id,c.home_radius_m,s.lat home_lat,s.lng home_lng
  from public.trips t
  join public.route_children rc on rc.route_id=t.route_id
  join public.children c on c.id=rc.child_id
  left join public.stops s on s.id=c.home_stop_id
  where t.id=new.trip_id and s.id is not null
 loop
  distance := private.distance_metres(new.lat,new.lng,manifest.home_lat,manifest.home_lng);
  if distance <= 100 then notification_type := 'arrived';
  elsif distance <= manifest.home_radius_m then notification_type := 'bus_near';
  else continue;
  end if;
  if exists(select 1 from public.notifications n where n.type=notification_type and n.params->>'trip_id'=new.trip_id::text and n.params->>'child_id'=manifest.child_id::text) then continue; end if;
  eta := case when notification_type='arrived' then 0 else ceil(distance / (greatest(coalesce(new.speed,25),5)*1000/60.0))::integer end;
  perform private.notify_child_guardians(manifest.child_id,manifest.school_id,notification_type,
   case when notification_type='arrived' then 'high'::public.notification_priority else 'normal'::public.notification_priority end,
   jsonb_build_object('trip_id',new.trip_id,'child_id',manifest.child_id,'distance_m',round(distance),'eta_minutes',eta));
 end loop;
 return new;
end $$;
revoke all on function public.handle_location_update() from public,anon,authenticated;
create trigger bus_live_location_update after insert or update of lat,lng,speed on public.bus_live
for each row execute function public.handle_location_update();

create function public.handle_trip_event_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_school uuid;
declare mapped_type text;
declare priority public.notification_priority := 'normal';
begin
 select r.school_id into target_school from public.trips t join public.routes r on r.id=t.route_id where t.id=new.trip_id;
 mapped_type := new.type::text;
 if mapped_type='sos' then priority := 'critical';
 elsif mapped_type in ('delay','handover_rejected') then priority := 'high';
 end if;
 if new.child_id is not null then
  perform private.notify_child_guardians(new.child_id,target_school,mapped_type,priority,jsonb_build_object('trip_id',new.trip_id,'child_id',new.child_id,'event_id',new.id));
 else
  insert into public.notifications(user_id,school_id,type,title_key,body_key,params,priority)
  select p.id,target_school,mapped_type,mapped_type,mapped_type,jsonb_build_object('trip_id',new.trip_id,'event_id',new.id),priority
  from public.profiles p where p.school_id=target_school and p.role='school_admin'
  on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.handle_trip_event_notification() from public,anon,authenticated;
create trigger trip_event_notification after insert on public.trip_events
for each row execute function public.handle_trip_event_notification();

create function public.handle_trip_completion_safety()
returns trigger language plpgsql security definer set search_path = '' as $$
declare missing_child record;
declare target_school uuid;
begin
 if new.status <> 'completed' or old.status = 'completed' then return new; end if;
 select r.school_id into target_school from public.routes r where r.id=new.route_id;
 for missing_child in
  select c.id child_id from public.route_children rc join public.children c on c.id=rc.child_id
  where rc.route_id=new.route_id and not exists(
   select 1 from public.trip_events e where e.trip_id=new.id and e.child_id=c.id
   and e.type in ('dropped_home','absent','arrived_school')
  )
 loop
  perform private.notify_child_guardians(missing_child.child_id,target_school,'child_unaccounted','critical',
    jsonb_build_object('trip_id',new.id,'child_id',missing_child.child_id,'requires_acknowledgement',true));
 end loop;
 return new;
end $$;
revoke all on function public.handle_trip_completion_safety() from public,anon,authenticated;
create trigger trip_completion_safety after update of status on public.trips
for each row execute function public.handle_trip_completion_safety();

create function public.renotify_unaccounted_children()
returns integer language plpgsql security definer set search_path = '' as $$
declare pending record;
declare sent_count integer := 0;
begin
 for pending in
  select n.user_id,n.school_id,n.params,n.type
  from public.notifications n
  where n.type='child_unaccounted' and n.acknowledged_at is null
   and n.created_at < now()-interval '55 seconds'
   and not exists(
    select 1 from public.notifications newer
    where newer.user_id=n.user_id and newer.type=n.type
     and newer.params->>'trip_id'=n.params->>'trip_id'
     and newer.params->>'child_id'=n.params->>'child_id'
     and newer.created_at>n.created_at
     and newer.acknowledged_at is null
   )
 loop
  insert into public.notifications(user_id,school_id,type,title_key,body_key,params,priority)
  values(pending.user_id,pending.school_id,'child_unaccounted','child_unaccounted','child_unaccounted',
    pending.params,'critical');
  sent_count := sent_count+1;
 end loop;
 return sent_count;
end $$;
revoke all on function public.renotify_unaccounted_children() from public,anon,authenticated;

create table private.pickup_pin_attempts (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null, child_id uuid not null,
 attempted_at timestamptz not null default now(), succeeded boolean not null
);
alter table private.pickup_pin_attempts enable row level security;
revoke all on private.pickup_pin_attempts from public,anon,authenticated;

create function public.verify_pickup_pin(child_id uuid,pickup_id uuid,pin text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare stored_hash text;
declare failures integer;
declare child_school uuid;
declare allowed boolean;
begin
 if actor is null or pin is null or length(pin) not between 4 and 12 or pin !~ '^[0-9]+$' then return false; end if;
 select c.school_id into child_school from public.children c where c.id=verify_pickup_pin.child_id;
 if child_school is null then return false; end if;
 select exists(
  select 1 from public.guardianships g where g.child_id=verify_pickup_pin.child_id and g.guardian_id=actor
  union all
  select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id
  where rc.child_id=verify_pickup_pin.child_id and t.supervisor_id=actor and t.status='active'
 ) into allowed;
 if not allowed and not private.is_school_admin(child_school) then return false; end if;
 select count(*) into failures from private.pickup_pin_attempts a
 where a.actor_id=actor and a.child_id=verify_pickup_pin.child_id and not a.succeeded
 and a.attempted_at>now()-interval '15 minutes';
 if failures >= 5 then
  insert into private.pickup_pin_attempts(actor_id,child_id,succeeded) values(actor,verify_pickup_pin.child_id,false);
  insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
  values(child_school,actor,'pickup_pin_rate_limited','authorized_pickup',pickup_id,jsonb_build_object('attempts',failures+1));
  return false;
 end if;
 select ap.pin_hash into stored_hash from public.authorized_pickups ap
 where ap.id=pickup_id and ap.child_id=verify_pickup_pin.child_id;
 if stored_hash is null then allowed := false;
 else allowed := crypt(pin,stored_hash)=stored_hash;
 end if;
 insert into private.pickup_pin_attempts(actor_id,child_id,succeeded) values(actor,verify_pickup_pin.child_id,allowed);
 insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
 values(child_school,actor,case when allowed then 'pickup_pin_verified' else 'pickup_pin_failed' end,'authorized_pickup',pickup_id,
 jsonb_build_object('child_id',verify_pickup_pin.child_id));
 return allowed;
end $$;
revoke all on function public.verify_pickup_pin(uuid,uuid,text) from public,anon;
grant execute on function public.verify_pickup_pin(uuid,uuid,text) to authenticated;

do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  if not exists(select 1 from cron.job where jobname='predrive-child-unaccounted-reminders') then
   perform cron.schedule('predrive-child-unaccounted-reminders','* * * * *','select public.renotify_unaccounted_children()');
  end if;
 end if;
exception when others then
 raise notice 'pg_cron scheduling skipped; configure the child safety reminder job in Supabase Dashboard: %',sqlerrm;
end $$;

do $$
begin
 alter publication supabase_realtime add table public.notifications;
 alter publication supabase_realtime add table public.trip_events;
 alter publication supabase_realtime add table public.bus_live;
 alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null;
end $$;
