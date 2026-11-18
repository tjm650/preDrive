# preDrive

A school-transport safety platform for creches and pre-schools in Zimbabwe. This repository uses a pnpm workspace under `frontend/` and Supabase local development under `supabase/`.

> **Safety status:** This is a development foundation, not a certified safety-critical production system. Do not onboard real children or use it for live journeys until the outstanding launch gates below are completed and independently reviewed.

## Repository layout

- `frontend/apps/mobile` — Expo Router mobile app for parents and supervisors (Expo SDK 58)
- `frontend/apps/web` — Next.js App Router landing page and school/platform dashboard foundation
- `frontend/packages/shared` — strict TypeScript types, geo utilities, constants and en/sn/nd strings
- `supabase/migrations` — versioned Postgres schema, RLS and safety workflows
- `supabase/functions` — push delivery and Expo receipt Edge Functions
- `supabase/tests` — pgTAP tenant-isolation tests
- `supabase/seed.sql` — fictional Harare demo school, auth identities, children and trip history

## Prerequisites

- Node.js 22.13+
- pnpm 10
- Docker Desktop / Docker Engine
- Supabase CLI (current stable)
- Git

## Local setup

1. Clone and install:

   ```sh
   git clone https://github.com/tjm650/preDrive.git
   cd preDrive
   corepack enable
   pnpm install
   ```

2. Start the local Supabase stack and apply schema + seed:

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

5. Run the checks:

   ```sh
   pnpm --filter @predrive/shared typecheck
   supabase test db
   pnpm lint
   pnpm format:check
   ```

6. Start the mobile app and web app in separate terminals:

   ```sh
   pnpm --filter @predrive/mobile start
   pnpm --filter @predrive/web dev
   ```

## Demo accounts

The local seed creates these Auth users and matching profiles:

| Role           | Email                      |
| -------------- | -------------------------- |
| Supervisor     | `supervisor@predrive.test` |
| Driver profile | `driver@predrive.test`     |
| Parent         | `parent@predrive.test`     |
| School admin   | `admin@predrive.test`      |
| Platform owner | `owner@predrive.test`      |

Shared local-only password: `PreDrive-Demo-2026!`. These credentials are deliberately public demo credentials. Never use them in staging or production. Reset them before sharing a demo environment.

## Push notification setup

Deploy both Edge Functions:

```sh
supabase functions deploy send-push
supabase functions deploy check-push-receipts
supabase secrets set NOTIFICATION_WEBHOOK_SECRET='a-long-random-secret' EXPO_ACCESS_TOKEN='optional-expo-access-token'
```

Also configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as function secrets if they are not injected by the Supabase runtime. Configure a Database Webhook for INSERT on `public.notifications`, targeting `send-push` and sending the matching `x-webhook-secret` header. Schedule `check-push-receipts` at least every 15 minutes with the same secret header. It checks Expo receipts and clears tokens reported as `DeviceNotRegistered`.

## Security model

- RLS is enabled for every exposed public table; role and school scope are derived from the authenticated profile, never user-editable user metadata.
- Tenant relationships (guardian-child, route-child, trip-bus-supervisor, notification-recipient, and invoice-guardian) are validated in database triggers.
- Parents are linked to children through `guardianships`; bus location and location history are only visible to guardians while the related trip is active.
- Supervisors are limited to assigned trips and their route manifest; trip events must refer to children on that manifest.
- School administrators are school-scoped; platform owners have cross-school read access but not school-admin write privileges.
- Pickup PIN hashes and Expo push tokens are not selectable through the client API. Verification occurs in `verify_pickup_pin`, with attempt throttling and audit records.
- Event and audit records are append-only for normal client sessions. Notifications expose only read/acknowledgement updates to clients.
- Realtime publication membership does not replace RLS; clients must subscribe with authenticated sessions.

## Important launch gates

1. Complete and run adversarial RLS tests for every table and each role, including supervisor manifest mutation and platform-owner boundaries.
2. Add verified road-following route geometry from a licensed mapping provider; demo polylines are illustrative, not navigation-grade.
3. Complete parent/supervisor mobile workflows, push token registration, offline-safe event queuing, trip transitions and realtime subscriptions.
4. Complete web role workflows for fleet, routes, children, billing, incidents and platform-level school management.
5. Verify pg_cron in the target Supabase project; confirm child-unaccounted reminders and acknowledgement behaviour under failure.
6. Add stale GPS detection, clock-skew handling, duplicate-event idempotency, push retry/dead-letter handling and delivery monitoring.
7. Add backups/PITR, observability, rate limits, secrets rotation, incident escalation, audit retention, restore drills and penetration testing.
8. Conduct supervised device testing with synthetic child data and obtain an independent child-safety/privacy review before any real-world use.

## Architecture

The requested `apps/mobile`, `apps/web`, `packages/shared` workspaces are nested under the final requested top-level `frontend/` directory, alongside top-level `supabase/`.
