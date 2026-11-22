# preDrive backend batch register

This register tracks the backend implementation plan. B0 is planning/audit work and is not counted as an implementation batch. B1.1–B1.5 are complete. B1.6 remains open and is explicitly deferred by the user; on 2026-11-22 the user authorized proceeding with B2 against the existing development project using reviewed incremental migrations only. This is an exception to the original phase gate, not a claim that the clean-room replay passed.

## Status summary

| Phase | Scope | Batches | Complete | Remaining |
|---|---|---:|---:|---:|
| B0 | Architecture and initial audit (planning only) | — | Complete | 0 |
| B1 | Database foundation and schema | 6 | 5 | 1 |
| B2 | Security and RLS | 6 | 0 | 6 |
| B3 | Database business logic | 8 | 0 | 8 |
| B4 | Edge Functions and automation | 8 | 0 | 8 |
| B5 | Demo data and seed scripts | 4 | 0 | 4 |
| B6 | Frontend integration | 6 | 0 | 6 |
| B7 | QA, deployment and release | 8 | 0 | 8 |
| **Total** | | **46** | **5** | **41** |

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
- [ ] All 42 application tables have RLS enabled and the tenant-column audit passes. Current live state: 42 enabled, none FORCE RLS; 37 have no policies by deliberate deny-by-default staging.
- [ ] Remote-vs-replay comparison covers columns, types, defaults, constraints, indexes, enums, functions, triggers, RLS/policies, extensions, publications, cron, Storage and Auth integration objects.
- [ ] Verify the clean target's Data API exposed-schema allowlist and table exposure configuration: expose only the intended application schema(s), keep `private` and `net` unexposed, and verify minimum grants plus RLS. New public tables are no longer automatically exposed by default on Supabase. This must also be checked on the current development project before B1.6 sign-off; the live allowlist cannot be inferred from SQL catalog privileges or the current minimal `supabase/config.toml`.
- [ ] Database lint/advisor review passes or every exception is documented and accepted. The `pg_net` platform ACL audit is documented: `supabase_admin` owns the extension and its PUBLIC grants; Supabase does not support changing these per-project grants, so no ACL/relocation workaround is permitted. The extension-in-public Security Advisor warning remains open as a platform exception; final acceptance still requires confirming `net` and `private` are absent from the live Data API exposed-schema allowlist. The 149 unused-index notices remain informational until representative workload testing.
- [ ] Function, trigger, RLS policy, table/column grant, index and default-privilege inventories reconcile against the clean replay; current live state is documented in `BACKEND-SCHEMA.md`. Supabase-managed `supabase_admin` default ACLs in `public` are accepted as a documented platform exception: Supabase confirms they apply only to objects created by `supabase_admin` and cannot be changed by project roles. Current inventory found zero `supabase_admin`-owned public relations/routines; all 50 public relations are `postgres`-owned, and `postgres` defaults grant no table/sequence/function privileges to API roles. The clean-room preflight enforces migration execution as `postgres` and verifies it is not a member of `supabase_admin`. Re-audit after extensions, restores and platform upgrades.
- [ ] Generated database types are regenerated from the verified clean-replay schema and typecheck. The current development project has been regenerated and its output matches the committed 93,685-byte `frontend/shared/types/database.types.ts` exactly. Workspace TypeScript checks now pass for shared, mobile and web on commit `1bc1ae2de67da2bcdb83ff8ba0dfb94f35baceea` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/44921668805)); the first run exposed missing style keys in three mobile cards, which were corrected. Repeat type generation and typecheck against the verified clean replay before sign-off.
- [ ] `docs/MIGRATIONS.md` and schema documentation reflect the verified workflow and state.

## B2 — Security and RLS (6 batches)

- [ ] B2.1 Security-definer helper functions with locked search paths and narrowly scoped grants — migration `20261122153000_predrive_security_helpers.sql` is committed to `main`; it defines six authenticated-caller-scoped tenant/relationship helpers. Remote application and SQL verification are pending explicit approval after the exact effects are reviewed.

Remaining B2 sub-batches:

1. B2.2 School admin and staff RLS policies — migration `20261122160000_predrive_admin_staff_rls.sql` is committed. It scopes class-group read access to admins, teachers and supervisors; restricts fee catalogue, settings and setup-progress CRUD to school admins; and grants authenticated table privileges only on those four tables. It uses the already-applied `private.has_school_role` helper, so it does not depend on B2.1. Remote application is pending explicit approval.
2. B2.3 Guardian/child relationship isolation — migration `20261122163000_predrive_guardian_child_rls.sql` is committed. Guardians can select only their own active child links and linked child records; school admins/teachers/supervisors receive school-scoped operational reads; only school admins can directly mutate child and guardian-link rows. Guardians can also read only the class-group label associated with their linked child. The migration grants authenticated SELECT only on `children` and `guardian_children`; remote application and policy tests remain pending explicit approval.
3. B2.4 Driver, supervisor, trip and GPS access policies — migration `20261122170000_predrive_transport_trip_access_rls.sql` is committed. School admins/supervisors can read school operations; drivers can read only assigned trip/fleet context; guardians can read only active trips and current positions carrying their linked child. Drivers receive no trip-child/handover/collector access. GPS history, trip events and collector records remain unavailable through direct authenticated table reads. The migration grants read-only access to the approved operational tables; remote application and cross-role tests remain pending explicit approval.
4. B2.5 Storage buckets, object paths, MIME/size limits and Storage policies.
5. B2.6 Database rate limiting and at least 30 SQL security cases, including cross-tenant isolation.



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

## B4 — Edge Functions and automation (8 batches)

1. Shared Deno Edge Function infrastructure.
2. Daily trip generation.
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
