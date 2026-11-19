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

- The requested `schools.code`, `schools.status`, `authorized_pickups.active`, `payments.method`, `payments.idempotency_key`, and the requested invoice/payment enums/columns do not match the current baseline schema and still need additive compatibility migrations.
- Current `children.home_radius_m` accepts 100–10,000m rather than only 500/1,000/2,000m.
- Current proximity notification uses type `arrived`, not the requested `bus_arrived` key.
- Current trip safety notification trigger runs when a trip transitions to completed; the required explicit end-trip RPC behavior must be checked against the active workflow migrations and tests.
- The initial schema contains no visible `auth.users` profile-creation trigger or `join_school_with_code` RPC in the inspected baseline migrations. This must be implemented with care for invitation provisioning and the existing seed.
- `demo_requests` currently has an unrestricted `WITH CHECK (true)` insert policy and lacks the requested status / children-count fields and database-side abuse controls.
- `location_history` retention and stale-location notification scheduling were not found in the inspected migration set.
- The `bus_near` dedupe index exists, but proximity logic and `bus_arrived` naming need alignment and regression tests.
- The current seed contains one demo tenant; the RLS test fixture separately creates two tenants. A second seeded demo school remains outstanding.

## Execution status

The audit report and corrective migration/test changes are committed on `backend/audit-and-hardening`. No UI files were changed. A local Supabase database, Docker engine and Supabase CLI were not available through the connected GitHub repository interface; therefore the migration and pgTAP tests have **not** been executed. The branch is not production-ready until the local migration reset, pgTAP suite, TypeScript checks and app builds pass.
