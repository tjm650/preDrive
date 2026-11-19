# preDrive

A school-transport safety platform for creches and pre-schools in Zimbabwe. The repository uses a pnpm workspace under `frontend/` and Supabase for authentication, data, realtime and server-side workflows.

> **Safety status:** This is an active development build, not a certified safety-critical production system. Do not onboard real children or use it for live journeys until the outstanding launch gates are completed and independently reviewed.

## Repository layout

- `frontend/apps/mobile` — Expo SDK 58 parent and supervisor app, trip operations, background location, push registration and SQLite offline queue
- `frontend/apps/web` — Next.js landing page, authenticated dashboard and school operations workspace
- `frontend/packages/shared` — strict TypeScript types, geo utilities, constants and en/sn/nd strings
- `supabase/migrations` — versioned Postgres schema, RLS, tenant integrity, trip RPCs and push/route provenance
- `supabase/functions` — push delivery, receipt checks, staff invitations and OpenRouteService road geometry
- `supabase/tests` — pgTAP tenant-isolation tests
- `supabase/seed.sql` — fictional Harare demo school, auth identities, children and trip history

## Prerequisites

- Node.js 22.13+
- pnpm 10
- Docker Desktop / Docker Engine
- Supabase CLI v2.122.1 or compatible current stable
- Expo CLI through the local Expo package
- Git

## Local setup

1. Clone and install:

   ```sh
   git clone https://github.com/tjm650/preDrive.git
   cd preDrive
   corepack enable
   pnpm install
   ```

2. Start local Supabase and apply schema + fictional seed:

   ```sh
   supabase start
   supabase status
   supabase db reset
   ```

3. Copy environment templates:

   ```sh
   cp frontend/apps/mobile/.env.example frontend/apps/mobile/.env
   cp frontend/apps/web/.env.example frontend/apps/web/.env.local
   cp supabase/.env.example supabase/.env
   ```

   Use the local URL and publishable/anon key printed by `supabase status`. Never commit real credentials. The service-role key is server-only and must never be prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

4. Generate schema-derived TypeScript types after the local database is up:

   ```sh
   pnpm db:types
   ```

5. Run checks:

   ```sh
   supabase test db
   pnpm lint
   pnpm format:check
   pnpm typecheck
   pnpm --filter @predrive/web build
   pnpm --filter @predrive/mobile exec expo export --platform android
   ```

6. Start the apps in separate terminals:

   ```sh
   pnpm --filter @predrive/mobile start
   pnpm --filter @predrive/web dev
   ```

## Demo accounts

The local seed creates these Auth users and matching profiles:

| Role | Email |
| --- | --- |
| Supervisor | `supervisor@predrive.test` |
| Driver profile | `driver@predrive.test` |
| Parent | `parent@predrive.test` |
| School admin | `admin@predrive.test` |
| Platform owner | `owner@predrive.test` |

Shared local-only password: `PreDrive-Demo-2026!`. These are public demo credentials. Never use them in staging or production. Reset them before sharing a demo environment.

## Mobile capabilities

- Parents can see active trips carrying their own children, last available vehicle coordinates and child-specific trip events. Parents can report an absence.
- Supervisors can start assigned scheduled trips, record boarding/absence/arrival/drop-off, verify the selected authorised pickup person with a PIN, send an SOS event and complete trips.
- The database rejects trip completion until every child on the manifest has a final status. On drop-off routes, the authorised pickup PIN must be verified before a child can be marked as released.
- Trip events are queued in local SQLite while offline and replayed in order using idempotency keys. Permanent server rejections are retained in a local review queue instead of being silently discarded; unresolved events block trip completion. The latest vehicle location is retained for retry.
- Realtime subscriptions refresh trip events, trip state, vehicle location and notifications.
- Android location tracking requests foreground and background permissions and uses an Android foreground location service. If background permission is denied, the supervisor must keep the app open. Force-stopping the app, revoked permissions, device power settings and network loss can still interrupt location delivery.
- SOS and pickup PIN verification require a live connection. If SOS cannot be sent, the app instructs the supervisor to contact the school's emergency contact immediately. A queued event is not an emergency notification.

For Expo push registration and native modules, initialise/link the Expo project from `frontend/apps/mobile` with `eas init`. Copy the generated project UUID to `EXPO_PUBLIC_EAS_PROJECT_ID` in the mobile environment; EAS also writes the same UUID to `expo.extra.eas.projectId` in `app.json`. Build the Android development client with `eas build --profile development --platform android`. Rebuild after adding native Expo modules or changing app plugins/permissions. The `development` and `preview` profiles are internal Android APK builds; no production build is triggered by CI.

## School operations workspace

Open `/dashboard/operations` as a school administrator to manage children, vehicles, routes and ordered stops, assign children to routes, schedule trips, issue/void invoices, reconcile externally verified manual payments, and invite parents, supervisors or additional school administrators. Child, vehicle and route archival is soft archival; records are not physically deleted from the operational history.

Manual payment reconciliation records a receipt/reference supplied by the school administrator and must only be used after independently verifying the payment through the bank, mobile-money operator or other payment channel. Automated provider callbacks, refunds and payment-provider integration are not implemented yet.

## Supabase Edge Functions

Deploy the functions after reviewing the target project and setting secrets:

```sh
supabase functions deploy send-push
supabase functions deploy check-push-receipts
supabase functions deploy invite-staff
supabase functions deploy invite-parent
supabase functions deploy build-route-geometry

supabase secrets set \
  NOTIFICATION_WEBHOOK_SECRET='a-long-random-secret' \
  SITE_URL='https://YOUR_WEB_APP_DOMAIN' \
  OPENROUTESERVICE_API_KEY='YOUR_OPENROUTESERVICE_KEY' \
  EXPO_ACCESS_TOKEN='YOUR_EXPO_ACCESS_TOKEN'
```

Supabase injects the project URL, anon key and service-role key into the Edge Function runtime. The staff/parent invitation and route-geometry functions verify the caller's bearer token and require the anon key. The Expo access token is optional if your Expo project does not require authenticated push requests.

The notification trigger runs inside Postgres, so it cannot read Edge Function secrets directly. In the Supabase SQL Editor, add the matching project URL and webhook secret to **Vault** (use the same random value as `NOTIFICATION_WEBHOOK_SECRET` above):

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SAME_RANDOM_WEBHOOK_SECRET', 'notification_webhook_secret');
```

Do not commit these values. The database trigger uses Vault to enqueue `send-push` through `pg_net`; the receipt checker runs every 15 minutes through `pg_cron`.

Configure a Database Webhook for INSERT on `public.notifications`, targeting `send-push` and sending the matching `x-webhook-secret` header. Schedule `check-push-receipts` at least every 15 minutes with the same secret header. It checks Expo receipts and clears tokens reported as `DeviceNotRegistered`.

The mobile app registers its Expo push token using the authenticated `register_push_token` RPC; the token is not readable through the client profile API.

### Push notification verification

The app registers Expo push tokens and the database creates recipient-specific notification rows. The `send-push` Edge Function sends each new row to Expo; `check-push-receipts` checks delivery receipts every 15 minutes.

After migrations have been deployed and reviewed:

1. In Supabase **Edge Functions → Secrets**, set `NOTIFICATION_WEBHOOK_SECRET` to a newly generated random value. Use that same value in Vault. Never commit it or paste it into source control.
2. In the Supabase SQL Editor, store the project URL and matching webhook secret in Vault:

   ```sql
   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
   select vault.create_secret('YOUR_SAME_RANDOM_WEBHOOK_SECRET', 'notification_webhook_secret');
   ```

3. Deploy `send-push` and `check-push-receipts`.
4. Set `SITE_URL` to the deployed web-app origin for invitation functions. Set `EXPO_ACCESS_TOKEN` if the Expo project uses authenticated push access.
5. Register a real test device's Expo push token and insert a test notification for that user. Inspect Edge Function logs, the private dispatch-attempt record and `public.push_receipts`.

The database trigger uses `pg_net` for asynchronous dispatch, so notification inserts do not wait for Expo. Missing Vault configuration and enqueue failures are recorded without blocking the notification transaction. Receipt polling is scheduled through `pg_cron`.

A queued pg_net request means only that the HTTP request was enqueued, not that Expo delivered it. Expo receipts can report device unregistration; the worker clears invalid tokens. Verify the function logs and receipt status before treating delivery as healthy. Physical-device tests, background permission checks and a full delivery/receipt test are required before operational use. Push is supplemental and must never be the only emergency channel.

## Road routing

The route editor stores ordered stops. Once at least two stops have valid coordinates, a school administrator can request road geometry through `build-route-geometry`. It calls the OpenRouteService Directions GeoJSON endpoint and stores the returned LineString, distance, duration, provider and verification timestamp.

A `provider_verified` status means the routing provider returned a road route for the supplied stops. It does **not** mean a school operator has inspected the stops or driven the route. Stop accessibility, road conditions, safe boarding locations and child handover points must still be checked in person. If the provider cannot route a Zimbabwean road segment, the route remains unverified.

## Security model

- RLS is enabled for exposed public tables; role and school scope are derived from the authenticated profile, never user-editable user metadata.
- Tenant relationships are validated in database triggers.
- Parents see only their own children, relevant trip events and active trip location/route/vehicle metadata.
- Supervisors are limited to assigned trips and manifests; trip events must refer to children on that manifest.
- Child-release events on drop-off routes require a successful PIN verification for the selected authorised pickup person.
- Trip state changes and trip event creation use narrow security-definer RPCs. Client sessions cannot directly edit trip-event history.
- School administrators are school-scoped; platform owners have cross-school read access but not school-admin write privileges.
- Pickup PIN hashes and Expo push tokens are not selectable through the client API. PIN attempts are throttled and audited.
- Realtime publication membership does not replace RLS; clients subscribe with authenticated sessions.

## Child-safety pre-launch checklist

This checklist is a review aid, not a child-safety certification, legal opinion or substitute for a school's safeguarding policy. A school safeguarding lead must approve the operating procedure before live transport begins.

### Identity, consent and enrolment

- [ ] Verify each parent/guardian identity through the school's normal enrolment process.
- [ ] Confirm guardian consent for transport, location sharing, emergency contacts and authorised pickup arrangements.
- [ ] Link every child to the correct guardian account; check sibling and cross-school separation.
- [ ] Verify authorised pickup names and PINs with the guardian. Do not reuse one PIN across unrelated families.
- [ ] Ensure staff accounts are individual accounts, not shared logins.

### Route and vehicle readiness

- [ ] Physically inspect each stop, access point, road crossing, pickup/drop-off area and route hazard.
- [ ] Confirm route geometry is provider-calculated and then manually field-checked; provider output alone is not a safety assessment.
- [ ] Confirm vehicle registration, capacity, roadworthiness, insurance and driver eligibility using the school's own process.
- [ ] Confirm the assigned supervisor and emergency contact procedure for each trip.
- [ ] Check that manifest membership and assigned vehicle/route cannot be changed while a trip is active.

### Supervisor trip controls

- [ ] Reconcile each child against the manifest before departure.
- [ ] Record boarding and absence per child.
- [ ] Confirm arrival at school for pickup routes.
- [ ] Confirm the authorised pickup person and PIN before home release.
- [ ] Verify that a failed or unavailable PIN check blocks release.
- [ ] Confirm a child cannot be marked absent after boarding or dropped home without verified handover.
- [ ] Confirm trip completion is blocked while any manifest child remains unaccounted for.

### Emergency and offline behaviour

- [ ] Test SOS and missing-child alerts with school administrators and guardians.
- [ ] Confirm the school has a phone-based fallback if data service or push delivery fails.
- [ ] Test airplane mode, weak connectivity, app backgrounding, device restart and event replay after reconnection.
- [ ] Confirm queued routine events retain their idempotency keys and do not create duplicate records.
- [ ] Confirm the supervisor knows not to rely on a queued SOS/missing-child event as delivered.
- [ ] Confirm the school has a documented procedure for a child who is not at the expected stop or destination.

### Privacy and security

- [ ] Verify parents can access only their own children's records and active-trip location.
- [ ] Verify supervisors can access only assigned trip manifests and necessary guardian contacts.
- [ ] Verify platform-owner access is read-only and school administrators remain tenant-scoped.
- [ ] Confirm pickup PIN hashes are not exposed through client reads or logs.
- [ ] Review location and incident-data retention, access logging, device security and account offboarding.
- [ ] Obtain local privacy and child-safeguarding review for Zimbabwe before production deployment.

### Physical acceptance tests

- [ ] Run a complete pickup trip with test accounts and a real Android device.
- [ ] Run a complete drop-off trip with a successful authorised handover.
- [ ] Test a wrong PIN, unknown pickup person, duplicate handover attempt and offline handover attempt.
- [ ] Test an absent child, an unaccounted child, a missing-child alert and an SOS event.
- [ ] Verify notifications, Realtime updates, push receipts and offline replay end to end.
- [ ] Record test evidence, defects, responsible owner and sign-off date.

**Go-live rule:** Do not use preDrive as the sole safety control until all applicable checks are completed, defects are resolved, and the school safeguarding lead has signed off its own operating procedures.

## Operations runbook

This runbook is an operational starting point for a school using preDrive. Each school must adapt it to its own safeguarding policy, transport arrangements, emergency contacts and local legal obligations.

### Before a school enables live trips

- Confirm the school administrator, supervisors and parent accounts belong to the correct school.
- Confirm every child is linked to the correct guardian and the guardian has provided the school's required consent.
- Verify authorised pickup people and PINs with the guardian using the school's identity-check procedure.
- Confirm each route's stops and road geometry have been physically checked. Only routes marked as manually verified can be scheduled.
- Confirm the assigned bus, driver, supervisor, passenger capacity and emergency contact procedure.
- Train supervisors to use the manifest, boarding, absence, arrival, handover, SOS and missing-child actions.
- Test the complete workflow on the actual Android devices and mobile network conditions used by the school.
- Confirm the school can contact guardians and emergency services without relying on the app.

### Daily trip procedure

#### Before departure

1. The supervisor checks the vehicle and confirms the correct trip, route and manifest.
2. Reconcile the children physically present against the manifest before departure.
3. Record each child boarding or absent. Do not infer boarding from GPS or a parent's location.
4. Do not start a trip until the route, vehicle and assigned supervisor are correct.

#### During the trip

- Keep the device charged and location permission enabled for the trip.
- Use the SOS action for an emergency and the child-missing action for a child who cannot be accounted for.
- If the device is offline, the app can queue routine trip events for later sync. SOS and missing-child alerts require connectivity; if they cannot be sent, use the school's phone/emergency procedure immediately.
- Do not treat a push notification as proof that a recipient has read or acted on it.

#### Arrival and handover

- Record arrival at school only for pickup routes and home drop-off only for drop-off routes.
- Before releasing a child, select the authorised pickup person and complete the PIN verification.
- If the authorised person is not listed, the PIN fails, or the connection needed for verification is unavailable, do not release the child. Contact the school administrator and follow the school's documented escalation process.
- Complete the trip only after every manifest child has a final, reconciled status.

### Incident response

For SOS, a missing child, a failed handover, an unaccounted child or a vehicle incident:

1. Follow the school's safeguarding and emergency response plan first. Contact emergency services where appropriate; do not wait for an app notification.
2. Keep the child supervised and account for the rest of the manifest.
3. Notify the school lead and the relevant guardians through the approved channels.
4. Record the incident and actions taken as soon as it is safe to do so.
5. Preserve relevant trip events and audit records; do not delete or edit incident evidence.
6. Escalate suspected unauthorised access or exposure of child/location data to the platform owner and the school's privacy lead.

### Monitoring checks

The following SQL checks are for an administrator with database access:

```sql
-- Push dispatches that could not be queued
select * from private.push_dispatch_attempts
where status <> 'queued'
order by created_at desc;

-- HTTP requests rejected or failed by pg_net
select *
from net._http_response
where status_code >= 400 or error_msg is not null
order by created desc;

-- Push receipt outcomes
select status, count(*)
from public.push_receipts
group by status;

-- Confirm the receipt worker is scheduled
select jobid, jobname, schedule, active
from cron.job
where jobname = 'predrive-check-push-receipts';
```

A queued request only means pg_net accepted the request. Confirm Edge Function logs and Expo receipt status before treating push delivery as healthy. Alerting and an on-call rota still need to be configured for the deploying school/platform operator.

### Deployment, backup and recovery

- Run the local migration reset, pgTAP suite, generated-type check, web build and Android export before deployment.
- Inspect the target Supabase project's migration history and data before applying migrations. Use `supabase db push`; never use a remote database reset on a live project.
- Keep Supabase backups enabled according to the selected plan and the school's recovery objectives. Export critical configuration and maintain a separate, access-controlled backup where required.
- Perform a restore drill into an isolated project before live use and record the recovery time and data-loss window. A backup that has never been restored is not a verified recovery plan.
- Keep Edge Function secrets in Supabase Secrets and Vault, rotate them after suspected exposure, and never commit them to GitHub.
- After a deployment, verify login, role scoping, a complete test trip, push dispatch, receipt polling, route field-check gating and the recovery of queued offline events.

### Data and access hygiene

- Review school-admin and supervisor access regularly and revoke accounts promptly when staff leave.
- Keep child profiles, pickup authorisations, PINs, location data and incident details limited to the people who need them.
- Do not share screenshots, exports or logs containing children's personal information in public channels.
- Define retention and deletion periods with the school and obtain local privacy/legal review before live use.

## Outstanding launch gates

1. Keep the expanded pgTAP suite, generated database types, lint/type checks, web build and Android bundle export passing on every main-branch change. Latest verified run: GitHub Actions CI run 44477235544; rerun after the newest offline/push/invitation changes is in progress.
2. Deploy migrations to the intended hosted Supabase project only after schema tests pass; verify hosted RLS, pg_cron, Realtime and function secrets without using a remote database reset.
3. Complete school admin management for route-child assignments, trip scheduling, incident handling, full staff lifecycle and platform-owner school operations.
4. Integrate and test a supported payment provider with verified callbacks, reconciliation and refunds.
5. Field-check provider-generated routes and stop safety in each operating school; verify GPS accuracy, stale-location detection, clock skew and device battery behaviour.
6. Complete adversarial RLS tests for every table and each role, plus RPC abuse, PIN brute-force, duplicate/offline event replay and cross-tenant tests.
7. Add push retry/dead-letter handling, delivery monitoring, error reporting, rate limits, secrets rotation, audit retention and incident escalation.
8. Configure backups/PITR, monitoring, restore drills, recovery objectives and operational runbooks.
9. Conduct supervised device testing with synthetic child data and obtain independent child-safety, privacy and legal review before any real-world use.

## Architecture

The requested `apps/mobile`, `apps/web` and `packages/shared` workspaces are nested under the top-level `frontend/` directory, alongside top-level `supabase/`.
