# preDrive database schema

The deployed schema is maintained by ordered SQL migrations in `supabase/migrations`. Primary keys are UUIDs unless a provider/system table requires another type. Timestamps use UTC; school-local presentation uses the school's `Africa/Harare` timezone.

## Enums

- `user_role`: parent, supervisor, school_admin, platform_owner
- `trip_status`: scheduled, active, completed, cancelled
- `route_type`: pickup, dropoff
- `trip_event_type`: boarded, arrived_school, dropped_home, absent, sos, delay, handover_rejected, handover_verified, child_missing
- `notification_priority`: low, normal, high, critical
- `invoice_status`: draft, pending, paid, overdue, void
- `incident_status`: open, investigating, resolved, closed
- `subscription_status`: trialing, active, past_due, cancelled, expired

## Public tables

### Tenant and identity
- `schools`: tenant profile, contact details, timezone and lifecycle status.
- `profiles`: Auth-linked user profile, school assignment, role, language and Expo token.
- `guardianships`: parent-to-child relationship.
- `authorized_pickups`: named pickup permissions, bcrypt PIN hash and active/revoked state.

### Fleet and trips
- `buses`: school vehicles, capacity and active/archive state.
- `routes`: pickup/drop-off route, geometry and field-check provenance.
- `stops`: ordered geographic stops.
- `route_children`: route manifest and assigned stop.
- `trips`: scheduled/active/completed vehicle and supervisor run.
- `trip_events`: idempotent child/trip event ledger.
- `bus_live`: one current location per trip.
- `location_history`: historical GPS points, retained for 90 days.
- `absences`: dated absence reports.

### Communication and safety
- `notifications`: recipient, priority, translation keys, parameters and acknowledgement state.
- `threads`, `thread_members`, `messages`: tenant-scoped messaging.
- `incidents`: school safety incident records.
- `audit_log`: sensitive-operation audit history.

### Billing and platform
- `subscriptions`: school plan and renewal state.
- `invoices`: guardian billing records.
- `payments`: reconciled manual/provider payment ledger.
- `paynow_transactions`: server-only Paynow checkout and polling metadata.
- `app_settings`: school-level currency and operational settings.
- `demo_requests`: validated public demo enquiry workflow.
- `push_receipts`: Expo push delivery receipts.
- `staff_invitations`, `parent_invitations`: school-scoped invitation ledger.

## Private operational tables

The `private` schema contains rate-limit, PIN-attempt, join-code, stale-location and push-dispatch state. These tables are not part of the public Data API. Access is through trusted database functions only.

**Outstanding security action:** the live security advisor reports RLS disabled on `private.push_dispatch_attempts`. The table is in the non-exposed private schema and has no client grants, but RLS should be enabled. See [security](security.md); this final hardening statement has deliberately not been applied pending explicit approval.

## Important constraints and indexes

- Child home radius is limited to 500, 1,000 or 2,000 metres.
- Guardian/child, route/child, route/stop, trip/bus/supervisor and thread/member relationships are checked for same-school integrity.
- Active/scheduled trips freeze route manifests, stops, route type/archive state, bus availability and child archive state.
- Trip-event idempotency uses a unique trip/key index.
- Payment provider references and idempotency keys are unique within invoice/provider scope.
- Foreign-key indexes cover school, guardian, trip, notification and invitation lookups.

## RPCs

The client-facing RPCs include `start_trip`, `end_trip`, `complete_trip`, `record_trip_event`, `verify_pickup_pin`, `verify_pickup_handover`, `join_school_with_code`, `create_school_join_code`, `revoke_school_join_code`, `register_push_token`, `create_child_with_guardian`, `record_manual_payment` and `verify_route_field_check`.

Privileged provider callback reconciliation is performed by `apply_paynow_callback`, executable only by `service_role`.
