-- Atomic school-admin workflows for guardian-linked enrolment and manual payment reconciliation.
create or replace function public.create_child_with_guardian(
  p_first_name text,
  p_guardian_id uuid,
  p_class_name text default null,
  p_relationship text default 'Parent'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare school_id uuid;
declare child_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  school_id := private.current_school_id();
  if private.current_role() <> 'school_admin' or school_id is null then
    raise exception 'Only a school administrator can enrol children' using errcode='42501';
  end if;
  if p_first_name is null or length(btrim(p_first_name)) not between 1 and 100 then
    raise exception 'Enter a valid child first name' using errcode='22023';
  end if;
  if p_class_name is not null and length(btrim(p_class_name)) > 100 then
    raise exception 'Class name is too long' using errcode='22023';
  end if;
  if p_relationship is null or length(btrim(p_relationship)) not between 1 and 50 then
    raise exception 'Enter a valid guardian relationship' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_guardian_id and p.school_id = school_id and p.role = 'parent'
  ) then raise exception 'Choose a parent account belonging to this school' using errcode='22023'; end if;

  insert into public.children(school_id,first_name,class_name)
  values(school_id,btrim(p_first_name),nullif(btrim(p_class_name),''))
  returning id into child_id;

  insert into public.guardianships(guardian_id,child_id,relationship)
  values(p_guardian_id,child_id,btrim(p_relationship));

  insert into public.audit_log(school_id,actor_id,action,entity_type,entity_id,metadata)
  values(school_id,auth.uid(),'child_enrolled','child',child_id,
    jsonb_build_object('guardian_id',p_guardian_id,'relationship',btrim(p_relationship)));
  return child_id;
end
$$;

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
  if invoice_row.status='void' then raise exception 'A void invoice cannot receive a payment' using errcode='22023'; end if;
  if invoice_row.status='paid' then raise exception 'This invoice is already paid' using errcode='22023'; end if;
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
  if exists(select 1 from public.payments p where p.invoice_id=p_invoice_id and p.provider='manual' and p.provider_reference=reference_value) then
    raise exception 'This payment reference has already been recorded for this invoice' using errcode='23505';
  end if;

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

revoke all on function public.create_child_with_guardian(text,uuid,text,text) from public,anon;
revoke all on function public.record_manual_payment(uuid,numeric,text,text) from public,anon;
grant execute on function public.create_child_with_guardian(text,uuid,text,text) to authenticated;
grant execute on function public.record_manual_payment(uuid,numeric,text,text) to authenticated;
