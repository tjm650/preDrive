-- preDrive B2.5: private Storage buckets and tenant/user-scoped object policies.
-- Additive migration. It creates the five documented private buckets only when
-- absent; existing bucket configurations are never overwritten. If a bucket
-- already exists with a conflicting configuration, the migration fails closed.
--
-- Object path contracts:
-- incident-photos: <school_uuid>/<uploader_user_uuid>/<incident_uuid>/<file>
-- payment-proofs: <school_uuid>/<guardian_user_uuid>/<payment_uuid>/<file>
-- avatars:         <user_uuid>/<file>
-- receipts:        <school_uuid>/<guardian_user_uuid>/<receipt_uuid>/<file>
-- exports:         <school_uuid>/<admin_user_uuid>/<file>
--
-- Generated receipts/exports and privileged writes are performed by trusted
-- Edge Functions. Authenticated clients receive only the narrowly scoped
-- object operations defined below.

create or replace function private.storage_school_id(p_object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_catalog.split_part(p_object_name, '/', 1)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then pg_catalog.split_part(p_object_name, '/', 1)::uuid
    else null
  end;
$$;

revoke all on function private.storage_school_id(text) from public, anon, authenticated;
grant execute on function private.storage_school_id(text) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'incident-photos',
    'incident-photos',
    false,
    10485760,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'payment-proofs',
    'payment-proofs',
    false,
    10485760,
    array['image/jpeg','image/png','image/webp','application/pdf']::text[]
  ),
  (
    'avatars',
    'avatars',
    false,
    2097152,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'receipts',
    'receipts',
    false,
    10485760,
    array['application/pdf']::text[]
  ),
  (
    'exports',
    'exports',
    false,
    26214400,
    array[
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]
  )
on conflict (id) do nothing;

do $$
declare
  expected record;
  actual storage.buckets%rowtype;
begin
  for expected in
    select *
    from (values
      ('incident-photos', 10485760::bigint, array['image/jpeg','image/png','image/webp']::text[]),
      ('payment-proofs', 10485760::bigint, array['image/jpeg','image/png','image/webp','application/pdf']::text[]),
      ('avatars', 2097152::bigint, array['image/jpeg','image/png','image/webp']::text[]),
      ('receipts', 10485760::bigint, array['application/pdf']::text[]),
      ('exports', 26214400::bigint, array['text/csv','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
    ) as configured(bucket_id, max_bytes, mime_types)
  loop
    select * into actual
    from storage.buckets
    where id = expected.bucket_id;

    if not found
      or actual.public is distinct from false
      or actual.file_size_limit is distinct from expected.max_bytes
      or actual.allowed_mime_types is distinct from expected.mime_types
    then
      raise exception
        'Storage bucket % is missing or has a conflicting privacy/size/MIME configuration',
        expected.bucket_id;
    end if;
  end loop;
end;
$$;

-- Incident photos: school admins/supervisors can read all school evidence;
-- a staff uploader can read and manage only files under their own user prefix.
drop policy if exists predrive_incident_photos_select on storage.objects;
create policy predrive_incident_photos_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'incident-photos'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin','supervisor']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['school_admin','supervisor','teacher','driver']::public.user_role[]
      )
    )
  )
);

drop policy if exists predrive_incident_photos_insert on storage.objects;
create policy predrive_incident_photos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'incident-photos'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
  and private.has_school_role(
    private.storage_school_id(name),
    array['school_admin','supervisor','teacher','driver']::public.user_role[]
  )
);

drop policy if exists predrive_incident_photos_update on storage.objects;
create policy predrive_incident_photos_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'incident-photos'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin','supervisor']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['school_admin','supervisor','teacher','driver']::public.user_role[]
      )
    )
  )
)
with check (
  bucket_id = 'incident-photos'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin','supervisor']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['school_admin','supervisor','teacher','driver']::public.user_role[]
      )
    )
  )
);

drop policy if exists predrive_incident_photos_delete on storage.objects;
create policy predrive_incident_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'incident-photos'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin','supervisor']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['school_admin','supervisor','teacher','driver']::public.user_role[]
      )
    )
  )
);

-- Payment proof: guardians can upload/read only under their own identity path;
-- school admins can review all proofs belonging to their school.
drop policy if exists predrive_payment_proofs_select on storage.objects;
create policy predrive_payment_proofs_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['guardian']::public.user_role[]
      )
    )
  )
);

drop policy if exists predrive_payment_proofs_insert on storage.objects;
create policy predrive_payment_proofs_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
  and private.has_school_role(
    private.storage_school_id(name),
    array['guardian']::public.user_role[]
  )
);

-- Avatars are private and user-owned. A user can manage only their own path.
drop policy if exists predrive_avatars_select on storage.objects;
create policy predrive_avatars_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 2
  and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists predrive_avatars_insert on storage.objects;
create policy predrive_avatars_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 2
  and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists predrive_avatars_update on storage.objects;
create policy predrive_avatars_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 2
  and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 2
  and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists predrive_avatars_delete on storage.objects;
create policy predrive_avatars_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 2
  and pg_catalog.split_part(name, '/', 1) = (select auth.uid())::text
);

-- Receipts are generated by trusted services. Guardians can read only their
-- own receipt path; school admins can read receipts across their school.
drop policy if exists predrive_receipts_select on storage.objects;
create policy predrive_receipts_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'receipts'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 4
  and private.storage_school_id(name) is not null
  and (
    private.has_school_role(
      private.storage_school_id(name),
      array['school_admin']::public.user_role[]
    )
    or (
      pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
      and private.has_school_role(
        private.storage_school_id(name),
        array['guardian']::public.user_role[]
      )
    )
  )
);

-- Exports are private and limited to the school administrator who requested
-- them. Edge Functions create/delete the objects using service_role.
drop policy if exists predrive_exports_select on storage.objects;
create policy predrive_exports_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exports'
  and pg_catalog.array_length(pg_catalog.string_to_array(name, '/'), 1) = 3
  and private.storage_school_id(name) is not null
  and pg_catalog.split_part(name, '/', 2) = (select auth.uid())::text
  and private.has_school_role(
    private.storage_school_id(name),
    array['school_admin']::public.user_role[]
  )
);

comment on function private.storage_school_id(text) is
  'Safely parses the school UUID from the first path segment of a preDrive Storage object name; returns NULL for malformed paths.';
