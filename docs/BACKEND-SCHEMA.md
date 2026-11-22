# preDrive database schema (B1.6)

## Verified development schema

- Supabase project: `preDrive` (`rjsdhgbjvghjnuiilizm`), region `eu-west-1`.
- PostgreSQL 17.12.
- 42 application tables in `public`; all 42 have RLS enabled. A static inventory of all 12 applied migration files matches the live catalog exactly for all 42 table names, 23 public enum names and five public view names; no missing or unexpected names were found in those three object classes.
- 37 tables currently have no RLS policies. This is deliberate deny-by-default staging before B2. All 42 tables have RLS enabled (none currently uses `FORCE ROW LEVEL SECURITY`). The `anon` role has no privileges on public application tables; `authenticated` has table-level SELECT only on `profiles`, `school_invitations`, `school_memberships`, `schools` and `staff_members`, with narrow column-level UPDATE grants on `profiles` (`full_name`, `language`, `phone`) and `schools` (`address`, `indicative_zig_per_usd`, `name`). The corresponding seven policies restrict those reads/updates. There are no authenticated table-level INSERT, UPDATE or DELETE grants and no client privileges on the other 37 tables.
- No application rows were inserted by B1.1–B1.6.
- All 51 foreign keys flagged as unindexed by Supabase Performance Advisor were given covering indexes in migration `20261121124613`. A follow-up advisor run no longer reports unindexed foreign keys. A static inventory finds 160 explicit `CREATE INDEX` declarations across the 13 repository migrations; every one exists in the live `public` catalog. The catalog contains 257 public indexes in total, with the remaining 97 created for primary-key/unique/constraint enforcement. The live catalog reports 384 public constraints.
- The 149 unused-index notices are expected in an empty development database and must be reassessed after representative workload tests; do not drop indexes merely to silence the advisor.
- Security Advisor still reports `pg_net` installed in `public`. A fresh read-only catalog audit on 2026-11-22 confirms `pg_net` 0.20.4 is owned by `supabase_admin`, has extension namespace `public`, is non-relocatable, and owns objects in the `net` schema. Do not propose `ALTER EXTENSION pg_net SET SCHEMA ...` or a relocation migration. The ACL expansion confirms `supabase_admin` is the grantor of `USAGE` on `net` to `PUBLIC` and the platform roles; `PUBLIC` has all privileges on `net.http_request_queue` and `net._http_response`, sequence privileges, and `EXECUTE` on the extension routines. Effective `EXECUTE` is true for `anon`, `authenticated` and `service_role`. This is a Supabase platform-owned ACL, not a grant created by the application migration role. Supabase's KB (updated 2026-11-04) explicitly states that per-project `GRANT`/`REVOKE` on these extension objects has no effect because `supabase_admin` owns the grants; dropping/recreating the extension reapplies them. Do not attempt ACL revokes, ownership changes, extension relocation, or drop/recreate as a workaround. Preserve pg_net because B4 may use it for scheduled Edge Function invocation; do not assume it is already used by application jobs. The current project has zero cron jobs and no application database webhook use was established in this audit. `anon` and `authenticated` are not LOGIN roles; the catalog lists only Supabase/platform login roles. Any direct database login role must be treated as trusted because pg_net queue rows include request URLs, headers and bodies, and the worker sends queued requests. Do not create direct-login roles for app users or expose database credentials to clients. Supabase documents that Data API reachability depends on whether `net` is in the exposed-schema allowlist; SQL privileges alone do not establish this. The current SQL catalog and repository `supabase/config.toml` do not establish the live allowlist. Verify in the project's Dashboard → Settings → API → Exposed schemas (and, if necessary, the Management API `GET /v1/projects/{ref}/postgrest`) that `net` and `private` are not exposed. If `net` is absent, retain the platform-owned grants as a documented exception; if it is exposed, stop and resolve the exposure before proceeding. Do not attempt to revoke pg_net grants from the connected `postgres` role.
- An on-time performance view is not defined yet: the schema does not yet establish an authoritative actual-arrival timestamp and lateness threshold. Do not fabricate an on-time metric. Resolve it against the API contract before adding it.

## Applied migrations

| Remote version | Migration |
|---|---|
| 20261120112956 | predrive_full_application_reset |
| 20261120181614 | core_identity_tenancy |
| 20261120181637 | tighten_profile_and_staff_visibility |
| 20261120181707 | lock_down_private_schema |
| 20261120181850 | index_membership_foreign_keys |
| 20261120181937 | revoke_all_public_default_privileges |
| 20261121124422 | predrive_children_guardians |
| 20261121124429 | predrive_transport_trips_gps |
| 20261121124437 | predrive_safety_operations |
| 20261121124444 | predrive_finance |
| 20261121124451 | predrive_settings_privacy_audit_analytics |
| 20261121124613 | predrive_foreign_key_indexes |

## Migration-chain exception

The remote migration ledger contains historical version `20261120112956` (`predrive_full_application_reset`). Its original SQL was recovered read-only from the remote `supabase_migrations.schema_migrations.statements` array and restored to `supabase/migrations/20261120112956_predrive_full_application_reset.sql`; a direct comparison now confirms the committed file is byte-for-byte identical to the ledger's `statements[0]` (2,281 bytes). All 12 remote versions have matching committed SQL files. A read-only comparison against each ledger `statements[0]` confirms normalized SQL text matches for all 12; six files are byte-exact and six differ only in comments/whitespace. An additional repository-only pgcrypto dependency migration is pending and is ordered before the first migration that uses `crypt()`/`gen_salt()`. The recovered migration is a destructive one-time reset: it unschedules every cron job, deletes all Vault secrets and Auth users, drops non-extension functions/relations/types in `public`, drops and recreates `private`, and deletes every row from `supabase_migrations.schema_migrations`. It must never be rerun against an existing environment containing data or secrets. The reset SQL assumes `cron.job`, `cron.unschedule(...)` and `vault.secrets` already exist before the application migrations begin. These schemas are present in the current development project, but their presence on a fresh hosted project is not yet verified. A preview branch cloned from the populated development project is not a clean replay target because it retains the parent's migration history and applies only new migrations. A clean-room replay is still **not yet certified**; it requires a separate, empty disposable hosted project.

## Static migration security review

- The live catalog contains 11 application routines, all in the `private` schema; there are no `public` application RPCs, and the generated public client types expose no RPC functions. The Supabase API exposed-schema configuration itself still requires dashboard verification. Seven are `SECURITY DEFINER`, and all 11 routines have an empty `search_path`. The migration history contains eight `SECURITY DEFINER` declarations; one historical helper (`private.can_view_profile`) was subsequently dropped/replaced. The two superseded policies (`profiles_select_self_or_school_colleague` and `staff_members_select_school_member`) are dropped by later migrations; the live seven-policy inventory matches the final policy declarations.
- A read-only privilege audit found no `anon` or `service_role` EXECUTE grants on these 11 routines. Only the two intended authenticated RLS helpers (`private.has_school_role` and `private.can_admin_view_profile`) are executable by `authenticated`. `authenticated` has `USAGE` on `private`; `anon` and `service_role` do not. Trigger helper functions remain callable through their installed triggers and are not granted as client RPCs.
- There are 36 enabled application triggers on `public` tables and one application-owned profile-sync trigger on `auth.users`. The public set comprises 26 explicit trigger declarations plus ten timestamp triggers created by two migration `DO` loops (six in B1.4 and four in B1.5). The other 11 observed `storage` triggers are Supabase-managed and are not application migrations. All 36 public triggers and the Auth profile-sync trigger are enabled.
- `service_role` has SELECT and INSERT on all 42 application tables, UPDATE and DELETE on 36; it is deliberately denied UPDATE/DELETE on `audit_log`, `consent_records`, `delay_reports`, `receipts`, `trip_events` and `vehicle_checks`. It remains a trusted server-only role and bypasses RLS; never expose its key to a client.
- Default-privilege audit and disposition (read-only, 2026-11-22): Supabase's [KB on `supabase_admin` default privileges](https://supabase.com/kb/troubleshooting/cant-change-the-default-privileges-of-supabase_admin-in-the-public-schema-448af9) confirms these grants apply only to objects created by `supabase_admin`; they cannot be changed by project roles, and the `Automatically expose new tables` setting changes `postgres` defaults, not `supabase_admin` defaults. The live catalog confirms broad `supabase_admin` defaults for future `public` tables, sequences and functions, but `postgres` has no default grants to `anon`, `authenticated` or `service_role` for its `public` tables, sequences or functions (the foundation migration also revokes default function EXECUTE from `PUBLIC`). The connected `current_user`/`session_user` is `postgres`, and `postgres` is not a member of `supabase_admin`. Current ownership inventory: 50 non-extension public relations (42 application tables, five views, three sequences) are owned by `postgres`; zero public relations or routines are owned by `supabase_admin`. The `pg_net` extension namespace is `public`, but its objects are in `net`, so it is not a current public-object instance of this default-ACL issue. Decision: accept the `supabase_admin` default ACLs as a documented Supabase platform exception, with a strict ownership invariant: all application migrations and application objects must be created as `postgres`; never `SET ROLE supabase_admin`; install relocatable extensions explicitly in `extensions` (and respect required extension schemas); after extension changes, restores and platform upgrades, re-run the owner/default-ACL inventory and inspect any new `supabase_admin`-owned objects in exposed schemas. Do not attempt to alter the platform-managed defaults. The clean-room preflight now fails unless `current_user = postgres` and `postgres` is not a member of `supabase_admin`.
- The reviewed function bodies schema-qualify application relations and private helper calls; this reduces object-shadowing risk. The review is static and does not replace executable privilege/RLS tests in B2.
- The reset migration is intentionally outside this security-function count; it contains anonymous `DO` blocks and destructive DDL.
- The current schema migrations do not create the B2 tenant authorization helper set or the B3 handover verification RPC. These remain planned work, not missing implementation claimed complete.

## Current Supabase advisor and generated-type observations

A fresh read-only advisor run on 2026-11-21 returned:

- Security: 37 `rls_enabled_no_policy` informational findings, matching the documented deny-by-default staging state; one warning for `pg_net` installed in `public`. The extension is non-relocatable in the current platform catalog; its owned objects are in `net`, while `pg_extension.extnamespace` is `public`.
- Performance: 149 `unused_index` informational findings. The development schema has not yet received representative application traffic, so these are not evidence that the indexes should be removed. Reassess after realistic workload and query-plan measurement.
- Health: no findings returned by the Health advisor.
- The previously reported unindexed-FK performance findings are absent after migration `20261121124613`.

A fresh TypeScript type-generation call against the current development project completed and returned the schema model, including the 42 tables, five views and 23 enums. It reports no exposed `public` RPC functions (`Functions: never`); private-schema functions are not part of the generated public client API. The latest generated output is an exact byte-for-byte match for committed `frontend/shared/types/database.types.ts` (93,685 bytes). The repository-only pgcrypto migration creates no public tables, columns, views or RPCs, so no generated type change is expected; final generation and typecheck must still be performed against the verified clean replay.

The Supabase branch inventory currently contains only the default `main` branch. No isolated verification branch has been created. Creating one is an explicit remote resource operation and remains outside the read-only work performed for this audit.

## Non-table and platform-object inventory

The following were checked against the connected development project using read-only catalog queries:

| Object area | Observed state | B1.6 treatment |
|---|---|---|
| Extensions | `pg_cron` 1.6.4 in `pg_catalog`; `pg_net` 0.20.4 has extension namespace `public` and is non-relocatable, while its owned objects are in `net`; `pg_stat_statements` 1.11, `pgcrypto` 1.3, `postgis` 3.3.7 and `uuid-ossp` 1.1 in `extensions`; `plpgsql` 1.0 in `pg_catalog`; `supabase_vault` 0.3.2 in `vault` | Preserve platform-managed extensions; verify each required extension and schema in the clean replay. Do not attempt to relocate `pg_net` with `ALTER EXTENSION ... SET SCHEMA`: its installed version reports `relocatable=false`. The Security Advisor warning remains open. The `net` schema grants `USAGE` and its HTTP functions inherit effective `EXECUTE` from PUBLIC, including for `anon` and `authenticated`; verify the Supabase API exposed-schema configuration and design least-privilege grants for trusted roles before sign-off. The reset migration's platform prerequisites (`cron.job`, `cron.unschedule(bigint)`, `vault.secrets`, and `supabase_migrations.schema_migrations`) were confirmed present in the current development project, and the connected `postgres` role has the required SELECT/EXECUTE/DELETE privileges. Their presence and privileges on a fresh hosted project remain unverified. Repository-only migration `20261121124410_predrive_enable_pgcrypto.sql`, ordered before the first PIN-hashing migration, explicitly declares `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions`; it is not recorded as applied in the development migration ledger. The extension is already installed in the development database as `extensions.pgcrypto` 1.3. Verify the migration's idempotent behavior and extension placement on the clean hosted project. |
| Analytics views | Five public views; all five have `reloptions = {security_invoker=true}` | RLS-invoker behavior is verified on the current database. Do not report these views as default owner-security views. |
| Realtime publications | `supabase_realtime` exists with no application tables; the separate Supabase-managed `supabase_realtime_messages_publication` contains only `realtime.messages` | Keep the application publication empty until the explicit Realtime contract and required tables are approved; preserve the platform-managed messages publication. |
| pg_cron | Extension `pg_cron` 1.6.4 is installed in `pg_catalog`; zero scheduled jobs | Add jobs in B4 only after their functions and operational requirements are defined. |
| Storage | Zero application buckets and zero application Storage policies; Supabase-managed Storage triggers are present | Configure application buckets and policies in B2; preserve platform-managed Storage triggers and objects. |
| Auth integration | Supabase-managed `auth` schema; exactly one application-owned enabled trigger, `on_auth_user_profile_sync`, on `auth.users`, invoking `private.sync_auth_user_profile()` | Preserve managed Auth objects; verify only the application-owned trigger/function integration. |
| Application policies and grants | Seven policies across five tables; `anon` has no application-table privileges; `authenticated` has SELECT on five tables and narrow column-level UPDATE on profile/school fields; no client INSERT/DELETE | Current deny-by-default staging. Implement the approved role/tenant matrix in B2; review all future grants alongside policies. `postgres` defaults are restricted; `supabase_admin` defaults remain broad only for objects that platform role creates and are accepted as a documented platform exception under the postgres-owner invariant. |

The view security check used `pg_class.reloptions`; all five returned `security_invoker=true`. This supersedes any earlier preliminary concern that the analytics views might be running with owner privileges.

## Entity relationship diagram

Every application table and every database foreign-key relationship is represented below. Key columns are shown; the generated type definition contains all columns.

```mermaid
erDiagram
schools {
  id uuid PK
}
profiles {
  id uuid PK
}
school_memberships {
  id uuid PK
  school_id uuid FK
  user_id uuid
}
staff_members {
  id uuid PK
  school_id uuid FK
  user_id uuid
  role user_role
}
school_invitations {
  id uuid PK
  school_id uuid FK
  invited_by uuid
  accepted_by uuid
}
class_groups {
  id uuid PK
  school_id uuid FK
}
children {
  id uuid PK
  school_id uuid FK
  class_group_id uuid
}
guardian_children {
  id uuid PK
  school_id uuid FK
  guardian_user_id uuid
  child_id uuid
}
approved_collectors {
  id uuid PK
  school_id uuid FK
  child_id uuid
  created_by uuid
}
buses {
  id uuid PK
  school_id uuid FK
}
transport_routes {
  id uuid PK
  school_id uuid FK
  assigned_bus_id uuid
}
route_stops {
  id uuid PK
  school_id uuid FK
  route_id uuid
}
route_schedules {
  id uuid PK
  school_id uuid FK
  route_id uuid
}
trips {
  id uuid PK
  school_id uuid FK
  route_id uuid
  schedule_id uuid
  bus_id uuid
  supervisor_id uuid
  driver_id uuid
  started_by uuid
  ended_by uuid
}
trip_children {
  id uuid PK
  school_id uuid FK
  trip_id uuid
  child_id uuid
  recorded_by uuid
}
trip_events {
  id uuid PK
  school_id uuid FK
  trip_id uuid
  trip_child_id uuid
  actor_user_id uuid
}
bus_positions {
  trip_id uuid
  school_id uuid FK
  bus_id uuid
}
bus_position_history {
  id int8 PK
  school_id uuid FK
  trip_id uuid
  bus_id uuid
}
vehicle_checks {
  id uuid PK
  school_id uuid FK
  bus_id uuid
  trip_id uuid
  checked_by uuid
}
delay_reports {
  id uuid PK
  school_id uuid FK
  trip_id uuid
  reported_by uuid
}
incidents {
  id uuid PK
  school_id uuid FK
  trip_id uuid
  child_id uuid
  reported_by uuid
  resolved_by uuid
}
alerts {
  id uuid PK
  school_id uuid FK
  created_by uuid
  acknowledged_by uuid
  resolved_by uuid
}
alert_recipients {
  id uuid PK
  school_id uuid FK
  alert_id uuid
  recipient_user_id uuid
}
sos_events {
  id uuid PK
  school_id uuid FK
  raised_by uuid
  trip_id uuid
  alert_id uuid
  resolved_by uuid
}
broadcasts {
  id uuid PK
  school_id uuid FK
  created_by uuid
}
fee_items {
  id uuid PK
  school_id uuid FK
}
invoices {
  id uuid PK
  school_id uuid FK
  child_id uuid
  guardian_user_id uuid
  created_by uuid
}
invoice_lines {
  id uuid PK
  school_id uuid FK
  invoice_id uuid
  fee_item_id uuid
}
payments {
  id uuid PK
  school_id uuid FK
  invoice_id uuid
  created_by uuid
}
payment_attempts {
  id uuid PK
  school_id uuid FK
  payment_id uuid
}
bank_transfer_submissions {
  id uuid PK
  school_id uuid FK
  payment_id uuid
  reviewed_by uuid
}
refunds {
  id uuid PK
  school_id uuid FK
  payment_id uuid
  requested_by uuid
  reviewed_by uuid
}
credit_notes {
  id uuid PK
  school_id uuid FK
  invoice_id uuid
  issued_by uuid
}
receipts {
  id uuid PK
  school_id uuid FK
  payment_id uuid
}
settings {
  id uuid PK
  school_id uuid FK
  updated_by uuid
}
consent_records {
  id uuid PK
  school_id uuid FK
  subject_user_id uuid
  child_id uuid
  captured_by uuid
}
device_tokens {
  id uuid PK
  school_id uuid FK
  user_id uuid
}
deletion_requests {
  id uuid PK
  school_id uuid FK
  requested_by uuid
  subject_user_id uuid
  child_id uuid
  reviewed_by uuid
}
setup_progress {
  id uuid PK
  school_id uuid FK
  completed_by uuid
}
audit_log {
  id int8 PK
  school_id uuid FK
  actor_user_id uuid
}
rate_limit_events {
  id int8 PK
  school_id uuid FK
}
webhook_events {
  id uuid PK
  school_id uuid FK
}

  auth.users ||--o{ profiles : "profiles_id_fkey"
  profiles ||--o{ school_memberships : "school_memberships_user_id_fkey"
  schools ||--o{ school_memberships : "school_memberships_school_id_fkey"
  school_memberships ||--o{ staff_members : "staff_members_membership_fkey"
  profiles ||--o{ school_invitations : "school_invitations_invited_by_fkey"
  profiles ||--o{ school_invitations : "school_invitations_accepted_by_fkey"
  schools ||--o{ school_invitations : "school_invitations_school_id_fkey"
  schools ||--o{ class_groups : "class_groups_school_id_fkey"
  schools ||--o{ children : "children_school_id_fkey"
  class_groups ||--o{ children : "children_class_group_school_fkey"
  schools ||--o{ guardian_children : "guardian_children_school_id_fkey"
  children ||--o{ guardian_children : "guardian_children_child_school_fkey"
  school_memberships ||--o{ guardian_children : "guardian_children_guardian_membership_fkey"
  schools ||--o{ approved_collectors : "approved_collectors_school_id_fkey"
  profiles ||--o{ approved_collectors : "approved_collectors_created_by_fkey"
  children ||--o{ approved_collectors : "approved_collectors_child_school_fkey"
  schools ||--o{ buses : "buses_school_id_fkey"
  buses ||--o{ transport_routes : "transport_routes_assigned_bus_school_fkey"
  schools ||--o{ transport_routes : "transport_routes_school_id_fkey"
  schools ||--o{ route_stops : "route_stops_school_id_fkey"
  transport_routes ||--o{ route_stops : "route_stops_route_school_fkey"
  schools ||--o{ route_schedules : "route_schedules_school_id_fkey"
  transport_routes ||--o{ route_schedules : "route_schedules_route_school_fkey"
  schools ||--o{ trips : "trips_school_id_fkey"
  profiles ||--o{ trips : "trips_started_by_fkey"
  profiles ||--o{ trips : "trips_ended_by_fkey"
  transport_routes ||--o{ trips : "trips_route_school_fkey"
  route_schedules ||--o{ trips : "trips_schedule_school_fkey"
  buses ||--o{ trips : "trips_bus_school_fkey"
  staff_members ||--o{ trips : "trips_supervisor_school_fkey"
  staff_members ||--o{ trips : "trips_driver_school_fkey"
  children ||--o{ trip_children : "trip_children_child_school_fkey"
  schools ||--o{ trip_children : "trip_children_school_id_fkey"
  profiles ||--o{ trip_children : "trip_children_recorded_by_fkey"
  trips ||--o{ trip_children : "trip_children_trip_school_fkey"
  schools ||--o{ trip_events : "trip_events_school_id_fkey"
  trip_children ||--o{ trip_events : "trip_events_trip_child_school_trip_fkey"
  trips ||--o{ trip_events : "trip_events_trip_school_fkey"
  profiles ||--o{ trip_events : "trip_events_actor_user_id_fkey"
  schools ||--o{ bus_positions : "bus_positions_school_id_fkey"
  buses ||--o{ bus_positions : "bus_positions_bus_school_fkey"
  trips ||--o{ bus_positions : "bus_positions_trip_school_fkey"
  schools ||--o{ bus_position_history : "bus_position_history_school_id_fkey"
  buses ||--o{ bus_position_history : "bus_position_history_bus_school_fkey"
  trips ||--o{ bus_position_history : "bus_position_history_trip_school_fkey"
  trips ||--o{ vehicle_checks : "vehicle_checks_trip_school_fkey"
  buses ||--o{ vehicle_checks : "vehicle_checks_bus_school_fkey"
  profiles ||--o{ vehicle_checks : "vehicle_checks_checked_by_fkey"
  schools ||--o{ vehicle_checks : "vehicle_checks_school_id_fkey"
  profiles ||--o{ delay_reports : "delay_reports_reported_by_fkey"
  schools ||--o{ delay_reports : "delay_reports_school_id_fkey"
  trips ||--o{ delay_reports : "delay_reports_trip_school_fkey"
  profiles ||--o{ incidents : "incidents_reported_by_fkey"
  children ||--o{ incidents : "incidents_child_school_fkey"
  trips ||--o{ incidents : "incidents_trip_school_fkey"
  profiles ||--o{ incidents : "incidents_resolved_by_fkey"
  schools ||--o{ incidents : "incidents_school_id_fkey"
  profiles ||--o{ alerts : "alerts_acknowledged_by_fkey"
  schools ||--o{ alerts : "alerts_school_id_fkey"
  profiles ||--o{ alerts : "alerts_created_by_fkey"
  profiles ||--o{ alerts : "alerts_resolved_by_fkey"
  schools ||--o{ alert_recipients : "alert_recipients_school_id_fkey"
  alerts ||--o{ alert_recipients : "alert_recipients_alert_school_fkey"
  school_memberships ||--o{ alert_recipients : "alert_recipients_membership_fkey"
  profiles ||--o{ sos_events : "sos_events_raised_by_fkey"
  alerts ||--o{ sos_events : "sos_events_alert_school_fkey"
  schools ||--o{ sos_events : "sos_events_school_id_fkey"
  trips ||--o{ sos_events : "sos_events_trip_school_fkey"
  profiles ||--o{ sos_events : "sos_events_resolved_by_fkey"
  profiles ||--o{ broadcasts : "broadcasts_created_by_fkey"
  schools ||--o{ broadcasts : "broadcasts_school_id_fkey"
  schools ||--o{ fee_items : "fee_items_school_id_fkey"
  children ||--o{ invoices : "invoices_child_school_fkey"
  schools ||--o{ invoices : "invoices_school_id_fkey"
  school_memberships ||--o{ invoices : "invoices_guardian_membership_fkey"
  profiles ||--o{ invoices : "invoices_created_by_fkey"
  fee_items ||--o{ invoice_lines : "invoice_lines_fee_item_school_fkey"
  invoices ||--o{ invoice_lines : "invoice_lines_invoice_school_fkey"
  schools ||--o{ invoice_lines : "invoice_lines_school_id_fkey"
  invoices ||--o{ payments : "payments_invoice_school_fkey"
  profiles ||--o{ payments : "payments_created_by_fkey"
  schools ||--o{ payments : "payments_school_id_fkey"
  schools ||--o{ payment_attempts : "payment_attempts_school_id_fkey"
  payments ||--o{ payment_attempts : "payment_attempts_payment_school_fkey"
  payments ||--o{ bank_transfer_submissions : "bank_transfer_submissions_payment_school_fkey"
  profiles ||--o{ bank_transfer_submissions : "bank_transfer_submissions_reviewed_by_fkey"
  schools ||--o{ bank_transfer_submissions : "bank_transfer_submissions_school_id_fkey"
  profiles ||--o{ refunds : "refunds_reviewed_by_fkey"
  profiles ||--o{ refunds : "refunds_requested_by_fkey"
  schools ||--o{ refunds : "refunds_school_id_fkey"
  payments ||--o{ refunds : "refunds_payment_school_fkey"
  schools ||--o{ credit_notes : "credit_notes_school_id_fkey"
  invoices ||--o{ credit_notes : "credit_notes_invoice_school_fkey"
  profiles ||--o{ credit_notes : "credit_notes_issued_by_fkey"
  schools ||--o{ receipts : "receipts_school_id_fkey"
  payments ||--o{ receipts : "receipts_payment_school_fkey"
  profiles ||--o{ settings : "settings_updated_by_fkey"
  schools ||--o{ settings : "settings_school_id_fkey"
  children ||--o{ consent_records : "consent_records_child_school_fkey"
  profiles ||--o{ consent_records : "consent_records_subject_user_id_fkey"
  schools ||--o{ consent_records : "consent_records_school_id_fkey"
  profiles ||--o{ consent_records : "consent_records_captured_by_fkey"
  schools ||--o{ device_tokens : "device_tokens_school_id_fkey"
  school_memberships ||--o{ device_tokens : "device_tokens_membership_fkey"
  children ||--o{ deletion_requests : "deletion_requests_child_school_fkey"
  profiles ||--o{ deletion_requests : "deletion_requests_subject_user_id_fkey"
  profiles ||--o{ deletion_requests : "deletion_requests_reviewed_by_fkey"
  profiles ||--o{ deletion_requests : "deletion_requests_requested_by_fkey"
  schools ||--o{ deletion_requests : "deletion_requests_school_id_fkey"
  profiles ||--o{ setup_progress : "setup_progress_completed_by_fkey"
  schools ||--o{ setup_progress : "setup_progress_school_id_fkey"
  profiles ||--o{ audit_log : "audit_log_actor_user_id_fkey"
  schools ||--o{ audit_log : "audit_log_school_id_fkey"
  schools ||--o{ rate_limit_events : "rate_limit_events_school_id_fkey"
  schools ||--o{ webhook_events : "webhook_events_school_id_fkey"
```

## Generated types

Generated directly from the connected development database. Source: `frontend/shared/types/database.types.ts`. Regenerate and commit the diff after every schema migration.


## Frontend API contract checkpoint

The exact frontend-facing contract is documented in [API-CONTRACT.md](./API-CONTRACT.md). The current `PreDriveApi` contains 30 operations across auth, school, children, staff, transport, safety and finance. This corrects an earlier planning note that counted 29. The contract currently defines no Realtime subscription methods or event payloads; no Realtime publication tables should be enabled until that contract is explicitly extended.
## B1.6 read-only verification refresh — 2026-11-21

The existing development project was rechecked without making database changes. Catalog counts reconfirmed 42 public application tables with RLS enabled, 37 without policies, seven public policies, five public views with `security_invoker=true`, and 12 migration-ledger entries. The required installed extensions (`pgcrypto`, `postgis`, `pg_cron`, `pg_net`, `supabase_vault`) are present.

Type generation was repeated from the live project. The generated output is exactly 93,685 characters and matches `frontend/shared/types/database.types.ts` byte-for-byte.

Latest advisors: Security reports 37 informational `rls_enabled_no_policy` findings and one `extension_in_public` warning for `pg_net`; Performance reports 149 informational `unused_index` findings; Health reports no findings. The RLS notices reflect the deliberate deny-by-default state before B2. The unused-index notices are not grounds for dropping indexes in a database without representative workload. The `pg_net` warning remains unresolved; it is non-relocatable in this project and must not be moved with `ALTER EXTENSION ... SET SCHEMA`.

This is a refresh of the current-development inventory, not a clean-room replay. PostgREST exposed-schema configuration cannot be read from the SQL catalog; verify in Supabase Dashboard → Settings → API → Exposed schemas that `private` and `net` are not exposed. The `supabase_admin` default-ACL issue is now dispositioned as a documented platform exception under the migration-owner invariant; clean-room replay and live API exposed-schema verification remain outstanding.

## B2.1 helper migration — 2026-11-22

Repository-only migration `20261122153000_predrive_security_helpers.sql` has been committed. It defines six private, `SECURITY DEFINER`, `STABLE` SQL helpers with an empty `search_path` and fully schema-qualified references:

- `private.current_school_ids()` — returns only the caller's active memberships in non-suspended schools.
- `private.is_school_member(uuid)` — checks the caller's active membership in the specified non-suspended school.
- `private.has_role(uuid, public.user_role)` — checks the caller's active membership and exact role in the specified non-suspended school.
- `private.is_guardian_of(uuid)` — checks the caller's active guardian-child link and guardian membership.
- `private.is_assigned_to_trip(uuid)` — checks whether the caller is the active assigned driver or supervisor for the specified trip.
- `private.is_demo_school(uuid)` — returns true only when the caller has an active membership in the specified non-suspended demo school.

All six functions revoke execution from `PUBLIC`, `anon` and the default authenticated grant before granting `EXECUTE` only to `authenticated`. They do not add table grants, RLS policies, data, triggers, or Realtime publication entries. The migration has **not** been applied to the existing development database; its remote effects require a separate explicit approval after review. Existing `private.has_school_role(uuid, public.user_role[])` and `private.can_admin_view_profile(uuid)` are unchanged.

The six helpers are intended as the shared authorization primitives for B2.2–B2.4. The helper migration is additive and does not execute the historical reset migration. The clean-room migration replay remains deferred and B1.6 is not certified complete.


## B2.2 school administration and staff RLS migration — 2026-11-22

Repository-only migration `20261122160000_predrive_admin_staff_rls.sql` has been committed. It is additive and idempotent at the policy level:

- `class_groups`: active school admins can select/insert/update/delete; teachers and supervisors can select class metadata.
- `fee_items`: active school admins can select/insert/update/delete.
- `settings`: active school admins can select/insert/update/delete.
- `setup_progress`: active school admins can select/insert/update/delete.

The migration explicitly enables RLS on these four tables, removes direct `anon` and `authenticated` table grants, then grants authenticated users the CRUD privileges needed for Postgres to evaluate the corresponding RLS policies. It leaves `service_role` privileges unchanged. Every policy checks the authenticated user's active membership and role through the already-applied `private.has_school_role(uuid, public.user_role[])` function; no client-supplied school or user ID is trusted.

This migration does not change children, guardian links, approved collectors, staff records, fleet, trips, GPS, safety, payment records, audit data, or any existing rows. It does not depend on B2.1's new helper functions. The file is committed but has **not** been applied to the development database; live policy and grant verification must follow explicit approval and application.


## B2.3 guardian/child isolation migration — 2026-11-22

Repository-only migration `20261122163000_predrive_guardian_child_rls.sql` has been committed. It enables RLS on `children` and `guardian_children` and adds relationship-aware policies:

- Guardians can select only their own active guardian-child links, after their active `guardian` school membership is verified.
- Guardians can select only child rows connected to one of those active links.
- Guardians can select the class-group row associated with their linked child, not unrelated class groups.
- School admins, teachers and supervisors can select child and guardian-link rows only in schools where they hold an active matching membership.
- Only school admins can directly insert, update or delete child and guardian-link rows.
- Authenticated receives SELECT only on `children` and `guardian_children`; no direct authenticated write grants are introduced by this migration.

The migration reuses the existing, already-applied `private.has_school_role(uuid, public.user_role[])` helper and does not depend on B2.1. The existing class-group CRUD grants/policies from B2.2 remain in place; the guardian class-group SELECT policy is additive.

No child, guardian, membership, school or class data is changed. The migration has been committed but **not applied** to the populated development database. Before remote application, validate policy composition and query plans with authenticated test identities for at least two schools, two guardians, one school admin, one teacher and one supervisor. Also verify that guardian reads cannot reveal unrelated children or links even when a client supplies another child's UUID.


## B2.4 transport, trip and GPS access migration — 2026-11-22

Repository-only migration `20261122170000_predrive_transport_trip_access_rls.sql` has been committed. It enables/retains RLS on fleet, route, trip, GPS and operational tables and defines read access as follows:

- School admins and supervisors can read school-scoped buses, routes, route stops/schedules, trips, trip-child operational records, current bus positions, vehicle checks and delay reports.
- Drivers can read fleet/route context only where a trip assigns that driver; all six driver-facing fleet/trip/GPS policies use `private.is_assigned_to_trip(uuid)`, which requires the matching active driver staff record, active school membership and a non-suspended school.
- Guardians can read an active trip and its current bus position only when an active guardian-child link places their child on that trip. They can read only their own child's trip-child rows.
- Drivers receive no direct `trip_children` access and therefore cannot perform or inspect gate handovers through table reads.
- Authenticated users receive no direct read access to `trip_events`, `approved_collectors` or `bus_position_history`. Collector PIN hashes and detailed event payloads remain behind trusted workflows.
- Authenticated receives SELECT only on the operational tables explicitly listed in the migration. No direct authenticated writes are granted.

The policies use the already-applied `private.has_school_role(uuid, public.user_role[])` helper and exact live enum labels (`active`, `school_admin`, `supervisor`, `driver`, `guardian`). The trip/child/guardian policy dependency is intentionally acyclic: trip-child visibility does not query trips, while trip visibility may safely consult the filtered trip-child rows.

The migration does not delete or modify data, does not publish Realtime tables, and does not grant access to GPS history. It is committed but **not applied** to the development database. Before remote application, validate with separate guardian, driver, supervisor and school-admin identities across at least two schools; explicitly test that an unrelated guardian cannot query a trip ID or bus position and that a driver cannot select trip-child, trip-event or collector records. Confirm that completed/cancelled trips return no current GPS rows.


## B2.5 private Storage migration — 2026-11-22

Repository-only migration `20261122173000_predrive_storage_buckets_rls.sql` has been committed. The five buckets are private and use explicit limits:

| Bucket | Maximum size | Allowed MIME types |
|---|---:|---|
| `incident-photos` | 10 MiB | JPEG, PNG, WebP |
| `payment-proofs` | 10 MiB | JPEG, PNG, WebP, PDF |
| `avatars` | 2 MiB | JPEG, PNG, WebP |
| `receipts` | 10 MiB | PDF |
| `exports` | 25 MiB | CSV, PDF, XLSX |

Object path conventions are encoded in the migration and policies. Incident evidence is school-scoped and uploader-scoped; guardians can upload/read only their own payment-proof path; avatars are user-owned; receipts are readable by the owning guardian or school admin; exports are readable only by the school admin whose user ID is in the path. Receipt and export generation/deletion are reserved for trusted Edge Functions. Incident evidence management is limited to authorized school staff. The migration creates buckets only if absent and fails closed if an existing bucket has different privacy, size or MIME configuration; it never silently overwrites an existing bucket.

A small immutable parser, `private.storage_school_id(text)`, safely returns the first path segment as a UUID or NULL for malformed paths. Its execution is revoked from PUBLIC/anon and granted to authenticated so Storage policies can evaluate school membership without unsafe casts.

Live read-only inspection confirmed the current Storage schema has the required `storage.buckets` columns and defaults, and there are currently zero Storage buckets and zero Storage object policies. The migration has **not** been applied to the development project. After explicit approval and application, test every bucket for unauthenticated denial, cross-school denial, cross-user denial, allowed MIME/size limits, correct upload paths, signed URL access, and service-role Edge Function behavior.


## B2.6 atomic rate limiting and SQL security suite — 2026-11-22

Repository-only migration `20261122180000_predrive_atomic_rate_limiting.sql` adds `private.consume_rate_limit(uuid,text,text,integer,integer)`. It is a `SECURITY DEFINER` function with an empty `search_path`, callable only by `service_role`. It validates the action name, lowercase SHA-256 subject digest, threshold (1–1000) and window (1–86,400 seconds). It obtains a transaction-scoped advisory lock per school/action/subject key, removes expired events for that key, counts attempts in the active window, returns false when the threshold is reached, and inserts accepted attempts. Callers must hash identifying material before passing it; raw PINs, email addresses and IP addresses must not be persisted in `subject_hash`.

The function does not add direct authenticated table access. Existing `rate_limit_events` remains deny-by-default under RLS; the function's owner performs the atomic table operations. Scheduled global cleanup/retention is deferred to B4 automation.

The committed suite `supabase/tests/security/b2_security_acceptance.sql` contains 49 SQL assertions covering policy inventory, RLS enablement, driver/guardian separation, GPS and collector denial, authenticated table grants, private Storage bucket configuration, Storage policy presence, helper execution grants, safe path parsing and rate-limit threshold/validation/isolation behavior. It wraps rate-limit inserts in a transaction and rolls them back. The suite is intended to run after the B2 migrations are applied.

**Coverage limitation:** the 49 checks verify database catalog and rate-limiter behavior but do not yet simulate actual authenticated users across two schools. Seeded row-visibility tests must be added/run with the B5 demo identities before production acceptance. No B2 migration has been applied to the populated development database.
