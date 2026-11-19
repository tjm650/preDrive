begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(135);

-- Isolated two-school fixture. Every row is rolled back at the end of this test.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('91000000-0000-4000-8000-000000000001','authenticated','authenticated','parent-a@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','authenticated','authenticated','parent-b@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000003','authenticated','authenticated','supervisor-a@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000004','authenticated','authenticated','supervisor-b@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000005','authenticated','authenticated','parent-a2@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000006','authenticated','authenticated','admin-a@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000007','authenticated','authenticated','owner@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000008','authenticated','authenticated','new-parent@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"New Parent","role":"platform_owner","school_id":"92000000-0000-4000-8000-000000000002"}',now(),now()),
('91000000-0000-4000-8000-000000000009','authenticated','authenticated','second-new-parent@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

insert into public.schools(id,name,slug) values
('92000000-0000-4000-8000-000000000001','School A','rls-school-a'),
('92000000-0000-4000-8000-000000000002','School B','rls-school-b');

insert into public.profiles(id,school_id,role,full_name) values
('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','parent','Parent A'),
('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','parent','Parent B'),
('91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','supervisor','Supervisor A'),
('91000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','supervisor','Supervisor B'),
('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','parent','Parent A2'),
('91000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001','school_admin','Admin A'),
('91000000-0000-4000-8000-000000000007',null,'platform_owner','Platform Owner')
on conflict (id) do update set
 school_id=excluded.school_id, role=excluded.role, full_name=excluded.full_name;

insert into public.children(id,school_id,first_name) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Child A1'),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Child A2'),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','Child B1');

insert into public.guardianships(guardian_id,child_id,relationship) values
('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Parent'),
('91000000-0000-4000-8000-000000000005','93000000-0000-4000-8000-000000000002','Parent'),
('91000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','Parent');

insert into public.authorized_pickups(child_id,name,relationship,pin_hash) values
('93000000-0000-4000-8000-000000000001','A1 Pickup','Aunt','test-hash-a'),
('93000000-0000-4000-8000-000000000003','B1 Pickup','Uncle','test-hash-b');
insert into public.authorized_pickups(child_id,name,relationship,pin_hash,active)
values ('93000000-0000-4000-8000-000000000001','Revoked Pickup','Aunt',
  extensions.crypt('1234',extensions.gen_salt('bf')),false);

insert into public.buses(id,school_id,registration,capacity) values
('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','TEST-A',10),
('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','TEST-B',10);

insert into public.routes(id,school_id,name,type) values
('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Route A','pickup'),
('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Route B','pickup');

insert into public.stops(id,route_id,name,lat,lng,position) values
('95500000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','Stop A1',-17.8,31.0,0),
('95500000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000001','Stop A2',-17.81,31.01,1);

insert into public.route_children(route_id,child_id) values
('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001'),
('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002'),
('95000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');

insert into public.trips(id,route_id,bus_id,supervisor_id,status,started_at,ended_at) values
('96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','active',now(),null),
('96000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004','completed',now(),now());

insert into public.trip_events(trip_id,child_id,type,recorded_by) values
('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','boarded','91000000-0000-4000-8000-000000000003'),
('96000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','boarded','91000000-0000-4000-8000-000000000004');

insert into public.bus_live(trip_id,lat,lng) values
('96000000-0000-4000-8000-000000000001',-17.8,31.0),
('96000000-0000-4000-8000-000000000002',-17.8,31.0);

insert into public.location_history(trip_id,lat,lng,speed,recorded_at)
values ('96000000-0000-4000-8000-000000000001',-17.8,31.0,25,now());

insert into public.invoices(school_id,guardian_id,amount_usd,currency,status,due_date) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',25,'USD','pending',current_date),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005',25,'USD','pending',current_date),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',25,'USD','pending',current_date);

insert into public.notifications(user_id,school_id,type,title_key,body_key) values
('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','test','test','test'),
('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','test','test','test'),
('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','test','test','test');

insert into public.subscriptions(school_id,plan,status) values
('92000000-0000-4000-8000-000000000001','starter','trialing'),
('92000000-0000-4000-8000-000000000002','starter','trialing');

-- Device tokens are reassigned to the currently authenticated account and cleared on sign-out.
update public.profiles set expo_push_token='ExpoPushToken[TEST-DEVICE-01]'
where id='91000000-0000-4000-8000-000000000002';

-- Parent: only their own child, child events, invoice, notification and active bus.
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.register_push_token('ExpoPushToken[TEST-DEVICE-01]')$$,
  'authenticated user can register their device push token');
reset role;
select is((select expo_push_token from public.profiles where id='91000000-0000-4000-8000-000000000001'),
  'ExpoPushToken[TEST-DEVICE-01]','device token is attached to the current profile');
select is((select expo_push_token from public.profiles where id='91000000-0000-4000-8000-000000000002'),
  null::text,'same device token is removed from the previous profile');
set local role authenticated;
select lives_ok($$select public.register_push_token(null)$$,
  'authenticated user can clear their push token during sign-out');
reset role;
select is((select expo_push_token from public.profiles where id='91000000-0000-4000-8000-000000000001'),
  null::text,'sign-out clears the active profile push token');
set local role authenticated;
select is((select count(*)::int from public.children),1,'parent sees only their own child');
select ok(not exists(select 1 from public.children where id='93000000-0000-4000-8000-000000000002'),'parent cannot read another family in the same school');
select ok(not exists(select 1 from public.children where id='93000000-0000-4000-8000-000000000003'),'parent cannot read a child in another school');
select is((select count(*)::int from public.trip_events),1,'parent sees only their own child event');
select is((select count(*)::int from public.invoices),1,'parent sees only their own invoice');
select is((select count(*)::int from public.notifications where type='test'),1,'parent sees only their own notification');
select is((select count(*)::int from public.bus_live),1,'parent sees location only for an active trip containing their child');
select is((select count(*)::int from public.location_history),0,'parent cannot read historical bus location under any trip state');
select is((select count(*)::int from public.routes),1,'parent sees route metadata only for an active trip containing their child');
select is((select count(*)::int from public.buses),1,'parent sees vehicle metadata only for an active trip containing their child');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname = any(array['schools','profiles','children','guardianships','authorized_pickups','buses','routes','stops','route_children','trips','trip_events','bus_live','location_history','absences','notifications','messages','threads','thread_members','incidents','subscriptions','invoices','payments','app_settings','audit_log','demo_requests','push_receipts','staff_invitations','parent_invitations']) and not c.relrowsecurity),'RLS is enabled on every preDrive public table');

-- Supervisor: assigned trip manifest and its guardian contacts only.
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.trips),1,'supervisor sees only their assigned trip');
select throws_ok(
  $$insert into public.trip_events(trip_id,child_id,type,recorded_by)
   values ('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','handover_verified','91000000-0000-4000-8000-000000000003')$$,
  '42501',null,'supervisor cannot forge a verified handover with a direct table insert'
);
select is((select count(*)::int from public.route_children),2,'supervisor sees the assigned route manifest only');
select is((select count(*)::int from public.children),2,'supervisor sees children on their assigned manifest only');
select is((select count(id)::int from public.profiles),3,'supervisor sees self and guardians linked to assigned children only');
select is((select count(*)::int from public.trip_events),1,'supervisor sees events for their assigned trip');
select is((select count(*)::int from public.bus_live),1,'supervisor sees live location for their assigned trip');
select is((select count(*)::int from public.location_history),1,'assigned supervisor can read location history for their trip');
select is((select count(id)::int from public.authorized_pickups),1,'supervisor sees pickup authorizations only for assigned active trip children');
select is(public.verify_pickup_pin('93000000-0000-4000-8000-000000000001',
  (select id from public.authorized_pickups where name='Revoked Pickup'),'1234'),false,
  'revoked pickup authorizations cannot pass PIN verification');
select is((select count(*)::int from public.routes),1,'supervisor sees only their assigned route');
select throws_ok(
  $$select public.record_trip_event('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','handover_verified',null,null,'{}'::jsonb,'forged-handover-01',now())$$,
  '22023',null,'generic trip event RPC cannot forge a verified handover'
);
select throws_ok(
  $$select public.record_trip_event('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','dropped_home',null,null,'{}'::jsonb,'wrong-route-event-01',now())$$,
  '22023',null,'pickup routes cannot record a home drop-off'
);
select throws_ok(
  $$select public.record_trip_event('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','absent',null,null,'{}'::jsonb,'false-absence-event-01',now())$$,
  '22023',null,'a boarded child cannot be marked absent'
);
select is((public.complete_trip('96000000-0000-4000-8000-000000000001')->>'completed')::boolean,false,
  'trip completion is blocked while manifest children are unaccounted for');
select throws_ok(
  $$select public.record_trip_event('96000000-0000-4000-8000-000000000001',null,'child_missing',null,null,'{}'::jsonb,'missing-no-child-01',now())$$,
  '22023',null,'child-specific safety events must identify a manifest child'
);
select lives_ok(
  $$select public.record_trip_event('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','child_missing',null,null,'{}'::jsonb,'missing-child-a2-01',now())$$,
  'supervisor can alert for a manifest child missing before boarding'
);
select is(
  public.record_trip_event('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','child_missing',null,null,'{}'::jsonb,'missing-child-a2-01',now()),
  (select id from public.trip_events where trip_id='96000000-0000-4000-8000-000000000001' and child_id='93000000-0000-4000-8000-000000000002' and type='child_missing' and idempotency_key='missing-child-a2-01'),
  'retrying a missing-child alert returns the original event'
);
select is(
  (select count(*)::int from public.trip_events where trip_id='96000000-0000-4000-8000-000000000001' and child_id='93000000-0000-4000-8000-000000000002' and type='child_missing'),
  1,'missing-child alert retries do not create duplicate events'
);


-- School admin: full read access inside their own school, never across tenants.
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000006',true);
reset role;
select ok(exists(select 1 from public.profiles where id='91000000-0000-4000-8000-000000000008'),
  'auth.users insert automatically creates a profile');
select is((select role::text from public.profiles where id='91000000-0000-4000-8000-000000000008'),'parent',
  'new accounts receive the safe parent role, never a client-supplied staff role');
select is((select school_id from public.profiles where id='91000000-0000-4000-8000-000000000008'),null::uuid,
  'user-editable metadata cannot assign a new account to a school');
set local role authenticated;
select set_config('test.school_join_code',public.create_school_join_code(now()+interval '1 day',1),true);
select ok(length(current_setting('test.school_join_code'))=32,
  'school administrator can create a one-use high-entropy join code');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000008',true);
select is(public.join_school_with_code(current_setting('test.school_join_code')),
  '92000000-0000-4000-8000-000000000001'::uuid,'parent can join the school using its valid code');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000009',true);
select is(public.join_school_with_code(current_setting('test.school_join_code')),null::uuid,
  'an exhausted one-use join code cannot enrol a second parent');
select is((select school_id from public.profiles where id='91000000-0000-4000-8000-000000000009'),null::uuid,
  'an exhausted join code leaves the second parent unassigned');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000006',true);
select is((select count(*)::int from public.children),2,'school admin sees all children in their school');
select is((select count(*)::int from public.schools),1,'school admin sees only their own school');
select throws_ok($update public.profiles set role='platform_owner' where id='91000000-0000-4000-8000-000000000006'$,
  '42501',null,'school administrator cannot promote their own profile');
select throws_ok($update public.profiles set school_id='92000000-0000-4000-8000-000000000002' where id='91000000-0000-4000-8000-000000000006'$,
  '42501',null,'school administrator cannot move their own profile to another tenant');
select is((select count(*)::int from public.authorized_pickups),2,'school admin sees active and revoked pickup authorizations only in their school');
select is((select count(*)::int from public.subscriptions),1,'school admin sees only their school subscription');
select is((select count(*)::int from public.invoices),2,'school admin sees invoices only in their school');
select lives_ok(
  $$select public.create_child_with_guardian('Child A3','91000000-0000-4000-8000-000000000001',null,'Parent')$$,
  'school admin can atomically enrol a child with an existing parent'
);
select is((select count(*)::int from public.children where first_name='Child A3'),1,
  'new child record is created');
select is((select count(*)::int from public.guardianships g join public.children c on c.id=g.child_id where c.first_name='Child A3' and g.guardian_id='91000000-0000-4000-8000-000000000001'),1,
  'new child is linked to the selected parent');
select throws_ok(
  $$select public.create_child_with_guardian('Child A4','91000000-0000-4000-8000-000000000002',null,'Parent')$$,
  '22023',null,'school admin cannot link a child to a parent in another school'
);
select lives_ok(
  $$select public.record_manual_payment((select id from public.invoices where guardian_id='91000000-0000-4000-8000-000000000001'),10,'USD','TEST-PAY-01')$$,
  'school admin can record a verified partial payment'
);
select is((select coalesce(sum(amount),0)::numeric from public.payments where provider_reference='TEST-PAY-01'),10::numeric,
  'partial payment is stored with its receipt reference');
select throws_ok(
  $$select public.record_manual_payment((select id from public.invoices where guardian_id='91000000-0000-4000-8000-000000000001'),1,'USD','TEST-PAY-01')$$,
  '23505',null,'duplicate manual payment references are rejected'
);
select throws_ok(
  $$insert into public.payments(invoice_id,amount,currency,provider,provider_reference,status,paid_at)
    values ((select id from public.invoices where guardian_id='91000000-0000-4000-8000-000000000001'),1,'USD','manual','TEST-DIRECT','succeeded',now())$$,
  '42501',null,'authenticated clients cannot bypass payment reconciliation'
);
select lives_ok(
  $$select public.record_manual_payment((select id from public.invoices where guardian_id='91000000-0000-4000-8000-000000000001'),15,'USD','TEST-PAY-02')$$,
  'final verified payment closes the invoice balance'
);
select is((select status::text from public.invoices where guardian_id='91000000-0000-4000-8000-000000000001'),'paid',
  'invoice is marked paid only when the full balance is reconciled');

select throws_ok(
  $$delete from public.route_children where route_id='95000000-0000-4000-8000-000000000001' and child_id='93000000-0000-4000-8000-000000000001'$$,
  '55000',null,'active trips lock route manifest membership'
);
select throws_ok(
  $$insert into public.stops(route_id,name,lat,lng,position) values ('95000000-0000-4000-8000-000000000001','Late stop',-17.82,31.02,2)$$,
  '55000',null,'active trips lock route stop changes'
);
select throws_ok(
  $$update public.routes set type='dropoff' where id='95000000-0000-4000-8000-000000000001'$$,
  '55000',null,'active trips lock route type changes'
);
select throws_ok(
  $$update public.buses set active=false where id='94000000-0000-4000-8000-000000000001'$$,
  '55000',null,'active trips lock assigned vehicle changes'
);
select throws_ok(
  $$update public.children set archived_at=now() where id='93000000-0000-4000-8000-000000000001'$$,
  '55000',null,'children cannot be archived while on a route manifest'
);


-- Platform owner: cross-tenant read access for oversight.
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000007',true);
select is((select count(*)::int from public.children where school_id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002')),4,'platform owner can read fixture children across schools');
select is((select count(*)::int from public.schools where id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002')),2,'platform owner can read fixture schools');
select is((select count(*)::int from public.authorized_pickups),3,'platform owner can read pickup authorizations across schools');
select is((select count(*)::int from public.subscriptions where school_id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002')),2,'platform owner can read fixture subscriptions across schools');
select is((select count(*)::int from public.invoices where school_id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002')),3,'platform owner can read fixture invoices across schools');

-- Anonymous visitors may submit validated demo requests, but authenticated users may not.
set local role anon;
select lives_ok(
  $insert into public.demo_requests(school_name,contact_name,email,children_count)
    values ('Demo School','Demo Contact','demo-request-limit@predrive.test',12)$,
  'anonymous visitors can submit a valid demo request'
);
select lives_ok(
  $insert into public.demo_requests(school_name,contact_name,email,children_count)
    values ('Demo School 2','Demo Contact 2','DEMO-REQUEST-LIMIT@predrive.test',20),
           ('Demo School 3','Demo Contact 3','demo-request-limit@predrive.test',30)$,
  'the demo request rate limit allows up to three requests per email in 24 hours'
);
select throws_ok(
  $insert into public.demo_requests(school_name,contact_name,email)
    values ('Demo School 4','Demo Contact 4','demo-request-limit@predrive.test')$,
  'P0001',null,'the fourth demo request for one email is rate limited'
);
select throws_ok(
  $insert into public.demo_requests(school_name,contact_name,email,website)
    values ('Bot School','Bot Contact','bot@predrive.test','https://spam.example')$,
  '42501',null,'the demo request honeypot rejects automated submissions'
);
reset role;
set local role authenticated;
select throws_ok(
  $insert into public.demo_requests(school_name,contact_name,email)
    values ('Authenticated School','Authenticated Contact','signed-in@predrive.test')$,
  '42501',null,'authenticated users cannot use the anonymous demo request endpoint'
);
reset role;
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='demo_requests' and column_name='children_count'),
  'demo requests record the expected child count');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='demo_requests' and column_name='status'),
  'demo requests have a platform-managed workflow status');

-- The stale GPS monitor alerts once per outage and rearms after a fresh location.
update public.bus_live set updated_at=now()-interval '2 minutes'
where trip_id='96000000-0000-4000-8000-000000000001';
select is(public.check_stale_bus_locations(),1,'stale active bus location creates one administrator alert');
select is((select count(*)::int from public.notifications
  where type='bus_location_stale' and user_id='91000000-0000-4000-8000-000000000006'),1,
  'stale location notification is delivered to the school administrator');
select is(public.check_stale_bus_locations(),0,'repeated monitor runs do not duplicate an active stale-location alert');
update public.bus_live set updated_at=now()
where trip_id='96000000-0000-4000-8000-000000000001';
update public.bus_live set updated_at=now()-interval '2 minutes'
where trip_id='96000000-0000-4000-8000-000000000001';
select is(public.check_stale_bus_locations(),1,'a later GPS outage alerts again after location recovery');
select is((select count(*)::int from public.notifications
  where type='bus_location_stale' and user_id='91000000-0000-4000-8000-000000000006'),2,
  'recovered stale-location episodes generate a fresh administrator notification');

select ok(to_regprocedure('public.start_trip(uuid)') is not null,'start trip RPC is installed');
select ok(to_regprocedure('public.record_trip_event(uuid,uuid,public.trip_event_type,double precision,double precision,jsonb,text,timestamp with time zone)') is not null,'idempotent trip event RPC is installed');
select ok(to_regprocedure('public.complete_trip(uuid)') is not null,'guarded trip completion RPC is installed');
select ok(to_regprocedure('public.end_trip(uuid)') is not null,'end_trip compatibility RPC is installed');
select ok(to_regprocedure('public.check_stale_bus_locations()') is not null,'stale bus location monitor is installed');
select ok(to_regprocedure('public.purge_old_location_history()') is not null,'90-day location history retention job is installed');
select ok(exists(select 1 from pg_constraint where conrelid='public.children'::regclass
  and conname='children_home_radius_m_check'
  and pg_get_constraintdef(oid) like '%500%1000%2000%'),
  'child geofence radius is restricted to the supported 500, 1000 or 2000 metres');
select ok(to_regprocedure('public.verify_pickup_handover(uuid,uuid,uuid,text,double precision,double precision,text)') is not null,'atomic pickup handover RPC is installed');
select ok(to_regprocedure('public.register_push_token(text)') is not null,'push token registration RPC is installed');
select ok(to_regprocedure('public.create_child_with_guardian(text,uuid,text,text)') is not null,'atomic child enrolment RPC is installed');
select ok(exists(select 1 from pg_constraint where conname='absences_reported_by_fkey' and confdeltype='n'),
  'absence history survives parent deletion with reporter anonymized');
select ok(exists(select 1 from pg_constraint where conname='incidents_reported_by_fkey' and confdeltype='n'),
  'incident history survives parent deletion with reporter anonymized');
select ok(exists(select 1 from pg_constraint where conname='invoices_guardian_id_fkey' and confdeltype='n'),
  'invoice history survives parent deletion with guardian link anonymized');
select ok(exists(select 1 from pg_constraint where conname='audit_log_actor_id_fkey' and confdeltype='n'),
  'audit history survives parent deletion with actor anonymized');
select ok(exists(select 1 from pg_constraint where conname='messages_sender_id_fkey' and confdeltype='n'),
  'message sender references do not block account deletion');
select ok(to_regprocedure('public.record_manual_payment(uuid,numeric,text,text)') is not null,'manual payment reconciliation RPC is installed');
select ok(to_regprocedure('public.apply_paynow_callback(text,text,numeric,text)') is not null,
  'atomic Paynow callback reconciliation RPC is installed');
select ok(not has_function_privilege('authenticated','public.apply_paynow_callback(text,text,numeric,text)','EXECUTE'),
  'authenticated clients cannot invoke the privileged Paynow callback RPC');
select ok(has_function_privilege('service_role','public.apply_paynow_callback(text,text,numeric,text)','EXECUTE'),
  'only the server service role can invoke Paynow callback reconciliation');
select ok(not has_table_privilege('authenticated','public.paynow_transactions','SELECT')
  and has_table_privilege('service_role','public.paynow_transactions','SELECT'),
  'Paynow poll and checkout URLs are private to the server service role');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='authorized_pickups' and column_name='active'),
  'pickup authorizations support revocation');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='method'),
  'payments record the payment method');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='idempotency_key'),
  'payments support idempotency keys');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='payments_invoice_provider_reference_uidx'),
  'payment provider references are protected against duplicate recording');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='payments_invoice_provider_idempotency_uidx'),
  'payment idempotency keys are unique per invoice and provider');
select ok(to_regprocedure('public.verify_route_field_check(uuid)') is not null,'route field-check gate is installed');
select ok(to_regclass('public.staff_invitations') is not null,'staff invitation audit table is installed');
select ok(to_regclass('public.parent_invitations') is not null,'parent invitation audit table is installed');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='children' and column_name='archived_at'),'child soft archival is supported');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='routes' and column_name='geometry_status'),'route provenance is recorded');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='trip_events' and column_name='idempotency_key'),'trip events support offline idempotency');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='trip_events_idempotency_idx'),'trip event idempotency index is installed');
select ok(exists(select 1 from pg_trigger where tgname='guard_route_manifest_change' and not tgisinternal),'scheduled and active manifests are locked');
select ok(exists(select 1 from pg_trigger where tgname='guard_route_stop_change' and not tgisinternal),'scheduled and active route stops are locked');
select ok(exists(select 1 from pg_trigger where tgname='guard_route_type_or_archive_change' and not tgisinternal),'route type and archival changes are guarded');
select ok(exists(select 1 from pg_trigger where tgname='guard_bus_archive_change' and not tgisinternal),'assigned vehicle availability is guarded');
select ok(exists(select 1 from pg_trigger where tgname='guard_child_archive_change' and not tgisinternal),'assigned child archival is guarded');
select ok(exists(select 1 from pg_trigger where tgname='invalidate_route_geometry_after_stop_change' and not tgisinternal),'stop changes invalidate route geometry');

-- Platform-owner school lifecycle controls suspend tenant access without deleting data.
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='schools' and column_name='status'),
  'schools have an explicit lifecycle status');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000007',true);
select lives_ok($update public.schools set status='suspended' where id='92000000-0000-4000-8000-000000000001'$,
  'platform owner can suspend a school');
select is((select status from public.schools where id='92000000-0000-4000-8000-000000000001'),'suspended',
  'school suspension status is persisted');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is(private.is_guardian('93000000-0000-4000-8000-000000000001'),false,
  'parents lose guardian authorization when their school is suspended');
select is((select count(*)::int from public.bus_live),0,
  'parents cannot read live bus locations while their school is suspended');
select is((select count(*)::int from public.invoices),0,
  'parents cannot read invoices while their school is suspended');
select is((select count(*)::int from public.notifications),0,
  'parents cannot read school notifications while their school is suspended');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000003',true);
select is(private.is_assigned_supervisor('96000000-0000-4000-8000-000000000001'),false,
  'supervisors lose assigned-trip authorization when their school is suspended');
select is((select count(*)::int from public.trips),0,
  'supervisors cannot read trips while their school is suspended');
select is((select count(*)::int from public.routes),0,
  'supervisors cannot read routes while their school is suspended');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000006',true);
select is((select count(*)::int from public.children),0,
  'school administrators cannot read child records while their school is suspended');
select is(private.current_school_id(),null::uuid,
  'suspended school administrators lose tenant-scoped access');
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000007',true);
select lives_ok($update public.schools set status='active' where id='92000000-0000-4000-8000-000000000001'$,
  'platform owner can reactivate a school');
select is((select status from public.schools where id='92000000-0000-4000-8000-000000000001'),'active',
  'school reactivation restores the active lifecycle status');
reset role;

-- Database-level guard prevents a race from deleting the final guardian.
insert into public.children(school_id,first_name)
values ('92000000-0000-4000-8000-000000000001','Guardian Protection Fixture');
insert into public.guardianships(guardian_id,child_id,relationship)
select '91000000-0000-4000-8000-000000000008', id, 'Parent'
from public.children where first_name='Guardian Protection Fixture';
select throws_ok($delete from public.profiles where id='91000000-0000-4000-8000-000000000008'$,
  '23514',null,'the final guardian cannot be deleted from the database');
select ok(exists(select 1 from public.profiles where id='91000000-0000-4000-8000-000000000008'),
  'blocked final-guardian deletion leaves the parent profile intact');

select * from finish();
rollback;
