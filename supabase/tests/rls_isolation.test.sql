begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('91000000-0000-4000-8000-000000000001','authenticated','authenticated','parent-a@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000002','authenticated','authenticated','parent-b@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000003','authenticated','authenticated','supervisor-a@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000004','authenticated','authenticated','supervisor-b@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('91000000-0000-4000-8000-000000000005','authenticated','authenticated','parent-a2@rls.test',extensions.crypt('test-password',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
insert into public.schools(id,name,slug) values ('92000000-0000-4000-8000-000000000001','School A','rls-school-a'),('92000000-0000-4000-8000-000000000002','School B','rls-school-b');
insert into public.profiles(id,school_id,role,full_name) values
('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','parent','Parent A'),
('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','parent','Parent B'),
('91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','supervisor','Supervisor A'),
('91000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','supervisor','Supervisor B'),
('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','parent','Parent A2');
insert into public.children(id,school_id,first_name) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Child A1'),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','Child A2'),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','Child B1');
insert into public.guardianships(guardian_id,child_id,relationship) values
('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','Parent'),
('91000000-0000-4000-8000-000000000005','93000000-0000-4000-8000-000000000002','Parent'),
('91000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','Parent');
insert into public.buses(id,school_id,registration,capacity) values
('94000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','TEST-A',10),
('94000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','TEST-B',10);
insert into public.routes(id,school_id,name,type) values
('95000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','Route A','pickup'),
('95000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','Route B','pickup');
insert into public.trips(id,route_id,bus_id,supervisor_id,status,started_at,ended_at) values
('96000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','active',now(),null),
('96000000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000004','completed',now(),now());
insert into public.route_children(route_id,child_id) values
('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001'),
('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002'),
('95000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');
insert into public.trip_events(trip_id,child_id,type,recorded_by) values
('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','boarded','91000000-0000-4000-8000-000000000003'),
('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','boarded','91000000-0000-4000-8000-000000000003'),
('96000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003','boarded','91000000-0000-4000-8000-000000000004');
insert into public.bus_live(trip_id,lat,lng) values
('96000000-0000-4000-8000-000000000001',-17.8,31.0),
('96000000-0000-4000-8000-000000000002',-17.8,31.0);
insert into public.invoices(school_id,guardian_id,amount_usd,currency,status,due_date) values
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',25,'USD','pending',current_date),
('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000005',25,'USD','pending',current_date),
('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',25,'USD','pending',current_date);
insert into public.notifications(user_id,school_id,type,title_key,body_key) values
('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','test','test','test'),
('91000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','test','test','test'),
('91000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','test','test','test');
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.children),1,'parent A reads only their own child, not another family or school B');
select ok(not exists(select 1 from public.children where id='93000000-0000-4000-8000-000000000002'),'parent A cannot read another family in school A');
select ok(not exists(select 1 from public.children where id='93000000-0000-4000-8000-000000000003'),'parent A cannot read school B child');
select is((select count(*)::int from public.trip_events),1,'parent A reads only their own child event');
select is((select count(*)::int from public.invoices),1,'parent A reads only their own invoice, not another family or school B');
select is((select count(*)::int from public.notifications where type='test'),1,'parent A reads only their own notification');
select is((select count(*)::int from public.bus_live),1,'parent A sees only active trip location for a route containing their child');
select ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname = any(array['schools','profiles','children','guardianships','authorized_pickups','buses','routes','stops','route_children','trips','trip_events','bus_live','location_history','absences','notifications','messages','threads','thread_members','incidents','subscriptions','invoices','payments','app_settings','audit_log','demo_requests','push_receipts']) and not c.relrowsecurity),'RLS is enabled on every preDrive public table');
select * from finish();
rollback;
