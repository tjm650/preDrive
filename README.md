# preDrive

The frontend implementation phase is complete at source level. The Supabase backend is now being implemented in staged, security-first phases. The application is not production-operational until the remaining data modules, authenticated adapters, end-to-end tests and release checks are complete.

## Existing infrastructure retained

- Supabase project reference: `rjsdhgbjvghjnuiilizm`
- Expo EAS project ID: `6b904474-dcd6-4602-8ee1-b530850e6ded`
- Vercel project ID: `prj_OuDABc1RfzpQgy71SEpU0DTIYW4c`
- Mobile application identifier: `zw.co.predrive.mobile`

No credentials or secret values belong in this repository.

## Repository structure

```text
preDrive/
├── docs/
├── frontend/
│   ├── shared/
│   ├── web/
│   │   ├── pages/          # Next.js Pages Router routes
│   │   └── components/     # Reusable web UI and feature components
│   └── mobile/
│       ├── app/            # Thin Expo Router routes and layouts only
│       ├── screens/        # All mobile screen implementations by role
│       ├── components/     # Reusable mobile UI and feature components
│       └── src/            # Auth, hooks, state, services and data access
└── supabase/
    └── migrations/         # Versioned database schema and RLS changes
```

Mobile route files in `app/` should only define Expo Router navigation/layout boundaries and re-export the corresponding implementation from `screens/`. Screen implementations must not be placed in `app/`. Shared visual and feature elements belong in `components/`; application logic belongs in `src/`.

## Database migration workflow

- Keep all application schema changes in versioned files under `supabase/migrations/`.
- Apply application migrations using the `postgres` migration role. Its default privileges for future objects in `public` are now revoked for `anon`, `authenticated` and `service_role`; each migration must explicitly grant only the privileges it needs and enable RLS on every exposed table.
- Do not create application tables through the Supabase Dashboard Table Editor yet. The existing `supabase_admin` default privileges are still broad, and the connected database role cannot alter that role's defaults. This is a known platform configuration gap; use the committed migration workflow until those defaults are hardened.
- Never expose service-role credentials to web or mobile clients.

## Expo environment variables

Configure these variables for the Expo app in the relevant local environment file or in the Expo/EAS environment used by the build profile. Expo inlines variables prefixed with `EXPO_PUBLIC_` into the application bundle. **Treat every `EXPO_PUBLIC_*` value as public: never put passwords, service-role keys, payment secrets or other confidential values in them.**

| Variable | Required when | Purpose | Example / format |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | All Expo builds | Selects the application environment. Use a separate value for each deployment. | `development`, `staging` or `production` |
| `EXPO_PUBLIC_SUPABASE_URL` | When the Supabase client is wired into the mobile app | Supabase project URL used by the mobile app. | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | When the Supabase client is wired into the mobile app | Supabase publishable client key. | `sb_publishable_<your-public-key>` |

### Local Expo setup

Create `frontend/mobile/.env` for local development (do not commit it):

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The Supabase entries remain blank until the mobile client adapter is implemented and the correct environment-specific values are supplied. Never invent values or use a service-role key to fill them.

For EAS, create matching variables in the Expo project's EAS environment settings and assign the correct environment to each build profile. Use distinct Supabase projects/credentials for development, staging and production when those environments are provisioned. Keep the publishable key scoped to the matching project.

### Public and secret variable rules

- `EXPO_PUBLIC_*` variables are bundled into the app and can be extracted by users. Only public configuration belongs there.
- The Supabase publishable key is designed for client use; database access must still be protected by Auth, Row Level Security and server-side authorization.
- Never add `SUPABASE_SERVICE_ROLE_KEY`, payment gateway secrets, signing secrets, private API tokens or database passwords to Expo variables with the `EXPO_PUBLIC_` prefix.
- Server-only secrets belong in the Supabase Edge Function secrets or the relevant trusted server environment, not in the mobile app.
- Do not add a maps API key, push-notification secret, analytics DSN or other integration variable until that provider and its configuration have been selected and implemented.

**Current implementation status:** The first Supabase identity and school-tenancy database migrations are applied. The Expo application does not yet read these variables or create a Supabase client; setting them does not activate authentication, data access, payments, maps or notifications.

## Development

- Package manager: pnpm
- Mobile app: Expo SDK 54 with Expo Router
- Web app: Next.js Pages Router (the implementation decision for this project)
- Shared contracts, domain types and design tokens: `frontend/shared`

Install dependencies from the repository root with `pnpm install`. Start the mobile app with `pnpm --filter @predrive/mobile start`.

## Product and engineering rules

## Product (REVISED: REAL-WORLD USE)
"preDrive" is a production mobile app and school dashboard for creches and preschools in Zimbabwe. It tracks every school bus trip live with real GPS and keeps a verified record of every child handover. Schools register, set up their routes, staff and children, and use it daily. The only demo content is database records for one separate demo school (is_demo = true), used for sales presentations.

## Engineering rules (REVISED)
- TypeScript strict, ESLint, Prettier, pnpm. Environments: development, staging, production, each with its own Supabase project.
- Supabase is the runtime data source. MockAdapter exists only for automated tests and never ships in a production build.
- No demo accounts, demo controls or simulators in production. A dev-only simulator behind a DEV_TOOLS build flag is allowed.
- Multi-school from day one: every table has school_id; RLS on every table. Demo school is isolated by school_id and is_demo.
- The service-role key never appears in client code. Admin actions go through Edge Functions.
- Real onboarding: school registration, setup wizard, email invites for staff, invite codes for guardians.
- Trips are generated daily from route schedules by a scheduled backend job.
- Real GPS from the driver or supervisor device, only while a trip is active, with consent. Background tracking and push require the installed app (EAS build).
- Handover PINs are hashed (pgcrypto) and verified by an RPC that rate-limits and locks after 3 failures.
- Payments: real gateway (Paynow-style) for EcoCash and cards, with idempotency and webhooks; CBZ and CABS are bank transfers verified by the admin. Full audit trail for money movement.
- Privacy: location consent, data-deletion requests, privacy policy and terms, data-protection review for child data under Zimbabwe's Cyber and Data Protection Act.
- Operations: error reporting, backups, staging environment, production plans for Supabase and Vercel.
