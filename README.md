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
- Trip events are queued in local SQLite while offline and replayed in order using idempotency keys. The latest vehicle location is retained for retry.
- Realtime subscriptions refresh trip events, trip state, vehicle location and notifications.
- Android location tracking requests foreground and background permissions and uses an Android foreground location service. If background permission is denied, the supervisor must keep the app open. Force-stopping the app, revoked permissions, device power settings and network loss can still interrupt location delivery.
- SOS and pickup PIN verification require a live connection. If SOS cannot be sent, the app instructs the supervisor to contact the school's emergency contact immediately. A queued event is not an emergency notification.

For Expo push registration and native modules, initialise/link the Expo project from `frontend/apps/mobile` with `eas init`. Copy the generated project UUID to `EXPO_PUBLIC_EAS_PROJECT_ID` in the mobile environment; EAS also writes the same UUID to `expo.extra.eas.projectId` in `app.json`. Build the Android development client with `eas build --profile development --platform android`. Rebuild after adding native Expo modules or changing app plugins/permissions. The `development` and `preview` profiles are internal Android APK builds; no production build is triggered by CI.

## School operations workspace

Open `/dashboard/operations` as a school administrator to manage children, vehicles, routes and ordered stops, issue/void invoices, and invite supervisors or additional school administrators. Child, vehicle and route archival is soft archival; records are not physically deleted from the operational history.

Payment confirmation is intentionally not available as a manual UI action. A payment must only be marked as received after a verified callback from a configured payment provider. No payment provider is integrated yet.

## Supabase Edge Functions

Deploy the functions after reviewing the target project and setting secrets:

```sh
supabase functions deploy send-push
supabase functions deploy check-push-receipts
supabase functions deploy invite-staff
supabase functions deploy build-route-geometry

supabase secrets set \
  NOTIFICATION_WEBHOOK_SECRET='a-long-random-secret' \
  SITE_URL='https://YOUR_WEB_APP_DOMAIN' \
  OPENROUTESERVICE_API_KEY='YOUR_OPENROUTESERVICE_KEY'
```

Supabase injects the project URL and service-role key into the Edge Function runtime. The staff-invitation and route-geometry functions also require the Supabase anon key for caller-token verification.

Configure a Database Webhook for INSERT on `public.notifications`, targeting `send-push` and sending the matching `x-webhook-secret` header. Schedule `check-push-receipts` at least every 15 minutes with the same secret header. It checks Expo receipts and clears tokens reported as `DeviceNotRegistered`.

The mobile app registers its Expo push token using the authenticated `register_push_token` RPC; the token is not readable through the client profile API.

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

## Outstanding launch gates

1. Pass the expanded pgTAP suite against a clean local database and verify all generated types and web/mobile builds.
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
