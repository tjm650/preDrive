# preDrive Supabase migration operations

## Purpose and authority

The SQL files in `supabase/migrations/` are the version-controlled source of truth for the application schema. The connected development database is an environment to compare against that design; it is not the authority for rewriting migrations.

This repository uses an online Supabase workflow. Do not require Docker, a local Supabase stack, or a local database reset as a prerequisite.

## Current B1.6 status

- Supabase development project: `rjsdhgbjvghjnuiilizm` (`eu-west-1`).
- PostgreSQL: 17.12.
- Remote migration ledger contains 12 applied versions.
- All 12 corresponding SQL files are present in `supabase/migrations/`; the historical reset SQL was recovered from the remote migration ledger and restored to GitHub. A direct comparison confirms the reset file is byte-for-byte identical to its ledger `statements[0]` (2,281 bytes). A read-only comparison of all 12 applied migration records against their repository files confirms normalized SQL text matches for every version; six files are byte-exact and six differ only in comments/whitespace.
- An additional repository-only migration `20261121130000_predrive_enable_pgcrypto.sql` explicitly declares `pgcrypto` in the `extensions` schema. It is not applied to the remote development database and must be included in the clean hosted replay before it is promoted.
- Historical version `20261120112956` (`predrive_full_application_reset`) was recovered from the remote `supabase_migrations.schema_migrations.statements` array and restored as `supabase/migrations/20261120112956_predrive_full_application_reset.sql`.
- Do not fabricate that historical SQL file or claim that the migration chain has passed a clean replay.
- No clean-room migration replay has been certified.
- Database types were regenerated against the current development project and match `frontend/shared/types/database.types.ts` byte-for-byte (93,685 bytes). Workspace TypeScript checks passed for shared, mobile and web on commit `1bc1ae2de67da2bcdb83ff8ba0dfb94f35baceea` ([GitHub Actions run](https://github.com/tjm650/preDrive/actions/runs/44921668805)); repeat type generation and typecheck against the verified clean replay before sign-off.
- The development database has 42 public application tables, all with RLS enabled. Thirty-seven currently have no policies by design; B2 will implement the role and tenant policies. The live grant audit confirms no `anon` application-table privileges and no authenticated INSERT/DELETE grants; authenticated SELECT is limited to five policy-protected tables, with narrow column-level UPDATE grants on profile and school fields.
- The existing development database must not be modified until the user authorizes the exact operation in writing.

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
- grants on tables, columns, sequences, schemas and functions; verify service-role append-only restrictions and never expose service-role credentials. Also inspect default ACLs for every object owner: the connected `postgres` role's defaults are restricted, but Supabase-managed `supabase_admin` defaults in `public` still grant broad privileges to client roles and cannot be changed by the connected migration role;
- tenant-scoped foreign keys and supporting indexes;
- extension placement, relocatability and required platform privileges; do not plan to move a non-relocatable extension such as the currently installed `pg_net` with `ALTER EXTENSION ... SET SCHEMA`.

### 3. Verify against an isolated empty hosted project

A Supabase preview branch created from the current development project is **not** a clean-room replay target: branch workflows retain the parent branch's applied migration history and apply only newly introduced migrations. Such a branch can verify incremental changes, but it cannot prove that all 13 repository migrations build the schema from an empty starting point.

For the required full replay, use a separate disposable Supabase project with no pre-existing application schema or application migration history. Connect the matching Git revision and deploy the complete ordered migration directory there. Before replay, verify the platform-provided prerequisites used by the migration chain: `cron.job`, `cron.unschedule(bigint)`, `vault.secrets`, `auth.users`, the `supabase_migrations` ledger, and the Supabase roles `anon`, `authenticated`, `service_role`, `postgres`, and `supabase_auth_admin`. Confirm the migration role has the required SELECT/EXECUTE/DELETE privileges and independently verify DDL ownership/authority for every object the reset migration drops or creates; record the initial state. A read-only check for these prerequisites and for an empty target is committed at `supabase/verification/clean-room-preflight.sql`; it reports privilege checks and fails closed if required reset privileges are missing. It refuses to pass if it finds cron jobs, Vault secrets, Auth users, ledger rows, pre-existing non-extension relations/functions/custom types in `public` or `private`, any namespace-owned objects in `private` that `DROP SCHEMA ... CASCADE` could remove, or any non-extension namespace-owned objects in `public` that cascading drops of reset targets could remove. It has not yet been run against a separate hosted project. These objects and privileges are confirmed in the current development project only; they have not yet been verified on a fresh hosted project. The preflight currently checks the reset migration's explicit row-level and function privileges, but does not prove that the selected migration role owns every non-extension object the reset migration may drop, can recreate `private`, or has the required DDL ownership through role membership. Before treating the preflight as a complete go/no-go gate, verify the actual migration runner role and object ownership on the disposable project; do not infer DDL authority from the DELETE/EXECUTE privilege report. Keep production data and credentials out of this target.

A separate hosted project is the online equivalent of a clean database replay for this project. The local-only `supabase db reset` command is not part of the required workflow. Supabase preview branches remain useful for later incremental migration checks, not as proof of empty-database reproducibility.

Do not create a hosted branch or disposable project, apply a migration to the existing development database, repair migration history, or incur compute charges without the user's written authorization for that operation.

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
4. Confirm extension placement and baseline requirements for pgcrypto, PostGIS, pg_cron, supabase_vault and pg_net. In the current project, `pg_net` 0.20.4 has extension namespace `public`, its owned objects are in `net`, and PostgreSQL reports `relocatable=false`; do not attempt `ALTER EXTENSION ... SET SCHEMA`. Its `net` schema and HTTP functions currently grant effective access to `anon` and `authenticated` through PUBLIC/default privileges. Verify that neither `net` nor `private` is in Supabase's API exposed-schema list and define least-privilege grants for the trusted roles that need pg_net before B1.6 sign-off; the database catalog alone does not establish PostgREST exposure. Identify a supported Supabase remediation or record an explicitly accepted Security Advisor exception. The reset migration has an earlier dependency on pg_cron and supabase_vault, while the repository migration chain now explicitly enables pgcrypto but does not explicitly enable pg_cron or supabase_vault.
5. Resolve or explicitly accept the Supabase-managed `supabase_admin` default ACLs in `public`; the connected `postgres` role is not a member of `supabase_admin` and cannot alter them. Existing application tables, views and sequences are owned by `postgres` and have restricted grants; the concern is future objects created by `supabase_admin`.

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

This confirms the current development database inventory and type synchronization only. It does not certify an empty-database migration replay, does not establish the PostgREST exposed-schema allowlist, and does not resolve the `pg_net` warning or Supabase-managed `supabase_admin` default ACL concern. The API exposed-schema setting must be checked in the Supabase Dashboard under **Settings → API → Exposed schemas**; verify that neither `private` nor `net` is exposed.

The repository-only `20261121130000_predrive_enable_pgcrypto.sql` remains unapplied to the development migration ledger. Since `extensions.pgcrypto` is already installed, do not apply it merely to make the ledger appear complete. Its behavior still needs to be verified in a genuinely isolated clean replay.

**B1.6 remains open. B2 must not start until the outstanding migration-replay and security/platform acceptance items are resolved.**