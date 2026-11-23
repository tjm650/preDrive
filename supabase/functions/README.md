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
| `_shared/http_test.ts` | CORS and error-mapping tests |
| `_shared/validation_test.ts` | Request-size and schema-validation tests |

## Required common environment

Set these as Supabase Function secrets for each environment. Do not put them in frontend environment files.

| Name | Purpose | Secret |
|---|---|---|
| `SUPABASE_URL` | Project URL used by the server client | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted server-only Supabase client | Yes |
| `APP_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins allowed to call browser-facing functions | No |
| `CRON_SECRET` | High-entropy credential for scheduled server-to-server invocations | Yes |

The platform-provided `SUPABASE_URL` and service-role key must be checked in the target project before deployment. `APP_ALLOWED_ORIGINS` must contain the real production web origins and any explicitly approved development origin. Do not use `*`.

## Per-function dependency configuration

Supabase recommends an isolated `deno.json` in each function directory. Pin exact versions; do not use floating `latest` or unversioned package specifiers. The shared modules currently pin:

- `npm:@supabase/supabase-js@2.119.2`
- `npm:zod@4.6.7`

Each function added in later B4 batches must include its own `deno.json`, entrypoint, README section and tests. The function's `deno.json` must pin the same shared dependency versions unless a reviewed upgrade is made across the function suite.

## Local development and verification

1. Install the Supabase CLI version used by the repository's toolchain and verify the installed command syntax with `supabase --help` and `supabase functions --help`.
2. Create a local-only environment file outside source control containing the common variables above. Use non-production credentials.
3. Serve an individual function with the current CLI's `functions serve` command and its local env file.
4. Run the Deno tests for the shared modules with `deno test supabase/functions/_shared`.
5. Run `deno check` on each function entrypoint before deployment.
6. Deploy only after the matching function tests pass and the required secrets exist in the target Supabase environment.

No Edge Function has been deployed by this batch. No remote database objects or scheduled jobs have been changed.
