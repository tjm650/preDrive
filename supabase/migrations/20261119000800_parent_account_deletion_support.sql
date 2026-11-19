-- Make user-owned records safe to retain or anonymize when a parent deletes their account.
alter table public.absences alter column reported_by drop not null;
alter table public.absences drop constraint if exists absences_reported_by_fkey;
alter table public.absences add constraint absences_reported_by_fkey
  foreign key (reported_by) references public.profiles(id) on delete set null;

alter table public.incidents alter column reported_by drop not null;
alter table public.incidents drop constraint if exists incidents_reported_by_fkey;
alter table public.incidents add constraint incidents_reported_by_fkey
  foreign key (reported_by) references public.profiles(id) on delete set null;

alter table public.invoices drop constraint if exists invoices_guardian_id_fkey;
alter table public.invoices add constraint invoices_guardian_id_fkey
  foreign key (guardian_id) references public.profiles(id) on delete set null;

alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.messages alter column sender_id drop not null;
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete set null;
