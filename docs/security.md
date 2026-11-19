# preDrive security model and threat controls

## Security invariants

1. A parent can read only their own children, related trip events, invoices, notifications and threads.
2. Parents can read live bus location only while a child is on an active route manifest. Parents cannot read historical GPS.
3. Supervisors can read and write only assigned trips and manifest members.
4. School administrators are scoped to their own active school.
5. Platform owners have cross-school read access and platform-level controls, not unrestricted tenant writes.
6. Client-provided metadata never assigns a staff role or tenant.
7. Payment rows cannot be written directly by authenticated clients.
8. Pickup PIN hashes and Paynow polling/checkout URLs are never returned to clients.

## Row-level security

All 29 public application tables have RLS enabled. Policies use private SECURITY DEFINER predicates to avoid recursive policy evaluation. The current security advisor reports no overlapping permissive-policy warnings after policy consolidation.

Private operational tables use no client-facing policies. The exception is `private.push_dispatch_attempts`: the live advisor reports RLS disabled. It has no grants to anon/authenticated and resides in the non-exposed private schema, but should still have RLS enabled.

Proposed final hardening SQL (not yet applied; awaiting explicit approval):

```sql
ALTER TABLE private.push_dispatch_attempts ENABLE ROW LEVEL SECURITY;
```

With RLS enabled and no client policies, anon/authenticated access remains denied. The privileged trigger function and service role continue to perform internal writes.

## Child location threat model

| Threat | Control |
|---|---|
| Parent guesses another child's ID | Guardianship checks and school-scoped RLS |
| Parent reads completed-trip GPS | No parent SELECT policy on `location_history` |
| Unassigned supervisor queries a bus | Assigned-trip predicates |
| School admin from another tenant queries a child | `current_school_id()` and school-admin policy |
| School is suspended while a trip is active | Tenant helper predicates check school lifecycle status |
| GPS updates stop during a trip | 60-second stale-location monitor and admin alert |
| Old GPS accumulates indefinitely | Scheduled 90-day retention purge |
| Route manifest is changed during a run | Database triggers freeze scheduled/active trip assets |

## Identity and privilege escalation

- Profiles are created from `auth.users` by a database trigger.
- New accounts receive the safe parent role.
- School assignment is granted only by trusted provisioning or the join-code RPC.
- A SECURITY INVOKER trigger prevents authenticated callers from changing `profiles.role` or `profiles.school_id`; it trusts the actual database role, not a client-controlled field.
- Join codes are high entropy, hashed, rate-limited, expiry/usage constrained, revocable and audited.

## Pickup PIN protection

- PIN hashes use bcrypt via `pgcrypto`.
- The client can call only `verify_pickup_pin` / `verify_pickup_handover`; it cannot read hashes.
- Attempts are serialized per actor/child, limited to five failed attempts in 15 minutes and audited.
- Revoked pickup permissions never verify.
- Generic trip-event RPCs cannot forge a verified handover.

## Payments

- Authenticated roles have no direct INSERT/UPDATE/DELETE privileges on `payments`.
- Manual reconciliation checks school-admin scope, currency, outstanding balance and unique provider reference.
- Paynow callbacks validate SHA-512 signatures and are reconciled atomically in Postgres.
- Paynow transaction polling/checkout URLs are private to the server role.
- Provider callback reconciliation RPC is service-role-only.

## SECURITY DEFINER RPC review

Supabase's advisor flags 13 authenticated-callable SECURITY DEFINER RPCs. These are intentional because they perform atomic operations that cannot safely run under ordinary table RLS. Each must retain explicit `auth.uid()`, role, school, assigned-trip or PIN checks. Do not grant additional EXECUTE privileges or add new SECURITY DEFINER functions without a review.

## Remaining advisor notices

- `private.push_dispatch_attempts`: RLS must be enabled; proposed SQL above is awaiting approval.
- `pg_net`: Supabase advisor warns the extension is installed in `public`. Its HTTP functions are in schema `net`; relocating the extension needs a dependency review because notification dispatch calls `net.http_post`.
- Unused-index notices are expected on a newly provisioned, empty database and should be re-evaluated after representative traffic.
