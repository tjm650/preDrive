# preDrive backend batch register

This register tracks the backend implementation plan. B0 is planning/audit work and is not counted as an implementation batch. B1.1–B1.5 are complete. B1.6 remains open and is explicitly deferred by the user; on 2026-11-22 the user authorized proceeding with B2 against the existing development project using reviewed incremental migrations only. This is an exception to the original phase gate, not a claim that the clean-room replay passed.

## Status summary

| Phase | Scope | Batches | Complete | Remaining |
|---|---|---:|---:|---:|
| B0 | Architecture and initial audit (planning only) | — | Complete | 0 |
| B1 | Database foundation and schema | 6 | 5 | 1 |
| B2 | Security and RLS | 6 | 6 | 0 |
| B3 | Database business logic | 8 | 8 | 0 |
| B4 | Edge Functions and automation | 8 | 0 | 8 |
| B5 | Demo data and seed scripts | 4 | 0 | 4 |
| B6 | Frontend integration | 6 | 0 | 6 |
| B7 | QA, deployment and release | 8 | 0 | 8 |
| **Total** | | **46** | **19** | **27** |

## B1 — Database foundation and schema

- [x] B1.1 Children, guardians and approved collectors — migration `20261121124422`.
- [x] B1.2 Fleet, routes, trips and GPS — migration `20261121124429`.
- [x] B1.3 Safety and operations — migration `20261121124437`.
- [x] B1.4 Finance — migration `20261121124444`.
- [x] B1.5 Settings, privacy, audit and analytics — migration `20261121124451`.
- [ ] B1.6 Documentation, generated types, schema audit and migration-chain verification — implementation inventory and current-development checks are documented; clean hosted replay and live exposed-schema confirmation remain pending. The user explicitly deferred the clean-room replay and authorized B2 to proceed on the existing development project with incremental, reviewed migrations only. B1.6 is not passed and must remain open until its deferred acceptance checks are completed.

B1.6 security decision update (2026-11-22): the pg_net ACL/ownership audit is complete. The extension is Supabase-owned and its PUBLIC grants cannot be changed by the project migration role; preserve it for planned B4 use and do not attempt revoke, relocation or drop/recreate workarounds. The `supabase_admin` default ACL audit is also complete: Supabase documents that these defaults apply only to objects created by that role and cannot be changed by project roles. Current development has zero `supabase_admin`-owned public relations/routines; all 50 public relations are owned by `postgres`, whose defaults are restricted. This is accepted as a documented platform exception under the invariant that migrations and application objects are owned by `postgres`; the clean-room preflight enforces the migration identity. The live API exposed-schema allowlist has not been verified, so the `net`/`private` exposure gate remains open. A fresh Security Advisor run still reports 37 informational deny-by-default RLS notices and one `extension_in_public` warning for pg_net.

B1.6 acceptance checkpoint:
- [ ] Complete full migration replay on a separate empty disposable hosted Supabase project (a preview branch cloned from the populated dev project is not a clean-room replay).
- [x] Add read-only clean-room preflight at `supabase/verification/clean-room-preflight.sql`; it checks required platform objects, empty cron/Vault/Auth/migration-ledger state, absence of existing non-extension application relations/functions and custom PostgreSQL types (base, enum, composite, domain, range, multirange and pseudo types; excluding generated array and relation row types) in `public` and `private`, absence of namespace-owned objects in `private` that `DROP SCHEMA ... CASCADE` could remove, installed `pg_cron` and `supabase_vault` extension records (not just matching object names), the reset migration's required privileges, and migration execution as `postgres` (not a member of `supabase_admin`) so the repository's default-privilege protections apply. It has not been executed against a clean hosted project.
- [ ] All 44 application tables have RLS enabled and the tenant-column audit passes. Current live state after B3: 44 enabled, none FORCE RLS; 20 have no policies by deliberate deny-by-default staging.
- [ ] Remote-vs-replay comparison covers columns, types, defaults, constraints, indexes, enums, functions, triggers, RLS/policies, extensions, publications, cron, Storage and Auth integration objects.
- [ ] Verify the clean target's Data API exposed-schema allowlist and table exposure configuration: expose only the intended application schema(s), keep `private` and `net` unexposed, and verify minimum grants plus RLS. New public tables are no longer automatically exposed by default on Supabase. This must also be checked on the current development project before B1.6 sign-off; the live allowlist cannot be inferred from SQL catalog privileges or the current minimal `supabase/config.toml`.
- [ ] Database lint/advisor review passes or every exception is documented and accepted. The `pg_net` platform ACL audit is documented: `supabase_admin` owns the extension and its PUBLIC grants; Supabase does not support changing these per-project grants, so no ACL/relocation workaround is permitted. The extension-in-public Security Advisor warning remains open as a platform exception; final acceptance still requires confirming `net` and `private` are absent from the live Data API exposed-schema allowlist. The 149 unused-index notices remain informational until representative workload testing.
- [ ] Function, trigger, RLS policy, table/column grant, index and default-privilege inventories reconcile against the clean replay; current live state is documented in `BACKEND-SCHEMA.md`. Supabase-managed `supabase_admin` default ACLs in `public` are accepted as a documented platform exception: Supabase confirms they apply only to objects created by `supabase_admin` and cannot be changed by project roles. Current inventory found zero `supabase_admin`-owned public relations/routines; all 50 public relations are `postgres`-owned, and `postgres` defaults grant no table/sequence/function privileges to API roles. The clean-room preflight enforces migration execution as `postgres` and verifies it is not a member of `supabase_admin`. Re-audit after extensions, restores and platform upgrades.
- [ ] Generated database types are regenerated from the verified clean-replay schema and typecheck. The current development project has been regenerated after B3 and its output is committed in `frontend/shared/types/database.types.ts` (110,951 characters); workspace typecheck is pending CI. Workspace TypeScript checks now pass for shared, mobile and web on commit `1bc1ae2de67da2bcdb83ff8ba0dfb94f35baceea` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/44921668805)); the first run exposed missing style keys in three mobile cards, which were corrected. Repeat type generation and typecheck against the verified clean replay before sign-off.
- [ ] `docs/MIGRATIONS.md` and schema documentation reflect the verified workflow and state.

## B2 — Security and RLS (6 batches)

<badge>All six migrations applied to the existing development project on 2026-11-22.</badge>

The six B2 migrations were applied sequentially to Supabase project `rjsdhgbjvghjnuiilizm`. Supabase assigned remote migration versions `20261122204630`, `20261122204634`, `20261122204639`, `20261122204644`, `20261122204649` and `20261122204654`. Repository migration filenames were aligned to those applied versions so the CLI can compare local and remote histories without a version mismatch.

- [x] B2.1 Security-definer helper functions — six private, stable helpers with empty search paths and authenticated-only execution.
- [x] B2.2 School admin and staff RLS — school-scoped class-group, fee catalogue, settings and setup-progress policies.
- [x] B2.3 Guardian/child isolation — linked-child and guardian-link visibility, school-staff reads and admin-only direct writes.
- [x] B2.4 Driver, supervisor, trip and GPS access — active assignment checks, guardian-linked trip visibility, no direct driver handover/collector access, and no authenticated GPS-history access.
- [x] B2.5 Private Storage — five private buckets with configured MIME/size limits and user/school-scoped object policies.
- [x] B2.6 Atomic rate limiting — private implementation plus a public-schema RPC wrapper callable only by `service_role`.

Runtime verification:
- The committed SQL acceptance suite `supabase/tests/security/b2_security_acceptance.sql` executed on the remote project without a SQL error. It checks 61 catalog/grant/policy/helper/rate-limit assertions and two end-to-end calls through the public rate-limit RPC under `service_role` (63 checks total).
- Post-run catalog verification found all six helper functions with the expected SECURITY DEFINER/empty-search-path configuration; all five expected Storage buckets exist and are private; the public rate-limit wrapper exists; only `service_role` can execute it; `service_role` cannot execute the private implementation; and all 42 public application tables retain RLS.
- The acceptance test transaction rolled back its rate-limit test rows; the table contains zero test rows after execution.
- Database TypeScript types were regenerated from the post-B2 schema and committed at `frontend/shared/types/database.types.ts` (93,897 characters); workspace TypeScript check passed on commit `82bf44fb79cfe6024268ed6ff96066e032147132` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/45068636781)).
- Security Advisor now reports 19 deny-by-default public tables without policies, down from 37 before B2. These remain inaccessible through authenticated direct table access pending their dedicated business workflows/policies. It also reports the pre-existing Supabase-owned `pg_net`-in-public warning.
- Performance Advisor reports one multiple-permissive-SELECT-policy warning on `class_groups` because guardian and school-staff reads are expressed as separate permissive policies. Their PostgreSQL semantics are OR-combined; consolidate in a later reviewed migration if query-plan testing shows it is worthwhile. The unused-index notices are expected in a near-empty development database.
- Health Advisor returned no findings.

Acceptance limitations:
- The SQL suite does not seed authenticated users or prove cross-school row visibility with real guardian, driver, supervisor and school-admin identities. That seeded multi-tenant test suite remains a B5/release gate.
- Storage object uploads/downloads, signed URL access and real client role behavior were not exercised end-to-end; the suite verifies bucket configuration, policy presence and grants.
- Clean-room replay remains deferred; applying B2 incrementally to the existing development project does not certify the full migration chain from an empty database.

## B3 — Database business logic (8 batches)

1. Authentication, school registration and membership lifecycle.
2. Child, guardian, collector and temporary-collector lifecycle.
3. Handover PIN verification, three-failure lockout, check-in/out and alerts.
4. Trip lifecycle, GPS ingestion and offline idempotency.
5. SOS, delays, incidents, vehicle checks and alert acknowledgement.
6. Geofencing, arrival notifications, ETA and automatic incidents.
7. Finance lifecycle and ledger-safe transitions.
8. Consent, deletion/export, bulk CSV, route/child reassignment, cancellation and absence operations.

Before implementing RPCs, follow the exact 30-method inventory in [`API-CONTRACT.md`](./API-CONTRACT.md), derived from `frontend/shared/lib/api/contract.ts` and its input types. Do not invent method names or payloads.

## B3 implementation status — applied to development; catalog acceptance passed

Nine additive B3 migration files have been applied sequentially to the existing development project `rjsdhgbjvghjnuiilizm` on 2026-11-23. Supabase recorded remote versions `20261123033037` through `20261123033205`; the repository migration filenames remain the ordered source files listed below.

| Sub-batch | Migration file(s) | Implemented database capabilities |
|---|---|---|
| B3.1 | `20261123010000_predrive_business_auth_lifecycle.sql` | School registration and invitation acceptance using `auth.uid()`; actor identity is not accepted from caller input. |
| B3.2 | `20261123020000_predrive_child_guardian_collector_lifecycle.sql` and `20261123025000_predrive_temporary_collector_lifecycle.sql` | Child creation, admin-controlled guardian links, approved and temporary collectors, hashed PINs, expiry, lockout and safe listing. |
| B3.3 | `20261123030000_predrive_handover_and_attendance_logic.sql` | Idempotent child boarding/absence, supervisor-only handover, PIN lockout and trip events. |
| B3.4 | `20261123040000_predrive_trip_lifecycle_and_gps.sql` | Supervisor trip start/end, active-trip GPS, GPS idempotency, current-position removal at trip end, automatic unaccounted-child incidents and alerts. |
| B3.5 | `20261123050000_predrive_safety_and_emergency_logic.sql` | Incidents, SOS, delay reports, vehicle checks, alert acknowledgement, incident and SOS resolution. |
| B3.6 | `20261123060000_predrive_geofencing_and_guardian_arrival.sql` | Guardian 500/1,000/2,000 m radius, child route-stop assignments, ETA calculation and deduplicated geofence alerts. |
| B3.7 | `20261123070000_predrive_finance_lifecycle.sql` | Invoice create/issue/void, idempotent pending payment intents, bank-transfer submission/review, service-role-only settlement/refunds, invoice balance updates and receipt creation. |
| B3.8 | `20261123080000_predrive_privacy_bulk_and_admin_operations.sql` | Consent grant/withdrawal history, account/child deletion and export requests, review workflow, bulk child import payload, route reassignment/reordering and scheduled-trip cancellation. |

**Remote migration versions recorded by Supabase**

| Remote version | Migration name |
|---|---|
| 20261123033037 | `predrive_business_auth_lifecycle` |
| 20261123033044 | `predrive_child_guardian_collector_lifecycle` |
| 20261123033051 | `predrive_temporary_collector_lifecycle` |
| 20261123033132 | `predrive_handover_and_attendance_logic` |
| 20261123033140 | `predrive_trip_lifecycle_and_gps` |
| 20261123033146 | `predrive_safety_and_emergency_logic` |
| 20261123033152 | `predrive_geofencing_and_guardian_arrival` |
| 20261123033159 | `predrive_finance_lifecycle` |
| 20261123033205 | `predrive_privacy_bulk_and_admin_operations` |

The committed catalog acceptance suite `supabase/tests/business_logic/b3_business_logic_acceptance.sql` ran against the remote database without SQL errors. It checks the 45 expected RPC signatures, SECURITY DEFINER empty search paths, RLS, table grants, privileged settlement/geofence grants and deferred route-stop uniqueness. A separate read-only catalog verification confirmed:
- 45/45 expected B3 functions resolve; all are SECURITY DEFINER with empty `search_path`.
- No B3 RPC is executable by `anon`; the four trusted-only operations (geofence evaluation, payment settlement, refund settlement and deletion completion) are not executable by `authenticated` and are executable by `service_role`.
- Both new tables have `school_id` and RLS enabled. `temporary_collectors` has no direct authenticated table privileges; `child_route_assignments` is SELECT-only for authenticated and writes remain RPC-only.
- The guardian notification-radius column and all three idempotency/deduplication indexes exist; route-stop order uniqueness is deferrable and initially deferred.
- All 44 public application tables retain RLS. The remote migration ledger now contains 28 versions (12 B1, six B2, nine B3 and one B4).

The first B3.3 apply attempt stopped at a PL/pgSQL parse error after its idempotent index statement had been created. The expression was simplified in the committed migration, then B3.3 was successfully reapplied; the later migrations were not attempted until it succeeded. The final catalog acceptance and index checks passed.

**B3 implementation is complete at the migration/catalog level.** It is not a full end-to-end acceptance of real user behavior: no Auth users or school data were seeded, and this catalog suite does not prove row visibility across two live schools. B5 must supply the real admin, guardian, supervisor, driver and teacher identities and multi-tenant runtime tests.

Known integration and acceptance boundaries:
- The current 30-method `PreDriveApi` contract remains unchanged. B3 RPCs that exceed it are backend capabilities for later B6 integration, not newly invented frontend methods.
- B4 must supply signed-provider webhook verification before calling payment/refund settlement, push delivery for generated alerts, geofence scheduling, ETA refresh, deletion/export execution and retention automation.
- CSV parsing belongs in a trusted import boundary; the database bulk function accepts validated JSON rows, not raw CSV text.
- Temporary collector RPCs are available in the backend but are not part of the current frontend API contract.
- The current school-registration RPC creates a pending school and admin membership; activation/verification workflow is a B4/admin operational gate.
- B1.6 clean-room replay remains deferred and is not certified by this B3 work.

## B4 — Edge Functions and automation (8 batches)

B4.1 shared source and the dedicated GitHub Actions Deno check workflow are committed on `main`. The workflow now also type-checks the B4.2 trip-generation entrypoint. The repository workspace has no Deno runtime; no successful Deno workflow result has been verified yet. Do not deploy functions or schedule jobs until the checks pass and required project secrets are configured.

### B4.3 — Invitations and authentication workflows (source authored; runtime verification pending)

- [x] Add a school-admin-only `invite-school-member` Edge Function with verified bearer identity and active school membership checks.
- [x] Restrict inviteable roles to guardian, teacher, supervisor and driver; school-admin privilege cannot be granted through this endpoint.
- [x] Normalize and validate email addresses, reject unknown request fields, prevent duplicate active memberships and rely on the existing pending-invitation unique index for race-safe duplicate prevention.
- [x] Create seven-day pending school invitations and send Supabase Auth invitation emails for new accounts. Existing accounts can sign in and accept the pending invitation without creating a second Auth account.
- [x] Rate-limit invitation creation to 10 attempts per administrator per school per 15 minutes using the existing atomic service-role rate limiter and a SHA-256 subject digest.
- [x] Require staff full name and phone for driver/supervisor/teacher invitations; persist those fields on the invitation and create/reactivate the `staff_members` row atomically when the invite is accepted.
- [x] Update the Supabase Auth port to call the existing `accept_school_invitation()` RPC only after successful password authentication. The RPC derives the user and email from `auth.uid()`; the client supplies no identity or role.
- [x] Add unit tests for input normalization, role escalation rejection, strict request fields and invitation expiry.
- [x] Extend the Deno workflow to type-check the new function.
- [x] GitHub Actions Deno 2.9.8 type-check and all shared tests passed on commit `1dbd0fa875562096eade9a554c01357214451164` (run `45121405746`).
- [x] Apply `20261123100000_predrive_invitation_staff_onboarding.sql` after explicit user approval; Supabase recorded remote migration version `20261123052600`.
- [x] Run `supabase/tests/automation/b4_invitation_acceptance.sql`; the read-only DO-block acceptance suite completed without errors and independent catalog assertions passed.
- [ ] Configure and verify Supabase Auth SMTP, Site URL and invite redirect allowlist in the development environment.
- [ ] Deploy `invite-school-member` and test new-user and existing-user acceptance using controlled test identities.
- [ ] Add the invitation operation to the shared frontend API and SupabaseAdapter in B6 before connecting the school-admin UI.

**Operational boundary:** B3 provided the invitation foundation. The additive staff-onboarding migration is now applied as remote version `20261123052600`. It persists staff details and creates/reactivates `staff_members` during acceptance. No Auth identities or invitations were created during migration verification. The existing frontend API still has 30 methods and does not yet expose invitation creation. For an email that already belongs to an Auth account, this function creates the pending invitation but does not send a second Auth invite email; the school administrator must ask that person to sign in. Do not deploy until the migration is applied, SMTP/redirect settings are verified, and Supabase Auth invite-token expiry is aligned with the seven-day database invitation. No remote Auth users, invitations, function deployments or email sends were created by this source-only batch. The frontend API still does not expose invitation creation; B6 must add the adapter operation before connecting the school-admin UI.

### B4.2 — Daily trip generation (migration applied; function deployment pending)

- [x] Add school-scoped driver and optional supervisor assignments to recurring route schedules, with composite school foreign keys.
- [x] Add an authenticated school-admin RPC to assign schedule staff; database trigger enforces active staff role and same-school identity.
- [x] Add a service-role-only trip generator for the current `Africa/Harare` service date. It uses schedule effective dates, PostgreSQL day-of-week values (Sunday = 0), the school's configured timezone, active school/route/bus/driver state and optional supervisor assignment.
- [x] Generate a scheduled trip only once per school/schedule/date/direction and create trip-child rows from active child route assignments.
- [x] Add a cron-secret-protected Edge Function entrypoint; it accepts POST only and does not accept a caller-selected service date.
- [x] Add read-only catalog acceptance SQL and extend the Deno workflow to type-check the entrypoint.
- [x] GitHub Actions Deno 2.9.8 type-check and all shared tests passed on commit `1dbd0fa875562096eade9a554c01357214451164` (run `45121405746`). The separate Vercel build-rate-limit status is unrelated to this Deno workflow.
- [x] Apply migration `20261123051100_predrive_daily_trip_generation.sql` to the development project after explicit written approval; applied as remote version `20261123051100` after approval.
- [ ] Configure `CRON_SECRET` and `APP_ALLOWED_ORIGINS` in Supabase Function secrets; values must not be committed.
- [ ] Deploy `generate-daily-trips` with platform JWT verification disabled only because the function independently verifies a high-entropy cron secret; do not schedule it until deployment and function smoke tests pass.
- [x] Run `supabase/tests/automation/b4_daily_trip_generation.sql` after the migration is applied; read-only acceptance suite and catalog verification passed, with no trip or demo data generated.

**Design dependency discovered:** the existing route-schedule schema did not identify a driver or supervisor, while `trips.driver_id` is mandatory. B4.2 adds those schedule assignments explicitly instead of guessing which of multiple active drivers belongs to a route. Existing schedules remain valid but are skipped by generation until an administrator assigns a driver and the route has an active bus. The current 30-method frontend API does not yet expose this new assignment RPC; B6 must add the approved adapter surface before the admin UI can manage it.


### B4.1 — Shared Deno Edge Function infrastructure (source authored; runtime verification pending)

- [x] Stable API error envelope and normalization to the existing frontend `ApiErrorCode` union.
- [x] Exact-origin CORS allowlist; no wildcard; server-to-server requests without an Origin header remain supported.
- [x] Request wrapper with correlation IDs, no-store responses and safe exception handling.
- [x] Structured allowlisted logs; no request bodies, child data, names, emails, phone numbers, PINs, tokens or provider payloads.
- [x] Server-only Supabase service-role client factory.
- [x] JWT verification with `auth.getUser(token)` and active `school_memberships` role checks; authorization does not use user-editable metadata.
- [x] Dedicated high-entropy cron-secret verification helper.
- [x] Bounded JSON parsing and Zod validation.
- [x] Deno tests authored for CORS, error normalization and request validation.
- [x] `.github/workflows/supabase-edge-functions.yml` passed Deno 2.9.8 type-check and all shared tests on commit `1dbd0fa875562096eade9a554c01357214451164` (run `45121405746`).
- [ ] Configure the real `APP_ALLOWED_ORIGINS` and `CRON_SECRET` secrets in the development project; do not commit secret values.
- [ ] Deploy no Edge Functions in B4.1; deployment belongs to each function's implementation and acceptance batch.

Shared dependency versions are pinned to `npm:@supabase/supabase-js@2.119.2` and `npm:zod@4.6.7`. Supabase recommends a separate `deno.json` per deployed function; the individual function batches will add their own entrypoints and isolated Deno configuration.

1. Shared Deno Edge Function infrastructure.
2. Daily trip generation (source and migration authored; remote migration approval and runtime acceptance pending).
3. Invitations and authentication workflows.
4. Payment creation and provider adapter.
5. Webhook verification and inbox processing.
6. Refunds, receipts and payment reminders.
7. Push/email delivery in English, Shona and Ndebele; broadcasts and escalation.
8. Deletion/export, retention, demo reset, cron and function tests.

## B4.4 — Payment creation and provider adapter (source authored; runtime verification pending)

- [x] Add a guardian-only `create-payment-intent` Edge Function using the existing `initiate_payment()` RPC and the verified guardian JWT.
- [x] Validate school membership and active school status before payment initiation; the database remains authoritative for invoice ownership, status, currency, outstanding balance and idempotency.
- [x] Convert frontend major-unit amounts to integer minor units and reject values with more than two decimal places.
- [x] Apply an atomic per-guardian payment initiation limit of five attempts per five minutes using the existing service-role rate-limit RPC and a SHA-256 subject hash.
- [x] Add a provider adapter seam: EcoCash remains a simulated pending intent; CBZ and CABS remain manual-bank pending intents. Card is rejected.
- [x] Preserve the existing `Payment` API result shape; no frontend contract changes and no provider credentials in source.
- [x] Add Deno tests for request validation, minor-unit conversion, supported methods, provider routing and opaque rate-limit subjects.
- [x] Extend the GitHub Actions Deno workflow to type-check the payment function and shared tests.
- [x] GitHub Actions Deno 2.9.8 type-check and all shared tests passed on commit `1dbd0fa875562096eade9a554c01357214451164` (run `45121405746`).
- [ ] Deploy `create-payment-intent` only after the Deno workflow passes and required Supabase Function secrets/CORS origins are confirmed.
- [ ] Run authenticated guardian runtime tests for valid invoice, wrong-school invoice, non-guardian role, inactive school, idempotent replay, reused idempotency key with changed payload, amount over balance, currency mismatch, rate limiting and card rejection.
- [ ] Do not mark EcoCash intents successful in this batch. Trusted settlement remains restricted to the service role and belongs to verified B4.5 webhook processing or a separately controlled demo simulation.

**Operational boundary:** B4.4 is source-only. No migration, payment intent, payment attempt, provider request, settlement, Edge Function deployment or cron job was created. The existing finance RPC grants were read-only verified: authenticated callers may invoke `initiate_payment()`; anon cannot; only `service_role` may invoke `apply_payment_result()`. Security Advisor output is unchanged in scope: 20 deliberate deny-by-default tables, the Supabase-owned `pg_net` platform warning, and existing authenticated SECURITY DEFINER RPC notices. Those existing notices are not newly introduced by B4.4.

## B4.5 — Paynow webhook verification and inbox processing (source authored; deployment pending)

- [x] Confirm the actual Paynow Zimbabwe callback contract against its official Developer Hub: standard status updates are form-encoded POSTs containing `reference`, `paynowreference`, `amount`, `status`, `pollurl` and `hash`; signature is SHA-512 over decoded field values in original order, excluding `hash`, followed by the integration key.
- [x] Add bounded form-body reading (16 KiB), duplicate-field rejection, strict required-field/amount validation and constant-time SHA-512 hash comparison.
- [x] Add a Paynow callback receiver with Supabase JWT verification disabled only for this endpoint; cryptographic Paynow hash verification is mandatory before any field is trusted or persisted.
- [x] Persist only a sanitized callback projection in the existing `webhook_events` table after signature verification. The raw body, hash, integration key, poll URL and optional instrument token fields are not persisted or logged.
- [x] Use SHA-256 of the exact callback body as the provider event ID; the existing unique provider/event constraint suppresses exact duplicate callbacks.
- [x] Settle only a uniquely matched `provider='paynow'` payment with an exact amount match and Paynow status `Paid`, using the existing service-role-only `apply_payment_result()` RPC.
- [x] Ignore unmatched references and non-Paid statuses; retain amount mismatches as failed events. Already-succeeded payment callbacks are idempotent; other terminal payment states are not reopened.
- [x] Add Deno tests including Paynow's published SHA-512 example, a signed callback, modified hash, duplicate fields and amount precision.
- [x] Extend the Deno CI workflow to check the Paynow webhook entrypoint.
- [x] Configure `supabase/config.toml` with `verify_jwt = false` only for `paynow-webhook`; the handler independently verifies Paynow's signature.
- [x] GitHub Actions Deno 2.9.8 type-check and all 33 shared tests passed on commit `1dbd0fa875562096eade9a554c01357214451164` (run `45121405746`).
- [ ] Configure `PAYNOW_INTEGRATION_KEY` in Supabase Function secrets only after the school owns a Paynow integration and has securely received its key.
- [ ] Deploy and test with Paynow-issued test credentials and an actual Paynow callback before enabling a live result URL.
- [ ] Add a reviewed Paynow initiation adapter that creates `provider='paynow'` payments and merchant references. B4.4 currently creates simulated EcoCash and manual-bank intents only, so no current payment can be settled by this receiver.
- [ ] Define currency mapping and test exact amount/currency behavior for the Paynow integration before real transactions.

**Operational boundary:** B4.5 is source-only. No migration, payment, webhook event, credential, provider request, settlement or function deployment was created. Read-only remote verification found `webhook_events` already has RLS enabled, a unique `(provider, provider_event_id)` constraint and service-role-only table grants; the existing `apply_payment_result()` RPC is executable by `service_role` and not by `authenticated`. The remote ledger remains at 29 migrations and the webhook inbox contains zero rows. Supabase currently reports no deployed Edge Functions.

## B5 — Demo data and scripts (4 batches)

1. Idempotent seed for the single Greenfield Early Learning Centre demo school.
2. Demo Auth users, one per role.
3. Four weeks of consistent fictional trip, attendance, incident and finance history.
4. Idempotent seed/reset and strict demo/real-school isolation tests.

## B6 — Frontend integration (6 batches)

1. Supabase clients and authentication adapter.
2. School, children, staff and finance data integration.
3. Fleet, routes and trips integration.
4. Realtime integration based only on the agreed API/data contract.
5. Offline sync, idempotency, errors and session refresh.
6. Role-by-role integration; remove mock/dev-only tools from production.

The current API contract has no Realtime subscription methods or payloads. Do not invent them; establish the required contract before implementing subscriptions.

## B7 — QA, deployment and release (8 batches)

1. Web, mobile-export and API acceptance tests.
2. Load, concurrency and GPS-ingestion tests.
3. Security review and dependency audit.
4. Observability, error reporting and operational alerts.
5. Development/staging/production environment and migration promotion.
6. Backup, PITR, restore and rollback drills.
7. Production deployment and smoke tests.
8. Final acceptance, documentation, legal/privacy review and Zimbabwe-specific language review.

## Working constraints

- Backend platform is Supabase only; no separate backend service.
- Development is online. Do not introduce Docker or a local Supabase stack as a prerequisite.
- Do not modify a shared remote database or its migration history without the user's written authorization for the exact operation.
- Explain every command that the user is expected to run before asking them to run it.
- Migration files are the intended schema design; compare remote state against a clean replay rather than copying drift into migrations.
- B1.6 clean-room replay is deferred by explicit user decision. Continue B2 only through additive, reviewed migrations on the existing development project; never run the destructive historical reset migration against it. B1.6 remains open.

## B4.6 — Refunds, receipts and payment reminders (source authored; migration approval and runtime verification pending)

- [x] Add a strict school-admin refund request schema and Edge Function. It verifies the caller's active `school_admin` membership, applies a five-attempt/15-minute per-admin limit, forwards the verified JWT to the existing `request_refund()` RPC, and returns only a pending refund identifier.
- [x] Keep refund settlement trusted-only. The new endpoint never marks a refund successful or failed and never moves money. A provider/manual settlement adapter remains a release dependency.
- [x] Add guardian receipt retrieval using the existing `PaymentReceipt` API shape. The function verifies the payment is succeeded, the invoice belongs to the authenticated guardian, and the guardian membership is active before returning receipt metadata.
- [x] Add school-time-zone-aware reminder stages: three days before due date, due date, and 7/14/30 days overdue. Reminders use existing `alerts` and `alert_recipients` tables and their unique deduplication constraints.
- [x] Add tests for refund/receipt request validation, Harare local-date conversion, date boundaries, reminder stages and USD/ZiG minor-unit formatting.
- [x] Add read-only catalog acceptance SQL at `supabase/tests/automation/b4_finance_acceptance.sql`.
- [x] Extend Deno CI to type-check all three new Edge Function entrypoints and run the expanded shared tests.
- [x] Apply migration `20261123061404_predrive_payment_reminder_alert_source.sql` after explicit user approval. It extends the `alerts_source_type_check` constraint with the dedicated `payment_reminder` value; no rows were changed.
- [x] Run the B4.6 catalog acceptance SQL; all catalog checks passed.
- [ ] Configure `CRON_SECRET` and `APP_ALLOWED_ORIGINS`, deploy the functions and run authenticated guardian/admin and cron smoke tests.
- [ ] Add native-reviewed Shona and Ndebele reminder copy and email/push delivery in B4.7.
- [ ] Add a trusted refund settlement adapter and verify partial/full refund accounting against a controlled test payment before live refunds.

**Operational boundary:** the approved migration is applied and catalog acceptance passed. No functions were deployed, no cron job was scheduled, and no payment/refund/receipt/alert data was created. Runtime authentication and cron tests remain gated on secure secrets and deployment.


## B4.7 — Push/email delivery, broadcasts and escalation (outbox migration applied; delivery runtime pending)

- [x] Add `notification_deliveries`, a school-scoped transactional outbox with per-recipient channel idempotency, bounded attempts, retry scheduling and worker lease state.
- [x] Enable RLS and restrict direct table access to service-role select/insert/update; client roles have no table privileges.
- [x] Enqueue push only for active Expo device registrations.
- [x] Enqueue email only for recipients with an email address and latest effective `communications` consent explicitly granted.
- [x] Capture recipient language for downstream English, Shona and Ndebele templates without copying message bodies or personal data into the outbox.
- [x] Materialise a deduplicated alert and active role-matched recipients when a broadcast is published.
- [x] Add read-only catalog acceptance SQL and apply migration `20261123074827_predrive_notification_delivery_outbox.sql` after explicit approval.
- [x] Run B4.7 catalog acceptance; RLS, grants, constraints, indexes, trigger functions and trigger installation passed. No outbox, alert, recipient or broadcast rows were created.
- [x] Implement the `deliver-notifications` cron-secret-protected worker with conditional atomic claims, ten-minute leases, lease recovery, fenced completion, bounded exponential retry and terminal failure handling.
- [x] Add Expo Push and Resend HTTP adapters with request timeouts, deterministic Resend idempotency keys and provider response sanitisation.
- [x] Recheck active school/membership, open alert, recipient acknowledgement, current communications consent, active push registration and broadcast expiry immediately before delivery.
- [x] Revoke Expo registrations when the provider returns `DeviceNotRegistered`; suppress deliveries when the recipient is no longer eligible.
- [x] Add Deno tests for safe HTML, English-only locale selection, retry bounds, provider error classification, Expo token validation and receipt classification.
- [x] Accept English regional locale tags (for example `en-ZW`) without weakening the Shona/Ndebele suppression boundary.
- [x] Validate Expo send responses as exactly one well-formed ticket for the single-recipient request; reject empty, malformed or multi-ticket responses.
- [x] Attach a stable per-delivery Expo `collapseId` and Android `tag` so repeated submissions for one outbox row can replace/collapse on supported devices. Distinct escalation rows keep distinct identifiers.
- [ ] Add native-reviewed Shona and Ndebele templates. Until reviewed copy is committed, non-English deliveries are suppressed rather than sent English copy.
- [x] Add per-device delivery records so all active devices can receive pushes and each Expo receipt can be tracked independently; worker now uses the delivery's exact device-token reference.
- [x] Add a separately reviewed delivery-cycle schema and service-role-only escalation enqueue RPC. The worker invocation/cron path and controlled escalation runtime tests remain pending.
- [ ] Configure `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `EXPO_ACCESS_TOKEN` and a verified Resend sender domain; deploy and smoke-test only after Deno CI passes.
- [ ] Add controlled runtime tests for token revocation, consent withdrawal, duplicate jobs, provider failures, retries, worker lease expiry, broadcast role targeting and alert acknowledgement.
- [ ] Schedule cron only after deployed function smoke tests and secure provider configuration.

**Operational boundary:** migration is applied as remote version `20261123074827`; remote ledger contains 31 versions. No Edge Functions were deployed, no cron jobs scheduled, no provider credentials configured, and no notifications sent. The outbox is empty. Email requires explicit latest communications consent; push requires an active registered Expo token. The approved migration does not send messages by itself.


**Delivery worker boundary:** source and CI wiring are committed. The worker has not been deployed or invoked against real delivery rows. English (including regional English tags such as `en-ZW`) is the only enabled locale; Shona/Ndebele are suppressed pending native review. Push rows are device-scoped and use a stable per-delivery Expo collapse identifier plus Android replacement tag. These identifiers reduce visible duplicate notifications on supported devices but do not provide exactly-once transport: Expo and downstream APNs/FCM delivery are best-effort and can be at-least-once. Expo push tickets indicate acceptance by Expo, not final device delivery; receipt polling is implemented. Resend idempotency keys are retained for 24 hours, so retries are bounded to complete within that window. No secrets, cron jobs, deployments or messages were created.


### B4.7.2 — Per-device notification cycles and Expo receipt tracking (schema synchronized; worker source updated; runtime pending)

- [x] Reconcile the already-applied remote migration versions `20261123093600` and `20261123093624` into the repository under matching filenames.
- [x] Add read-only catalog acceptance at `supabase/tests/automation/b4_notification_cycles_acceptance.sql`.
- [x] Verify sequence/receipt columns, per-device and per-sequence indexes, RLS, the column-specific device-token delete action, empty function search paths, and service-role-only escalation execution.
- [x] Update `deliver-notifications` to bind each push delivery to its `device_token_id`; missing/revoked/deleted token references are suppressed rather than redirected to another device.
- [x] Add Expo receipt polling using the ticket ID returned by the send endpoint, after a 15-minute wait. Receipt checks are retried while Expo has not produced a receipt and expire after Expo's 24-hour receipt-retention window.
- [x] Revoke a device registration on a receipt-level `DeviceNotRegistered` error. Receipt outcomes do not resend a delivery already accepted by Expo.
- [x] Add shared unit tests for receipt outcome classification.
- [x] GitHub Actions run `45151098062` passed Deno type-check and all 46 shared tests on commit `c1b61584cfe6cce0dd293e60592206faee9aad88`.
- [ ] Run controlled runtime tests against seeded device registrations and mocked/Expo-issued receipt IDs.
- [ ] Deploy only after secrets and provider configuration are verified; no deployment or cron schedule is part of this batch.

The remote acceptance SQL passed. The development database read-only snapshot reported 33 migrations, zero notification deliveries, zero alerts, zero scheduled repeat alerts and outbox RLS enabled. No notification was sent and no remote schema mutation was performed in this reconciliation.


### B4.7.4 — Urgent-alert escalation worker (source complete; runtime pending)

- [x] Add `supabase/functions/enqueue-alert-escalations/index.ts`, a POST-only, `CRON_SECRET`-protected Edge Function.
- [x] Call the existing service-role-only `enqueue_due_alert_escalations(p_batch_size)` RPC with a fixed batch size of 100; do not accept caller-selected school/alert IDs or batch size.
- [x] Validate the RPC result as an integer from 0 through 100 and return only aggregate processing counts.
- [x] Configure `verify_jwt = false` only for this function because it independently verifies the high-entropy cron secret.
- [x] Add Deno unit tests for bounded RPC result validation and add the function to CI type-checking.
- [x] GitHub Actions run `45153289661` completed Deno type-checking and all 47 shared tests passed (0 failures).
- [ ] Run controlled database runtime tests for duplicate/concurrent invocations, sequence uniqueness, acknowledgement during enqueue, no active device, revoked token, withdrawn email consent, and the 1,000-cycle safety cap.
- [ ] Deploy both `enqueue-alert-escalations` and `deliver-notifications` only after secure secrets and provider configuration are verified.
- [ ] Only after both function smoke tests pass, schedule two independent one-minute jobs: one to materialize due escalation deliveries and one to send pending outbox deliveries. The database routine enforces the five-minute repeat interval itself.

The escalation RPC uses row-level `FOR UPDATE SKIP LOCKED` locking, increments the delivery sequence, and inserts per-device push/per-recipient consented email rows. The existing delivery worker performs the actual send and rechecks eligibility before delivery. No database migration, remote data write, deployment, secret configuration, or cron schedule was performed in this batch.


### B4.7.5 — Notification template and provider hardening (source, CI and read-only acceptance complete; live runtime pending)

- [x] Normalize English locale tags so `en`, `en-ZW` and other regional English variants use the English template.
- [x] Continue suppressing Shona and Ndebele until native-reviewed templates are supplied; regional variants do not bypass this rule.
- [x] Add strict parsing for the single Expo ticket expected from each single-recipient request.
- [x] Add stable delivery-specific Expo `collapseId` and Android `tag` values to reduce duplicate display after retries on supported platforms.
- [x] Add tests for regional locale behavior, malformed ticket payloads, and stable/bounded collapse identifiers.
- [x] Deno 2.9.8 type-check passed and all 50 shared tests passed (0 failures) in GitHub Actions run [45158947154](https://github.com/tjm650/preDrive/actions/runs/45158947154).
- [x] Both read-only remote acceptance suites passed after aligning the original outbox assertion with the B4.7.2 sequence-aware constraints/indexes.
- [ ] Complete controlled provider and concurrent-worker runtime tests after B5 supplies isolated seeded identities and device records.

**Delivery guarantee:** collapse/replacement identifiers reduce duplicate display but do not make Expo/APNs/FCM exactly-once. A timeout after the provider accepts a request can leave the sender uncertain whether it was accepted; the worker retries transient failures in accordance with Expo's documented guidance. Critical alert UX must therefore tolerate duplicate delivery and remain backed by the in-app alert record and acknowledgement state.

**B4.7.5 verification:** both remote read-only acceptance suites passed. The development project still has 33 migrations, zero notification deliveries, zero alerts, zero alert recipients, zero broadcasts and zero related cron jobs. Supabase reports no deployed Edge Functions. No remote migration, data write, secret configuration, deployment or notification send occurred in B4.7.5.

### B4.8.1 — Personal data export (source added; runtime pending)

- [x] Reuse the existing `deletion_requests` workflow and `request_data_export()` RPC; the export worker processes only administrator-reviewed requests in `processing` state and never self-approves.
- [x] Add `process-data-exports`, protected by `CRON_SECRET`, to generate subject-centred JSON exports in the existing private `exports` bucket.
- [x] Scope export records to the requesting profile, school memberships, staff record, guardian-child links, linked children, approved collector details, consent history, invoices/payments, trip-child attendance and related trip metadata.
- [x] Exclude PIN hashes/lock counters, device tokens, credentials, GPS coordinates, unrelated guardians and internal idempotency hashes.
- [x] Enforce a 20 MiB export limit and use school/request-scoped object paths.
- [x] Add `download-data-export`, which checks the authenticated requester, completed request and retention-hold state before issuing a 60-second signed URL.
- [x] Add Deno tests for UUID path validation and UTF-8 byte accounting; add both functions to CI type-checking.
- [x] Configure `verify_jwt=false` only for the cron-secret-protected export worker; the download endpoint retains JWT verification.
- [ ] Run Deno CI and fix any type/test failures before continuing.
- [ ] Configure `CRON_SECRET` and `APP_ALLOWED_ORIGINS` securely, deploy, and test admin approval, requester isolation, signed download expiry and failed-upload retry.
- [ ] Complete export coverage review against the final product data inventory before representing the export as a complete legal data portability package.

**Operational boundary:** source only. No remote migration, database write, export artifact, secret, function deployment or cron schedule was created. The export worker requires a school administrator to move a request into `processing`; it cannot approve or complete account/child deletion requests.
