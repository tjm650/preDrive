# Child-safety pre-launch checklist

This checklist is a review aid, not a child-safety certification, legal opinion or substitute for a school's safeguarding policy. A school safeguarding lead must approve the operating procedure before live transport begins.

## Identity, consent and enrolment

- [ ] Verify each parent/guardian identity through the school's normal enrolment process.
- [ ] Confirm guardian consent for transport, location sharing, emergency contacts and authorised pickup arrangements.
- [ ] Link every child to the correct guardian account; check sibling and cross-school separation.
- [ ] Verify authorised pickup names and PINs with the guardian. Do not reuse one PIN across unrelated families.
- [ ] Ensure staff accounts are individual accounts, not shared logins.

## Route and vehicle readiness

- [ ] Physically inspect each stop, access point, road crossing, pickup/drop-off area and route hazard.
- [ ] Confirm route geometry is provider-calculated and then manually field-checked; provider output alone is not a safety assessment.
- [ ] Confirm vehicle registration, capacity, roadworthiness, insurance and driver eligibility using the school's own process.
- [ ] Confirm the assigned supervisor and emergency contact procedure for each trip.
- [ ] Check that manifest membership and assigned vehicle/route cannot be changed while a trip is active.

## Supervisor trip controls

- [ ] Reconcile each child against the manifest before departure.
- [ ] Record boarding and absence per child.
- [ ] Confirm arrival at school for pickup routes.
- [ ] Confirm the authorised pickup person and PIN before home release.
- [ ] Verify that a failed or unavailable PIN check blocks release.
- [ ] Confirm a child cannot be marked absent after boarding or dropped home without verified handover.
- [ ] Confirm trip completion is blocked while any manifest child remains unaccounted for.

## Emergency and offline behaviour

- [ ] Test SOS and missing-child alerts with school administrators and guardians.
- [ ] Confirm the school has a phone-based fallback if data service or push delivery fails.
- [ ] Test airplane mode, weak connectivity, app backgrounding, device restart and event replay after reconnection.
- [ ] Confirm queued routine events retain their idempotency keys and do not create duplicate records.
- [ ] Confirm the supervisor knows not to rely on a queued SOS/missing-child event as delivered.
- [ ] Confirm the school has a documented procedure for a child who is not at the expected stop or destination.

## Privacy and security

- [ ] Verify parents can access only their own children's records and active-trip location.
- [ ] Verify supervisors can access only assigned trip manifests and necessary guardian contacts.
- [ ] Verify platform-owner access is read-only and school administrators remain tenant-scoped.
- [ ] Confirm pickup PIN hashes are not exposed through client reads or logs.
- [ ] Review location and incident-data retention, access logging, device security and account offboarding.
- [ ] Obtain local privacy and child-safeguarding review for Zimbabwe before production deployment.

## Physical acceptance tests

- [ ] Run a complete pickup trip with test accounts and a real Android device.
- [ ] Run a complete drop-off trip with a successful authorised handover.
- [ ] Test a wrong PIN, unknown pickup person, duplicate handover attempt and offline handover attempt.
- [ ] Test an absent child, an unaccounted child, a missing-child alert and an SOS event.
- [ ] Verify notifications, Realtime updates, push receipts and offline replay end to end.
- [ ] Record test evidence, defects, responsible owner and sign-off date.

**Go-live rule:** Do not use preDrive as the sole safety control until all applicable checks are completed, defects are resolved, and the school safeguarding lead has signed off its own operating procedures.
