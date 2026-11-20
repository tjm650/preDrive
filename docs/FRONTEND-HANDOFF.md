# preDrive frontend handoff

## Scope and decisions

The frontend is a pnpm monorepo with a shared TypeScript package, a Next.js Pages Router school dashboard/marketing site, and an Expo SDK 54 application using Expo Router. The Pages Router is the deliberate implementation choice for this repository, overriding the original brief's App Router reference.

All operational backend work is intentionally deferred. The frontend must not be described as operational until authenticated services, school-scoped data, authorization and real-time integrations have been connected and verified.

## Frontend package boundaries

- `frontend/shared/types`: domain types for identity, schools, children, transport, safety and finance.
- `frontend/shared/lib/api`: typed request inputs, result/error types, pagination and the `PreDriveApi` contract.
- `frontend/shared/lib/auth/permissions.ts`: client-side role/permission presentation helpers. These are not a security boundary.
- `frontend/shared/lib/offline`: offline child check action models and queue-state transitions. Durable storage, sync transport and server reconciliation are not implemented.
- `frontend/shared/tokens`: canonical design tokens.
- `frontend/shared/i18n`: English, Shona and Ndebele resources plus shared i18next provider and language storage contract.
- `frontend/web`: Pages Router landing, sign-in boundary and school administration workspaces.
- `frontend/mobile`: Expo Router guardian, supervisor, driver and teacher workspaces.

## API contract surface

The shared `PreDriveApi` contract currently groups:

- `auth`: sign-in, sign-out, session retrieval, password reset and school switching.
- `school`: current school retrieval and school settings update.
- `children`: paginated list, detail, create and update.
- `staff`: paginated staff listing.
- `transport`: buses, routes, trips, trip start, child status recording, handover verification and approved collectors.
- `safety`: alerts, incidents, incident creation and SOS.
- `finance`: invoices, payment initiation and receipts.

These are typed frontend contracts only. No Supabase adapter, database schema, Edge Function, RPC or real API implementation is delivered in the frontend phase.

## Backend integration requirements

1. Implement Supabase Auth and session lifecycle, including secure sign-out, password recovery, expiry handling, school membership switching and role-aware routing.
2. Add `school_id` to every school-owned table and enforce Row Level Security for every table. Treat client-side permission checks as presentation only.
3. Implement the API contract behind trusted adapters. Validate all input on the server; never trust client-supplied role, school scope, payment status or handover result.
4. Implement child check events with unique idempotency keys, server ordering, duplicate protection and conflict reconciliation. Offline events remain visibly pending until server-confirmed.
5. Verify handover PINs only through a rate-limited server RPC. Store only salted hashes; lock after the agreed failed-attempt threshold. Never log raw PINs.
6. Limit GPS ingestion and reads to active trips. Enforce guardian/child/route visibility on the server. Stop location sharing when a trip ends.
7. Implement payment initiation and confirmation with idempotency, provider verification, reconciliation, receipts, refunds and immutable audit events. Never trust a client success callback.
8. Deliver safety alerts/SOS through a durable server-side event flow with acknowledgement and escalation semantics.
9. Add audit trails for administrative changes, invitations, child status events, handovers, finance and access-sensitive actions.
10. Keep service-role credentials, gateway secrets and signing keys exclusively in trusted server/Edge Function environments.

## Environment configuration

The Expo public variables are documented in the root README. The Supabase URL and publishable key are intentionally inactive until backend integration. Never expose service-role or payment secrets through `EXPO_PUBLIC_*` or any client bundle.

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

The source changes were committed directly to `main` and selected files were retrieved from GitHub after commits. A local dependency installation, TypeScript check, ESLint run, Next.js production build, Expo export/build, browser test, Android device test, accessibility audit and end-to-end test have not been run in this environment. Do not treat the frontend as release-certified until these checks pass in CI and on supported devices.

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
