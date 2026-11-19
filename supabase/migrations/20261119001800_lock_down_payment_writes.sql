-- Payment writes must pass through the audited reconciliation RPCs or trusted
-- provider callbacks. A school-admin RLS policy must never allow raw payment rows.
drop policy if exists payments_admin_insert on public.payments;
drop policy if exists payments_admin_update on public.payments;
drop policy if exists payments_admin_delete on public.payments;
drop policy if exists payments_admin_write on public.payments;
revoke insert, update, delete on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;
