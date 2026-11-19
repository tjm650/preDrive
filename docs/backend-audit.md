# Backend audit — preDrive

**Audit target:** `tjm650/preDrive`, default branch `main`  
**Audit date:** 2026-11-19  
**Status:** Partial source audit; no local database execution has been performed.

## Verified repository and runtime configuration

- pnpm workspace version: `pnpm@10.22.0`; workspace packages are under `frontend/apps/*` and `frontend/packages/*`.
- Mobile package: Expo `~58.0.26`, Expo Router `~58.0.32`, React Native `0.88.0`, React `19.3.0`.
- Android application ID is documented as `zw.co.predrive.mobile`.
- Web package: Next.js `^16.0.0`, React `19.2.3`, `@supabase/ssr` `^0.7.0`.
- Supabase JS is used by both apps. Mobile persists Auth sessions with Expo SecureStore. Web uses Supabase SSR browser and server clients with cookie storage.
- Mobile environment template: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_EAS_PROJECT_ID`.
- Web environment template: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
- Supabase local config uses Postgres 17, local API/Auth/Studio ports 54321/54322/54323, and seeds from `supabase/seed.sql`.
- Root scripts include `db:types` (`supabase gen types typescript --local`), `test:db` (`supabase test db`), lint, format and typecheck.

## Existing backend surfaces documented or inspected

- README documents versioned migrations, pgTAP tenant-isolation tests, seed data, trip RPCs, RLS, tenant integrity, push/route provenance, and Edge Functions.
- Seed file inspected: five local demo Auth identities (supervisor, driver-profile, parent, school admin, platform owner), one Little Sprouts tenant, three buses, three routes, seven stops, 24 children, two guardianships, route assignments, trip history and events.
- Seed's school data currently uses fields including `slug`, `address`, `phone`, `email`; buses use `registration`, `make`, `model`, `driver_name`; routes use `type`. This differs from some field names in the new target specification and must be reconciled rather than blindly replaced.
- Existing `send-push` function uses Supabase service-role credentials from Edge Function environment, a webhook-secret check, per-language message dictionaries (en/sn/nd), Expo Push API delivery and clears tokens on `DeviceNotRegistered`. The inspected excerpt records a push receipt on successful send. Receipt polling is separately documented.
- Existing `invite-staff` function authenticates the caller, checks for `school_admin`, scopes invitations to the caller's school and writes an audit record. It uses service-role access and currently accepts `supervisor` and `school_admin` roles.
- README documents `invite-parent`, `check-push-receipts`, and `build-route-geometry` functions and their operational setup.
- README explicitly states that automated payment-provider callbacks/integration, refunds and provider payment integration are not implemented.
- README states trip completion is blocked until all manifest children have a final status; pickup PIN and offline event controls are documented.
- Existing mobile home screen uses Supabase Auth password sign-in and reads the caller's profile after authentication. UI files were not modified.

## Firebase review

The inspected mobile and web package manifests and Supabase client entry points show Supabase Auth and no Firebase SDK import. The current push function sends through Expo Push API. A complete repository-wide Firebase/FCM search could not be established from the available file-level repository interface, so Firebase removal is not certified by this partial audit.

## Gaps and items requiring source-level verification

1. Inspect every ordered SQL migration and pgTAP test to verify actual schema, grants, RLS policies, helper functions, triggers, RPCs, cron jobs and Realtime publication membership.
2. Verify every public table has RLS enabled and every foreign key has an index.
3. Verify profile creation, immutable role/school assignment, school-code join flow, platform-owner privileges and tenant-consistent foreign keys.
4. Verify parent access is limited to their own children and active-trip bus coordinates; confirm no parent access to location history.
5. Verify supervisor access is restricted to assigned trips and school admins are tenant-scoped.
6. Verify pickup PIN bcrypt hashing, attempt limits, lockout and audit behavior; verify hashes are not selectable by client roles.
7. Verify end-trip child-unaccounted escalation, 60-second retry, stale location alerts and 90-day location-history retention.
8. Verify notification idempotency, bus-near/bus-arrived distance logic and notification acknowledgement behavior.
9. Verify all required RPCs and Edge Functions, including Paynow feature-flag/mock behavior, data export and account deletion.
10. Verify the second-tenant fixture and all requested security tests.
11. Regenerate `frontend/packages/shared/src/database.types.ts` from the actual local database after migrations are reconciled; do not hand-edit generated types.
12. Run Supabase CLI, Docker, pgTAP, TypeScript checks and Android/web builds in a local runtime before claiming tests pass.

## Confirmed defects and corrective work on `backend/audit-and-hardening`

1. **Parent historical-location exposure:** migrations `20261118000100`, `20261118000600` and `20261118001100` all allowed a guardian to read `location_history` while a trip carrying their child was active. Added `20261119000100_child_location_and_identity_hardening.sql`, which replaces that policy so only the assigned supervisor and authorized school/platform administrators can read historical traces. Parents retain access to `bus_live` only under the active-trip/guardian policy.
2. **Profile privilege escalation:** the existing school-admin profile write policy did not independently prevent changing `profiles.role` or `profiles.school_id`. The same corrective migration adds a database trigger that rejects those changes from authenticated sessions; trusted service-role provisioning remains supported.
3. Added stable private helper aliases `current_user_role()`, `is_guardian_of(uuid)` and `is_on_active_trip_for(uuid)` with an empty search path and restricted execution grants.
4. Added missing foreign-key and hot-query indexes using `IF NOT EXISTS`.
5. Extended `supabase/tests/rls_isolation.test.sql` with regression assertions for parent historical-location denial, supervisor historical-location access, and school-admin self-promotion / cross-tenant profile mutation denial. The pgTAP plan was increased from 77 to 81.

## Remaining confirmed gaps / risks

- `schools.status`, `authorized_pickups.active`, `payments.method`, and `payments.idempotency_key` have been added. A plaintext `schools.code` is intentionally replaced by private hashed join-code credentials; some requested invoice/payment enum and column details remain to be reconciled.
- `children.home_radius_m` has been constrained to 500, 1,000 or 2,000 metres; existing values are normalized during migration.
- Current proximity notification uses type `arrived`, not the requested `bus_arrived` key.
- Current trip safety notification trigger runs when a trip transitions to completed; the required explicit end-trip RPC behavior must be checked against the active workflow migrations and tests.
- The auth profile-creation trigger and `join_school_with_code` RPC are implemented in migration `20261119000200_auth_profiles_and_school_join_codes.sql`; the seed and invite provisioning paths have been adapted.
- `demo_requests` now has anon-only validated insertion, status / children-count fields, a honeypot, and per-email rate limiting.
- Stale-location notifications and 90-day location-history retention are now implemented and scheduled through pg_cron when available.
- The `bus_near` one-shot dedupe and 100m arrival threshold exist; the legacy notification key remains `arrived` for client compatibility and still needs an explicit `bus_arrived` compatibility decision.
- The current seed contains one demo tenant; the RLS test fixture separately creates two tenants. A second seeded demo school remains outstanding.

## Execution status

The audit report and corrective migration/test changes are committed on `backend/audit-and-hardening`. No UI files were changed. A local Supabase database, Docker engine and Supabase CLI were not available through the connected GitHub repository interface; therefore the migration and pgTAP tests have **not** been executed. The branch is not production-ready until the local migration reset, pgTAP suite, TypeScript checks and app builds pass.


## Authentication and school enrolment implementation

The main branch now includes `20261119000200_auth_profiles_and_school_join_codes.sql`:

- An `auth.users` insert trigger creates a minimal profile automatically. Every self-registered account starts as an unassigned `parent`; user-editable metadata is used only for the display name and never for role or tenant authorization.
- The profile school constraint permits a parent profile to remain unassigned until enrolment. Staff and platform-owner role assignment remains a trusted provisioning operation.
- School administrators can issue high-entropy, expiring, usage-limited join codes through `create_school_join_code(expires_at, max_uses)`. Only a bcrypt hash is stored; the plaintext code is returned once.
- Parents join through `join_school_with_code(code)`. The RPC locks the code row, enforces expiry and use limits, rate-limits attempts per account, assigns the school, and writes an audit record. Invalid, expired, exhausted, or ineligible attempts return NULL.
- The profile identity trigger now runs as invoker and permits tenant/role changes only for trusted database/service-role execution or the validated SECURITY DEFINER enrolment path. Direct authenticated profile updates remain denied.
- The local demo seed and RLS fixtures upsert profiles because the auth trigger now creates them before the seed/test profile rows are applied.

**Verification status:** pgTAP coverage was extended from 81 to 87 assertions for automatic profile creation, safe default role, join-code issuance, successful parent enrolment, one-use exhaustion, and direct tenant-assignment denial. The test file has been updated but has not been executed. The connected Supabase project currently reports zero applied migrations, tables, and Edge Functions; do not treat the repository migration chain as deployed.


## Trip operations and location lifecycle

The main branch now also includes `20261119000300_stale_location_and_retention.sql`:

- Adds the requested `end_trip(uuid)` RPC as a compatibility wrapper around the existing guarded `complete_trip(uuid)` workflow; the existing completion rules and unaccounted-child safety checks remain authoritative.
- Enforces child home geofence radii of exactly 500, 1,000 or 2,000 metres. Existing out-of-policy values are normalized to the nearest supported radius during migration.
- Adds a once-per-stale-episode monitor. An active trip with no bus point, or a point older than 60 seconds, generates a high-priority notification for that school's administrators. A fresh location marks the episode recovered so a later outage can alert again.
- Schedules the stale-location monitor every minute when `pg_cron` is available.
- Adds a bounded 10,000-row cleanup operation for GPS history older than 90 days, scheduled hourly to avoid long-running deletes.
- Extends English, Shona and Ndebele push copy for stale GPS alerts.

The RLS suite now declares 143 assertions, including checks for the end-trip alias, stale-location monitor, retention routine and geofence constraint. These are source-level additions only; pgTAP and cron execution have not yet been run.


## Pickup authorization and payment integrity

The main branch now includes `20261119000400_pickup_and_payment_hardening.sql`:

- Pickup authorizations now have an `active` flag. Revoked entries remain auditable but are hidden from supervisors' active-trip pickup list and cannot pass PIN verification.
- PIN verification continues to use bcrypt, a per-actor/child advisory lock, a five-failure/15-minute limit, and audit logging; it now also requires the selected authorization to be active.
- Authenticated users can read the new `active` field without receiving the protected PIN hash.
- Payments now include a `method` and optional `idempotency_key`. Unique partial indexes prevent duplicate provider references and repeated idempotency keys for the same invoice/provider, closing the concurrency gap in manual reconciliation.
- pgTAP now covers revoked pickup PIN rejection, the new payment fields, and both uniqueness indexes.

The RLS test plan is now 143 assertions. Runtime execution is still pending.


## Public demo-request abuse controls

The main branch now includes `20261119000500_demo_request_validation.sql`:

- Adds child-count and workflow-status fields, strict input bounds, normalized email validation, and an optional honeypot.
- Keeps public submission strictly `anon` INSERT-only. Authenticated users cannot submit through this public endpoint; platform owners can review requests and update only their status.
- A private database trigger applies a per-normalized-email limit of three submissions per 24 hours, serialized with an advisory transaction lock. It stores only a SHA-256 email digest in the private rate-limit table.
- The trigger forces new submissions to the `new` status and server timestamp, preventing clients from self-qualifying or forging workflow state.
- pgTAP now checks anonymous submission, rate limiting, honeypot rejection, authenticated-user denial, and the new request fields. The same suite also exercises stale-GPS alert creation, duplicate suppression during one outage, recovery, and re-alerting after a second outage.

This is a database-level per-email abuse control, not a substitute for edge/IP-based rate limiting or CAPTCHA. The UI was intentionally left unchanged.


## School lifecycle and tenant suspension

Migration `20261119000600_school_lifecycle_controls.sql` adds `schools.status` with `active`, `suspended`, and `archived` states. Only platform owners can change it. Suspending or archiving a school removes tenant-scoped access for its school administrators and users while preserving all records; reactivation restores access. Existing join codes cannot be used while a school is inactive, and new codes cannot be issued.

A plaintext `schools.code` column was deliberately not added. School join codes are separate high-entropy credentials whose bcrypt hashes are stored in the private schema, avoiding exposure through ordinary school queries. The RLS suite now has 143 assertions, including suspend/reactivate behavior and verification that parents, supervisors and school administrators lose tenant-scoped data access while suspended.


## Personal data export and parent account deletion

Two authenticated Edge Functions have been added and configured in `supabase/config.toml`:

- `export-my-data` verifies the caller's JWT, reads only records linked to that account/role, excludes credential hashes and push tokens, paginates through the Supabase row limit, and returns a no-store JSON download.
- `delete-my-account` is limited to parent accounts, requires recent sign-in plus email confirmation, and refuses deletion if any linked child would be left without another registered guardian. It removes authored messages, anonymizes reporter/guardian/audit references, revokes refresh sessions, and then deletes the Auth identity.
- Migration `20261119000800_parent_account_deletion_support.sql` changes the relevant foreign keys to preserve operational/audit records with anonymized references instead of blocking parent deletion.
- The tenant-integrity trigger was updated to permit null reporters only for this anonymization path; non-null reporters must still belong to the same school.

Access JWTs already issued by Supabase may remain cryptographically valid until expiry after session revocation. The deleted profile and membership links make normal RLS checks deny access during that period. Staff and platform-owner self-deletion remain intentionally disabled and require an administrator-led offboarding workflow.

The RLS suite now has 143 assertions, including the account-deletion foreign-key behavior and a database-level guard that prevents deleting a child's final registered guardian. Superseded by the live deployment on 2026-11-19: all 10 Edge Functions are now deployed and ACTIVE in Supabase project `rjsdhgbjvghjnuiilizm`. Their runtime integration paths still require the secrets listed in `docs/runbook.md` and have not yet been exercised with real provider credentials.


A further database trigger in `20261119000900_prevent_guardian_orphaning.sql` serializes guardian deletions per child and rejects deletion if it would remove the final parent guardian. This closes the race where two guardian accounts could otherwise pass simultaneous application-level preflight checks.


## Paynow payment integration

The Paynow source implementation is now in place:

- `paynow-initiate` supports Paynow web checkout plus EcoCash and OneMoney mobile-money requests. It verifies the parent owns the invoice, checks school/invoice status and outstanding balance, enforces idempotency and per-invoice attempt limits, and stores checkout/poll URLs in a server-only table.
- Outbound Paynow requests are URL-encoded and SHA-512 signed. The returned hash is verified before a redirect URL is accepted, and checkout/poll URLs must be HTTPS on a Paynow domain.
- `paynow-callback` is the only endpoint configured without JWT verification; it authenticates callbacks using Paynow's SHA-512 integration-key hash.
- `apply_paynow_callback` performs payment, transaction, invoice and audit updates atomically in Postgres. Only the service role can execute it.
- The `paynow_transactions` table has RLS enabled and is inaccessible to anon/authenticated clients. It stores sensitive poll URLs and checkout metadata.

Required custom Edge Function secrets before real Paynow use: `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, and `SITE_URL`. Supabase injects `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` and `SUPABASE_URL` into the Edge Function runtime. Optional settings: `PAYNOW_API_BASE` and `PAYNOW_RETURN_URL`. No Paynow credentials have been supplied or stored in the repository, so the integration is implemented but cannot initiate real payments until these secrets are configured.

Official protocol references: [Paynow initiate transaction](https://developers.paynow.co.zw/docs/paynow/initiate_transaction/), [mobile money](https://developers.paynow.co.zw/docs/paynow/initiate_mobile_transaction/), [hash generation](https://developers.paynow.co.zw/docs/paynow/generating_hash/), and [callback hash validation](https://developers.paynow.co.zw/docs/paynow/validating_hash/).

The RLS suite now has 143 assertions, including server-only access to Paynow callback reconciliation and transaction metadata.


## Unified administrator invitations

A new `admin-invite-user` Edge Function provides one entry point for school administrators to invite `parent`, `supervisor`, or `school_admin` accounts. It forwards the caller's bearer token to the existing role-specific `invite-parent` or `invite-staff` handler, so the existing tenant/role checks remain authoritative and the service-role key is never exposed.


Migration `20261119001200_revoke_school_join_codes.sql` adds `revoke_school_join_code(code)`. The issuing school administrator or a platform owner can revoke a leaked code immediately; revocation is idempotent and audited. Tests cover successful revocation and rejection of a revoked code.


## Live Supabase deployment verification — 2026-11-19

The configured and verified target is **preDrive / `rjsdhgbjvghjnuiilizm`** (`https://rjsdhgbjvghjnuiilizm.supabase.co`, region `eu-west-1`, PostgreSQL 17). The repository's `supabase/config.toml` and mobile/web public environment templates point at this project.

- **35 migrations** are applied. Remote migration-history versions were synchronized to the matching repository migration filenames so `supabase migration list` and future `supabase db push` do not replay the schema.
- **29/29 public application tables** have RLS enabled; 87 public policies are installed.
- **143/143 pgTAP assertions pass** against the live schema. The test fixture runs inside a transaction and rolls back; no demo users or schools were left in the live database.
- **10/10 Edge Functions** are deployed and ACTIVE with their intended JWT-verification settings.
- Realtime publication includes `notifications`, `trip_events`, `bus_live`, `trips`, `messages` and `absences`.
- Generated TypeScript database types have been regenerated from this project and committed to `frontend/packages/shared/src/database.types.ts`.
- FK index advisor findings and overlapping permissive-policy findings are resolved. Unused-index notices are expected while the live project is empty.
- The live database currently contains zero schools and zero Auth users. Local seed/demo records have intentionally not been inserted into this live project.

### Outstanding configuration and security items

1. **Critical advisor finding — `private.push_dispatch_attempts` has RLS disabled.** The table is in the non-exposed private schema and has no client grants, but Supabase still flags it. The proposed final hardening statement is below. It has not been applied automatically; explicit approval is required.

   ```sql
   ALTER TABLE private.push_dispatch_attempts ENABLE ROW LEVEL SECURITY;
   ```

2. **Vault is empty.** The notification dispatcher requires Vault entries named `project_url` and `notification_webhook_secret`. The latter must match the Edge Function secret `NOTIFICATION_WEBHOOK_SECRET`. Until configured, push dispatch is not operational.
3. **Edge Function secrets are not configured.** Set `SITE_URL`, `NOTIFICATION_WEBHOOK_SECRET`, `OPENROUTESERVICE_API_KEY`, `PAYNOW_INTEGRATION_ID` and `PAYNOW_INTEGRATION_KEY` as applicable. See `docs/runbook.md`.
4. **Production web origin and Auth redirect URLs are unknown.** Configure the actual preDrive web origin in `SITE_URL` and Supabase Auth URL Configuration before browser invitations and OAuth/deep-link flows are used.
5. Supabase Security Advisor still flags 13 authenticated-callable SECURITY DEFINER RPCs. These are intentional atomic operations with explicit role/tenant/assigned-trip checks; keep them under review. It also warns that `pg_net` is installed in `public`; moving it requires checking the `net.http_post` notification-dispatch dependency first.
6. Real Paynow and OpenRouteService calls have not been exercised because provider credentials were not supplied. Push delivery likewise remains unverified until the webhook and Vault secrets are configured.

See `docs/architecture.md`, `docs/schema.md`, `docs/security.md` and `docs/runbook.md` for the complete design and operational procedures.
