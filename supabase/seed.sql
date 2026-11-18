-- Local demo accounts only. Shared password: PreDrive-Demo-2026! Never use outside local development.
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('20000000-0000-4000-8000-000000000001','authenticated','authenticated','supervisor@predrive.test',extensions.crypt('PreDrive-Demo-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Mrs. Chipo Moyo"}',now(),now()),
('20000000-0000-4000-8000-000000000002','authenticated','authenticated','driver@predrive.test',extensions.crypt('PreDrive-Demo-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Mr. Farai Ndlovu"}',now(),now()),
('20000000-0000-4000-8000-000000000003','authenticated','authenticated','parent@predrive.test',extensions.crypt('PreDrive-Demo-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Mrs. Rudo Mutasa"}',now(),now()),
('20000000-0000-4000-8000-000000000004','authenticated','authenticated','admin@predrive.test',extensions.crypt('PreDrive-Demo-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Mr. Tawanda Banda"}',now(),now()),
('20000000-0000-4000-8000-000000000005','authenticated','authenticated','owner@predrive.test',extensions.crypt('PreDrive-Demo-2026!',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"preDrive Platform Owner"}',now(),now())
on conflict(id) do nothing;
insert into auth.identities(id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
select gen_random_uuid(),u.id,u.id::text,jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),'email',null,now(),now()
from auth.users u where u.email in ('supervisor@predrive.test','driver@predrive.test','parent@predrive.test','admin@predrive.test','owner@predrive.test')
on conflict(provider_id,provider) do nothing;

insert into public.schools(id,name,slug,address,phone,email) values
('10000000-0000-4000-8000-000000000001','Little Sprouts Creche','little-sprouts-borrowdale','Borrowdale, Harare, Zimbabwe','+263 77 000 0000','demo@littlesprouts.example');
insert into public.profiles(id,school_id,role,full_name,phone,language) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','supervisor','Mrs. Chipo Moyo','+263 77 100 0001','sn'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','supervisor','Mr. Farai Ndlovu','+263 77 100 0002','en'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','parent','Mrs. Rudo Mutasa','+263 77 100 0003','sn'),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','school_admin','Mr. Tawanda Banda','+263 77 100 0004','en'),
('20000000-0000-4000-8000-000000000005',null,'platform_owner','preDrive Platform Owner',null,'en');
insert into public.buses(id,school_id,registration,make,model,capacity,driver_name) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AFD 4821','Toyota','HiAce',14,'Mr. Farai Ndlovu'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','AFD 4822','Nissan','Civilian',18,'Mr. Simba Moyo'),
('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','AFD 4823','Toyota','Quantum',14,'Mr. Tinashe Dube');
insert into public.routes(id,school_id,name,type,polyline) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Borrowdale to Little Sprouts','pickup','[[-17.7548,31.0850],[-17.7650,31.0800],[-17.7800,31.0750],[-17.7980,31.0700]]'),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Mabelreign, Avondale and Mount Pleasant','pickup','[[-17.7800,30.9800],[-17.7900,31.0300],[-17.7830,31.0500],[-17.7980,31.0700]]'),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Greendale and Highlands','pickup','[[-17.8300,31.1000],[-17.8200,31.0950],[-17.8100,31.0850],[-17.7980,31.0700]]');
insert into public.stops(id,route_id,name,lat,lng,position) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','Borrowdale Village',-17.7548,31.0850,0),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','Borrowdale Brooke',-17.7800,31.0750,1),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002','Mabelreign Shopping Centre',-17.7800,30.9800,0),
('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002','Avondale Shopping Centre',-17.7900,31.0300,1),
('50000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000002','Mount Pleasant',-17.7830,31.0500,2),
('50000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000003','Greendale Shopping Centre',-17.8300,31.1000,0),
('50000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000003','Highlands Park',-17.8100,31.0850,1);
insert into public.children(id,school_id,first_name,class_name,avatar_key,home_stop_id,home_radius_m) values
('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Tendai','Eagles','avatar-child-01','50000000-0000-4000-8000-000000000001',1000),
('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Anesu','Eagles','avatar-child-02','50000000-0000-4000-8000-000000000002',1000),
('60000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Rutendo','Doves','avatar-child-03',null,1000),
('60000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Tafara','Doves','avatar-child-04',null,1000),
('60000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','Nokuthula','Robins','avatar-child-05',null,1000),
('60000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Sipho','Robins','avatar-child-06',null,1000),
('60000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000001','Kuda','Eagles','avatar-child-07',null,1000),
('60000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000001','Thandiwe','Doves','avatar-child-08',null,1000),
('60000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000001','Tatenda','Robins','avatar-child-09',null,1000),
('60000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','Ruvimbo','Eagles','avatar-child-10',null,1000),
('60000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','Mbali','Doves','avatar-child-11',null,1000),
('60000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000001','Tinashe','Robins','avatar-child-12',null,1000),
('60000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000001','Chipo','Eagles','avatar-child-13',null,1000),
('60000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','Farai','Doves','avatar-child-14',null,1000),
('60000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000001','Nyasha','Robins','avatar-child-15',null,1000),
('60000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000001','Kudzai','Eagles','avatar-child-16',null,1000),
('60000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000001','Lerato','Doves','avatar-child-17',null,1000),
('60000000-0000-4000-8000-000000000018','10000000-0000-4000-8000-000000000001','Simba','Robins','avatar-child-18',null,1000),
('60000000-0000-4000-8000-000000000019','10000000-0000-4000-8000-000000000001','Rudo','Eagles','avatar-child-19',null,1000),
('60000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000001','Munashe','Doves','avatar-child-20',null,1000),
('60000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000001','Nandi','Robins','avatar-child-21',null,1000),
('60000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000001','Tariro','Eagles','avatar-child-22',null,1000),
('60000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000001','Mandla','Doves','avatar-child-23',null,1000),
('60000000-0000-4000-8000-000000000024','10000000-0000-4000-8000-000000000001','Rumbidzai','Robins','avatar-child-24',null,1000);
insert into public.guardianships(guardian_id,child_id,relationship) values
('20000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001','Mother'),
('20000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002','Mother');
insert into public.route_children(route_id,child_id,stop_id) values
('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002');
insert into public.trips(id,route_id,bus_id,supervisor_id,status,started_at,ended_at) values
('70000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','completed',now()-interval '2 days',now()-interval '2 days'+interval '1 hour'),
('70000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','completed',now()-interval '1 day',now()-interval '1 day'+interval '1 hour');
insert into public.trip_events(trip_id,child_id,type,recorded_by,created_at) values
('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','boarded','20000000-0000-4000-8000-000000000001',now()-interval '2 days'),
('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','dropped_home','20000000-0000-4000-8000-000000000001',now()-interval '2 days'+interval '1 hour');
insert into public.invoices(school_id,guardian_id,amount_usd,currency,status,due_date) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',45,'USD','paid',current_date-10),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',45,'USD','pending',current_date+7),
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000003',40,'USD','overdue',current_date-20);
insert into public.notifications(user_id,school_id,type,title_key,body_key,priority,created_at) values
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','boarded','boarded','boarded','normal',now()-interval '2 days'),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','dropped_home','dropped_home','dropped_home','normal',now()-interval '2 days');
insert into public.subscriptions(school_id,plan,status,renews_at) values
('10000000-0000-4000-8000-000000000001','starter','trialing',now()+interval '30 days');
