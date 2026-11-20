-- Add covering indexes for foreign-key lookups used during staff and invitation lifecycle changes.

create index school_invitations_invited_by_idx
  on public.school_invitations (invited_by)
  where invited_by is not null;

create index school_invitations_accepted_by_idx
  on public.school_invitations (accepted_by)
  where accepted_by is not null;

create index staff_members_membership_idx
  on public.staff_members (school_id, user_id, role);
