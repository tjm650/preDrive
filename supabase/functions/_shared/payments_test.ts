import {
  hashPaymentRateLimitSubject,
  paymentIntentSchema,
  paymentProviderFor,
  toMinorUnits,
} from "./payments.ts";

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";

Deno.test("payment intent accepts EcoCash demo requests", () => {
  const result = paymentIntentSchema.parse({
    schoolId: SCHOOL_ID,
    invoiceId: INVOICE_ID,
    amount: 125.5,
    currency: "USD",
    method: "ecocash",
    idempotencyKey: "guardian-payment-001",
  });

  if (result.amount !== 125.5 || result.method !== "ecocash") {
    throw new Error("Payment request fields were not preserved.");
  }
});

Deno.test("payment intent accepts only Zimbabwe bank transfer methods", () => {
  for (const method of ["cbz_transfer", "cabs_transfer"] as const) {
    const result = paymentIntentSchema.parse({
      schoolId: SCHOOL_ID,
      invoiceId: INVOICE_ID,
      amount: 25,
      currency: "ZiG",
      method,
      idempotencyKey: `bank-payment-${method}`,
    });

    if (result.method !== method) {
      throw new Error("Bank transfer method was not preserved.");
    }
  }
});

Deno.test("payment intent rejects card and unknown fields", () => {
  const base = {
    schoolId: SCHOOL_ID,
    invoiceId: INVOICE_ID,
    amount: 25,
    currency: "USD",
    idempotencyKey: "guardian-payment-002",
  };

  if (paymentIntentSchema.safeParse({ ...base, method: "card" }).success) {
    throw new Error("Card payments must not be accepted.");
  }

  if (
    paymentIntentSchema.safeParse({
      ...base,
      method: "ecocash",
      createdBy: SCHOOL_ID,
    }).success
  ) {
    throw new Error("Caller-supplied actor fields must be rejected.");
  }
});

Deno.test("payment intent rejects fractional minor units and invalid amounts", () => {
  const base = {
    schoolId: SCHOOL_ID,
    invoiceId: INVOICE_ID,
    currency: "USD",
    method: "ecocash",
    idempotencyKey: "guardian-payment-003",
  };

  for (const amount of [0, -1, 10.001, Number.POSITIVE_INFINITY]) {
    if (paymentIntentSchema.safeParse({ ...base, amount }).success) {
      throw new Error(`Invalid payment amount was accepted: ${amount}`);
    }
  }
});

Deno.test("minor-unit conversion is exact for USD and ZiG cents", () => {
  const cases: Array<[number, number]> = [
    [1, 100],
    [0.01, 1],
    [12.34, 1234],
    [125.5, 12550],
  ];

  for (const [major, minor] of cases) {
    if (toMinorUnits(major) !== minor) {
      throw new Error(`Incorrect minor-unit conversion for ${major}.`);
    }
  }
});

Deno.test("provider adapters keep demo and manual-bank paths separate", () => {
  const ecoCash = paymentProviderFor("ecocash").prepareIntent();
  const cbz = paymentProviderFor("cbz_transfer").prepareIntent();
  const cabs = paymentProviderFor("cabs_transfer").prepareIntent();

  if (ecoCash.provider !== "simulated" || ecoCash.mode !== "demo") {
    throw new Error("EcoCash must remain simulated in the demo.");
  }
  if (
    cbz.provider !== "manual_bank" ||
    cabs.provider !== "manual_bank" ||
    cbz.mode !== "manual_review" ||
    cabs.mode !== "manual_review"
  ) {
    throw new Error("CBZ and CABS must use the manual-review adapter.");
  }
});

Deno.test("payment rate-limit subject is deterministic and opaque", async () => {
  const first = await hashPaymentRateLimitSubject(SCHOOL_ID, INVOICE_ID);
  const second = await hashPaymentRateLimitSubject(SCHOOL_ID, INVOICE_ID);

  if (first !== second || !/^[a-f0-9]{64}$/.test(first)) {
    throw new Error("Payment rate-limit subject must be a stable SHA-256 hash.");
  }
});
