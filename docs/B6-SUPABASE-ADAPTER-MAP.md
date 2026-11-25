# B6 Supabase Adapter Implementation Map

**Status:** B6.3 discovery complete; adapter implementation not yet complete.
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
| School | getCurrent | `schools` selected only for the active authenticated membership. |
| School | update | Must be an admin-authorized update; only `name`, `address`, `indicative_zig_per_usd` may be written. |
| Children | list, get | `children` joined to `class_groups`; guardian visibility must continue to be enforced by RLS. |
| Children | create | `create_child(p_school_id,p_first_name,p_last_name,p_date_of_birth,p_class_group_id)`; school context is derived by the adapter, never accepted from UI input. |
| Children | update | Requires a confirmed admin-only update policy/operation; do not assume direct UPDATE is permitted. |
| Staff | list | `staff_members` joined to `profiles`; role is restricted to supervisor, driver or teacher in the shared type. |
| Transport | listBuses | `buses`. |
| Transport | createBus, updateBus | Requires confirmation of table write policies and audit requirements before direct writes are implemented. |
| Transport | listRoutes | `transport_routes` with ordered `route_stops`; geography is returned as GeoJSON/WKT only through an explicit supported projection. |
| Transport | createRoute, updateRoute | Parent route and stops need a transactional RPC; no partial multi-request route writes. |
| Transport | listTrips | `trips` joined to required route/bus/staff display data; RLS scopes the rows. |
| Transport | startTrip | `start_trip(p_school_id,p_trip_id,p_started_at)`. |
| Transport | recordChildStatus | `record_child_status(p_school_id,p_trip_id,p_child_id,p_recorded_at,p_idempotency_key,p_status)`. The contract must distinguish boarding from alighting before mapping the enum. |
| Transport | verifyHandover | `verify_handover(p_school_id,p_trip_id,p_child_id,p_collector_id,p_pin)`; PIN is sent only to the RPC over TLS and never stored client-side. |
| Transport | listApprovedCollectors | `list_approved_collectors(p_school_id,p_child_id)`; RPC result excludes PIN hash and lock internals. |
| Safety | listAlerts | `alerts` joined to `alert_recipients`; recipient IDs must be limited to the signed-in user's school/recipient scope. |
| Safety | listIncidents | `incidents`. |
| Safety | createIncident | `create_incident(p_school_id,p_title,p_description,p_severity,p_trip_id,p_child_id)`. |
| Safety | raiseSos | `raise_sos(p_school_id,p_trip_id)`; the current RPC does not accept client coordinates. Do not silently add coordinates to an unsupported RPC. |
| Finance | listInvoices | `invoices` with `invoice_lines`; map integer minor units to the shared `Money` type only after confirming currency scale. |
| Finance | initiatePayment | `initiate_payment(p_school_id,p_invoice_id,p_amount_minor,p_currency,p_method,p_idempotency_key)`; never call the provider from the client. |
| Finance | getReceipt | `receipts` by payment ID, with document access mediated by a short-lived authorized Storage URL if a file is required. |

## Live schema facts confirmed

- The inspected public tables have RLS enabled, including tenant, child, staff, transport, safety and finance tables.
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

## Dependency and app bootstrap gate

The pnpm workspace lockfile does not currently contain `@supabase/supabase-js`, and neither app manifest declares it. The shared runtime deliberately accepts an injected client, so the SDK belongs in app packages. App-level integration remains blocked until pnpm can generate and commit a verified lockfile. Do not hand-author lockfile package snapshots or integrity hashes.

## Next implementation order

1. Fix the two API contract mismatches (child status and SOS coordinates) only after confirming the intended product behavior and updating shared tests.
2. Implement typed, sanitized Supabase query/error helpers and read-only list/get operations.
3. Add transactional RPCs or approved existing RPC paths for writes; verify every RPC argument against its live signature.
4. Add app SDK dependency and platform-specific client persistence once a real pnpm install is available.
5. Run workspace typecheck, lint/format checks, RLS tests, adapter contract tests and an authenticated end-to-end smoke test.
