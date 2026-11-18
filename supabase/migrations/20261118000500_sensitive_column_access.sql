-- Do not expose credential hashes or device push tokens through PostgREST.
revoke select on public.profiles from authenticated;
grant select(id,school_id,role,full_name,phone,language,avatar_url,created_at,updated_at)
on public.profiles to authenticated;
revoke select on public.authorized_pickups from authenticated;
grant select(id,child_id,name,relationship,phone,created_at,updated_at)
on public.authorized_pickups to authenticated;

-- Tighten incident access: guardians and assigned supervisors can read relevant incidents,
-- but only school administrators can edit or delete records.
drop policy if exists incidents_access on public.incidents;
create policy incidents_read on public.incidents for select to authenticated using (
 private.is_school_admin(school_id)
 or reported_by=(select auth.uid())
 or (child_id is not null and private.is_guardian(child_id))
 or (trip_id is not null and private.is_assigned_supervisor(trip_id))
);
create policy incidents_insert on public.incidents for insert to authenticated with check (
 reported_by=(select auth.uid())
 and (
  private.is_school_admin(school_id)
  or (child_id is not null and private.is_guardian(child_id))
  or (trip_id is not null and private.is_assigned_supervisor(trip_id))
 )
);
create policy incidents_admin_update on public.incidents for update to authenticated using (
 private.is_school_admin(school_id)
) with check (private.is_school_admin(school_id));
create policy incidents_admin_delete on public.incidents for delete to authenticated using (
 private.is_school_admin(school_id)
);

-- Manifest edits by a supervisor must remain within that supervisor's school.
drop policy if exists route_children_supervisor_update on public.route_children;
create policy route_children_supervisor_update on public.route_children for update to authenticated
using (exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid())))
with check (
 exists(select 1 from public.trips t where t.route_id=route_children.route_id and t.supervisor_id=(select auth.uid()))
 and exists(select 1 from public.children c where c.id=route_children.child_id and c.school_id=private.current_school_id())
);

-- Ensure PIN verification is serialised per actor/child to prevent concurrent attempts
-- from bypassing the configured threshold.
create or replace function public.verify_pickup_pin(child_id uuid,pickup_id uuid,pin text)
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
 perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || verify_pickup_pin.child_id::text,0));
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
 else allowed := extensions.crypt(pin,stored_hash)=stored_hash;
 end if;
 insert into private.pickup_pin_attempts(actor_id,child_id,succeeded) values(actor,verify_pickup_pin.child_id,allowed);
 insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
 values(child_school,actor,case when allowed then 'pickup_pin_verified' else 'pickup_pin_failed' end,'authorized_pickup',pickup_id,
 jsonb_build_object('child_id',verify_pickup_pin.child_id));
 return allowed;
end $$;
revoke all on function public.verify_pickup_pin(uuid,uuid,text) from public,anon;
grant execute on function public.verify_pickup_pin(uuid,uuid,text) to authenticated;

alter table public.buses add column if not exists driver_name text;
