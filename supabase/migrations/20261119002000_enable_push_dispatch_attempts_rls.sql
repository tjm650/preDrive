-- Defense in depth for the internal push-dispatch audit table.
-- Keep this table server-only: deliberately add no anon/authenticated policies.
-- Do not FORCE ROW LEVEL SECURITY; trusted owner-context dispatch functions
-- must retain their existing internal write behavior.
ALTER TABLE private.push_dispatch_attempts ENABLE ROW LEVEL SECURITY;
