-- Add the operational handover and missing-child event values before
-- 20261118001300 defines RPCs that reference them.
alter type public.trip_event_type add value if not exists 'handover_verified';
alter type public.trip_event_type add value if not exists 'child_missing';
