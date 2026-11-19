-- Active pickup authorization state and payment idempotency metadata.
alter table public.authorized_pickups
  add column if not exists active boolean not null default true;
create index if not exists authorized_pickups_active_child_idx
  on public.authorized_pickups(child_id) where active;
grant select(id, child_id, name, relationship, phone, active, created_at, updated_at)
  on public.authorized_pickups to authenticated;

-- Supervisors receive only currently valid pickup authorizations for their active manifest.
drop policy if exists authorized_pickups_read on public.authorized_pickups;
create policy authorized_pickups_read on public.authorized_pickups
for select to authenticated
using (
  private.is_guardian(child_id)
  or private.can_read_school((select c.school_id from public.children c where c.id = authorized_pickups.child_id))
  or (active and private.is_child_on_assigned_active_trip(child_id))
);

-- A revoked authorization must never verify, even if its PIN hash remains stored.
create or replace function public.verify_pickup_pin(child_id uuid, pickup_id uuid, pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  stored_hash text;
  failures integer;
  child_school uuid;
  allowed boolean;
begin
  if actor is null or pin is null or length(pin) not between 4 and 12 or pin !~ '^[0-9]+$' then
    return false;
  end if;

  select c.school_id into child_school
  from public.children c where c.id = verify_pickup_pin.child_id;
  if child_school is null then return false; end if;

  select exists (
    select 1 from public.guardianships g
    where g.child_id = verify_pickup_pin.child_id and g.guardian_id = actor
    union all
    select 1 from public.route_children rc
    join public.trips t on t.route_id = rc.route_id
    where rc.child_id = verify_pickup_pin.child_id
      and t.supervisor_id = actor and t.status = 'active'
  ) into allowed;
  if not allowed and not private.is_school_admin(child_school) then return false; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || verify_pickup_pin.child_id::text, 0));
  select count(*) into failures
  from private.pickup_pin_attempts a
  where a.actor_id = actor and a.child_id = verify_pickup_pin.child_id
    and not a.succeeded and a.attempted_at > now() - interval '15 minutes';

  if failures >= 5 then
    insert into private.pickup_pin_attempts(actor_id, child_id, succeeded)
    values (actor, verify_pickup_pin.child_id, false);
    insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
    values (child_school, actor, 'pickup_pin_rate_limited', 'authorized_pickup', pickup_id,
      jsonb_build_object('attempts', failures + 1));
    return false;
  end if;

  select ap.pin_hash into stored_hash
  from public.authorized_pickups ap
  where ap.id = pickup_id
    and ap.child_id = verify_pickup_pin.child_id
    and ap.active;

  if stored_hash is null then
    allowed := false;
  else
    allowed := extensions.crypt(pin, stored_hash) = stored_hash;
  end if;

  insert into private.pickup_pin_attempts(actor_id, child_id, succeeded)
  values (actor, verify_pickup_pin.child_id, allowed);
  insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
  values (child_school, actor, case when allowed then 'pickup_pin_verified' else 'pickup_pin_failed' end,
    'authorized_pickup', pickup_id, jsonb_build_object('child_id', verify_pickup_pin.child_id));
  return allowed;
end
$$;
revoke all on function public.verify_pickup_pin(uuid, uuid, text) from public, anon;
grant execute on function public.verify_pickup_pin(uuid, uuid, text) to authenticated;

alter table public.payments
  add column if not exists method text not null default 'manual',
  add column if not exists idempotency_key text;
alter table public.payments
  add constraint payments_method_check
  check (method in ('cash', 'bank_transfer', 'ecocash', 'onemoney', 'paynow', 'manual', 'other'));
alter table public.payments
  add constraint payments_idempotency_key_length_check
  check (idempotency_key is null or length(idempotency_key) between 8 and 128);
create unique index if not exists payments_invoice_provider_reference_uidx
  on public.payments(invoice_id, provider, provider_reference)
  where provider is not null and provider_reference is not null;
create unique index if not exists payments_invoice_provider_idempotency_uidx
  on public.payments(invoice_id, provider, idempotency_key)
  where provider is not null and idempotency_key is not null;
