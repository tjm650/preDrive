-- Complete the requested realtime surface and cover the final foreign-key indexes.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.absences;

create index if not exists staff_invitations_invited_by_idx
  on public.staff_invitations(invited_by);
create index if not exists parent_invitations_invited_by_idx
  on public.parent_invitations(invited_by);
create index if not exists routes_field_checked_by_idx
  on public.routes(field_checked_by);
