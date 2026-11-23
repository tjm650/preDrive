# preDrive Supabase Edge Functions

All trusted application workflows run in Supabase Edge Functions (Deno/TypeScript). The shared infrastructure lives in `supabase/functions/_shared`. Functions must not expose the Supabase service-role key or provider credentials to web/mobile clients.

## Shared runtime contract

- HTTP responses use the frontend's discriminated `ApiResult` shape: `{ ok: true, data }` or `{ ok: false, error }`.
- Public error codes are restricted to `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `NETWORK`, `UNAVAILABLE` and `UNKNOWN`.
- Every response is `Cache-Control: no-store` and includes a correlation ID in error responses.
- CORS uses exact origins from `APP_ALLOWED_ORIGINS`; wildcard origins are not supported. Requests without an `Origin` header are allowed for server-to-server webhook and scheduled calls.
- Authenticated handlers validate the Supabase access token with `auth.getUser(token)`. Authorization is read from active `school_memberships` rows, never from user-editable metadata or caller-supplied role claims.
- Scheduled handlers authenticate using a dedicated `x-cron-secret` header and a high-entropy `CRON_SECRET`. Provider webhook handlers must verify the provider signature against the unmodified request body before parsing or trusting event fields.
- Structured logs contain only event name, request correlation ID, function name, status, duration, outcome and stable error code. Do not log names, email addresses, phone numbers, child data, PINs, tokens, provider payloads or request bodies.

## Shared files

| Path | Responsibility |
|---|---|
| `_shared/errors.ts` | Stable API error codes, safe error messages and database error normalization |
| `_shared/cors.ts` | Exact-origin CORS allowlist and preflight headers |
| `_shared/http.ts` | Request wrapper, correlation IDs, response envelope and safe error handling |
| `_shared/logger.ts` | Structured, allowlisted log fields |
| `_shared/supabase.ts` | Server-only service-role client factory and required environment lookup |
| `_shared/auth.ts` | JWT verification, active school-membership authorization and cron-secret verification |
| `_shared/validation.ts` | Bounded JSON parsing and Zod validation |
| `_shared/payments.ts` | Payment-intent validation, provider adapter interface, minor-unit conversion and opaque rate-limit subjects |
| `_shared/payments_test.ts` | Payment request, currency precision, provider routing and rate-limit hash tests |
| `_shared/paynow.ts` | Bounded Paynow form parsing, SHA-512 callback verification and safe event projection |
| `_shared/paynow_test.ts` | Published Paynow hash vector, signed callback and malformed-payload tests |
| `_shared/paynow.ts` | Bounded Paynow form parsing, SHA-512 callback verification and safe event projection |
| `_shared/paynow_test.ts` | Published Paynow hash vector, signed callback and malformed-payload tests |
| `_shared/http_test.ts` | CORS and error-mapping tests |
| `_shared/errors_test.ts` | Stable business-error mapping and safe-message tests |
| `_shared/validation_test.ts` | Request-size and schema-validation tests |

## Required common environment

Set these as Supabase Function secrets for each environment. Do not put them in frontend environment files.

| Name | Purpose | Secret |
|---|---|---|
| `SUPABASE_URL` | Project URL used by the server client | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted server-only Supabase client | Yes |
| `APP_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins allowed to call browser-facing functions | No |
| `CRON_SECRET` | High-entropy credential for scheduled server-to-server invocations | Yes |
| `PAYNOW_INTEGRATION_KEY` | Paynow SHA-512 callback verification key | Yes |
| `PAYNOW_INTEGRATION_KEY` | Paynow SHA-512 callback verification key | Yes |

The platform-provided `SUPABASE_URL` and service-role key must be checked in the target project before deployment. `APP_ALLOWED_ORIGINS` must contain the real production web origins and any explicitly approved development origin. Do not use `*`.

## Per-function dependency configuration

Supabase recommends an isolated `deno.json` in each function directory. Pin exact versions; do not use floating `latest` or unversioned package specifiers. The shared modules currently pin:

- `npm:@supabase/supabase-js@2.119.2`
- `npm:zod@4.6.7`

Each function must include its own `deno.json`, entrypoint, README section and tests. The function's `deno.json` must pin the same shared dependency versions unless a reviewed upgrade is made across the function suite.

## School invitations

`invite-school-member` is a school-admin-only function. It verifies the caller's bearer token against Supabase Auth, checks the caller's active `school_admin` membership for the target school, rejects school-admin role invitations, and stores a seven-day pending invitation. Staff invitations require a full name and phone number; creation is limited to ten attempts per administrator per school in a 15-minute window. New accounts receive a Supabase Auth invitation email; an existing account can accept the pending invitation on its next successful sign-in through `accept_school_invitation()`. The RPC derives the identity and email from the authenticated profile. The B4.3 staff-onboarding migration is applied and provisions the `staff_members` row atomically from the invitation's stored name and phone. Existing-account invitations do not send a second Auth invitation email; the administrator must tell that person to sign in. The school must be active. The frontend API contract does not yet expose the admin invitation operation; B6 must add its adapter surface before the admin UI can call this function.

The Auth invitation email uses the project's configured Supabase Auth email delivery and Site URL. Configure and test production SMTP and the allowed redirect URLs before deployment. The database invitation expires after seven days; Supabase Auth's invite-token expiry is a separate Auth setting and must be aligned so the email link does not expire later than the database invitation. No email provider credentials are stored in this repository.

## Payment intent creation

`create-payment-intent` is a guardian-only, user-JWT Edge Function. It validates the active school membership, checks that the school is active, applies a five-attempt/five-minute per-guardian rate limit, and calls `initiate_payment()` with the verified caller JWT so the database derives `auth.uid()` from the guardian session. The database remains authoritative for invoice ownership, invoice status, currency, outstanding balance and idempotency. Amounts arrive in major currency units and are converted to integer minor units (100 per USD/ZiG unit).

The payment adapter intentionally has no live gateway call in this batch. EcoCash creates a `simulated` pending intent; CBZ and CABS create `manual_bank` pending intents for the existing bank-transfer submission/review workflow. Card is rejected. No intent is marked successful by this function, and no money is moved. The `PaymentProviderAdapter` interface is the seam for a future reviewed Paynow integration; provider credentials and webhook settlement belong in later B4 batches.

The function returns the existing shared `Payment` shape. It does not add fields or methods to the frontend API contract. The service-role key remains server-only; the RPC request carries the already-verified user's JWT in its Authorization header so `auth.uid()` remains the guardian.

## Paynow webhook inbox

`paynow-webhook` accepts Paynow's standard form-encoded status update at the configured `resulturl`. It verifies the callback using Paynow's SHA-512 algorithm over decoded form values in their original order, excluding the `hash` field and appending `PAYNOW_INTEGRATION_KEY`. It uses a constant-time comparison, rejects duplicate fields, enforces a 16 KiB body limit and never logs or stores the signature, integration key, raw body, poll URL or optional payment-instrument token fields.

Only after successful signature verification does it persist a sanitized event in `public.webhook_events`. The event ID is a SHA-256 digest of the exact callback body; the existing `(provider, provider_event_id)` unique constraint provides duplicate suppression. A callback settles a payment only when its merchant `reference` uniquely matches a `payments` row whose provider is `paynow`, its amount exactly matches the stored integer minor-unit amount, and its Paynow status is exactly `Paid`. Settlement is delegated to the existing service-role-only `apply_payment_result()` RPC. Non-Paid statuses and unmatched references are recorded as ignored; amount mismatches are retained as failed events and are never settled.

The current B4.4 payment-intent function intentionally creates only simulated EcoCash and manual-bank intents, not Paynow intents. Consequently, this webhook receiver is a verified integration boundary but cannot settle any current B4.4 payment until a separately reviewed Paynow initiation adapter creates a `provider='paynow'` payment with a merchant reference. Do not point a live Paynow account at this endpoint until that initiation flow, the exact account currency and callback URL have been tested with Paynow-issued credentials. `verify_jwt=false` is required because Paynow cannot present a Supabase user JWT; cryptographic verification is mandatory in the handler.

## Paynow webhook inbox

`paynow-webhook` accepts Paynow's standard form-encoded status update at the configured `resulturl`. It verifies the callback using the Paynow SHA-512 algorithm over the decoded form values in their original order, excluding the `hash` field and appending `PAYNOW_INTEGRATION_KEY`. It uses a constant-time comparison, rejects duplicate fields, enforces a 16 KiB body limit and never logs or stores the signature, integration key, raw body, poll URL or optional payment-instrument token fields.

Only after successful signature verification does it persist a sanitized event in `public.webhook_events`. The event ID is a SHA-256 digest of the exact callback body; the existing `(provider, provider_event_id)` unique constraint provides duplicate suppression. A callback settles a payment only when its merchant `reference` uniquely matches a `payments` row whose provider is `paynow`, its amount exactly matches the stored integer minor-unit amount, and its Paynow status is exactly `Paid`. Settlement is delegated to the existing service-role-only `apply_payment_result()` RPC. Non-Paid statuses and unmatched references are recorded as ignored; amount mismatches are retained as failed events and are never settled.

The current B4.4 payment-intent function intentionally creates only simulated EcoCash and manual-bank intents, not Paynow intents. Consequently, this webhook receiver is a verified integration boundary but cannot settle any current B4.4 payment until a separately reviewed Paynow initiation adapter creates a `provider='paynow'` payment with a merchant reference. Do not point a live Paynow account at this endpoint until that initiation flow, the exact account currency and callback URL have been tested with Paynow-issued credentials. `verify_jwt=false` is required because Paynow cannot present a Supabase user JWT; cryptographic verification is mandatory in the handler.

## Local development and verification

1. Install the Supabase CLI version used by the repository's toolchain and verify the installed command syntax with `supabase --help` and `supabase functions --help`.
2. Create a local-only environment file outside source control containing the common variables above. Use non-production credentials.
3. Serve an individual function with the current CLI's `functions serve` command and its local env file.
4. Run the Deno tests for the shared modules with `deno test supabase/functions/_shared`.
5. Run `deno check` on each function entrypoint before deployment.
6. Deploy only after the matching function tests pass and the required secrets exist in the target Supabase environment.

The repository workflow `.github/workflows/supabase-edge-functions.yml` runs `deno check` on shared modules and all deployed function entrypoints, then runs the shared Deno tests. The Deno 2.9.8 type-check and all 33 shared tests passed on commit `1dbd0fa875562096eade9a554c01357214451164` (GitHub Actions run `45121405746`). Function deployment still requires the relevant secrets and provider configuration.

B4.4 source does not require a database migration. No payment intents, provider requests, successful settlements, Edge Function deployments or scheduled jobs were created by the source-only batch.

## Refund requests, receipts and payment reminders

- `request-refund` accepts a school-admin JWT, verifies the active school-admin membership, applies a five-attempt/15-minute per-admin rate limit, and calls the existing `request_refund()` RPC with that same verified JWT. The database derives `auth.uid()`, confirms the payment is settled, and prevents aggregate pending/processing/succeeded refunds from exceeding the original payment. A request is recorded as pending; this function does not move money or mark a refund successful.
- `get-payment-receipt` accepts a guardian JWT and returns the existing `PaymentReceipt` metadata only after checking that the payment succeeded, the invoice belongs to the authenticated guardian, and the guardian still has an active membership in the school. It does not expose service-role access or return another guardian's receipt.
- `generate-payment-reminders` is a daily cron-secret-protected function. It evaluates invoice due dates using each school's configured time zone and creates in-app alerts for three days before due date, on the due date, and 7, 14 and 30 days overdue. It uses the existing alert deduplication key and recipient uniqueness constraints, so retries do not create duplicate alerts or recipients.
- The reminder generator requires migration `20261123061404_predrive_payment_reminder_alert_source.sql`, which adds the explicit `payment_reminder` source type to the existing alert constraint. It is applied to the development project as remote version `20261123061404`.
- Reminder alerts are in-app only in B4.6. Email/push delivery, language-specific message templates and delivery retry policy belong to B4.7. The current messages are English pending native-reviewed Shona and Ndebele templates.
- No refund provider adapter exists yet. A pending refund requires a trusted settlement path before it can become succeeded or failed; never mark it complete from a guardian or school-admin client.
- No secrets, cron jobs, payment rows, refunds, receipts or alert rows are created by this source-only batch. Deployment and runtime smoke tests remain gated on the migration, `CRON_SECRET`, verified `APP_ALLOWED_ORIGINS` and the Deno workflow.


## Notification outbox and broadcast fan-out

- `notification_deliveries` is a service-role-only outbox linked to `alert_recipients`. It records channel, recipient locale, attempt count, retry time, worker lease, provider message ID and a sanitised error code. It does not duplicate alert content, email addresses, push tokens, provider payloads or secrets.
- An alert recipient is queued for push only when an active Expo device token exists. Email is queued only when the recipient has an email address and the latest effective school-scoped `communications` consent is explicitly `granted`.
- Publishing a broadcast creates one deduplicated alert and recipient rows for active memberships matching its target roles. Draft, expired and future-dated broadcasts are not fanned out by the publication trigger.
- The B4.7 outbox migration `20261123074827_predrive_notification_delivery_outbox.sql` is applied and catalog-verified. No delivery worker or provider adapter is deployed yet; no messages are sent until those functions are implemented, secrets are configured and runtime checks pass.
