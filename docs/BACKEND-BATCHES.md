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

### B4.2 — Daily trip generation (migration applied; function deployment pending)

- [x] Add school-scoped driver and optional supervisor assignments to recurring route schedules, with composite school foreign keys.
- [x] Add an authenticated school-admin RPC to assign schedule staff; database trigger enforces active staff role and same-school identity.
- [x] Add a service-role-only trip generator for the current `Africa/Harare` service date. It uses schedule effective dates, PostgreSQL day-of-week values (Sunday = 0), the school's configured timezone, active school/route/bus/driver state and optional supervisor assignment.
- [x] Generate a scheduled trip only once per school/schedule/date/direction and create trip-child rows from active child route assignments.
- [x] Add a cron-secret-protected Edge Function entrypoint; it accepts POST only and does not accept a caller-selected service date.
- [x] Add read-only catalog acceptance SQL and extend the Deno workflow to type-check the entrypoint.
- [ ] Obtain a successful GitHub Actions Deno check (the Vercel status currently reports a build-rate-limit failure, which is not the Deno workflow result).
- [ ] Apply migration `20261123051100_predrive_daily_trip_generation.sql` to the development project after explicit written approval. **Complete:** applied as remote version `20261123051100` after approval.
- [ ] Configure `CRON_SECRET` and `APP_ALLOWED_ORIGINS` in Supabase Function secrets; values must not be committed.
- [ ] Deploy `generate-daily-trips` with platform JWT verification disabled only because the function independently verifies a high-entropy cron secret; do not schedule it until deployment and function smoke tests pass.
- [ ] Run `supabase/tests/automation/b4_daily_trip_generation.sql` after the migration is applied. **Complete:** read-only acceptance suite and catalog verification passed; no trip or demo data was generated.

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
- [ ] Obtain a successful run of `.github/workflows/supabase-edge-functions.yml` (Deno 2.9.8 type-check and shared tests).
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
