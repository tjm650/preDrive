-- preDrive B1.4: school fees, invoices, payments, refunds and receipts.
-- Currency values are stored as integer minor units (100 = 1.00 USD or ZiG).
-- The frontend Money.amount is mapped to/from major currency units in SupabaseAdapter.
-- All finance writes are service-controlled until B2 policies and B3 RPCs are installed.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'currency_code'
  ) then
    create type public.currency_code as enum ('USD', 'ZiG');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_method'
  ) then
    create type public.payment_method as enum (
      'ecocash', 'cbz_transfer', 'cabs_transfer', 'card'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_status'
  ) then
    create type public.payment_status as enum (
      'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'invoice_status'
  ) then
    create type public.invoice_status as enum (
      'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'payment_attempt_status'
  ) then
    create type public.payment_attempt_status as enum (
      'pending', 'processing', 'succeeded', 'failed', 'cancelled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'refund_status'
  ) then
    create type public.refund_status as enum (
      'pending', 'processing', 'succeeded', 'failed', 'cancelled'
    );
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'bank_transfer_status'
  ) then
    create type public.bank_transfer_status as enum ('pending', 'verified', 'rejected');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'credit_note_status'
  ) then
    create type public.credit_note_status as enum ('draft', 'issued', 'applied', 'void');
  end if;
end
$$;

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(btrim(description)) <= 1000),
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  billing_period text not null default 'term'
    check (billing_period in ('once', 'month', 'term', 'year')),
  active boolean not null default true,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_items_id_school_key unique (id, school_id),
  constraint fee_items_school_name_currency_key unique (school_id, name, currency),
  constraint fee_items_effective_dates_check check (
    effective_until is null or effective_from is null or effective_until >= effective_from
  )
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  child_id uuid not null,
  guardian_user_id uuid not null,
  invoice_number text not null check (
    char_length(btrim(invoice_number)) between 3 and 64
    and invoice_number = btrim(invoice_number)
  ),
  currency public.currency_code not null,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  balance_minor bigint not null default 0 check (balance_minor >= 0),
  status public.invoice_status not null default 'draft',
  due_date date not null,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  notes text check (notes is null or char_length(btrim(notes)) <= 2000),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_id_school_key unique (id, school_id),
  constraint invoices_school_number_key unique (school_id, invoice_number),
  constraint invoices_child_school_fkey
    foreign key (child_id, school_id)
    references public.children (id, school_id) on delete restrict,
  constraint invoices_guardian_membership_fkey
    foreign key (school_id, guardian_user_id)
    references public.school_memberships (school_id, user_id) on delete restrict,
  constraint invoices_amount_equation_check check (
    total_minor = greatest(subtotal_minor - credit_minor, 0)
    and paid_minor <= total_minor
    and balance_minor = total_minor - paid_minor
  ),
  constraint invoices_state_timestamps_check check (
    (status = 'draft' and issued_at is null and paid_at is null and voided_at is null)
    or (status in ('issued', 'overdue', 'partially_paid') and issued_at is not null and paid_at is null and voided_at is null)
    or (status = 'paid' and issued_at is not null and paid_at is not null and voided_at is null and balance_minor = 0)
    or (status = 'void' and voided_at is not null and paid_minor = 0)
  )
);

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  invoice_id uuid not null,
  fee_item_id uuid,
  description text not null check (char_length(btrim(description)) between 2 and 240),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  currency public.currency_code not null,
  created_at timestamptz not null default now(),
  constraint invoice_lines_id_school_key unique (id, school_id),
  constraint invoice_lines_invoice_school_fkey
    foreign key (invoice_id, school_id)
    references public.invoices (id, school_id) on delete restrict,
  constraint invoice_lines_fee_item_school_fkey
    foreign key (fee_item_id, school_id)
    references public.fee_items (id, school_id) on delete restrict
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  idempotency_key text not null check (
    char_length(btrim(idempotency_key)) between 8 and 160
  ),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  reference text check (reference is null or char_length(btrim(reference)) between 1 and 160),
  provider_reference text check (provider_reference is null or char_length(btrim(provider_reference)) <= 200),
  provider text not null default 'simulated'
    check (provider in ('simulated', 'paynow', 'manual_bank')),
  exchange_rate_snapshot numeric(14, 4),
  created_by uuid not null references public.profiles(id) on delete restrict,
  succeeded_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_id_school_key unique (id, school_id),
  constraint payments_school_idempotency_key unique (school_id, idempotency_key),
  constraint payments_invoice_school_fkey
    foreign key (invoice_id, school_id)
    references public.invoices (id, school_id) on delete restrict,
  constraint payments_exchange_rate_check check (
    exchange_rate_snapshot is null or exchange_rate_snapshot > 0
  ),
  constraint payments_state_timestamps_check check (
    (status = 'succeeded' and succeeded_at is not null and refunded_at is null and failed_at is null and cancelled_at is null)
    or (status = 'refunded' and succeeded_at is not null and refunded_at is not null and failed_at is null and cancelled_at is null)
    or (status = 'failed' and failed_at is not null and succeeded_at is null and refunded_at is null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and succeeded_at is null and refunded_at is null and failed_at is null)
    or (status in ('pending', 'processing') and succeeded_at is null and refunded_at is null and failed_at is null and cancelled_at is null)
  )
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  payment_id uuid not null,
  attempt_number smallint not null check (attempt_number between 1 and 20),
  status public.payment_attempt_status not null default 'pending',
  provider text not null check (char_length(btrim(provider)) between 2 and 40),
  provider_reference text check (provider_reference is null or char_length(btrim(provider_reference)) <= 200),
  request_reference text check (request_reference is null or char_length(btrim(request_reference)) <= 200),
  failure_code text check (failure_code is null or char_length(failure_code) <= 100),
  failure_message text check (failure_message is null or char_length(failure_message) <= 500),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payment_attempts_id_school_key unique (id, school_id),
  constraint payment_attempts_payment_school_fkey
    foreign key (payment_id, school_id)
    references public.payments (id, school_id) on delete restrict,
  constraint payment_attempts_payment_number_key unique (school_id, payment_id, attempt_number),
  constraint payment_attempts_completion_check check (
    (status in ('pending', 'processing') and completed_at is null)
    or (status in ('succeeded', 'failed', 'cancelled') and completed_at is not null)
  )
);

create table if not exists public.bank_transfer_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  payment_id uuid not null,
  bank public.payment_method not null check (bank in ('cbz_transfer', 'cabs_transfer')),
  depositor_name text not null check (char_length(btrim(depositor_name)) between 2 and 160),
  bank_reference text not null check (char_length(btrim(bank_reference)) between 3 and 120),
  proof_storage_path text check (
    proof_storage_path is null
    or (
      char_length(proof_storage_path) <= 512
      and left(proof_storage_path, 1) <> '/'
      and position('..' in proof_storage_path) = 0
    )
  ),
  status public.bank_transfer_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(btrim(review_note)) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_transfer_submissions_id_school_key unique (id, school_id),
  constraint bank_transfer_submissions_payment_school_fkey
    foreign key (payment_id, school_id)
    references public.payments (id, school_id) on delete restrict,
  constraint bank_transfer_submissions_school_reference_key
    unique (school_id, bank, bank_reference),
  constraint bank_transfer_submissions_review_state_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('verified', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  payment_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  status public.refund_status not null default 'pending',
  reason text not null check (char_length(btrim(reason)) between 2 and 1000),
  provider_reference text check (provider_reference is null or char_length(btrim(provider_reference)) <= 200),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refunds_id_school_key unique (id, school_id),
  constraint refunds_payment_school_fkey
    foreign key (payment_id, school_id)
    references public.payments (id, school_id) on delete restrict,
  constraint refunds_completion_check check (
    (status in ('succeeded', 'failed', 'cancelled') and completed_at is not null)
    or (status in ('pending', 'processing') and completed_at is null)
  )
);

create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  invoice_id uuid not null,
  credit_note_number text not null check (char_length(btrim(credit_note_number)) between 3 and 64),
  amount_minor bigint not null check (amount_minor > 0),
  currency public.currency_code not null,
  reason text not null check (char_length(btrim(reason)) between 2 and 1000),
  status public.credit_note_status not null default 'draft',
  issued_by uuid references public.profiles(id) on delete restrict,
  issued_at timestamptz,
  applied_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_notes_id_school_key unique (id, school_id),
  constraint credit_notes_school_number_key unique (school_id, credit_note_number),
  constraint credit_notes_invoice_school_fkey
    foreign key (invoice_id, school_id)
    references public.invoices (id, school_id) on delete restrict,
  constraint credit_notes_state_timestamps_check check (
    (status = 'draft' and issued_at is null and applied_at is null and voided_at is null)
    or (status = 'issued' and issued_at is not null and applied_at is null and voided_at is null)
    or (status = 'applied' and issued_at is not null and applied_at is not null and voided_at is null)
    or (status = 'void' and voided_at is not null)
  )
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  payment_id uuid not null,
  receipt_number text not null check (char_length(btrim(receipt_number)) between 3 and 64),
  issued_at timestamptz not null default now(),
  document_storage_path text check (
    document_storage_path is null
    or (
      char_length(document_storage_path) <= 512
      and left(document_storage_path, 1) <> '/'
      and position('..' in document_storage_path) = 0
    )
  ),
  created_at timestamptz not null default now(),
  constraint receipts_id_school_key unique (id, school_id),
  constraint receipts_payment_school_fkey
    foreign key (payment_id, school_id)
    references public.payments (id, school_id) on delete restrict,
  constraint receipts_school_number_key unique (school_id, receipt_number),
  constraint receipts_one_per_payment_key unique (school_id, payment_id)
);


-- Enforce guardian ownership and currency consistency at the database boundary.
create or replace function private.assert_invoice_guardian()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.school_memberships as membership
    join public.guardian_children as link
      on link.school_id = membership.school_id
     and link.guardian_user_id = membership.user_id
     and link.child_id = new.child_id
     and link.active = true
    where membership.school_id = new.school_id
      and membership.user_id = new.guardian_user_id
      and membership.role = 'guardian'::public.user_role
      and membership.active = true
  ) then
    raise exception using
      errcode = '23503',
      message = 'INVOICE_GUARDIAN_NOT_LINKED_TO_CHILD';
  end if;

  return new;
end;
$function$;

revoke all on function private.assert_invoice_guardian() from public, anon, authenticated, service_role;

drop trigger if exists invoices_assert_guardian on public.invoices;
create trigger invoices_assert_guardian
before insert or update of school_id, child_id, guardian_user_id
on public.invoices
for each row execute function private.assert_invoice_guardian();

create or replace function private.assert_invoice_line_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  invoice_currency public.currency_code;
  fee_currency public.currency_code;
begin
  select invoice.currency
    into invoice_currency
  from public.invoices as invoice
  where invoice.id = new.invoice_id
    and invoice.school_id = new.school_id;

  if invoice_currency is null or invoice_currency <> new.currency then
    raise exception using
      errcode = '23514',
      message = 'INVOICE_LINE_CURRENCY_MISMATCH';
  end if;

  if new.fee_item_id is not null then
    select fee.currency
      into fee_currency
    from public.fee_items as fee
    where fee.id = new.fee_item_id
      and fee.school_id = new.school_id;

    if fee_currency is null or fee_currency <> new.currency then
      raise exception using
        errcode = '23514',
        message = 'FEE_ITEM_CURRENCY_MISMATCH';
    end if;
  end if;

  if new.line_total_minor <> round(new.quantity * new.unit_amount_minor)::bigint then
    raise exception using
      errcode = '23514',
      message = 'INVOICE_LINE_TOTAL_MISMATCH';
  end if;

  return new;
end;
$function$;

revoke all on function private.assert_invoice_line_currency() from public, anon, authenticated, service_role;

drop trigger if exists invoice_lines_assert_currency on public.invoice_lines;
create trigger invoice_lines_assert_currency
before insert or update of school_id, invoice_id, fee_item_id, quantity, unit_amount_minor, line_total_minor, currency
on public.invoice_lines
for each row execute function private.assert_invoice_line_currency();

-- Keep mutable finance records' updated_at values consistent with the foundation.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'fee_items', 'invoices', 'payments', 'bank_transfer_submissions',
    'refunds', 'credit_notes'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_set_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function private.set_updated_at()',
      table_name || '_set_updated_at', table_name
    );
  end loop;
end
$$;

create index if not exists fee_items_school_active_period_idx
  on public.fee_items (school_id, active, billing_period, name);
create index if not exists fee_items_effective_dates_idx
  on public.fee_items (school_id, effective_from, effective_until);

create index if not exists invoices_school_status_due_idx
  on public.invoices (school_id, status, due_date, created_at desc);
create index if not exists invoices_school_child_due_idx
  on public.invoices (school_id, child_id, due_date desc);
create index if not exists invoices_school_guardian_due_idx
  on public.invoices (school_id, guardian_user_id, due_date desc);
create index if not exists invoices_created_by_fkey_idx
  on public.invoices (created_by) where created_by is not null;

create index if not exists invoice_lines_invoice_idx
  on public.invoice_lines (school_id, invoice_id, created_at);
create index if not exists invoice_lines_fee_item_idx
  on public.invoice_lines (school_id, fee_item_id)
  where fee_item_id is not null;

create index if not exists payments_school_status_created_idx
  on public.payments (school_id, status, created_at desc);
create index if not exists payments_school_invoice_created_idx
  on public.payments (school_id, invoice_id, created_at desc);
create index if not exists payments_created_by_fkey_idx
  on public.payments (created_by);
create index if not exists payments_provider_reference_idx
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create index if not exists payment_attempts_payment_started_idx
  on public.payment_attempts (school_id, payment_id, started_at desc);
create index if not exists payment_attempts_provider_reference_idx
  on public.payment_attempts (provider, provider_reference)
  where provider_reference is not null;

create index if not exists bank_transfer_submissions_school_status_created_idx
  on public.bank_transfer_submissions (school_id, status, created_at desc);
create index if not exists bank_transfer_submissions_payment_idx
  on public.bank_transfer_submissions (school_id, payment_id);

create index if not exists refunds_school_status_requested_idx
  on public.refunds (school_id, status, requested_at desc);
create index if not exists refunds_payment_idx
  on public.refunds (school_id, payment_id, requested_at desc);

create index if not exists credit_notes_school_invoice_status_idx
  on public.credit_notes (school_id, invoice_id, status, created_at desc);

create index if not exists receipts_school_issued_idx
  on public.receipts (school_id, issued_at desc);
create index if not exists receipts_payment_idx
  on public.receipts (school_id, payment_id);

alter table public.fee_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.bank_transfer_submissions enable row level security;
alter table public.refunds enable row level security;
alter table public.credit_notes enable row level security;
alter table public.receipts enable row level security;

revoke all on table
  public.fee_items, public.invoices, public.invoice_lines, public.payments,
  public.payment_attempts, public.bank_transfer_submissions, public.refunds,
  public.credit_notes, public.receipts
from public, anon, authenticated, service_role;

grant all privileges on table
  public.fee_items, public.invoices, public.invoice_lines, public.payments,
  public.payment_attempts, public.bank_transfer_submissions, public.refunds,
  public.credit_notes, public.receipts
to service_role;

-- Financial source records are retained for audit and reconciliation.
-- Trusted RPCs may append attempts/receipts; they may not rewrite issued receipts.
revoke update, delete, truncate on public.receipts from service_role;
