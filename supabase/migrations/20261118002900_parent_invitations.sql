create table public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) <= 320),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  invited_by uuid not null references public.profiles(id),
  invited_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'invited' check (status in ('invited','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_id,email)
);
alter table public.parent_invitations enable row level security;
revoke all on public.parent_invitations from anon,authenticated;
grant select on public.parent_invitations to authenticated;
create policy parent_invitations_admin_read on public.parent_invitations
for select to authenticated
using (private.is_school_admin(school_id) or private.is_platform_owner());
create index parent_invitations_school_status_idx
on public.parent_invitations(school_id,status,expires_at);
