# preDrive Supabase migration operations

## Purpose and authority

The SQL files in `supabase/migrations/` are the version-controlled source of truth for the application schema. The connected development database is an environment to compare against that design; it is not the authority for rewriting migrations.

This repository uses an online Supabase workflow. Do not require Docker, a local Supabase stack, or a local database reset as a prerequisite.

## Current B1.6 status (B3 applied incrementally; clean-room replay still deferred)

- Supabase development project: `rjsdhgbjvghjnuiilizm` (`eu-west-1`).
- PostgreSQL: 17.12.
- Remote migration ledger contains 28 applied versions: the original 12 B1 versions, six B2 versions applied on 2026-11-22, and nine B3 versions applied on 2026-11-23.
- All 12 original B1 SQL files are present in `supabase/migrations/`; the historical reset SQL was recovered from the remote migration ledger and restored to GitHub. A direct comparison confirms the reset file is byte-for-byte identical to its ledger `statements[0]` (2,281 bytes). A read-only comparison of all 12 applied migration records against their repository files confirms normalized SQL text matches for every version; six files are byte-exact and six differ only in comments/whitespace.
- An additional repository-only migration `20261121124410_predrive_enable_pgcrypto.sql` explicitly declares `pgcrypto` in the `extensions` schema. Its timestamp places it before `20261121124422_predrive_children_guardians.sql`, the first migration that calls `crypt()` and `gen_salt()` for handover PIN hashing. It is not applied to the remote development database and must be included in the clean hosted replay before it is promoted.
- Historical version `20261120112956` (`predrive_full_application_reset`) was recovered from the remote `supabase_migrations.schema_migrations.statements` array and restored as `supabase/migrations/20261120112956_predrive_full_application_reset.sql`.
- Do not fabricate that historical SQL file or claim that the migration chain has passed a clean replay.
- No clean-room migration replay has been certified.
- Database types were regenerated against the post-B2 development schema and committed to `frontend/shared/types/database.types.ts` (93,897 characters); the workspace TypeScript check passed on commit `82bf44fb79cfe6024268ed6ff96066e032147132` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/45068636781)). Workspace TypeScript checks passed for shared, mobile and web on commit `1bc1ae2de67da2bcdb83ff8ba0dfb94f35baceea` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/44921668805)); repeat type generation and typecheck against the verified clean replay before sign-off.
- The development database has 42 public application tables, all with RLS enabled. After B2, 19 remain without policies by design and continue to deny authenticated direct access pending their dedicated workflows. The live grant audit confirms no `anon` application-table privileges and no authenticated INSERT/DELETE grants; authenticated SELECT is limited to five policy-protected tables, with narrow column-level UPDATE grants on profile and school fields.
- The six B2 migrations were applied only after the user's explicit written authorization for that exact operation; future remote mutations still require their own written authorization.

## B2 remote application record — 2026-11-22

The user explicitly authorized applying the six reviewed B2 migrations to the existing development project. All six applied successfully in order. The hosted migration runner assigned these remote versions, and the repository files now use matching version prefixes:

| Remote version | Migration |
|---|---|
| 20261122204630 | `predrive_security_helpers` |
| 20261122204634 | `predrive_admin_staff_rls` |
| 20261122204639 | `predrive_guardian_child_rls` |
| 20261122204644 | `predrive_transport_trip_access_rls` |
| 20261122204649 | `predrive_storage_buckets_rls` |
| 20261122204654 | `predrive_atomic_rate_limiting` |

The committed SQL acceptance suite `supabase/tests/security/b2_security_acceptance.sql` executed against the remote project without a SQL error. It contains 63 checks, including two service-role calls through the public rate-limit RPC. The test transaction rolled back its temporary rate-limit events. A subsequent read-only check confirmed all six helpers, all five private buckets, RLS on all 42 public application tables, and the intended service-role-only public rate-limit RPC grant.

The checks do not replace seeded multi-tenant runtime tests. B5 must exercise real guardian, driver, supervisor, teacher and school-admin identities across at least two schools. Storage upload/download and signed URL flows also remain to be exercised end-to-end. The clean-room migration replay remains deferred; incremental B2 application is not proof of clean replay.

The complete inventory and current schema observations are maintained in [BACKEND-SCHEMA.md](./BACKEND-SCHEMA.md).

## Online migration lifecycle

### 1. Author

1. Confirm the intended change against `BRIEF.md`, the frontend API contract, and the existing migration chain.
2. Create a timestamped migration file under `supabase/migrations/` in the repository's hosted development workspace.
3. Keep each migration focused on one coherent change.
4. Include explicit grants, RLS enablement, constraints, indexes, comments, and rollback considerations where applicable.
5. Do not put demo records, credentials, API keys, or other secrets in schema migrations.

### 2. Review before applying

Review the complete SQL and its dependencies before it is run anywhere. Check that it is safe to re-run where practical and that it does not rely on untracked SQL Editor changes.

For security-sensitive SQL, review:
- schema ownership and search paths;
- SECURITY DEFINER functions and their execute grants; the migration files contain eight declarations, all with `SET search_path = ''`. The current live development catalog contains seven SECURITY DEFINER routines among 11 private routines (one historical declaration was subsequently dropped/replaced); all 11 live routines have empty search paths. A live privilege audit found no `anon` or `service_role` EXECUTE grants; only the two intended authenticated RLS helpers are executable by `authenticated`;
- fully qualified references inside functions using an empty search path;
- RLS policies and both USING / WITH CHECK conditions;
- view security, including `security_invoker` where appropriate;
- grants on tables, columns, sequences, schemas and functions; verify service-role append-only restrictions and never expose service-role credentials. Inspect default ACLs for every object owner. Supabase's [documented `supabase_admin` default-ACL limitation](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema-448af9) confirms these platform defaults apply only to objects that role creates, cannot be changed by project roles, and are not changed by the Automatically expose new tables setting. Our live read-only audit found no `supabase_admin`-owned public relations or routines; all 50 current public relations are owned by `postgres`. The `postgres` defaults for public tables, sequences and functions grant no privileges to `anon`, `authenticated` or `service_role`, and the foundation migration revokes default function EXECUTE from `PUBLIC`. Accept the platform defaults as a documented exception, not as an application exposure: migrations must run as `postgres`, all application objects must remain owned by `postgres`, never `SET ROLE supabase_admin`, and extension creation must specify the intended schema. The clean-room preflight now enforces `current_user = postgres` and confirms `postgres` is not a member of `supabase_admin`. Recheck ownership/default ACLs after extension changes, restores and platform upgrades;
- tenant-scoped foreign keys and supporting indexes;
- extension placement, relocatability and required platform privileges; do not plan to move a non-relocatable extension such as the currently installed `pg_net` with `ALTER EXTENSION ... SET SCHEMA`.

### 3. Verify against an isolated empty hosted project

A Supabase preview branch created from the current development project is **not** a clean-room replay target: branch workflows retain the parent branch's applied migration history and apply only newly introduced migrations. Such a branch can verify incremental changes, but it cannot prove that all 13 repository migrations build the schema from an empty starting point.

For the required full replay, use a separate disposable Supabase project with no pre-existing application schema or application migration history. Connect the matching Git revision and deploy the complete ordered migration directory there. Before replay, verify the platform-provided prerequisites used by the migration chain: `cron.job`, `cron.unschedule(bigint)`, `vault.secrets`, `auth.users`, the `supabase_migrations` ledger, and the Supabase roles `anon`, `authenticated`, `service_role`, `postgres`, and `supabase_auth_admin`. Confirm the migration role has the required SELECT/EXECUTE/DELETE privileges and verify database CREATE and `public` CREATE privileges, verify effective ownership privileges on `private` when that schema exists, verify `auth` schema USAGE and `TRIGGER` on `auth.users`, confirm PostGIS and pgcrypto are available and installed in `extensions` if already present, and independently verify DDL ownership/authority for every other object the reset migration drops or creates; record the initial state. A read-only check for these prerequisites and for an empty target is committed at `supabase/verification/clean-room-preflight.sql`; it reports privilege checks and fails closed if required reset privileges are missing. It refuses to pass if it finds cron jobs, Vault secrets, Auth users, ledger rows, pre-existing non-extension relations/functions/custom types in `public` or `private`, any namespace-owned objects in `private` that `DROP SCHEMA ... CASCADE` could remove, an extension-owned `private` schema, or any non-extension namespace-owned objects in `public` that cascading drops of reset targets could remove. Its custom-type guard covers base, enum, composite, domain, range and multirange types (excluding generated array types and relation row types), plus pseudo types, so an unsupported user-defined type cannot survive the reset unnoticed. It has not yet been run against a separate hosted project. These objects and privileges are confirmed in the current development project only; they have not yet been verified on a fresh hosted project. The preflight currently checks the reset migration's explicit row-level and function privileges, but does not prove that the selected migration role owns every non-extension object the reset migration may drop, can recreate `private`, or has the required DDL ownership through role membership. Before treating the preflight as a complete go/no-go gate, verify the actual migration runner role and object ownership on the disposable project; do not infer DDL authority from the DELETE/EXECUTE privilege report. Keep production data and credentials out of this target.

A separate hosted project is the online equivalent of a clean database replay for this project. The local-only `supabase db reset` command is not part of the required workflow. Supabase preview branches remain useful for later incremental migration checks, not as proof of empty-database reproducibility.

The historical reset migration intentionally deletes rows from `supabase_migrations.schema_migrations` as part of its one-time cleanup. Supabase CLI documents that `db push` inserts a migration-history row after each migration succeeds. Therefore, during a clean-room `db push`, the reset migration's own version is expected to be recorded after its SQL completes; subsequent migrations then continue through the ordered migration set. This is a documented runner behavior, not evidence that the reset is safe to rerun against a populated project. Do not manually pre-populate or repair the ledger to work around this migration. Confirm the resulting ledger contains every expected version after the replay.

Run `supabase/verification/clean-room-preflight.sql` using the same database connection identity that will execute the migration deployment. Its privilege and ownership checks evaluate `current_user`; running it as a different role does not certify the migration runner's authority. Record the connection role used for both the preflight and deployment.

Do not create a hosted branch or disposable project, apply a migration to the existing development database, repair migration history, or incur compute charges without the user's written authorization for that operation.

### Hosted Supabase platform prerequisites and current CLI behaviour

The historical first migration calls `cron.unschedule(bigint)` and deletes from `vault.secrets`. These are platform dependencies, not application objects created by this migration chain. Supabase documents enabling `pg_cron` through Database → Extensions (or the Cron integration) and Vault through its database extension/UI. The clean-room preflight now requires both the actual `pg_cron` and `supabase_vault` extension entries in `pg_extension`, in addition to the expected platform relations and routine. A schema/table/function with a matching name is not sufficient evidence that the platform extension is installed.

On the current development project, a read-only extension catalog query confirms:
- `pg_cron` 1.6.4 in `pg_catalog`;
- `supabase_vault` 0.3.2 in `vault`;
- `postgis` 3.3.7 and `pgcrypto` 1.3 in `extensions`.

This confirms only the current development project. A new disposable project must independently enable/verify the platform prerequisites before preflight. Do not copy any Vault secrets into the disposable project; the preflight requires its Vault secret table to be empty.

Supabase CLI v3 changed hosted-target safety defaults: database commands now target the local stack unless `--remote` is specified, and hosted mutations require explicit confirmation (or `--yes` in unattended execution). Any future CLI deployment procedure must pin/record the CLI major version, explicitly target the intended hosted project, and never rely on an implicit linked/local target. `--yes` is an automation acknowledgement, not user authorization; it must only be used after the target, backup, preflight result and exact migration operation have been approved. The CLI v3 migration guide is documented at https://supabase.com/docs/guides/local-development/cli/migrating-to-v3.

Supabase also changed Data API exposure defaults: as of 2026-10-30, new public-schema tables are not automatically exposed to the Data API. Before frontend integration, verify the disposable project's **Settings → API → Exposed schemas** and Data API exposure settings. Keep `private` and `net` unexposed. Expose only the application schema(s) intentionally used by the Supabase adapter, and separately grant the minimum required role privileges with RLS policies. Schema exposure is not a substitute for grants or RLS. Do not change the existing development project's API settings as part of this audit.

### 4. Validate before promotion

A migration batch is not complete until the isolated branch has passed:
- migration deployment with no failed or skipped migration;
- complete schema comparison: tables, columns, types, defaults, constraints, indexes, enums, functions, triggers, RLS flags, FORCE RLS flags, policies, grants and default privileges; the current static migration-to-catalog check matches all 42 tables, 23 enums and five views, all 160 explicit migration index declarations are present among 257 live public indexes, and the live catalog has 36 enabled public application triggers plus one Auth profile-sync trigger. These checks do not replace the full replay comparison;
- extension inventory and extension schema placement;
- Realtime publication membership;
- pg_cron jobs;
- Storage buckets and Storage policies;
- Supabase Auth integration objects that are owned by this application;
- 42-table RLS and tenant-column audit;
- database lint/advisor review;
- generated TypeScript database types and frontend type-check.

Do not recreate or modify Supabase-managed Auth internals. Record platform-managed objects separately from application-owned objects.

### 5. Promote to development, staging and production

1. Keep development, staging and production as separate Supabase projects.
2. Promote only reviewed migration files through Git pull requests.
3. Review the Supabase deployment workflow and migration output before treating a deployment as successful.
4. Apply the same ordered migration chain to staging first.
5. Run the relevant API, RLS, tenant-isolation and application acceptance tests against staging.
6. Promote the same reviewed commit to production during an approved release window.
7. Never use a production dashboard SQL edit as an undocumented substitute for a migration.
8. Keep environment-specific credentials in the corresponding Supabase/Vercel secret stores; never commit them.

### 6. Rollback and recovery

Prefer a new forward migration that restores the intended schema. Do not edit or delete a migration that has already been applied to a shared environment.

Before any destructive migration:
- take and verify a backup appropriate to the environment;
- identify affected data and dependent application versions;
- define a recovery plan and the exact commands/operations;
- obtain written authorization for the target environment and operation.

For accidental data loss, use the environment's supported backup/PITR recovery procedure. A compensating migration does not restore deleted data. Do not use `supabase migration repair` as a schema rollback: it changes migration-history bookkeeping, not the database objects or data.

## Migration-history reconciliation rules

- The remote migration ledger is evidence of what the remote environment records as applied; it does not replace the SQL source files.
- The original `20261120112956_predrive_full_application_reset` SQL has been restored from the remote migration ledger. Preserve its exact one-time reset semantics; do not rewrite it as a routine baseline. It unschedules all cron jobs, deletes all Vault secrets and Auth users, drops non-extension public objects, recreates `private`, and clears the migration ledger. Its `cron` and `vault` prerequisites must exist before replay begins.
- Do not mark a migration applied or reverted merely to make the ledger look consistent.
- Consider `supabase migration repair` only after the clean-room result and schema comparison establish the exact intended history transition. Document its precise effect and obtain written authorization before running it against any shared remote project.
- A new baseline must represent the complete approved application schema and required non-public/platform configuration. It must not simply duplicate objects on top of an existing populated schema.
- Keep platform-managed Supabase objects distinct from application-managed objects in baseline planning.

## Current unresolved decisions

1. Validate the restored historical reset migration on a genuinely empty disposable hosted project; a preview branch cloned from the current development database is not a clean-room replay. Do not rerun it against the existing development project.
2. Complete hosted clean-room replay and report every schema/platform-object difference against the development project.
3. Decide the correct side for each difference before changing the development project or migration history.
4. Confirm extension placement and baseline requirements for pgcrypto, PostGIS, pg_cron, supabase_vault and pg_net. In the current project, `pg_net` 0.20.4 is owned by `supabase_admin`, has extension namespace `public`, its owned objects are in `net`, and PostgreSQL reports `relocatable=false`; do not attempt `ALTER EXTENSION ... SET SCHEMA`. A fresh ACL audit shows `supabase_admin` granted `PUBLIC` usage on `net`, all privileges on the request/response tables and sequence, and execute on extension routines; `anon`, `authenticated` and `service_role` have effective execute privileges. Supabase KB guidance (2026-11-04) says these ACLs cannot be changed by project roles: `GRANT`/`REVOKE` as `postgres` has no effect, and recreating the extension reapplies them. Do not attempt ACL changes or extension removal/relocation. Preserve pg_net for the planned B4 cron-to-Edge-Function workflow, but do not claim it is currently in use. Zero cron jobs were observed. Direct DB login roles are trusted infrastructure roles; do not create app-user login roles or expose database credentials. Queue rows contain request URLs, headers and bodies. Verify via Dashboard → Settings → API → Exposed schemas (or Management API `GET /v1/projects/{ref}/postgrest`) that `net` and `private` are absent. SQL catalogs and current repository config do not reveal the live allowlist. If `net` is exposed, stop and resolve exposure before proceeding; if it is absent, document the platform-owned grants as a Supabase exception. The reset migration has an earlier dependency on pg_cron and supabase_vault, while the repository migration chain now explicitly enables pgcrypto but does not explicitly enable pg_cron or supabase_vault.
5. Default ACL disposition: accept the Supabase-managed `supabase_admin` defaults as a documented platform exception. They apply only to objects created by `supabase_admin`; current inventory found no such public relations/routines. The `postgres` defaults are restricted, and the clean-room preflight now requires migration execution as `postgres` with no `supabase_admin` membership. Re-audit object owners/default ACLs after extension changes, restores and platform upgrades.

Until these are resolved, B1.6 remains open and B2 must not begin.
## Latest authorized read-only verification — 2026-11-21

The user authorized read-only verification on the existing development project only. No schema, data, migration ledger, settings, branches or projects were changed.

A fresh Supabase read-only check confirmed:

- The project is `ACTIVE_HEALTHY`, PostgreSQL 17.12.
- The migration API reports the same 12 applied versions listed above.
- The public catalog reports 42 application tables and RLS enabled on all 42; 37 currently have no policies and remain deny-by-default. Seven policies exist.
- Five public views exist and all five have `security_invoker=true`.
- Required installed extensions are present: `pgcrypto`, `postgis`, `pg_cron`, `pg_net` and `supabase_vault`.
- A new TypeScript generation run returned 93,685 characters and matched the committed `frontend/shared/types/database.types.ts` byte-for-byte.
- Security Advisor: 37 informational RLS-without-policy findings, plus one warning for `pg_net` in `public`.
- Performance Advisor: 149 informational unused-index findings; do not remove indexes without representative workload and query-plan evidence.
- Health Advisor: no findings.

This confirms the current development database inventory and type synchronization only. It does not certify an empty-database migration replay or establish the PostgREST exposed-schema allowlist. The `supabase_admin` default ACL issue has been dispositioned as a documented platform exception under the postgres-owner invariant. The `pg_net` placement warning remains a platform exception; verify the API exposed-schema setting in Supabase Dashboard under **Settings → API → Exposed schemas** and confirm neither `private` nor `net` is exposed.

The repository-only `20261121124410_predrive_enable_pgcrypto.sql` remains unapplied to the development migration ledger. Since `extensions.pgcrypto` is already installed, do not apply it merely to make the ledger appear complete. Its behavior still needs to be verified in a genuinely isolated clean replay.

**B1.6 remains open. B2 must not start until the outstanding migration-replay and security/platform acceptance items are resolved.**

## B3 migration set — applied to development

Nine additive B3 migration files were applied sequentially to the existing development project `rjsdhgbjvghjnuiilizm` on 2026-11-23. No reset migration, seed, account deletion, project creation or branch creation was performed.

| Remote version | Repository migration file |
|---|---|
| 20261123033037 | `20261123010000_predrive_business_auth_lifecycle.sql` |
| 20261123033044 | `20261123020000_predrive_child_guardian_collector_lifecycle.sql` |
| 20261123033051 | `20261123025000_predrive_temporary_collector_lifecycle.sql` |
| 20261123033132 | `20261123030000_predrive_handover_and_attendance_logic.sql` |
| 20261123033140 | `20261123040000_predrive_trip_lifecycle_and_gps.sql` |
| 20261123033146 | `20261123050000_predrive_safety_and_emergency_logic.sql` |
| 20261123033152 | `20261123060000_predrive_geofencing_and_guardian_arrival.sql` |
| 20261123033159 | `20261123070000_predrive_finance_lifecycle.sql` |
| 20261123033205 | `20261123080000_predrive_privacy_bulk_and_admin_operations.sql` |

The nine migrations add 45 public RPC functions, two school-scoped tables (`temporary_collectors` and `child_route_assignments`), the guardian notification-radius column, GPS and trip-event idempotency indexes, an alert deduplication index, and a deferrable route-stop ordering constraint. All 45 RPCs are SECURITY DEFINER with an empty search path. No B3 function is executable by `anon`; four trusted automation/settlement functions are service-role-only.

The first B3.3 application attempt failed while parsing the attendance function. Its preceding idempotent unique-index statement had already succeeded, but no B3.3 migration ledger row was recorded. The committed function expression was simplified, then the migration was reapplied successfully. Only after B3.3 succeeded were B3.4–B3.8 applied. The final remote ledger contains 28 versions (12 B1, six B2, nine B3, one B4).

## B4.2 migration — applied and catalog-verified

`supabase/migrations/20261123051100_predrive_daily_trip_generation.sql` is committed on `main` and applied to the development project's remote migration ledger as version `20261123051100`. It adds nullable `driver_id` and `supervisor_id` assignments to `route_schedules`, composite school-scoped staff foreign keys, active-role validation, an admin assignment RPC, and the service-role-only `generate_daily_trips(date)` function. The generator is restricted to the current `Africa/Harare` date, is idempotent by school/schedule/date/direction, and creates trip-child rows from active child route assignments.

The migration was applied on 2026-11-23 after the user's explicit B4.2 authorization. The read-only acceptance suite `supabase/tests/automation/b4_daily_trip_generation.sql` ran successfully, followed by independent catalog verification. The remote ledger now contains 28 versions: 12 B1, six B2, nine B3 and one B4.2. Supabase assigned remote version `20261123051100`; the repository migration filename uses the same version prefix.

## B3 catalog acceptance — passed 2026-11-23

The read-only test `supabase/tests/business_logic/b3_business_logic_acceptance.sql` ran against the development database without SQL errors. It validates the expected function signatures, SECURITY DEFINER empty search paths, new-table RLS, direct table grants, service-role-only execution and deferrable route-stop uniqueness. Independent catalog verification confirmed:
- 45/45 expected B3 function signatures resolve and have the required SECURITY DEFINER/empty-search-path configuration.
- No B3 RPC has effective `anon` EXECUTE.
- `evaluate_trip_geofences`, `apply_payment_result`, `apply_refund_result` and `complete_deletion_request` are service-role-only.
- Both new tables have `school_id` and RLS enabled. `temporary_collectors` has no authenticated direct table privileges; `child_route_assignments` has SELECT only, with writes routed through checked RPCs.
- The notification-radius column, GPS/trip idempotency indexes, alert deduplication index and deferred route-stop uniqueness are present.
- All 44 public application tables retain RLS.

This is catalog acceptance, not a substitute for real-user runtime acceptance. No Auth users or business records were seeded. B5 must test row visibility and role boundaries with real school-admin, guardian, supervisor, driver and teacher identities. B4 must provide verified payment webhooks, push delivery, geofence scheduling, deletion/export execution and retention automation. The clean-room replay remains deferred under B1.6; incremental application to the existing development project does not certify an empty-database replay.

