-- Ensure pgcrypto functions are installed in a known, non-exposed extension schema.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Keep service-managed push receipt metadata outside the public client API.
create table public.push_receipts (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.notifications(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 expo_ticket_id text not null unique,
 status text not null default 'pending' check(status in ('pending','ok','error')),
 error_code text,
 checked_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.push_receipts enable row level security;
revoke all on public.push_receipts from anon,authenticated;
