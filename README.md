# preDrive

Fresh-start repository. The frontend is being developed as a production product for Zimbabwean schools. The Supabase backend and live service integrations are intentionally deferred until the frontend phase is complete.

## Existing infrastructure retained

- Supabase project reference: `rjsdhgbjvghjnuiilizm`
- Expo EAS project ID: `6b904474-dcd6-4602-8ee1-b530850e6ded`
- Vercel project ID: `prj_OuDABc1RfzpQgy71SEpU0DTIYW4c`
- Mobile application identifier: `zw.co.predrive.mobile`

No credentials or secret values belong in this repository.

## Expo environment variables

Configure these variables for the Expo app in the relevant local environment file or in the Expo/EAS environment used by the build profile. Expo inlines variables prefixed with `EXPO_PUBLIC_` into the application bundle. **Treat every `EXPO_PUBLIC_*` value as public: never put passwords, service-role keys, payment secrets or other confidential values in them.**

| Variable | Required when | Purpose | Example / format |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_APP_ENV` | All Expo builds | Selects the application environment. Use a separate value for each deployment. | `development`, `staging` or `production` |
| `EXPO_PUBLIC_SUPABASE_URL` | When the Supabase client is introduced in the backend phase | Supabase project URL used by the mobile app. | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | When the Supabase client is introduced in the backend phase | Supabase publishable client key. The shared environment validator accepts the `sb_publishable_...` format. | `sb_publishable_<your-public-key>` |

### Local Expo setup

Create `frontend/mobile/.env` for local development (do not commit it):

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

The Supabase entries are intentionally blank until the backend integration phase. Do not invent values or use a service-role key to fill them.

For EAS, create matching variables in the Expo project's EAS environment settings and assign the correct environment to each build profile. Use distinct Supabase projects/credentials for development, staging and production when those environments are provisioned. Keep the publishable key scoped to the matching project.

### Public and secret variable rules

- `EXPO_PUBLIC_*` variables are bundled into the app and can be extracted by users. Only public configuration belongs there.
- The Supabase publishable key is designed for client use; database access must still be protected by Auth, Row Level Security and server-side authorization.
- Never add `SUPABASE_SERVICE_ROLE_KEY`, payment gateway secrets, signing secrets, private API tokens or database passwords to Expo variables with the `EXPO_PUBLIC_` prefix.
- Server-only secrets belong in the Supabase Edge Function secrets or the relevant trusted server environment, not in the mobile app.
- Do not add a maps API key, push-notification secret, analytics DSN or other integration variable until that provider and its configuration have been selected and implemented.

**Current implementation status:** The Expo application does not yet read these variables or create a Supabase client. The names above document the intended mobile configuration for the backend integration phase; setting them now does not activate authentication, data access, payments, maps or notifications.

## Development

- Package manager: pnpm
- Mobile app: Expo SDK 54 with Expo Router
- Web app: Next.js Pages Router (the implementation decision for this project)
- Shared contracts, domain types and design tokens: `frontend/shared`

Install dependencies from the repository root with `pnpm install`. Start the mobile app with `pnpm --filter @predrive/mobile start`.

## Product and engineering rules

- Production workflows must not rely on demo accounts, fake payments, simulated GPS or hardcoded school records.
- The only permitted demo dataset is the separately isolated Greenfield Early Learning Centre (Demo) school in the later backend seed.
- Location is shared only during an active trip.
- Handover PINs must never be stored or logged in raw form.
- Offline child check events remain pending until server confirmation. PIN verification and payments are online-only.
- Every school-owned backend record must be scoped by `school_id` and protected by Row Level Security.
- The service-role key must never enter client code.
