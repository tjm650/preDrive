-- Validate and rate-limit public demo requests without granting broad table access.
alter table public.demo_requests
  add column if not exists children_count integer not null default 1,
  add column if not exists status text not null default 'new',
  add column if not exists website text;
alter table public.demo_requests
  add constraint demo_requests_children_count_check check (children_count between 1 and 500),
  add constraint demo_requests_status_check check (status in ('new', 'contacted', 'qualified', 'closed', 'spam')),
  add constraint demo_requests_school_name_check check (length(btrim(school_name)) between 2 and 160),
  add constraint demo_requests_contact_name_check check (length(btrim(contact_name)) between 2 and 120),
  add constraint demo_requests_email_check check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  add constraint demo_requests_phone_check check (phone is null or length(btrim(phone)) <= 40),
  add constraint demo_requests_message_check check (message is null or length(message) <= 2000);

create table if not exists private.demo_request_rate_limits (
  id bigint generated always as identity primary key,
  email_hash bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists demo_request_rate_limits_email_time_idx
  on private.demo_request_rate_limits(email_hash, created_at desc);
alter table private.demo_request_rate_limits enable row level security;
revoke all on private.demo_request_rate_limits from public, anon, authenticated;

create or replace function private.guard_demo_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  email_digest bytea;
  recent_count integer;
begin
  new.school_name := btrim(coalesce(new.school_name, ''));
  new.contact_name := btrim(coalesce(new.contact_name, ''));
  normalized_email := lower(btrim(coalesce(new.email, '')));
  new.email := normalized_email;
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.message := nullif(btrim(coalesce(new.message, '')), '');
  new.children_count := coalesce(new.children_count, 1);

  if length(new.school_name) not between 2 and 160
     or length(new.contact_name) not between 2 and 120
     or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or (new.phone is not null and length(new.phone) > 40)
     or (new.message is not null and length(new.message) > 2000)
     or new.children_count not between 1 and 500 then
    raise exception 'Invalid demo request details' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(new.website, '')), '') is not null then
    raise exception 'Demo request rejected' using errcode = '42501';
  end if;

  email_digest := extensions.digest(normalized_email, 'sha256');
  perform pg_advisory_xact_lock(hashtextextended(encode(email_digest, 'hex'), 0));
  select count(*) into recent_count
  from private.demo_request_rate_limits r
  where r.email_hash = email_digest
    and r.created_at > now() - interval '24 hours';
  if recent_count >= 3 then
    raise exception 'Too many demo requests. Please try again later.' using errcode = 'P0001';
  end if;

  insert into private.demo_request_rate_limits(email_hash) values (email_digest);
  new.status := 'new';
  new.created_at := now();
  return new;
end
$$;
revoke all on function private.guard_demo_request() from public, anon, authenticated;
drop trigger if exists guard_demo_request on public.demo_requests;
create trigger guard_demo_request
before insert on public.demo_requests
for each row execute function private.guard_demo_request();

drop policy if exists demo_requests_no_public_access on public.demo_requests;
create policy demo_requests_anon_insert on public.demo_requests
for insert to anon with check (true);
drop policy if exists demo_requests_owner_update on public.demo_requests;
create policy demo_requests_owner_update on public.demo_requests
for update to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

revoke insert, update, delete on public.demo_requests from anon, authenticated;
grant insert (school_name, contact_name, email, phone, message, children_count, website)
  on public.demo_requests to anon;
grant update (status) on public.demo_requests to authenticated;
