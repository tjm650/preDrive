import { z } from "./validation.ts";

export const paymentIntentSchema = z.object({
  schoolId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: z.number().finite().positive().max(Number.MAX_SAFE_INTEGER / 100)
    .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7, {
      message: "Payment amounts may have no more than two decimal places.",
    }),
  currency: z.enum(["USD", "ZiG"]),
  method: z.enum(["ecocash", "cbz_transfer", "cabs_transfer"]),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();

export type PaymentIntentRequest = z.infer<typeof paymentIntentSchema>;
export type SupportedPaymentMethod = PaymentIntentRequest["method"];
export type PaymentProviderName = "simulated" | "manual_bank";

export interface PaymentProviderPreparation {
  provider: PaymentProviderName;
  status: "pending";
  mode: "demo" | "manual_review";
}

export interface PaymentProviderAdapter {
  readonly methods: readonly SupportedPaymentMethod[];
  prepareIntent(): PaymentProviderPreparation;
}

const ecoCashDemoAdapter: PaymentProviderAdapter = {
  methods: ["ecocash"],
  prepareIntent: () => ({
    provider: "simulated",
    status: "pending",
    mode: "demo",
  }),
};

const bankTransferAdapter: PaymentProviderAdapter = {
  methods: ["cbz_transfer", "cabs_transfer"],
  prepareIntent: () => ({
    provider: "manual_bank",
    status: "pending",
    mode: "manual_review",
  }),
};

export function paymentProviderFor(
  method: SupportedPaymentMethod,
): PaymentProviderAdapter {
  if (ecoCashDemoAdapter.methods.includes(method)) return ecoCashDemoAdapter;
  return bankTransferAdapter;
}

export function toMinorUnits(amount: number): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-7
  ) {
    throw new RangeError("Payment amount must be positive with at most two decimal places.");
  }

  const minorUnits = Math.round(amount * 100);
  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw new RangeError("Payment amount exceeds the supported range.");
  }

  return minorUnits;
}

export async function hashPaymentRateLimitSubject(
  schoolId: string,
  userId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${schoolId}:${userId}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
