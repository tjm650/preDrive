-- Default privileges for future public objects created by the postgres migration role
-- must be opt-in. Each exposed table/function/sequence receives explicit grants
-- in the migration that creates it.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role, public;
