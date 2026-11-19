# preDrive Supabase operations runbook

## Target project

- Project ref: `rjsdhgbjvghjnuiilizm`
- URL: `https://rjsdhgbjvghjnuiilizm.supabase.co`
- Region: `eu-west-1`
- Database: PostgreSQL 17

The Supabase project is active and the schema is deployed. The live project is intentionally empty of schools, users and demo seed data. Do not load local demo identities into production.

## Local development

From the repository root:

```bash
pnpm install
supabase start
supabase db reset
pnpm db:types
pnpm test:db
```

The local reset applies the repository migrations and `supabase/seed.sql`. The seed is for local development and automated tests only.

## Link and verify the live project

```bash
supabase link --project-ref rjsdhgbjvghjnuiilizm
supabase migration list
supabase db push
```

All 35 repository migration versions are recorded as applied in the target project's `supabase_migrations.schema_migrations` table. `supabase db push` should therefore report no pending migrations. Do not delete or recreate the remote database to resolve migration-history issues.

The RLS isolation suite contains 143 assertions and has been executed against the live schema in a transaction that rolls back its fixtures.

## Deploy Edge Functions

```bash
supabase functions deploy send-push --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy check-push-receipts --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy invite-staff --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy invite-parent --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy admin-invite-user --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy build-route-geometry --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy export-my-data --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy delete-my-account --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy paynow-initiate --project-ref rjsdhgbjvghjnuiilizm
supabase functions deploy paynow-callback --project-ref rjsdhgbjvghjnuiilizm
```

All 10 functions are already active in the live project. The commands above are for future repeatable deployments.

## Required secrets before enabling integrations

Set these in Supabase Dashboard → Edge Functions → Secrets (or via `supabase secrets set`):

| Secret | Used by | Required |
|---|---|---:|
| `SITE_URL` | CORS and invitation redirects | Yes |
| `NOTIFICATION_WEBHOOK_SECRET` | Push dispatch webhook authentication | Yes |
| `OPENROUTESERVICE_API_KEY` | Road geometry generation | For route geometry |
| `PAYNOW_INTEGRATION_ID` | Paynow checkout | For Paynow |
| `PAYNOW_INTEGRATION_KEY` | Paynow signatures/callbacks | For Paynow |
| `EXPO_ACCESS_TOKEN` | Expo push API access token | Optional |
| `PAYNOW_RETURN_URL` | Paynow browser return destination | Optional |
| `PAYNOW_API_BASE` | Paynow API override | Optional |

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never place the service-role key in a client environment file.

### Push dispatch also requires Vault entries

The database trigger reads these Vault names:

- `project_url`: `https://rjsdhgbjvghjnuiilizm.supabase.co`
- `notification_webhook_secret`: exactly the same value as the Edge Function secret `NOTIFICATION_WEBHOOK_SECRET`

The Vault is currently empty. Until these two values are set, the notification dispatcher records `missing_secrets` and does not call `send-push`.

Example Vault setup (replace the placeholder with the same secret configured for the Edge Function):

```sql
select vault.create_secret(
  'https://rjsdhgbjvghjnuiilizm.supabase.co',
  'project_url',
  'preDrive Supabase project URL'
);

select vault.create_secret(
  '<same-value-as-NOTIFICATION_WEBHOOK_SECRET>',
  'notification_webhook_secret',
  'preDrive notification webhook authentication'
);
```

Generate the webhook secret using a password manager or cryptographically secure generator. Do not commit it to Git.

## Auth configuration

In Supabase Authentication → URL Configuration:
- Set the production Site URL to the actual preDrive web origin.
- Add the production web callback URL.
- Add the required Expo / EAS mobile deep-link redirect URLs.
- Keep localhost and Expo Go redirect URLs only for development.

The production web origin has not been supplied, so the Edge Function `SITE_URL` secret and remote Auth redirect allow-list still need to be set.

## Storage buckets

The private `avatars` and `school-logos` buckets are provisioned. Keep them private; use signed URLs and the existing school/owner-scoped policies.

## Operational checks

- Review Supabase Security and Performance advisors after schema changes.
- Review Edge Function logs after setting secrets and test a real push receipt.
- Confirm a test parent cannot read another tenant's child or any historical GPS.
- Confirm an unassigned supervisor cannot access a trip.
- Confirm a suspended school loses tenant access.
- Confirm route geometry remains `provider_verified` only after provider calculation and becomes `field_checked` only after a school operator confirms it.
- Verify Paynow with provider sandbox credentials before enabling live transactions.
- Keep location-history retention at 90 days.
- Take and verify database backups before production schema changes.

## Pending approval

The live Supabase security advisor reports RLS disabled on `private.push_dispatch_attempts`. Proposed statement:

```sql
ALTER TABLE private.push_dispatch_attempts ENABLE ROW LEVEL SECURITY;
```

This has not been applied automatically. Review and approve it before the final security hardening pass.
