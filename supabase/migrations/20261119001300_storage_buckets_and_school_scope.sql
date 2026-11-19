-- Private school-scoped avatars and publicly readable school logos.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('school-logos', 'school-logos', true, 2097152, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read_school_scope on storage.objects;
create policy avatars_read_school_scope on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    owner_id = (select auth.uid())::text
    or (storage.foldername(name))[1] = private.current_school_id()::text
  )
);

drop policy if exists avatars_insert_own_scope on storage.objects;
create policy avatars_insert_own_scope on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (
    (storage.foldername(name))[1] = private.current_school_id()::text
    or ((select private.current_school_id()) is null and (storage.foldername(name))[1] = 'unassigned')
  )
);

drop policy if exists avatars_update_own_scope on storage.objects;
create policy avatars_update_own_scope on storage.objects
for update to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (
    (storage.foldername(name))[1] = private.current_school_id()::text
    or ((select private.current_school_id()) is null and (storage.foldername(name))[1] = 'unassigned')
  )
);

drop policy if exists avatars_delete_own_scope on storage.objects;
create policy avatars_delete_own_scope on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

drop policy if exists school_logos_public_read on storage.objects;
create policy school_logos_public_read on storage.objects
for select to public using (bucket_id = 'school-logos');

drop policy if exists school_logos_admin_insert on storage.objects;
create policy school_logos_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'school-logos'
  and (storage.foldername(name))[1] = private.current_school_id()::text
  and private.is_school_admin(private.current_school_id())
);

drop policy if exists school_logos_admin_update on storage.objects;
create policy school_logos_admin_update on storage.objects
for update to authenticated
using (
  bucket_id = 'school-logos'
  and (storage.foldername(name))[1] = private.current_school_id()::text
  and private.is_school_admin(private.current_school_id())
)
with check (
  bucket_id = 'school-logos'
  and (storage.foldername(name))[1] = private.current_school_id()::text
  and private.is_school_admin(private.current_school_id())
);

drop policy if exists school_logos_admin_delete on storage.objects;
create policy school_logos_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'school-logos'
  and (storage.foldername(name))[1] = private.current_school_id()::text
  and private.is_school_admin(private.current_school_id())
);
