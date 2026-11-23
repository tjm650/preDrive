-- Allow the existing alert/recipient model to distinguish generated
-- payment reminders from staff-created alerts. No rows are changed.
alter table public.alerts
  drop constraint if exists alerts_source_type_check;

alter table public.alerts
  add constraint alerts_source_type_check
  check (
    source_type = any (
      array[
        'manual'::text,
        'sos'::text,
        'delay'::text,
        'incident'::text,
        'geofence'::text,
        'unaccounted_child'::text,
        'vehicle_check'::text,
        'payment_reminder'::text
      ]
    )
  );
