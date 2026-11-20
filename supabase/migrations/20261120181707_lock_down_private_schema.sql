-- Keep private helper functions out of the anonymous API surface.
-- Authenticated RLS policies can call only the explicitly granted helpers.
-- Supabase Auth retains access to the profile-sync trigger function.

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, supabase_auth_admin;

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.sync_auth_user_profile() from public, anon, authenticated, service_role;
grant execute on function private.sync_auth_user_profile() to supabase_auth_admin;

revoke all on function private.has_school_role(uuid, public.user_role[]) from public, anon;
grant execute on function private.has_school_role(uuid, public.user_role[]) to authenticated;

revoke all on function private.can_admin_view_profile(uuid) from public, anon;
grant execute on function private.can_admin_view_profile(uuid) to authenticated;
