-- Manual payment records must be written through the audited reconciliation RPC.
drop policy if exists payments_admin_write on public.payments;
revoke insert, update, delete on public.payments from anon, authenticated;

create or replace function public.record_manual_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_currency text,
  p_reference text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare invoice_row public.invoices%rowtype;
declare outstanding numeric(12,2);
declare payment_id uuid;
declare reference_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into invoice_row from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  if not private.is_school_admin(invoice_row.school_id) then
    raise exception 'Only the invoice school administrator can reconcile payments' using errcode='42501';
  end if;
  if invoice_row.status::text not in ('pending','overdue') then
    raise exception 'Only pending or overdue invoices can receive a payment' using errcode='22023';
  end if;
  if p_amount is null or p_amount <= 0 or round(p_amount,2) <> p_amount then
    raise exception 'Enter a positive payment amount with no more than two decimal places' using errcode='22023';
  end if;
  if p_currency is null or upper(btrim(p_currency)) <> upper(invoice_row.currency) then
    raise exception 'Payment currency must match the invoice currency' using errcode='22023';
  end if;
  reference_value := nullif(btrim(p_reference),'');
  if reference_value is null or length(reference_value) > 120 then
    raise exception 'Enter a payment receipt or transaction reference (maximum 120 characters)' using errcode='22023';
  end if;
  if exists (
    select 1 from public.payments p
    where p.invoice_id=p_invoice_id and p.provider='manual' and p.provider_reference=reference_value
  ) then raise exception 'This payment reference has already been recorded for this invoice' using errcode='23505'; end if;

  select greatest(invoice_row.amount_usd - coalesce(sum(p.amount),0),0)
  into outstanding
  from public.payments p
  where p.invoice_id=p_invoice_id and p.status='succeeded';

  if p_amount > outstanding then raise exception 'Payment exceeds the outstanding invoice balance' using errcode='22023'; end if;

  insert into public.payments(invoice_id,amount,currency,provider,provider_reference,status,paid_at)
  values(p_invoice_id,p_amount,upper(btrim(p_currency)),'manual',reference_value,'succeeded',now())
  returning id into payment_id;

  if p_amount = outstanding then
    update public.invoices set status='paid',updated_at=now() where id=p_invoice_id;
  end if;

  insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
  values(invoice_row.school_id,auth.uid(),'manual_payment_recorded','payment',payment_id,
    jsonb_build_object('invoice_id',p_invoice_id,'amount',p_amount,'currency',upper(btrim(p_currency)),'reference',reference_value));
  return payment_id;
end
$$;

revoke all on function public.record_manual_payment(uuid,numeric,text,text) from public,anon;
grant execute on function public.record_manual_payment(uuid,numeric,text,text) to authenticated;
