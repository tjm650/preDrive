# preDrive Supabase migration operations

## Purpose and authority

The SQL files in `supabase/migrations/` are the version-controlled source of truth for the application schema. The connected development database is an environment to compare against that design; it is not the authority for rewriting migrations.

This repository uses an online Supabase workflow. Do not require Docker, a local Supabase stack, or a local database reset as a prerequisite.

## Current B1.6 status

- Supabase development project: `rjsdhgbjvghjnuiilizm` (`eu-west-1`).
- PostgreSQL: 17.12.
- Remote migration ledger contains 12 applied versions.
- All 12 corresponding SQL files are present in `supabase/migrations/`; the historical reset SQL was recovered from the remote migration ledger and restored to GitHub.
- An additional repository-only migration `20261121130000_predrive_enable_pgcrypto.sql` explicitly declares `pgcrypto` in the `extensions` schema. It is not applied to the remote development database and must be included in the clean hosted replay before it is promoted.
- Historical version `20261120112956` (`predrive_full_application_reset`) was recovered from the remote `supabase_migrations.schema_migrations.statements` array and restored as `supabase/migrations/20261120112956_predrive_full_application_reset.sql`.
- Do not fabricate that historical SQL file or claim that the migration chain has passed a clean replay.
- No clean-room migration replay has been certified.
- The development database has 42 public application tables, all with RLS enabled. Thirty-seven currently have no policies by design; B2 will implement the role and tenant policies.
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
- SECURITY DEFINER functions and their execute grants; the migration files contain eight declarations, all with `SET search_path = ''`. The current live development catalog contains seven (one historical declaration was subsequently dropped/replaced). A live privilege audit found no `anon` EXECUTE grants; only the two intended authenticated RLS helpers are executable by `authenticated`;
- fully qualified references inside functions using an empty search path;
- RLS policies and both USING / WITH CHECK conditions;
- view security, including `security_invoker` where appropriate;
- grants on tables, sequences, schemas and functions;
- tenant-scoped foreign keys and supporting indexes;
- extension placement and required platform privileges.

### 3. Verify in an isolated hosted branch

Use a dedicated Supabase branch connected to the matching Git branch so Supabase deploys the committed migration files to an isolated database. Keep production data excluded.

A branch deployment is not automatically proof of an empty-database replay: confirm the branch workflow's Pull and Migrate steps and inspect its migration log. The historical SQL file has been restored. The new pgcrypto dependency migration is repository-only until a hosted replay and approved promotion.

For this project, the hosted branch is the online equivalent used for migration-chain verification. The local-only `supabase db reset` command is not part of the required workflow.

Do not create a hosted branch, apply a migration to the existing development database, repair its migration history, or incur branch compute charges without the user's written authorization for that operation.

### 4. Validate before promotion

A migration batch is not complete until the isolated branch has passed:
- migration deployment with no failed or skipped migration;
- complete schema comparison: tables, columns, types, defaults, constraints, indexes, enums, functions, triggers, RLS flags and policies;
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

1. Validate the restored historical reset migration on a genuinely fresh isolated hosted branch; do not rerun it against the existing development project.
2. Complete hosted clean-room replay and report every schema/platform-object difference against the development project.
3. Decide the correct side for each difference before changing the development project or migration history.
4. Confirm extension placement and baseline requirements for pgcrypto, PostGIS, pg_cron, supabase_vault and pg_net; the current project has pg_net in the exposed `public` schema. The reset migration has an earlier dependency on pg_cron and supabase_vault, while the repository migration chain now explicitly enables pgcrypto but does not explicitly enable pg_cron or supabase_vault.
5. Reconcile the stale claims in `DATABASE-SCHEMA.md` with the verified current schema documentation.

Until these are resolved, B1.6 remains open and B2 must not begin.
