# B6 Supabase Adapter Implementation Map

**Status:** B6 source adapters and both platform client bootstraps implemented; production web deployment is READY and workspace TypeScript checks pass. Authenticated end-to-end verification and secure read access for several RLS-protected domains remain release gates.
**Source of truth:** `BRIEF.md`, `frontend/shared/lib/api/contract.ts`, shared domain types, and the live development database schema inspected read-only on 25 November 2026.

## Security invariants

1. The browser/mobile client uses only a Supabase publishable key (or legacy anon key where required). A service-role/secret key is prohibited.
2. The adapter never accepts a caller-provided `schoolId`. The active school is derived from the authenticated session and verified membership; Postgres RLS remains the final enforcement layer.
3. Every query runs with the user's Supabase JWT. Do not use a privileged server client to service normal tenant reads.
4. PIN verification, payment initiation, child status recording, trip lifecycle, SOS and other security-sensitive state transitions use their database RPCs. Do not replace them with multi-step client-side table writes.
5. Do not read or expose `approved_collectors.pin_hash`, failed-attempt counters, lock timestamps, payment request hashes, provider secrets, or raw notification provider responses.
6. Return sanitized `ApiError` values. Never return raw Postgres/provider messages to the UI.
7. All paginated reads use a stable order plus an exact count and a bounded range; page size is validated against the shared maximum.

## Contract-to-database map

| API area | Contract operation | Database implementation |
|---|---|---|
| Auth | signIn, signOut, getSession, requestPasswordReset, switchSchool | Existing `SupabaseAuthPort` + `AuthSessionService`; profile, memberships and school reads are RLS-bound. |
| School | getCurrent | Implemented:  `schools` selected only for the active authenticated membership. |
| School | update | Must be an admin-authorized update; only `name`, `address`, `indicative_zig_per_usd` may be written. |
| Children | list, get | Implemented:  `children` joined to `class_groups`; guardian visibility must continue to be enforced by RLS. |
| Children | create | Implemented:  `create_child(p_school_id,p_first_name,p_last_name,p_date_of_birth,p_class_group_id)`; school context is derived by the adapter, never accepted from UI input. |
| Children | update | Implemented: direct update guarded by the existing school-admin RLS policy; no caller-supplied school ID. |
| Staff | list | Implemented:  `staff_members` joined to `profiles`; role is restricted to supervisor, driver or teacher in the shared type. |
| Transport | listBuses | Implemented:  `buses`. |
| Transport | createBus, updateBus | Requires confirmation of table write policies and audit requirements before direct writes are implemented. |
| Transport | listRoutes | Implemented:  `transport_routes` with ordered `route_stops`; geography is returned as GeoJSON/WKT only through an explicit supported projection. |
| Transport | createRoute, updateRoute | Parent route and stops need a transactional RPC; no partial multi-request route writes. |
| Transport | listTrips | Implemented read projection. Rows with a null supervisor_id cannot map to required Trip.supervisorId and fail closed; contract mismatch remains. `trips` joined to required route/bus/staff display data; RLS scopes the rows. |
| Transport | startTrip | Implemented:  `start_trip(p_school_id,p_trip_id,p_started_at)`. |
| Transport | recordChildStatus | Implemented for boarding only: sends p_status = on_board. The input cannot express absent or alighting. `record_child_status(p_school_id,p_trip_id,p_child_id,p_recorded_at,p_idempotency_key,p_status)`. The contract must distinguish boarding from alighting before mapping the enum. |
| Transport | verifyHandover | Implemented:  `verify_handover(p_school_id,p_trip_id,p_child_id,p_collector_id,p_pin)`; PIN is sent only to the RPC over TLS and never stored client-side. |
| Transport | listApprovedCollectors | Implemented:  `list_approved_collectors(p_school_id,p_child_id)`; RPC result excludes PIN hash and lock internals. |
| Safety | listAlerts | Implemented:  `alerts` joined to `alert_recipients`; recipient IDs must be limited to the signed-in user's school/recipient scope. |
| Safety | listIncidents | Implemented:  `incidents`. |
| Safety | createIncident | Implemented:  `create_incident(p_school_id,p_title,p_description,p_severity,p_trip_id,p_child_id)`. |
| Safety | raiseSos | Implemented only when coordinates are omitted; coordinate-bearing requests fail validation. `raise_sos(p_school_id,p_trip_id)`; the current RPC does not accept client coordinates. Do not silently add coordinates to an unsupported RPC. |
| Finance | listInvoices | Implemented: minor-unit conversion currently uses 100:1; currency scale still needs accounting acceptance. `invoices` with `invoice_lines`; map integer minor units to the shared `Money` type only after confirming currency scale. |
| Finance | initiatePayment | Implemented: creates pending simulated/manual payments only; does not represent provider settlement. `initiate_payment(p_school_id,p_invoice_id,p_amount_minor,p_currency,p_method,p_idempotency_key)`; never call the provider from the client. |
| Finance | getReceipt | Implemented: receipt lookup; returns NOT_FOUND until issued. `receipts` by payment ID, with document access mediated by a short-lived authorized Storage URL if a file is required. |

## Live schema facts confirmed

- The inspected public tables have RLS enabled. However, the live security advisor and `pg_policies` inspection found no authenticated policies on `alerts`, `alert_recipients`, `incidents`, `invoices`, `invoice_lines`, `payments` and `receipts` (among 21 tables total). RLS therefore denies direct authenticated reads from these tables. The adapter now fails closed for alert, incident, invoice and receipt reads instead of presenting an empty result or false NOT_FOUND. Safe read RPCs/policies must be added before enabling those reads.
- Tenant root is `schools`; memberships are in `school_memberships`; user profiles are in `profiles`.
- Children are linked to `class_groups`; guardian relationships are represented by `guardian_children`.
- Routes use `transport_routes` and `route_stops`; stop coordinates are stored as PostGIS `geography`.
- Trips are linked to buses, routes, drivers and optional supervisors.
- Approved collector PIN hashes and lockout counters exist only in `approved_collectors`; the public list RPC returns a safe projection.
- Invoice and payment amounts are stored as integer minor units; currency is an enum.
- RPCs exist for trip start/end, child status, handover verification, SOS, incidents, approved collectors, payment initiation and alert acknowledgement.
- The current `raise_sos` RPC signature accepts school and trip IDs only; coordinates are not part of that function signature.

## Contract gaps and implementation decisions required

- `ChildTripStatus` includes `not_boarded | on_board | dropped_off | absent`, but `ChildStatusInput` has no status field. The database RPC requires `p_status`. The adapter must not guess a state from context. This is a shared contract defect to resolve before that method can be implemented.
- `raiseSos` exposes optional latitude/longitude, but the database RPC does not accept them. The adapter must not discard them silently. Either a separate safe location RPC or a contract change is required.
- Route create/update needs a transaction-safe RPC for route plus ordered stops. Do not simulate a transaction with independent browser writes.
- Bus create/update and child update need confirmed authorization and audit semantics; do not infer policies from table shape alone.
- `getReceipt` must define behavior when a payment is pending or no receipt exists yet.
- `PaymentMethod` includes `card`; product brief names CBZ, CABS and EcoCash for Zimbabwe demo payments. Unsupported real payment processing remains simulated and must not be represented as a live gateway.

## App bootstrap and current deployment state

- Added Supabase JS, SSR, Expo SecureStore and URL polyfill dependency resolution through pnpm CI. The workflow now commits generated manifests and lockfile before validation so later jobs install the same dependency graph.
- Added native Expo Supabase client with SecureStore persistence and Next.js Pages Router browser/server clients using cookie-backed SSR sessions.
- Added unified SupabaseAdapter implementing the shared PreDriveApi contract and platform factories at frontend/mobile/src/lib/api.ts and frontend/web/lib/api.ts.
- Mobile sign-in and password reset forms call the shared API; the root auth provider reads Supabase sessions and role routing includes teachers.
- Web sign-in and password reset forms call the shared API. Dashboard login accepts school-admin membership only.
- The Vercel web project has NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY configured for Production, Preview and Development. No secret/service-role credential was added.
- Expo EAS development and preview build profiles now receive EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from eas.json. Local Expo development still requires the same values in frontend/mobile/.env.local or the shell environment.
- No Supabase schema or production records were changed as part of B6 adapter implementation.

## Remaining release gates

1. Confirm CI has committed the real dependency manifests and lockfile, then pass workspace typecheck and web production build.
2. Configure Expo EAS public environment variables and run a development build; Expo Go cannot fully validate native SecureStore-backed session behavior.
3. Add a password-reset completion screen and verify the recovery redirect flow.
4. Add secure, role-scoped read RPCs or reviewed RLS policies for alerts, incidents, invoices and receipts; current direct reads fail closed because those tables have no authenticated policies.
5. Resolve ChildStatusInput so absent/alighting events can be expressed; the current adapter implements boarding only.
6. Resolve nullable database trips.supervisor_id versus required shared Trip.supervisorId.
7. Implement transactional route/bus mutations and audit semantics; the adapter currently fails closed for those methods.
8. Confirm SOS coordinate handling, currency minor-unit scale and receipt issuance semantics with end-to-end tests; add authenticated RLS tests for each role, adapter contract tests, and mobile/web sign-in smoke tests.

Do not claim B6 complete until these gates pass.
