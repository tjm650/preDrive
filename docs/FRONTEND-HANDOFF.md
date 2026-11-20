# preDrive frontend handoff

## Scope and decisions

The frontend is a pnpm monorepo with a shared TypeScript package, a Next.js Pages Router school dashboard/marketing site, and an Expo SDK 54 application using Expo Router. The Pages Router is the deliberate implementation choice for this repository, overriding the original brief's App Router reference.

The frontend implementation phase is complete at source level. Backend implementation has started with the identity and school-tenancy foundation; the remaining operational modules, client adapters and end-to-end verification are still outstanding. The frontend must not be described as production-operational until authenticated services, school-scoped data, authorization and real-time integrations have been connected and verified.

## Frontend package boundaries

- `frontend/shared/types`: domain types for identity, schools, children, transport, safety and finance.
- `frontend/shared/lib/api`: typed request inputs, result/error types, pagination and the `PreDriveApi` contract.
- `frontend/shared/lib/auth/permissions.ts`: client-side role/permission presentation helpers. These are not a security boundary.
- `frontend/shared/lib/offline`: offline child check action models and queue-state transitions. Durable storage, sync transport and server reconciliation are not implemented.
- `frontend/shared/tokens`: canonical design tokens.
- `frontend/shared/i18n`: English, Shona and Ndebele resources plus shared i18next provider and language storage contract.
- `frontend/web/pages`: Next.js Pages Router entry points; route-level UI is composed from `frontend/web/components`.
- `frontend/mobile/app`: thin Expo Router route files and role layouts only.
- `frontend/mobile/screens`: all mobile screen implementations, grouped into public, auth, guardian, supervisor, driver and teacher areas.
- `frontend/mobile/components`: reusable UI and role-feature components used by screens.
- `frontend/mobile/src`: application logic such as auth/session boundaries; hooks, state, services and data access belong here as they are implemented.

Expo Router route files should remain thin and re-export the matching screen from `screens/`. Do not put screen implementations in `app/`.

## API contract surface

The shared `PreDriveApi` contract currently groups:

- `auth`: sign-in, sign-out, session retrieval, password reset and school switching.
- `school`: current school retrieval and school settings update.
- `children`: paginated list, detail, create and update.
- `staff`: paginated staff listing.
- `transport`: buses, routes, trips, trip start, child status recording, handover verification and approved collectors.
- `safety`: alerts, incidents, incident creation and SOS.
- `finance`: invoices, payment initiation and receipts.

These are typed frontend contracts only. The initial Supabase migrations now provide the identity and school-tenancy database foundation, but no Supabase client adapter, complete operational data schema, Edge Function or real-time service integration has been delivered yet.

## Backend integration requirements and progress

1. **Identity and tenancy foundation — applied:** schools, profiles, school memberships, staff records and school invitations; Auth profile synchronization; role-aware tenant helper; RLS and explicit grants.
2. Implement Supabase Auth session lifecycle, including secure sign-out, password recovery, expiry handling, school membership switching and role-aware routing.
3. Add the remaining school-owned domain tables with `school_id` and Row Level Security. Treat client-side permission checks as presentation only.
4. Implement the API contract behind trusted adapters. Validate all input on the server; never trust client-supplied role, school scope, payment status or handover result.
5. Implement child check events with unique idempotency keys, server ordering, duplicate protection and conflict reconciliation. Offline events remain visibly pending until server-confirmed.
6. Verify handover PINs only through a rate-limited server RPC. Store only salted hashes; lock after three failed attempts. Never log raw PINs.
7. Limit GPS ingestion and reads to active trips. Enforce guardian/child/route visibility on the server. Stop location sharing when a trip ends.
8. Implement payment initiation and confirmation with idempotency, provider verification, reconciliation, receipts, refunds and immutable audit events. Never trust a client success callback.
9. Deliver safety alerts/SOS through a durable server-side event flow with acknowledgement and escalation semantics.
10. Add audit trails for administrative changes, invitations, child status events, handovers, finance and access-sensitive actions.
11. Keep service-role credentials, gateway secrets and signing keys exclusively in trusted server/Edge Function environments.

## Environment configuration

The Expo public variables are documented in the root README. The Supabase URL and publishable key are not yet wired into the Expo client. Never expose service-role or payment secrets through `EXPO_PUBLIC_*` or any client bundle.

## Localization status

The shared provider supports English, Shona and Ndebele and the landing page has separate localized copy. The language selector is available on the landing page, sign-in flow and Guardian settings. The rest of the mobile and web workspace copy is not yet fully migrated to translation keys. Native-speaker proofreading is required for Shona and Ndebele before production release. Mobile language persistence is session-only until an authenticated profile storage implementation exists.

## Explicitly incomplete frontend integrations

- Authentication/session sources are not connected. Role gates are not a substitute for server authorization.
- School, child, staff, fleet, route, trip, incident and finance data are not loaded from a backend.
- Admin workspace callbacks are not connected to real services.
- Guardian live maps, bus positions, ETA and arrival notifications are not connected.
- Supervisor trip execution, manifest status submission, PIN verification, incident reporting and SOS delivery are not connected.
- Driver vehicle checks, route assignment, delay reporting and SOS delivery are not connected.
- Teacher attendance persistence is not connected.
- Payment providers, transfers, reconciliation and receipts are not connected.
- Offline queue persistence, background synchronization and server conflict resolution are not connected.
- Push notifications, background GPS, map providers, file uploads and observability are not connected.
- Shona and Ndebele need native-speaker review.

No fabricated operational records, simulated payments or fake GPS have been added to the production frontend.

## Verification record

The mobile screen relocation and the first three Supabase database migrations have been committed/applied. Database metadata has been inspected after migration. A local dependency installation, TypeScript check, ESLint run, Next.js production build, Expo export/build, browser test, Android device test, full RLS cross-tenant test and end-to-end test have not yet been run. Do not treat the frontend or backend as release-certified until these checks pass in CI and on supported devices.

## Recommended release gate

- Run `pnpm install --frozen-lockfile`.
- Run `pnpm typecheck` and resolve all errors.
- Run lint and formatting checks.
- Run `pnpm build:web`.
- Run Expo web export and Android development/release builds.
- Test all role routes with both signed-out and authorized sessions.
- Test narrow Android viewports, slow/offline connections, keyboard-only navigation and screen readers.
- Verify every visible string and overflow in English, Shona and Ndebele with native speakers.
- Perform a security review of authorization, RLS, PIN handling, location privacy, payment reconciliation and audit trails before production launch.
