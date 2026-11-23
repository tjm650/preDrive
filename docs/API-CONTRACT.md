# Frontend API contract inventory

## Authority

This inventory is derived from `frontend/shared/lib/api/contract.ts`, `inputs.ts` and `types.ts` on `main`. Those files are the binding frontend/backend contract. Database and Edge Function work must implement these operations without silently expanding the interface. Any additional operation must first be agreed and added to the shared contract.

## Operation count

The current `PreDriveApi` exposes **30 methods**:

| Namespace | Methods |
|---|---:|
| auth | 5 |
| school | 2 |
| children | 4 |
| staff | 1 |
| transport | 11 |
| safety | 4 |
| finance | 3 |
| **Total** | **30** |

## Exact operations

### Auth — 5

- `signIn(SignInInput): ApiResult<AuthSession>`
- `signOut(): ApiResult<void>`
- `getSession(): ApiResult<AuthSession | null>`
- `requestPasswordReset(PasswordResetInput): ApiResult<void>`
- `switchSchool(schoolId): ApiResult<AuthSession>`

### School — 2

- `getCurrent(): ApiResult<School>`
- `update(UpdateSchoolSettingsInput): ApiResult<School>`

### Children — 4

- `list(PageRequest): ApiResult<PageResult<Child>>`
- `get(childId): ApiResult<Child>`
- `create(CreateChildInput): ApiResult<Child>`
- `update(childId, Partial<CreateChildInput>): ApiResult<Child>`

### Staff — 1

- `list(PageRequest): ApiResult<PageResult<StaffMember>>`

### Transport — 11

- `listBuses(PageRequest): ApiResult<PageResult<Bus>>`
- `createBus(CreateBusInput): ApiResult<Bus>`
- `updateBus(busId, UpdateBusInput): ApiResult<Bus>`
- `listRoutes(PageRequest): ApiResult<PageResult<TransportRoute>>`
- `createRoute(CreateTransportRouteInput): ApiResult<TransportRoute>`
- `updateRoute(routeId, UpdateTransportRouteInput): ApiResult<TransportRoute>`
- `listTrips(PageRequest): ApiResult<PageResult<Trip>>`
- `startTrip(StartTripInput): ApiResult<Trip>`
- `recordChildStatus(ChildStatusInput): ApiResult<void>`
- `verifyHandover(VerifyHandoverInput): ApiResult<void>`
- `listApprovedCollectors(childId): ApiResult<ApprovedCollector[]>`

### Safety — 4

- `listAlerts(PageRequest): ApiResult<PageResult<Alert>>`
- `listIncidents(PageRequest): ApiResult<PageResult<Incident>>`
- `createIncident(CreateIncidentInput): ApiResult<Incident>`
- `raiseSos({ tripId?, latitude?, longitude? }): ApiResult<void>`

### Finance — 3

- `listInvoices(PageRequest): ApiResult<PageResult<Invoice>>`
- `initiatePayment(InitiatePaymentInput): ApiResult<Payment>`
- `getReceipt(paymentId): ApiResult<PaymentReceipt>`

## Shared request and result rules

- Every operation returns the discriminated `ApiResult<T>`: either `{ ok: true, data }` or `{ ok: false, error }`.
- Error codes are exactly `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `NETWORK`, `UNAVAILABLE` and `UNKNOWN`.
- Errors carry a human-readable message and `retryable`; `fieldErrors` and `correlationId` are optional.
- Pagination uses one-based page numbers, default page size 25 and maximum page size 100.
- School context is represented by `SchoolScope.schoolId`; the backend must derive and validate authorization from the authenticated identity rather than trusting a client-supplied school ID.

## Typed input details

- Sign-in: email and password. Password reset: email.
- School update: name, address and indicative ZiG-per-USD rate.
- Child create: first name, last name, date of birth and class-group ID.
- Bus create: registration number, make, model and capacity. Bus update may additionally set the typed bus status.
- Route create: name, code, ordered stops (name, address, order) and optional bus ID. Route update may change route metadata, status and stops.
- Trip start: trip ID and timestamp.
- Child status: trip ID, child ID, timestamp and idempotency key.
- Handover verification: trip ID, child ID, approved collector ID and raw PIN supplied for verification. The backend must never persist the raw PIN.
- Payment initiation: invoice ID, typed money amount, payment method and idempotency key.
- Incident creation: title, description, typed severity and optional trip/child IDs.
- SOS: optional trip ID and optional latitude/longitude.

## Deliberate contract boundaries

The current contract does **not** expose methods for ending a trip, writing GPS positions, editing/deleting children, managing guardian links or collector records, acknowledging alerts, resolving incidents, vehicle checks, delay reports, broadcasts, refunds, bank-transfer review, realtime subscriptions, or bulk imports. Some underlying schema entities exist, but their existence does not authorize the backend to invent client-facing methods or assume those workflows are integrated.

The current contract also does not define realtime event names or payloads. Keep the Realtime publication empty until an explicit contract is agreed. B3/B4 implementation should map only the 30 operations above to the necessary database functions and Edge Functions, while keeping privileged operations server-side.


## B4 invitation capability (not yet part of the client API)

The server-side `invite-school-member` Edge Function is implemented for the school-admin workflow. It is intentionally not added as a `PreDriveApi` method in this batch because the frontend contract and SupabaseAdapter must be updated together in B6. The function accepts a school ID, email and one of guardian/teacher/supervisor/driver roles; it never accepts a caller-supplied actor ID or role. It returns a pending invitation identifier and expiry. The Auth sign-in adapter accepts a matching invitation through the existing `accept_school_invitation()` RPC after Supabase verifies the password. This does not expand the current 30-method API count.
