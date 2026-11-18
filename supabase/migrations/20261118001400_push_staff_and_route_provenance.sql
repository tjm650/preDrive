-- Push registration, auditable staff invitations and route provenance.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_token is not null and (
    length(p_token) > 512
    or p_token !~ '^(Expo|Exponent)PushToken\\[[A-Za-z0-9_-]+\\]$'
  ) then raise exception 'Invalid Expo push token' using errcode='22023'; end if;
  update public.profiles set expo_push_token=p_token where id=auth.uid();
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
end
$$;
revoke all on function public.register_push_token(text) from public,anon;
grant execute on function public.register_push_token(text) to authenticated;

alter table public.routes
  add column if not exists geometry_source text,
  add column if not exists geometry_status text not null default 'unverified'
    check(geometry_status in ('unverified','provider_verified','manually_verified')),
  add column if not exists geometry_verified_at timestamptz,
  add column if not exists distance_m integer check(distance_m is null or distance_m > 0),
  add column if not exists duration_s integer check(duration_s is null or duration_s > 0);

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null check(role in ('supervisor','school_admin')),
  invited_by uuid not null references public.profiles(id),
  invited_user_id uuid references public.profiles(id),
  status text not null default 'invited' check(status in ('invited','accepted','revoked')),
  expires_at timestamptz not null default now()+interval '7 days',
  created_at timestamptz not null default now(),
  unique(school_id,email)
);
alter table public.staff_invitations enable row level security;
create policy staff_invitations_admin_read on public.staff_invitations
  for select to authenticated using (private.is_school_admin(school_id));
revoke insert,update,delete on public.staff_invitations from anon,authenticated;
