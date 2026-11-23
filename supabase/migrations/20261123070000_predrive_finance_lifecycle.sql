-- B3.7: idempotent payment initiation and trusted payment/refund settlement.
-- Client callers can create pending payment intents only. Settlement is service_role-only
-- and must be called only after B4 has verified the provider webhook or simulated result.

create or replace function public.initiate_payment(
  p_school_id uuid,
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_currency public.currency_code,
  p_method public.payment_method,
  p_idempotency_key text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
  v_request_hash text;
  v_pending_minor bigint;
  v_existing public.payments%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0
     or p_currency is null or p_method is null
     or p_idempotency_key is null
     or char_length(btrim(p_idempotency_key)) not between 8 and 160
     or p_method = 'card'::public.payment_method then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        p_invoice_id::text || ':' || p_amount_minor::text || ':' ||
        p_currency::text || ':' || p_method::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  select p.* into v_existing
  from public.payments p
  where p.school_id = p_school_id
    and p.idempotency_key = btrim(p_idempotency_key);
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_existing;
  end if;

  select i.* into v_invoice
  from public.invoices i
  where i.id = p_invoice_id and i.school_id = p_school_id
    and i.guardian_user_id = v_actor
    and i.status in (
      'issued'::public.invoice_status,
      'partially_paid'::public.invoice_status,
      'overdue'::public.invoice_status
    )
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYABLE_INVOICE_NOT_FOUND';
  end if;

  select coalesce(sum(p.amount_minor), 0) into v_pending_minor
  from public.payments p
  where p.school_id = p_school_id and p.invoice_id = p_invoice_id
    and p.status in ('pending'::public.payment_status, 'processing'::public.payment_status);

  if v_invoice.currency <> p_currency
     or p_amount_minor + v_pending_minor > v_invoice.balance_minor then
    raise exception using errcode = '22023', message = 'PAYMENT_AMOUNT_INVALID_OR_RESERVED';
  end if;

  insert into public.payments (
    school_id, invoice_id, amount_minor, currency, method,
    status, idempotency_key, request_hash, provider,
    exchange_rate_snapshot, created_by
  ) values (
    p_school_id, p_invoice_id, p_amount_minor, p_currency, p_method,
    'pending'::public.payment_status, btrim(p_idempotency_key), v_request_hash,
    case when p_method in ('cbz_transfer'::public.payment_method, 'cabs_transfer'::public.payment_method)
      then 'manual_bank' else 'simulated' end,
    (select s.indicative_zig_per_usd from public.schools s where s.id = p_school_id),
    v_actor
  ) returning * into v_payment;

  return v_payment;
end;
$function$;

create or replace function public.apply_payment_result(
  p_payment_id uuid,
  p_succeeded boolean,
  p_provider_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_receipt_id uuid;
  v_receipt_number text;
begin
  -- Only a trusted Edge Function/service-role caller can settle a payment.
  select p.* into v_payment
  from public.payments p
  where p.id = p_payment_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status in (
    'succeeded'::public.payment_status,
    'refunded'::public.payment_status,
    'failed'::public.payment_status,
    'cancelled'::public.payment_status
  ) then
    select r.id into v_receipt_id
    from public.receipts r
    where r.school_id = v_payment.school_id and r.payment_id = v_payment.id;
    return v_receipt_id;
  end if;

  if p_succeeded then
    select i.* into v_invoice
    from public.invoices i
    where i.id = v_payment.invoice_id and i.school_id = v_payment.school_id
    for update;

    if v_invoice.balance_minor < v_payment.amount_minor then
      raise exception using errcode = '23514', message = 'INVOICE_BALANCE_CHANGED';
    end if;

    update public.payments
    set status = 'succeeded'::public.payment_status,
        provider_reference = nullif(btrim(p_provider_reference), ''),
        succeeded_at = now(),
        updated_at = now()
    where id = v_payment.id;

    update public.invoices
    set paid_minor = paid_minor + v_payment.amount_minor,
        balance_minor = balance_minor - v_payment.amount_minor,
        status = case
          when balance_minor - v_payment.amount_minor = 0
            then 'paid'::public.invoice_status
          else 'partially_paid'::public.invoice_status
        end,
        paid_at = case when balance_minor - v_payment.amount_minor = 0 then now() else null end,
        updated_at = now()
    where id = v_invoice.id;

    v_receipt_number := 'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.receipts (school_id, payment_id, receipt_number)
    values (v_payment.school_id, v_payment.id, v_receipt_number)
    on conflict (school_id, payment_id) do nothing
    returning id into v_receipt_id;

    if v_receipt_id is null then
      select r.id into v_receipt_id
      from public.receipts r
      where r.school_id = v_payment.school_id and r.payment_id = v_payment.id;
    end if;
  else
    update public.payments
    set status = 'failed'::public.payment_status,
        failed_at = now(),
        provider_reference = nullif(btrim(p_provider_reference), ''),
        updated_at = now()
    where id = v_payment.id;
  end if;

  return v_receipt_id;
end;
$function$;

create or replace function public.request_refund(
  p_school_id uuid,
  p_payment_id uuid,
  p_amount_minor bigint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_refund_id uuid;
  v_payment public.payments%rowtype;
  v_already_requested bigint;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0
     or p_reason is null or char_length(btrim(p_reason)) not between 2 and 1000 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.id = p_payment_id and p.school_id = p_school_id
    and p.status in ('succeeded'::public.payment_status, 'refunded'::public.payment_status)
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'SETTLED_PAYMENT_NOT_FOUND';
  end if;

  select coalesce(sum(r.amount_minor), 0) into v_already_requested
  from public.refunds r
  where r.school_id = p_school_id and r.payment_id = p_payment_id
    and r.status in ('pending'::public.refund_status, 'processing'::public.refund_status, 'succeeded'::public.refund_status);

  if v_already_requested + p_amount_minor > v_payment.amount_minor then
    raise exception using errcode = '23514', message = 'REFUND_EXCEEDS_PAYMENT';
  end if;

  insert into public.refunds (
    school_id, payment_id, amount_minor, currency, reason, requested_by
  ) values (
    p_school_id, p_payment_id, p_amount_minor, v_payment.currency,
    btrim(p_reason), auth.uid()
  ) returning id into v_refund_id;

  return v_refund_id;
end;
$function$;

create or replace function public.apply_refund_result(
  p_refund_id uuid,
  p_succeeded boolean,
  p_provider_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_refund public.refunds%rowtype;
  v_payment public.payments%rowtype;
  v_invoice public.invoices%rowtype;
  v_refunded_total bigint;
begin
  select r.* into v_refund from public.refunds r
  where r.id = p_refund_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REFUND_NOT_FOUND';
  end if;
  if v_refund.status in ('succeeded'::public.refund_status, 'failed'::public.refund_status, 'cancelled'::public.refund_status) then
    return;
  end if;

  select p.* into v_payment from public.payments p
  where p.id = v_refund.payment_id and p.school_id = v_refund.school_id
  for update;

  if p_succeeded then
    update public.refunds
    set status = 'succeeded'::public.refund_status,
        provider_reference = nullif(btrim(p_provider_reference), ''),
        completed_at = now(), updated_at = now()
    where id = p_refund_id;

    select coalesce(sum(r.amount_minor), 0) into v_refunded_total
    from public.refunds r
    where r.payment_id = v_payment.id and r.school_id = v_payment.school_id
      and r.status = 'succeeded'::public.refund_status;

    select i.* into v_invoice from public.invoices i
    where i.id = v_payment.invoice_id and i.school_id = v_payment.school_id
    for update;

    update public.invoices
    set paid_minor = greatest(paid_minor - v_refund.amount_minor, 0),
        balance_minor = least(total_minor, balance_minor + v_refund.amount_minor),
        status = case
          when least(total_minor, balance_minor + v_refund.amount_minor) = total_minor
            then 'issued'::public.invoice_status
          else 'partially_paid'::public.invoice_status
        end,
        paid_at = null,
        updated_at = now()
    where id = v_invoice.id;

    if v_refunded_total >= v_payment.amount_minor then
      update public.payments
      set status = 'refunded'::public.payment_status,
          refunded_at = now(), updated_at = now()
      where id = v_payment.id;
    end if;
  else
    update public.refunds
    set status = 'failed'::public.refund_status,
        provider_reference = nullif(btrim(p_provider_reference), ''),
        completed_at = now(), updated_at = now()
    where id = p_refund_id;
  end if;
end;
$function$;

create or replace function public.create_invoice(
  p_school_id uuid,
  p_child_id uuid,
  p_guardian_user_id uuid,
  p_invoice_number text,
  p_currency public.currency_code,
  p_due_date date,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invoice_id uuid;
  v_line jsonb;
  v_description text;
  v_quantity numeric(12,3);
  v_unit_amount bigint;
  v_line_total bigint;
  v_fee_item_id uuid;
  v_subtotal bigint := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_invoice_number is null or char_length(btrim(p_invoice_number)) not between 3 and 64
     or p_currency is null or p_due_date is null
     or p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) < 1
     or jsonb_array_length(p_lines) > 50 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;
  if not exists (
    select 1 from public.guardian_children gc
    where gc.school_id = p_school_id and gc.child_id = p_child_id
      and gc.guardian_user_id = p_guardian_user_id and gc.active
  ) then
    raise exception using errcode = '23503', message = 'GUARDIAN_CHILD_LINK_REQUIRED';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_description := btrim(v_line ->> 'description');
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_unit_amount := (v_line ->> 'unitAmountMinor')::bigint;
    v_fee_item_id := nullif(v_line ->> 'feeItemId', '')::uuid;

    if v_description is null or char_length(v_description) not between 2 and 240
       or v_quantity is null or v_quantity <= 0
       or v_unit_amount is null or v_unit_amount < 0 then
      raise exception using errcode = '22023', message = 'INVOICE_LINE_VALIDATION';
    end if;

    if v_fee_item_id is not null and not exists (
      select 1 from public.fee_items fi
      where fi.id = v_fee_item_id and fi.school_id = p_school_id
        and fi.currency = p_currency and fi.active
    ) then
      raise exception using errcode = '23503', message = 'FEE_ITEM_NOT_FOUND_OR_CURRENCY_MISMATCH';
    end if;

    v_line_total := round(v_quantity * v_unit_amount)::bigint;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  insert into public.invoices (
    school_id, child_id, guardian_user_id, invoice_number, currency,
    subtotal_minor, credit_minor, total_minor, paid_minor, balance_minor,
    status, due_date, created_by
  ) values (
    p_school_id, p_child_id, p_guardian_user_id, btrim(p_invoice_number), p_currency,
    v_subtotal, 0, v_subtotal, 0, v_subtotal,
    'draft'::public.invoice_status, p_due_date, auth.uid()
  ) returning id into v_invoice_id;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_description := btrim(v_line ->> 'description');
    v_quantity := (v_line ->> 'quantity')::numeric;
    v_unit_amount := (v_line ->> 'unitAmountMinor')::bigint;
    v_fee_item_id := nullif(v_line ->> 'feeItemId', '')::uuid;
    v_line_total := round(v_quantity * v_unit_amount)::bigint;

    insert into public.invoice_lines (
      school_id, invoice_id, fee_item_id, description,
      quantity, unit_amount_minor, line_total_minor, currency
    ) values (
      p_school_id, v_invoice_id, v_fee_item_id, v_description,
      v_quantity, v_unit_amount, v_line_total, p_currency
    );
  end loop;

  return v_invoice_id;
end;
$function$;

create or replace function public.issue_invoice(
  p_school_id uuid,
  p_invoice_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  update public.invoices
  set status = 'issued'::public.invoice_status,
      issued_at = now(),
      updated_at = now()
  where id = p_invoice_id and school_id = p_school_id
    and status = 'draft'::public.invoice_status
    and total_minor > 0;

  if not found then
    raise exception using errcode = '40001', message = 'INVOICE_NOT_ISSUABLE';
  end if;
end;
$function$;

create or replace function public.void_invoice(
  p_school_id uuid,
  p_invoice_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 2 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  update public.invoices
  set status = 'void'::public.invoice_status,
      voided_at = now(),
      notes = left(coalesce(notes || E'\n', '') || 'Voided: ' || btrim(p_reason), 2000),
      updated_at = now()
  where id = p_invoice_id and school_id = p_school_id
    and status in ('draft'::public.invoice_status, 'issued'::public.invoice_status, 'overdue'::public.invoice_status)
    and paid_minor = 0
    and not exists (
      select 1 from public.payments p
      where p.school_id = p_school_id and p.invoice_id = p_invoice_id
        and p.status in ('pending'::public.payment_status, 'processing'::public.payment_status)
    );

  if not found then
    raise exception using errcode = '40001', message = 'INVOICE_NOT_VOIDABLE';
  end if;
end;
$function$;

create or replace function public.submit_bank_transfer(
  p_school_id uuid,
  p_payment_id uuid,
  p_depositor_name text,
  p_bank_reference text,
  p_proof_storage_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment public.payments%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if p_depositor_name is null or char_length(btrim(p_depositor_name)) not between 2 and 160
     or p_bank_reference is null or char_length(btrim(p_bank_reference)) not between 3 and 120
     or (p_proof_storage_path is not null and (
       char_length(p_proof_storage_path) > 512
       or left(p_proof_storage_path, 1) = '/'
       or position('..' in p_proof_storage_path) > 0
       or pg_catalog.array_length(pg_catalog.string_to_array(p_proof_storage_path, '/'), 1) <> 4
       or pg_catalog.split_part(p_proof_storage_path, '/', 3) <> p_payment_id::text
       or left(p_proof_storage_path, length(p_school_id::text || '/' || auth.uid()::text || '/'))
          <> (p_school_id::text || '/' || auth.uid()::text || '/')
     )) then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  select p.* into v_payment
  from public.payments p
  join public.invoices i on i.id = p.invoice_id and i.school_id = p.school_id
  where p.id = p_payment_id and p.school_id = p_school_id
    and p.created_by = auth.uid()
    and p.method in ('cbz_transfer'::public.payment_method, 'cabs_transfer'::public.payment_method)
    and p.provider = 'manual_bank'
    and p.status = 'pending'::public.payment_status
    and i.guardian_user_id = auth.uid()
  for update of p;
  if not found then
    raise exception using errcode = 'P0002', message = 'PENDING_BANK_PAYMENT_NOT_FOUND';
  end if;

  insert into public.bank_transfer_submissions (
    school_id, payment_id, bank, depositor_name, bank_reference, proof_storage_path
  ) values (
    p_school_id, p_payment_id, v_payment.method, btrim(p_depositor_name),
    btrim(p_bank_reference), p_proof_storage_path
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.review_bank_transfer(
  p_school_id uuid,
  p_submission_id uuid,
  p_decision text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payment_id uuid;
  v_bank_reference text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'UNAUTHENTICATED';
  end if;
  if not private.has_role(p_school_id, 'school_admin'::public.user_role) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception using errcode = '22023', message = 'VALIDATION';
  end if;

  update public.bank_transfer_submissions
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(btrim(p_review_note), ''),
      updated_at = now()
  where id = p_submission_id and school_id = p_school_id
    and status = 'pending'::public.bank_transfer_status
  returning payment_id, bank_reference
  into v_payment_id, v_bank_reference;

  if not found then
    raise exception using errcode = '40001', message = 'BANK_TRANSFER_NOT_REVIEWABLE';
  end if;

  if p_decision = 'verified' then
    perform public.apply_payment_result(v_payment_id, true, v_bank_reference);
  end if;
end;
$function$;

revoke all on function public.initiate_payment(uuid, uuid, bigint, public.currency_code, public.payment_method, text) from public, anon;
revoke all on function public.apply_payment_result(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.request_refund(uuid, uuid, bigint, text) from public, anon;
revoke all on function public.apply_refund_result(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.create_invoice(uuid,uuid,uuid,text,public.currency_code,date,jsonb) from public, anon;
revoke all on function public.issue_invoice(uuid,uuid) from public, anon;
revoke all on function public.void_invoice(uuid,uuid,text) from public, anon;
revoke all on function public.submit_bank_transfer(uuid,uuid,text,text,text) from public, anon;
revoke all on function public.review_bank_transfer(uuid,uuid,text,text) from public, anon;
grant execute on function public.initiate_payment(uuid, uuid, bigint, public.currency_code, public.payment_method, text) to authenticated;
grant execute on function public.request_refund(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.apply_payment_result(uuid, boolean, text) to service_role;
grant execute on function public.apply_refund_result(uuid, boolean, text) to service_role;
grant execute on function public.create_invoice(uuid,uuid,uuid,text,public.currency_code,date,jsonb) to authenticated;
grant execute on function public.issue_invoice(uuid,uuid) to authenticated;
grant execute on function public.void_invoice(uuid,uuid,text) to authenticated;
grant execute on function public.submit_bank_transfer(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.review_bank_transfer(uuid,uuid,text,text) to authenticated;

comment on function public.apply_payment_result(uuid, boolean, text) is
  'Trusted settlement only. Caller must be a B4 service-role Edge Function after webhook signature verification.';
comment on function public.apply_refund_result(uuid, boolean, text) is
  'Trusted settlement only. Caller must be a B4 service-role Edge Function after provider confirmation.';
