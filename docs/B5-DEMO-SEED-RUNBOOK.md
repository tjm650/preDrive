# B5 Greenfield demo seed runbook

This runbook is for the **development Supabase project only**. It is not a production deployment procedure.

## Safety rules

- Confirm project ref `rjsdhgbjvghjnuiilizm` and take a current database backup before any seed.
- Never paste service-role keys, passwords or collector PIN derivation secrets into chat, source control, app code or CI logs.
- Run Deno scripts only in a trusted server-side environment.
- The five primary demo identities are the only supported demo sign-in accounts. Supporting household/staff accounts use reserved `.invalid` email addresses and random undisclosed passwords.
- No real payment provider is contacted. Historical payment rows use provider `simulated`.
- No notifications are sent. No cron jobs or Edge Functions are deployed by this runbook.
- Do not run the rollback-only tenant-isolation test until its temporary remote writes have been explicitly authorized.

## Execution order

### 1. Greenfield foundation

Review and execute `supabase/seed.sql` in the development project's SQL Editor after explicit approval.

It creates only:
- Greenfield Early Learning Centre.
- Three classes.
- Three buses and three routes.
- Fifteen ordered route stops.
- Four USD term fee items.
- Six approved settings.

It does not create Auth users or children. The 27.00 ZiG/USD value is illustrative only.

Then run:
- `supabase/tests/seed/b5_demo_foundation_acceptance.sql`

### 2. Five primary demo Auth identities

In a trusted Deno 2.9.8 environment, configure:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PREDRIVE_DEMO_ADMIN_PASSWORD`
- `PREDRIVE_DEMO_GUARDIAN_PASSWORD`
- `PREDRIVE_DEMO_SUPERVISOR_PASSWORD`
- `PREDRIVE_DEMO_DRIVER_PASSWORD`
- `PREDRIVE_DEMO_TEACHER_PASSWORD`

Each password must satisfy the script's 16–128 character and three-of-four character-class policy.

Run:

```sh
deno run --allow-env --allow-net scripts/seed-auth-users.ts
```

Then run:
- `supabase/tests/seed/b5_demo_auth_acceptance.sql`

No invitation emails are sent. Passwords are not logged. Reruns do not reset existing passwords.

### 3. Households, staff, children, collectors and schedules

Keep the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and also configure:

- `SUPABASE_ANON_KEY`
- `PREDRIVE_DEMO_ADMIN_PASSWORD` (same password as step 2)
- `PREDRIVE_DEMO_COLLECTOR_PIN_SECRET` (high-entropy, at least 32 characters)

Keep the collector PIN secret unchanged for all retries of a partially completed seed. The script derives 128 unique eight-digit collector PINs with HMAC-SHA-256 and sends each to the protected database RPC. Only bcrypt hashes are stored.

Run:

```sh
deno run --allow-env --allow-net scripts/seed-greenfield-households.ts
```

This provisions:
- 31 supporting guardians, giving 32 households total.
- Nine supporting staff, giving 3 supervisors, 3 drivers and 6 teachers total.
- 64 children across the three classes.
- One guardian relationship per child; Chipo Moyo is linked to Tendai and Tadiwa Moyo.
- Two approved collectors per child.
- One active route/stop assignment per child.
- Six weekday schedules, with route-specific driver/supervisor assignments.

Business child, guardian, collector and route records are created through authenticated school-admin RPCs. The service-role key is used only for Auth Admin and controlled fixture profile/membership/staff setup and read-only checks.

Then run:
- `supabase/tests/seed/b5_demo_operational_acceptance.sql`

### 4. Historical trip and finance migration

The migration `supabase/migrations/20261123131500_predrive_greenfield_demo_history_writer.sql` has been applied to the development database. Supabase recorded remote version `20261123133938` (`predrive_greenfield_demo_history_writer`).

The read-only catalog acceptance `supabase/tests/seed/b5_demo_history_writer_catalog_acceptance.sql` passed. The function is SECURITY DEFINER with an empty search path and EXECUTE granted only to service_role. It refuses to run unless the fixed Greenfield school is active and `is_demo=true`, and all B5.1–B5.3 dependencies pass preflight.

### 5. Historical demo data

With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured, run:

```sh
deno run --allow-env --allow-net scripts/seed-greenfield-history.ts
```

It must return exactly:
- 120 completed trips over 20 weekdays.
- 2,560 attendance rows.
- 64 term invoices.
- 32 simulated EcoCash payments and 32 receipts.
- Two resolved incidents.
- Four historical delay reports.

No live bus positions are inserted. Handover events are explicitly marked as simulated and do not claim real guardian PIN verification.

Then run:
- `supabase/tests/seed/b5_demo_history_acceptance.sql`

### 6. Tenant isolation and end-to-end runtime checks

After all previous acceptance suites pass, review and explicitly authorize the rollback-only script:
- `supabase/tests/seed/b5_tenant_isolation_rollback.sql`

It temporarily creates a second school, class, pupil and membership, switches to authenticated role checks, verifies isolation, and rolls the transaction back.

Then test all five primary demo logins and their role-specific restrictions. Use only synthetic records; do not send notifications or invoke live payment providers.

## Current status

All scripts, fixtures, migration source and acceptance SQL are committed. The Deno workflow type-checks the seed tooling and reports 86 passing tests. The Greenfield foundation is seeded and its acceptance SQL passed: 1 school, 3 classes, 3 buses, 3 routes, 15 stops, 4 fee items and 6 settings. The history-writer migration is applied as remote version `20261123133938`, and its catalog acceptance passed. No Auth users, profiles, memberships, children, trips, invoices, payments or receipts have been created yet.

## Known outstanding brief requirement

Route stops have approximate demo coordinates, but there is no typed road-path geometry field in the current schema or shared API. Do not fabricate a route line. See `docs/ROUTE-GEOMETRY-CONTRACT.md`; the geometry storage and API contract must be implemented in B6 with road-network-sourced and school-verified paths containing at least 30 coordinates per route.
