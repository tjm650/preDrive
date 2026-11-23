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
| `RESEND_FROM_EMAIL` | Sender identity on a verified Resend domain | No |
| `EXPO_ACCESS_TOKEN` | Optional Expo Push enhanced-security credential | Yes, if enabled |
| `PAYNOW_INTEGRATION_KEY` | Paynow SHA-512 callback verification key | Yes |
| `RESEND_API_KEY` | Resend transactional email API credential | Yes |
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

The repository workflow `.github/workflows/supabase-edge-functions.yml` runs `deno check` on shared modules and all function entrypoints, then runs the shared Deno tests. The Deno 2.9.8 type-check and all 45 shared tests passed with the notification worker included on commit `68642408eec8d971085359dbf833cec2c21ca8ae` (GitHub Actions run [45139514983](https://github.com/tjm650/preDrive/actions/runs/45139514983)). Function deployment still requires the relevant secrets and provider configuration.

B4.4 source does not require a database migration. No payment intents, provider requests, successful settlements, Edge Function deployments or scheduled jobs were created by the source-only batch.

## Refund requests, receipts and payment reminders

- `request-refund` accepts a school-admin JWT, verifies the active school-admin membership, applies a five-attempt/15-minute per-admin rate limit, and calls the existing `request_refund()` RPC with that same verified JWT. The database derives `auth.uid()`, confirms the payment is settled, and prevents aggregate pending/processing/succeeded refunds from exceeding the original payment. A request is recorded as pending; this function does not move money or mark a refund successful.
- `get-payment-receipt` accepts a guardian JWT and returns the existing `PaymentReceipt` metadata only after checking that the payment succeeded, the invoice belongs to the authenticated guardian, and the guardian still has an active membership in the school. It does not expose service-role access or return another guardian's receipt.
- `generate-payment-reminders` is a daily cron-secret-protected function. It evaluates invoice due dates using each school's configured time zone and creates in-app alerts for three days before due date, on the due date, and 7, 14 and 30 days overdue. It uses the existing alert deduplication key and recipient uniqueness constraints, so retries do not create duplicate alerts or recipients.
- The reminder generator requires migration `20261123061404_predrive_payment_reminder_alert_source.sql`, which adds the explicit `payment_reminder` source type to the existing alert constraint. It is applied to the development project as remote version `20261123061404`.
- Reminder alerts are in-app only in B4.6. Email/push delivery, language-specific message templates and delivery retry policy belong to B4.7. The current messages are English pending native-reviewed Shona and Ndebele templates.
- No refund provider adapter exists yet. A pending refund requires a trusted settlement path before it can become succeeded or failed; never mark it complete from a guardian or school-admin client.
- No secrets, cron jobs, payment rows, refunds, receipts or alert rows are created by this source-only batch. Deployment and runtime smoke tests remain gated on the migration, `CRON_SECRET`, verified `APP_ALLOWED_ORIGINS` and the Deno workflow.


## Notification outbox, delivery worker and broadcast fan-out

- `notification_deliveries` is a service-role-only outbox linked to `alert_recipients`. It records channel, recipient locale, attempt count, retry time, worker lease, provider message ID and a sanitised error code. It does not duplicate alert content, email addresses, push tokens, provider payloads or secrets.
- An alert recipient is queued for push only when an active Expo device token exists. Email is queued only when the recipient has an email address and the latest effective school-scoped `communications` consent is explicitly `granted`.
- Publishing a broadcast creates one deduplicated alert and recipient rows for active memberships matching its target roles. Draft, expired and future-dated broadcasts are not fanned out by the publication trigger.
- `deliver-notifications` is a POST-only, `CRON_SECRET`-protected worker. It claims each pending row with a conditional update on the observed attempt count and pending status, so concurrent workers cannot claim the same row. It recovers expired ten-minute leases, increments attempts at claim time, retries transient failures with bounded backoff, and marks exhausted or permanent failures terminally. Completion updates are fenced by the worker lease ID.
- Push uses the Expo Push API and an eight-second request timeout. Each delivery uses a stable `collapseId` and Android `tag` derived from its outbox UUID, so retries for the same delivery can collapse/replace visible duplicates where supported; a new escalation sequence has a new ID. This is not an exactly-once transport guarantee. Email uses Resend with the deterministic `predrive-notification/<delivery-id>` idempotency key. Provider response bodies and recipient endpoints are never logged or stored; only provider message IDs and allowlisted error codes are retained.
- The Expo send response is parsed as exactly one ticket for the one-recipient request. Empty, malformed or unexpected multi-ticket responses are treated as retryable provider-response errors rather than silently accepting the first item. Regional English tags such as `en-ZW` use English copy; Shona and Ndebele variants remain suppressed until native-reviewed templates are available.
- Before sending, the worker rechecks active school status, active membership, alert openness, recipient acknowledgement, current email consent and current device registration. Expired/cancelled broadcast alerts are suppressed. `DeviceNotRegistered` revokes the affected active Expo registration.
- Current source templates send English only. Shona and Ndebele deliveries are safely suppressed until native-reviewed copy is supplied; they are never silently sent English text. The worker binds each push delivery to its own `device_token_id` and tracks the Expo receipt independently. A missing or revoked token suppresses that row rather than redirecting it to another device.
- Delivery sequence numbers permit distinct initial and escalation cycles without resetting sent rows. Push uniqueness is per recipient/device/sequence; email uniqueness is per recipient/sequence. The service-role-only escalation enqueue RPC creates subsequent delivery sequences.
- Migration `20261123074827_predrive_notification_delivery_outbox.sql` is applied and catalog-verified. The worker and provider adapters are source-only: no function deployment, secrets, cron jobs or messages were created. Configure `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and optionally `EXPO_ACCESS_TOKEN` only in Supabase Function secrets after provider account/sender verification. The sender address must belong to a verified Resend domain.


## Device-scoped notification delivery and Expo receipts

B4.7.2 adds sequence-aware notification deliveries. Initial alert notifications use sequence 1; repeat-until-acknowledged escalation creates later sequences. Push rows reference one specific `device_tokens` row, so a worker never substitutes a different device if the original token is revoked or deleted. The composite foreign key clears only `device_token_id` on token deletion and preserves the school tenant key.

The `deliver-notifications` worker now polls Expo's documented `/push/getReceipts` endpoint using the ticket ID returned by `/push/send`. It waits at least 15 minutes, rechecks missing receipts periodically, and stops after Expo's 24-hour receipt retention. A receipt confirms handoff to APNs/FCM, not receipt by the person. Receipt-level `DeviceNotRegistered` revokes the associated device registration. Receipt failures are recorded separately and never cause a second send of a delivery already accepted by Expo.

The worker remains source-only. No Edge Function is deployed, no cron job is scheduled, no provider credentials are configured and no messages have been sent. Shona and Ndebele remain suppressed until native-reviewed templates are available.


## Urgent-alert escalation scheduler

`enqueue-alert-escalations` is a POST-only Edge Function protected by the same high-entropy `CRON_SECRET` header as the delivery worker. It calls the existing service-role-only `enqueue_due_alert_escalations(p_batch_size)` database routine with a fixed batch size of 100. It does not accept a caller-selected school, alert ID or batch size, and it never sends a message itself.

The database routine locks due urgent alerts with `FOR UPDATE SKIP LOCKED`, so concurrent scheduler invocations do not process the same alert row at once. It creates a new delivery sequence for each escalation rather than resetting previously sent records, queues one push per currently active Expo device and one email only when the recipient's current communications consent is granted, and advances the next escalation time by five minutes. Acknowledged recipients are excluded. The existing `deliver-notifications` worker is responsible for sending the resulting outbox rows.

When release gates are met, schedule `enqueue-alert-escalations` at one-minute intervals and `deliver-notifications` at one-minute intervals. The enqueue routine itself only advances an alert when its five-minute due time has arrived. These are two distinct jobs: the escalation scheduler materializes deliveries, and the delivery worker sends them. Do not create either cron job until both functions are deployed, `CRON_SECRET` and provider settings are configured, and smoke tests pass. GitHub Actions run `45153289661` passed Deno type-checking and all 47 shared tests (0 failures). The database read-only verification found zero matching cron jobs. No cron job is currently scheduled.


## Notification template and provider hardening

English locale tags are normalized across regional variants (for example, `en-ZW`). Shona and Ndebele remain suppressed, including regional variants, until native-reviewed copy is committed. No English fallback is used for those languages.

Each Expo delivery sends a stable outbox-derived `collapseId` and Android `tag`. This helps supported devices collapse or replace a repeated notification from the same delivery row. A new escalation sequence has a different delivery ID and remains a distinct notification. These identifiers do not guarantee exactly-once delivery: a timeout can occur after Expo accepts a request, and Expo/APNs/FCM delivery is best-effort. The app must treat the in-app alert and acknowledgement record as authoritative.

The worker accepts exactly one valid Expo ticket for its single-recipient request. Malformed, empty or unexpected multi-ticket responses are rejected with a safe provider error code. Provider response bodies, email addresses and push tokens are not logged.


B4.7.5 verification: GitHub Actions run [45158947154](https://github.com/tjm650/preDrive/actions/runs/45158947154) passed Deno type-checking and all 50 shared tests. The two remote read-only notification acceptance SQL suites passed. The current development project has no deployed Edge Functions, no matching cron jobs, and no notification/alert/broadcast rows. No remote schema or data changes were made during B4.7.5.


## Personal data export (B4.8.1)

- A school member requests an export through the existing authenticated `request_data_export(school_id, reason)` RPC. A school administrator must review the request and move it to `processing`; the worker never self-approves requests.
- `process-data-exports` is POST-only and protected by `CRON_SECRET`. It processes only `data_export` requests already in `processing`, with no retention hold, and requires `requested_by = subject_user_id`.
- The export is scoped to the authenticated subject's profile, memberships, staff record, guardian-child links, linked children, approved collector details (never PIN hashes or PIN lock counters), consent history, invoices, payments, trip-child attendance and related trip metadata. It excludes GPS coordinates, device tokens, credentials, other guardians' profiles and internal idempotency hashes.
- The JSON artifact is stored in the private `exports` bucket under a school/request-scoped object path. It is limited to 20 MiB. The worker marks the request completed only after upload succeeds.
- `download-data-export` requires the original authenticated requester, a completed export request and no retention hold. It returns a signed URL valid for 60 seconds; the retention worker removes export files after seven days.
- The worker does not email the export or expose a public bucket URL. The service-role key remains server-only.
- This first export version intentionally does not claim to export every school operational or safety record. It covers the subject-centred personal categories listed above; financial records are included as a copy for the subject and are never deleted by export processing.
- Both functions are source-only until secrets are configured, CI passes, and controlled authenticated/cron tests are completed.
