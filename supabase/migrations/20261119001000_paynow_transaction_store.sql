-- Server-only transaction metadata for Paynow. Poll URLs and checkout URLs must never be readable by client roles.
create table public.paynow_transactions (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  merchant_reference text not null unique,
  paynow_reference text,
  browser_url text,
  poll_url text,
  status text not null default 'initiating'
    check (status in ('initiating','pending','succeeded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.paynow_transactions enable row level security;
revoke all on public.paynow_transactions from public, anon, authenticated;
grant all on public.paynow_transactions to service_role;
create index paynow_transactions_status_created_idx
  on public.paynow_transactions(status, created_at);
create trigger set_updated_at before update on public.paynow_transactions
  for each row execute function public.set_updated_at();
