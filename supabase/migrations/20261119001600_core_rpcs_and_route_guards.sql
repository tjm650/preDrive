-- Complete the RPCs consumed by the apps and enforce route/asset immutability
-- whenever a scheduled or active trip depends on those records.

-- Push tokens are owned by one profile only and can be cleared on sign-out.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_token is not null and (
    length(p_token) > 512
    or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,256}\]$'
  ) then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  if p_token is not null then
    update public.profiles
    set expo_push_token = null
    where expo_push_token = p_token and id <> actor;
  end if;

  update public.profiles
  set expo_push_token = p_token, updated_at = now()
  where id = actor;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
end
$$;
revoke all on function public.register_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;

-- School admins can create a child and attach an existing parent atomically.
create or replace function public.create_child_with_guardian(
  p_first_name text,
  p_guardian_id uuid,
  p_class_name text,
  p_relationship text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  school_id uuid := private.current_school_id();
  guardian_school uuid;
  guardian_role public.user_role;
  child_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if school_id is null or not private.is_school_admin(school_id) then
    raise exception 'School administrator access required' using errcode = '42501';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 100 then
    raise exception 'A valid child first name is required' using errcode = '22023';
  end if;
  select p.school_id, p.role into guardian_school, guardian_role
  from public.profiles p where p.id = p_guardian_id;
  if guardian_school is distinct from school_id or guardian_role is distinct from 'parent'::public.user_role then
    raise exception 'Guardian must be a registered parent in this school' using errcode = '22023';
  end if;

  insert into public.children(school_id, first_name, class_name)
  values (school_id, btrim(p_first_name), nullif(btrim(p_class_name), ''))
  returning id into child_id;

  insert into public.guardianships(guardian_id, child_id, relationship)
  values (p_guardian_id, child_id, coalesce(nullif(btrim(p_relationship), ''), 'Parent'));

  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (school_id, actor, 'child_created_with_guardian', 'child', child_id,
    jsonb_build_object('guardian_id', p_guardian_id));
  return child_id;
end
$$;
revoke all on function public.create_child_with_guardian(text, uuid, text, text) from public, anon;
grant execute on function public.create_child_with_guardian(text, uuid, text, text) to authenticated;

-- Manual payments are reconciled server-side, support partial balances and cannot
-- be inserted directly by a browser/mobile client.
create or replace function public.record_manual_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_currency text,
  p_provider_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invoice_row public.invoices%rowtype;
  already_paid numeric(12,2);
  payment_id uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
     or p_currency is null or length(btrim(p_currency)) <> 3
     or p_provider_reference is null or length(btrim(p_provider_reference)) not between 3 and 120 then
    raise exception 'Invalid manual payment details' using errcode = '22023';
  end if;

  select * into invoice_row
  from public.invoices i
  where i.id = p_invoice_id
  for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if not private.is_school_admin(invoice_row.school_id) then
    raise exception 'Only this school administrator can reconcile a manual payment' using errcode = '42501';
  end if;
  if invoice_row.status not in ('pending', 'overdue') then
    raise exception 'Invoice is not open for payment' using errcode = '22023';
  end if;
  if upper(btrim(p_currency)) <> upper(invoice_row.currency) then
    raise exception 'Payment currency does not match the invoice' using errcode = '22023';
  end if;

  select coalesce(sum(p.amount), 0) into already_paid
  from public.payments p
  where p.invoice_id = invoice_row.id and p.status = 'succeeded';
  if p_amount > invoice_row.amount_usd - already_paid then
    raise exception 'Payment exceeds the outstanding invoice balance' using errcode = '22023';
  end if;

  insert into public.payments(
    invoice_id, amount, currency, provider, provider_reference,
    status, paid_at, method
  )
  values (
    invoice_row.id, p_amount, upper(btrim(p_currency)), 'manual',
    btrim(p_provider_reference), 'succeeded', now(), 'manual'
  )
  returning id into payment_id;

  select coalesce(sum(p.amount), 0) into already_paid
  from public.payments p
  where p.invoice_id = invoice_row.id and p.status = 'succeeded';
  if already_paid >= invoice_row.amount_usd then
    update public.invoices set status = 'paid', updated_at = now()
    where id = invoice_row.id;
  end if;

  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (invoice_row.school_id, actor, 'manual_payment_reconciled', 'payment', payment_id,
    jsonb_build_object('invoice_id', invoice_row.id, 'amount', p_amount,
      'currency', upper(btrim(p_currency)), 'provider_reference', btrim(p_provider_reference)));
  return payment_id;
end
$$;
revoke all on function public.record_manual_payment(uuid, numeric, text, text) from public, anon;
grant execute on function public.record_manual_payment(uuid, numeric, text, text) to authenticated;

-- Prevent bypassing the dedicated pickup PIN flow to create verified handovers.
create or replace function public.record_trip_event(
  p_trip_id uuid,
  p_child_id uuid,
  p_type public.trip_event_type,
  p_lat double precision default null,
  p_lng double precision default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_client_recorded_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_row public.trips%rowtype;
  route_row public.routes%rowtype;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into trip_row from public.trips where id = p_trip_id for share;
  if not found then raise exception 'Trip not found' using errcode = 'P0002'; end if;
  if trip_row.supervisor_id <> auth.uid() then
    raise exception 'Only the assigned supervisor can record trip events' using errcode = '42501';
  end if;
  if trip_row.status <> 'active' then raise exception 'Trip is not active' using errcode = '22023'; end if;
  if p_type is null then raise exception 'Trip event type is required' using errcode = '22023'; end if;
  if p_type not in ('boarded','arrived_school','dropped_home','absent','sos','delay','handover_rejected','handover_verified','child_missing') then
    raise exception 'Unsupported trip event' using errcode = '22023';
  end if;
  if p_type in ('handover_verified','handover_rejected') then
    raise exception 'Pickup handover events must be recorded through verify_pickup_handover' using errcode = '22023';
  end if;
  if p_type in ('boarded','arrived_school','dropped_home','absent','child_missing') and p_child_id is null then
    raise exception 'This event requires a manifest child' using errcode = '22023';
  end if;
  if p_child_id is not null and not exists (
    select 1 from public.route_children rc
    where rc.route_id = trip_row.route_id and rc.child_id = p_child_id
  ) then
    raise exception 'Child is not on this trip manifest' using errcode = '42501';
  end if;
  select * into route_row from public.routes where id = trip_row.route_id;
  if p_type = 'dropped_home' and route_row.type <> 'dropoff' then
    raise exception 'A home drop-off can only be recorded on a drop-off route' using errcode = '22023';
  end if;
  if p_type = 'absent' and exists (
    select 1 from public.trip_events e
    where e.trip_id = p_trip_id and e.child_id = p_child_id and e.type = 'boarded'
  ) then
    raise exception 'A child who has boarded cannot be marked absent' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat < -90 or p_lat > 90))
     or (p_lng is not null and (p_lng < -180 or p_lng > 180)) then
    raise exception 'Latitude and longitude must be valid and supplied together' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' or octet_length(p_metadata::text) > 4096 then
    raise exception 'Event metadata must be a JSON object no larger than 4 KB' using errcode = '22023';
  end if;
  if p_idempotency_key is not null and length(p_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  insert into public.trip_events(
    trip_id, child_id, type, recorded_by, lat, lng, metadata, idempotency_key, client_recorded_at
  )
  values (
    p_trip_id, p_child_id, p_type, auth.uid(), p_lat, p_lng, p_metadata, p_idempotency_key, p_client_recorded_at
  )
  on conflict (trip_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into event_id;

  if event_id is null and p_idempotency_key is not null then
    select id into event_id from public.trip_events
    where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  end if;
  return event_id;
end
$$;
revoke all on function public.record_trip_event(uuid, uuid, public.trip_event_type, double precision, double precision, jsonb, text, timestamptz) from public, anon;
grant execute on function public.record_trip_event(uuid, uuid, public.trip_event_type, double precision, double precision, jsonb, text, timestamptz) to authenticated;

-- The PIN RPC is the only route that may create handover_verified events.
create or replace function public.verify_pickup_handover(
  p_trip_id uuid,
  p_child_id uuid,
  p_pickup_id uuid,
  p_pin text,
  p_lat double precision default null,
  p_lng double precision default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  trip_row public.trips%rowtype;
  verified boolean;
  event_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into trip_row from public.trips where id = p_trip_id for share;
  if not found or trip_row.supervisor_id <> auth.uid() or trip_row.status <> 'active' then
    raise exception 'Active trip assigned to the current supervisor is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.route_children rc
    where rc.route_id = trip_row.route_id and rc.child_id = p_child_id
  ) then
    raise exception 'Child is not on this trip manifest' using errcode = '42501';
  end if;
  if (p_lat is null) <> (p_lng is null)
     or (p_lat is not null and (p_lat < -90 or p_lat > 90))
     or (p_lng is not null and (p_lng < -180 or p_lng > 180)) then
    raise exception 'Latitude and longitude must be valid and supplied together' using errcode = '22023';
  end if;
  if p_idempotency_key is not null and length(p_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  verified := public.verify_pickup_pin(p_child_id, p_pickup_id, p_pin);
  insert into public.trip_events(
    trip_id, child_id, type, recorded_by, lat, lng, metadata, idempotency_key, client_recorded_at
  )
  values (
    p_trip_id, p_child_id,
    case when verified then 'handover_verified'::public.trip_event_type
         else 'handover_rejected'::public.trip_event_type end,
    auth.uid(), p_lat, p_lng,
    jsonb_build_object('authorized_pickup_id', p_pickup_id, 'pin_verified', verified),
    p_idempotency_key, now()
  )
  on conflict (trip_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into event_id;

  if event_id is null and p_idempotency_key is not null then
    select id into event_id from public.trip_events
    where trip_id = p_trip_id and idempotency_key = p_idempotency_key;
  end if;
  return jsonb_build_object('verified', verified, 'event_id', event_id);
end
$$;
revoke all on function public.verify_pickup_handover(uuid, uuid, uuid, text, double precision, double precision, text) from public, anon;
grant execute on function public.verify_pickup_handover(uuid, uuid, uuid, text, double precision, double precision, text) to authenticated;

-- Route geometry provenance: provider calculation is not the same as a safe,
-- operator-confirmed field check.
alter table public.routes
  add column if not exists geometry_source text,
  add column if not exists geometry_status text not null default 'pending',
  add column if not exists geometry_verified_at timestamptz,
  add column if not exists distance_m integer,
  add column if not exists duration_s integer,
  add column if not exists field_checked_at timestamptz,
  add column if not exists field_checked_by uuid references public.profiles(id) on delete set null,
  add column if not exists field_check_notes text;
alter table public.routes
  add constraint routes_geometry_status_check
  check (geometry_status in ('pending','provider_verified','field_checked','failed'));
create index if not exists routes_geometry_status_idx on public.routes(geometry_status, school_id);

create or replace function public.verify_route_field_check(p_route_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  route_row public.routes%rowtype;
  stop_count integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into route_row from public.routes where id = p_route_id for update;
  if not found then raise exception 'Route not found' using errcode = 'P0002'; end if;
  if not private.is_school_admin(route_row.school_id) then
    raise exception 'Only this school's administrator can confirm a field check' using errcode = '42501';
  end if;
  select count(*) into stop_count from public.stops where route_id = p_route_id;
  if stop_count < 2 or route_row.geometry_status <> 'provider_verified' then
    raise exception 'A provider-verified route with at least two stops is required before field check' using errcode = '22023';
  end if;
  update public.routes
  set geometry_status = 'field_checked',
      field_checked_at = now(),
      field_checked_by = actor,
      field_check_notes = 'Operator field check confirmed'
  where id = p_route_id;
  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (route_row.school_id, actor, 'route_field_check_confirmed', 'route', p_route_id,
    jsonb_build_object('stop_count', stop_count, 'geometry_source', route_row.geometry_source));
  return true;
end
$$;
revoke all on function public.verify_route_field_check(uuid) from public, anon;
grant execute on function public.verify_route_field_check(uuid) to authenticated;

-- Every scheduled/active trip freezes the manifest and its route/bus/child assets.
create or replace function private.guard_route_manifest_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_id_to_check uuid;
begin
  if tg_op = 'DELETE' then route_id_to_check := old.route_id;
  else route_id_to_check := new.route_id;
  end if;
  if exists (
    select 1 from public.trips t
    where t.route_id = route_id_to_check and t.status in ('scheduled','active')
  ) or (
    tg_op = 'UPDATE' and old.route_id is distinct from new.route_id
    and exists (
      select 1 from public.trips t
      where t.route_id = old.route_id and t.status in ('scheduled','active')
    )
  ) then
    raise exception 'Route manifest cannot change while a trip is scheduled or active' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;
revoke all on function private.guard_route_manifest_change() from public, anon, authenticated;
drop trigger if exists guard_route_manifest_change on public.route_children;
create trigger guard_route_manifest_change
before insert or update or delete on public.route_children
for each row execute function private.guard_route_manifest_change();

create or replace function private.guard_route_stop_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_id_to_check uuid;
begin
  if tg_op = 'DELETE' then route_id_to_check := old.route_id;
  else route_id_to_check := new.route_id;
  end if;
  if exists (
    select 1 from public.trips t
    where t.route_id = route_id_to_check and t.status in ('scheduled','active')
  ) or (
    tg_op = 'UPDATE' and old.route_id is distinct from new.route_id
    and exists (
      select 1 from public.trips t
      where t.route_id = old.route_id and t.status in ('scheduled','active')
    )
  ) then
    raise exception 'Route stops cannot change while a trip is scheduled or active' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;
revoke all on function private.guard_route_stop_change() from public, anon, authenticated;
drop trigger if exists guard_route_stop_change on public.stops;
create trigger guard_route_stop_change
before insert or update or delete on public.stops
for each row execute function private.guard_route_stop_change();

create or replace function private.guard_route_type_or_archive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.type is distinct from old.type or new.archived_at is distinct from old.archived_at)
     and exists (
       select 1 from public.trips t
       where t.route_id = old.id and t.status in ('scheduled','active')
     ) then
    raise exception 'Route type or archive state cannot change while a trip is scheduled or active' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_route_type_or_archive_change() from public, anon, authenticated;
drop trigger if exists guard_route_type_or_archive_change on public.routes;
create trigger guard_route_type_or_archive_change
before update of type, archived_at on public.routes
for each row execute function private.guard_route_type_or_archive_change();

create or replace function private.guard_bus_archive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.active is distinct from old.active or new.archived_at is distinct from old.archived_at)
     and exists (
       select 1 from public.trips t
       where t.bus_id = old.id and t.status in ('scheduled','active')
     ) then
    raise exception 'Bus availability or archive state cannot change while a trip is scheduled or active' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_bus_archive_change() from public, anon, authenticated;
drop trigger if exists guard_bus_archive_change on public.buses;
create trigger guard_bus_archive_change
before update of active, archived_at on public.buses
for each row execute function private.guard_bus_archive_change();

create or replace function private.guard_child_archive_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and exists (
       select 1
       from public.route_children rc
       join public.trips t on t.route_id = rc.route_id
       where rc.child_id = old.id and t.status in ('scheduled','active')
     ) then
    raise exception 'A child on a scheduled or active trip manifest cannot be archived' using errcode = '55000';
  end if;
  return new;
end
$$;
revoke all on function private.guard_child_archive_change() from public, anon, authenticated;
drop trigger if exists guard_child_archive_change on public.children;
create trigger guard_child_archive_change
before update of archived_at on public.children
for each row execute function private.guard_child_archive_change();

create or replace function private.invalidate_route_geometry_after_stop_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_id_to_invalidate uuid;
begin
  if tg_op = 'DELETE' then route_id_to_invalidate := old.route_id;
  else route_id_to_invalidate := new.route_id;
  end if;
  update public.routes
  set geometry_status = 'pending',
      geometry_source = null,
      geometry_verified_at = null,
      distance_m = null,
      duration_s = null,
      field_checked_at = null,
      field_checked_by = null,
      field_check_notes = null,
      updated_at = now()
  where id = route_id_to_invalidate;
  if tg_op = 'UPDATE' and old.route_id is distinct from new.route_id then
    update public.routes
    set geometry_status = 'pending',
        geometry_source = null,
        geometry_verified_at = null,
        distance_m = null,
        duration_s = null,
        field_checked_at = null,
        field_checked_by = null,
        field_check_notes = null,
        updated_at = now()
    where id = old.route_id;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;
revoke all on function private.invalidate_route_geometry_after_stop_change() from public, anon, authenticated;
drop trigger if exists invalidate_route_geometry_after_stop_change on public.stops;
create trigger invalidate_route_geometry_after_stop_change
after insert or update or delete on public.stops
for each row execute function private.invalidate_route_geometry_after_stop_change();

-- Invitation ledgers are tenant scoped; Edge Functions write them with service_role.
create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 5 and 320),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  role public.user_role not null check (role in ('supervisor','school_admin')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'invited' check (status in ('invited','accepted','expired','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, email)
);
create table if not exists public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 5 and 320),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'invited' check (status in ('invited','accepted','expired','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, email)
);
alter table public.staff_invitations enable row level security;
alter table public.parent_invitations enable row level security;
revoke all on public.staff_invitations, public.parent_invitations from public, anon;
grant select on public.staff_invitations, public.parent_invitations to authenticated;
grant all on public.staff_invitations, public.parent_invitations to service_role;
drop policy if exists staff_invitations_school_read on public.staff_invitations;
create policy staff_invitations_school_read on public.staff_invitations
for select to authenticated using (private.can_read_school(school_id));
drop policy if exists parent_invitations_school_read on public.parent_invitations;
create policy parent_invitations_school_read on public.parent_invitations
for select to authenticated using (private.can_read_school(school_id));
create index if not exists staff_invitations_user_idx on public.staff_invitations(invited_user_id);
create index if not exists parent_invitations_user_idx on public.parent_invitations(invited_user_id);
drop trigger if exists staff_invitations_set_updated_at on public.staff_invitations;
create trigger staff_invitations_set_updated_at before update on public.staff_invitations
for each row execute function public.set_updated_at();
drop trigger if exists parent_invitations_set_updated_at on public.parent_invitations;
create trigger parent_invitations_set_updated_at before update on public.parent_invitations
for each row execute function public.set_updated_at();
