-- B4.8.5 corrective migration.
-- The original export path constraint was over-escaped and rejected valid
-- UUID-based lease paths. Replace it with a PostgreSQL regex matching the
-- exact school/privacy/request/lease.json object path shape.

alter table public.deletion_requests
  drop constraint if exists deletion_requests_export_object_path_check;

alter table public.deletion_requests
  add constraint deletion_requests_export_object_path_check
  check (
    export_object_path is null
    or export_object_path ~
      '^[0-9a-f-]{36}/privacy/[0-9a-f-]{36}/[0-9a-f-]{36}\.json$'
  );