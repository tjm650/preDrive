-- Atomically reconcile signed Paynow callbacks, payment state, invoice balance and audit log.
create or replace function public.apply_paynow_callback(
  p_merchant_reference text,
  p_paynow_reference text,
  p_amount numeric,
  p_provider_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  tx public.paynow_transactions%rowtype;
  payment public.payments%rowtype;
  invoice public.invoices%rowtype;
  next_status text;
  paid_total numeric(12,2);
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_merchant_reference is null or length(p_merchant_reference) > 120
     or p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount
     or p_provider_status is null or length(p_provider_status) > 80 then
    raise exception 'Invalid Paynow callback values' using errcode = '22023';
  end if;

  select t.* into tx
  from public.paynow_transactions t
  where t.merchant_reference = p_merchant_reference
  for update;
  if not found then raise exception 'Unknown Paynow reference' using errcode = 'P0002'; end if;

  select p.* into payment
  from public.payments p
  where p.id = tx.payment_id and p.provider = 'paynow'
    and p.provider_reference = p_merchant_reference
  for update;
  if not found then raise exception 'Paynow payment not found' using errcode = 'P0002'; end if;

  if payment.amount <> p_amount then
    raise exception 'Paynow callback amount does not match the payment' using errcode = '22023';
  end if;
  select i.* into invoice from public.invoices i where i.id = payment.invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode = 'P0002'; end if;
  if upper(invoice.currency) <> upper(payment.currency) then
    raise exception 'Paynow payment currency does not match the invoice' using errcode = '22023';
  end if;

  if payment.status = 'succeeded' then return 'succeeded'; end if;
  if lower(p_provider_status) = 'paid' then
    next_status := 'succeeded';
  elsif lower(p_provider_status) in ('cancelled', 'failed', 'disputed') then
    next_status := 'failed';
  else
    next_status := 'pending';
  end if;
  if payment.status = 'failed' and next_status <> 'succeeded' then return 'failed'; end if;

  update public.payments
  set status = next_status,
      paid_at = case when next_status = 'succeeded' then coalesce(paid_at, now()) else null end
  where id = payment.id;
  update public.paynow_transactions
  set paynow_reference = coalesce(p_paynow_reference, paynow_reference),
      status = next_status
  where payment_id = payment.id;

  if next_status = 'succeeded' then
    select coalesce(sum(p.amount), 0) into paid_total
    from public.payments p
    where p.invoice_id = invoice.id and p.status = 'succeeded';
    if paid_total >= invoice.amount_usd then
      update public.invoices set status = 'paid', updated_at = now()
      where id = invoice.id and status in ('pending', 'overdue');
    end if;
  end if;

  if payment.status is distinct from next_status then
    insert into public.audit_log(school_id, actor_id, action, entity_type, entity_id, metadata)
    values (invoice.school_id, null, 'paynow_payment_' || next_status, 'payment', payment.id,
      jsonb_build_object('invoice_id', invoice.id, 'merchant_reference', p_merchant_reference,
        'paynow_reference', p_paynow_reference, 'amount', p_amount,
        'currency', payment.currency, 'provider_status', p_provider_status));
  end if;

  return next_status;
end
$$;
revoke all on function public.apply_paynow_callback(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_paynow_callback(text, text, numeric, text) to service_role;
