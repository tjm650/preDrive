# preDrive backend batch register

This register tracks the backend implementation plan. B0 is planning/audit work and is not counted as an implementation batch. B1.1–B1.5 are complete. B1.6 remains open; later phases must not begin until B1.6's migration baseline checkpoint is passed.

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
- [ ] B1.6 Documentation, generated types, schema audit and migration-chain verification — 51 FK indexes added in `20261121124613`; historical reset SQL `20261120112956` recovered from the remote migration ledger, restored byte-for-byte to GitHub and verified against `statements[0]`; repository-only pgcrypto dependency migration `20261121130000` added (not applied remotely); all 12 applied ledger statements have been reconciled against repository SQL (normalized SQL text matches, with only comment/whitespace differences in six files). Fresh hosted replay and full acceptance checks remain pending.

B1.6 acceptance checkpoint:
- [ ] Complete full migration replay on a separate empty disposable hosted Supabase project (a preview branch cloned from the populated dev project is not a clean-room replay).
- [ ] All 42 application tables have RLS enabled and the tenant-column audit passes. Current live state: 42 enabled, none FORCE RLS; 37 have no policies by deliberate deny-by-default staging.
- [ ] Remote-vs-replay comparison covers columns, types, defaults, constraints, indexes, enums, functions, triggers, RLS/policies, extensions, publications, cron, Storage and Auth integration objects.
- [ ] Database lint/advisor review passes or every exception is documented and accepted; current review still has an unresolved `pg_net` placement/privilege warning and unused-index notices.
- [ ] Function, trigger, RLS policy, table/column grant, index and default-privilege inventories reconcile against the clean replay; current live state is documented in `BACKEND-SCHEMA.md`. Supabase-managed `supabase_admin` default ACLs in `public` remain an explicit platform exception to resolve or accept.
- [ ] `docs/MIGRATIONS.md` and schema documentation reflect the verified workflow and state.

## B2 — Security and RLS (6 batches)

1. Security-definer helper functions with locked search paths and narrowly scoped grants.
2. School admin and staff RLS policies.
3. Guardian/child relationship isolation.
4. Driver, supervisor, trip and GPS access policies; protect medical notes and collector data.
5. Storage buckets, object paths, MIME/size limits and Storage policies.
6. Database rate limiting and at least 30 SQL security cases, including cross-tenant isolation.

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
- Do not start B2 until B1.6 passes its acceptance checkpoint.
