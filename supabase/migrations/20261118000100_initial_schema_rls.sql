create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.user_role as enum ('parent','supervisor','school_admin','platform_owner');
create type public.route_type as enum ('pickup','dropoff');
create type public.trip_status as enum ('scheduled','active','completed','cancelled');
create type public.trip_event_type as enum ('boarded','arrived_school','dropped_home','absent','sos','delay','handover_rejected');
create type public.notification_priority as enum ('low','normal','high','critical');
create type public.subscription_status as enum ('trialing','active','past_due','cancelled','expired');
create type public.invoice_status as enum ('draft','pending','paid','overdue','void');
create type public.incident_status as enum ('open','investigating','resolved','closed');

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create table public.schools (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 address text, phone text, email text, timezone text not null default 'Africa/Harare',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, school_id uuid references public.schools(id),
 role public.user_role not null, full_name text not null, phone text, language text not null default 'en' check(language in ('en','sn','nd')),
 avatar_url text, expo_push_token text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint platform_owner_school_check check ((role = 'platform_owner') or school_id is not null)
);
create table public.children (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 first_name text not null, class_name text, avatar_key text, allergies text, medical_notes text,
 emergency_contact_name text, emergency_contact_phone text, home_stop_id uuid,
 home_radius_m integer not null default 1000 check(home_radius_m between 100 and 10000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.guardianships (
 id uuid primary key default gen_random_uuid(), guardian_id uuid not null references public.profiles(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade, relationship text not null,
 created_at timestamptz not null default now(), unique(guardian_id, child_id)
);
create table public.authorized_pickups (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id) on delete cascade,
 name text not null, relationship text not null, phone text, pin_hash text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.buses (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 registration text not null, make text, model text, capacity integer not null check(capacity > 0), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(school_id,registration)
);
create table public.routes (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 name text not null, type public.route_type not null, polyline jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.stops (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.routes(id) on delete cascade,
 name text not null, lat double precision not null check(lat between -90 and 90), lng double precision not null check(lng between -180 and 180),
 position integer not null check(position >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(route_id,position)
);
alter table public.children add constraint children_home_stop_fk foreign key(home_stop_id) references public.stops(id) on delete set null;
create table public.route_children (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.routes(id) on delete cascade,
 child_id uuid not null references public.children(id) on delete cascade, stop_id uuid references public.stops(id) on delete set null,
 created_at timestamptz not null default now(), unique(route_id,child_id)
);
create table public.trips (
 id uuid primary key default gen_random_uuid(), route_id uuid not null references public.routes(id),
 bus_id uuid not null references public.buses(id), supervisor_id uuid not null references public.profiles(id),
 status public.trip_status not null default 'scheduled', started_at timestamptz, ended_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status <> 'active') or started_at is not null), check((status <> 'completed') or ended_at is not null)
);
create table public.trip_events (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
 child_id uuid references public.children(id), type public.trip_event_type not null, recorded_by uuid not null references public.profiles(id),
 lat double precision check(lat between -90 and 90), lng double precision check(lng between -180 and 180),
 created_at timestamptz not null default now()
);
create table public.bus_live (
 trip_id uuid primary key references public.trips(id) on delete cascade, lat double precision not null check(lat between -90 and 90),
 lng double precision not null check(lng between -180 and 180), heading double precision check(heading between 0 and 360),
 speed double precision check(speed >= 0), updated_at timestamptz not null default now()
);
create table public.location_history (
 id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips(id) on delete cascade,
 lat double precision not null check(lat between -90 and 90), lng double precision not null check(lng between -180 and 180),
 speed double precision check(speed >= 0), recorded_at timestamptz not null default now()
);
create index location_history_trip_recorded_idx on public.location_history(trip_id,recorded_at desc);
create table public.absences (
 id uuid primary key default gen_random_uuid(), child_id uuid not null references public.children(id) on delete cascade,
 date date not null, reported_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(child_id,date)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 school_id uuid not null references public.schools(id) on delete cascade, type text not null, title_key text not null,
 body_key text not null, params jsonb not null default '{}'::jsonb, priority public.notification_priority not null default 'normal',
 read_at timestamptz, acknowledged_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
create table public.threads (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.threads(id) on delete cascade,
 sender_id uuid not null references public.profiles(id), body text not null check(length(body) between 1 and 10000),
 created_at timestamptz not null default now()
);
create table public.incidents (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 trip_id uuid references public.trips(id), child_id uuid references public.children(id), reported_by uuid not null references public.profiles(id),
 title text not null, description text not null, status public.incident_status not null default 'open',
 severity public.notification_priority not null default 'high', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.subscriptions (
 id uuid primary key default gen_random_uuid(), school_id uuid not null unique references public.schools(id) on delete cascade,
 plan text not null, status public.subscription_status not null default 'trialing', renews_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id) on delete cascade,
 guardian_id uuid references public.profiles(id), amount_usd numeric(12,2) not null check(amount_usd >= 0),
 currency text not null default 'USD', status public.invoice_status not null default 'pending', due_date date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
 amount numeric(12,2) not null check(amount > 0), currency text not null, provider text, provider_reference text,
 status text not null check(status in ('pending','succeeded','failed','refunded')), paid_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.app_settings (
 school_id uuid primary key references public.schools(id) on delete cascade,
 usd_to_zig_rate numeric(14,4) not null check(usd_to_zig_rate > 0),
 updated_at timestamptz not null default now()
);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), school_id uuid references public.schools(id) on delete cascade,
 actor_id uuid references public.profiles(id), action text not null, entity_type text not null,
 entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table public.demo_requests (
 id uuid primary key default gen_random_uuid(), school_name text not null, contact_name text not null,
 email text not null, phone text, message text, created_at timestamptz not null default now()
);

create function private.current_school_id() returns uuid language sql stable security definer set search_path = '' as $$
 select p.school_id from public.profiles p where p.id = (select auth.uid()) limit 1
$$;
create function private.current_role() returns public.user_role language sql stable security definer set search_path = '' as $$
 select p.role from public.profiles p where p.id = (select auth.uid()) limit 1
$$;
create function private.is_platform_owner() returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.current_role() = 'platform_owner',false)
$$;
create function private.is_school_admin(target_school uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(private.is_platform_owner() or (private.current_role() = 'school_admin' and private.current_school_id() = target_school),false)
$$;
create function private.is_guardian(target_child uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.guardianships g where g.child_id = target_child and g.guardian_id = (select auth.uid()))
$$;
create function private.is_assigned_supervisor(target_trip uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.trips t where t.id = target_trip and t.supervisor_id = (select auth.uid()))
$$;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

do $$
declare t text;
begin
 foreach t in array array['schools','profiles','children','guardianships','authorized_pickups','buses','routes','stops','route_children','trips','trip_events','bus_live','location_history','absences','notifications','threads','messages','incidents','subscriptions','invoices','payments','app_settings','audit_log','demo_requests'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

create policy schools_read on public.schools for select to authenticated using (private.is_platform_owner() or id = private.current_school_id());
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_school_admin(school_id) or (private.current_role() = 'supervisor' and school_id = private.current_school_id()));
create policy profiles_admin_write on public.profiles for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy children_read on public.children for select to authenticated using (private.is_school_admin(school_id) or private.is_platform_owner() or (school_id = private.current_school_id() and (private.is_guardian(id) or exists(select 1 from public.route_children rc join public.trips t on t.route_id=rc.route_id where rc.child_id=id and t.supervisor_id=(select auth.uid())))));
create policy children_admin_write on public.children for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy guardianships_read on public.guardianships for select to authenticated using (guardian_id=(select auth.uid()) or private.is_school_admin((select c.school_id from public.children c where c.id=child_id)) or exists(select 1 from public.children c join public.route_children rc on rc.child_id=c.id join public.trips t on t.route_id=rc.route_id where c.id=child_id and t.supervisor_id=(select auth.uid())));
create policy guardianships_admin_write on public.guardianships for all to authenticated using (private.is_school_admin((select c.school_id from public.children c where c.id=child_id))) with check (private.is_school_admin((select c.school_id from public.children c where c.id=child_id)));
create policy authorized_pickups_read on public.authorized_pickups for select to authenticated using (private.is_guardian(child_id) or private.is_school_admin((select c.school_id from public.children c where c.id=child_id)));
create policy authorized_pickups_admin_write on public.authorized_pickups for all to authenticated using (private.is_school_admin((select c.school_id from public.children c where c.id=child_id))) with check (private.is_school_admin((select c.school_id from public.children c where c.id=child_id)));
create policy buses_school_access on public.buses for all to authenticated using (private.is_school_admin(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.bus_id=id and t.supervisor_id=(select auth.uid())))) with check (private.is_school_admin(school_id));
create policy routes_school_access on public.routes for all to authenticated using (private.is_school_admin(school_id) or (school_id=private.current_school_id() and exists(select 1 from public.trips t where t.route_id=id and t.supervisor_id=(select auth.uid())))) with check (private.is_school_admin(school_id));
create policy stops_access on public.stops for all to authenticated using (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)) or exists(select 1 from public.trips t where t.route_id=stops.route_id and t.supervisor_id=(select auth.uid()))) with check (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)));
create policy route_children_access on public.route_children for all to authenticated using (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)) or exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid())) or private.is_guardian(child_id)) with check (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)));
create policy trips_read on public.trips for select to authenticated using (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)) or supervisor_id=(select auth.uid()) or (status='active' and exists(select 1 from public.route_children rc where rc.route_id=trips.route_id and private.is_guardian(rc.child_id))));
create policy trips_admin_write on public.trips for all to authenticated using (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id))) with check (private.is_school_admin((select r.school_id from public.routes r where r.id=route_id)));
create policy trips_supervisor_update on public.trips for update to authenticated using (supervisor_id=(select auth.uid())) with check (supervisor_id=(select auth.uid()));
create policy trip_events_read on public.trip_events for select to authenticated using (private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)) or (child_id is not null and private.is_guardian(child_id)));
create policy trip_events_supervisor_insert on public.trip_events for insert to authenticated with check (recorded_by=(select auth.uid()) and private.is_assigned_supervisor(trip_id));
create policy trip_events_admin_all on public.trip_events for all to authenticated using (private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id))) with check (private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)));
create policy bus_live_guardian_read on public.bus_live for select to authenticated using (exists(select 1 from public.trips t join public.route_children rc on rc.route_id=t.route_id where t.id=trip_id and t.status='active' and private.is_guardian(rc.child_id)) or private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)));
create policy bus_live_supervisor_write on public.bus_live for all to authenticated using (private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id))) with check (private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)));
create policy location_history_read on public.location_history for select to authenticated using (exists(select 1 from public.trips t join public.route_children rc on rc.route_id=t.route_id where t.id=trip_id and t.status='active' and private.is_guardian(rc.child_id)) or private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)));
create policy location_history_write on public.location_history for insert to authenticated with check (private.is_assigned_supervisor(trip_id) or private.is_school_admin((select r.school_id from public.trips t join public.routes r on r.id=t.route_id where t.id=trip_id)));
create policy absences_read on public.absences for select to authenticated using (private.is_guardian(child_id) or private.is_school_admin((select school_id from public.children c where c.id=child_id)));
create policy absences_write on public.absences for all to authenticated using (private.is_school_admin((select school_id from public.children c where c.id=child_id)) or (reported_by=(select auth.uid()) and private.is_guardian(child_id))) with check (private.is_school_admin((select school_id from public.children c where c.id=child_id)) or (reported_by=(select auth.uid()) and private.is_guardian(child_id)));
create policy notifications_read_update on public.notifications for select to authenticated using (user_id=(select auth.uid()) or private.is_school_admin(school_id));
create policy notifications_update on public.notifications for update to authenticated using (user_id=(select auth.uid()) or private.is_school_admin(school_id)) with check (user_id=(select auth.uid()) or private.is_school_admin(school_id));
create policy threads_access on public.threads for all to authenticated using (private.is_school_admin(school_id) or exists(select 1 from public.messages m where m.thread_id=id and m.sender_id=(select auth.uid()))) with check (private.is_school_admin(school_id));
create policy messages_read on public.messages for select to authenticated using (sender_id=(select auth.uid()) or exists(select 1 from public.threads th where th.id=thread_id and private.is_school_admin(th.school_id)) or exists(select 1 from public.messages m where m.thread_id=messages.thread_id and m.sender_id=(select auth.uid())));
create policy messages_insert on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and exists(select 1 from public.threads th where th.id=thread_id and (private.is_school_admin(th.school_id) or th.school_id=private.current_school_id())));
create policy incidents_access on public.incidents for all to authenticated using (private.is_school_admin(school_id) or reported_by=(select auth.uid()) or (child_id is not null and private.is_guardian(child_id)) or (trip_id is not null and private.is_assigned_supervisor(trip_id))) with check (private.is_school_admin(school_id) or reported_by=(select auth.uid()));
create policy subscriptions_admin on public.subscriptions for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy invoices_read on public.invoices for select to authenticated using (guardian_id=(select auth.uid()) or private.is_school_admin(school_id) or private.is_platform_owner());
create policy invoices_admin_write on public.invoices for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy payments_read on public.payments for select to authenticated using (exists(select 1 from public.invoices i where i.id=invoice_id and (i.guardian_id=(select auth.uid()) or private.is_school_admin(i.school_id))));
create policy payments_admin_write on public.payments for all to authenticated using (exists(select 1 from public.invoices i where i.id=invoice_id and private.is_school_admin(i.school_id))) with check (exists(select 1 from public.invoices i where i.id=invoice_id and private.is_school_admin(i.school_id)));
create policy app_settings_admin on public.app_settings for all to authenticated using (private.is_school_admin(school_id)) with check (private.is_school_admin(school_id));
create policy audit_log_read on public.audit_log for select to authenticated using (private.is_school_admin(school_id) or actor_id=(select auth.uid()));
create policy audit_log_insert on public.audit_log for insert to authenticated with check (actor_id=(select auth.uid()) and school_id=private.current_school_id());
create policy demo_requests_no_public_access on public.demo_requests for insert to anon, authenticated with check (true);
create policy demo_requests_owner_read on public.demo_requests for select to authenticated using (private.is_platform_owner());

do $$
declare t text;
begin
 foreach t in array array['schools','profiles','children','authorized_pickups','buses','routes','stops','trips','threads','incidents','subscriptions','invoices','payments'] loop
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
 end loop;
end $$;
