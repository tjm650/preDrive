import type { ApiResult } from "../api/types";
import type { InitiatePaymentInput } from "../api/inputs";
import type { Money } from "../../types/common";
import type {
  CurrencyCode,
  Payment,
  PaymentMethod,
  PaymentReceipt,
  PaymentStatus,
} from "../../types/safety-finance";
import type { SupabaseReadClient } from "./read";
import type { SupabaseRpcClient } from "./trip-commands";
import { toSupabaseApiError } from "./errors";
import type { DatabaseRow } from "./mappers";

export interface SupabaseFinanceClient extends SupabaseRpcClient, SupabaseReadClient {}

const CURRENCIES: readonly CurrencyCode[] = ["USD", "ZiG"];
const METHODS: readonly PaymentMethod[] = [
  "ecocash",
  "cbz_transfer",
  "cabs_transfer",
];
const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
];

function requiredString(row: DatabaseRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Invalid payment record");
  }
  return value;
}

function optionalString(row: DatabaseRow, key: string): string | undefined {
  return typeof row[key] === "string" ? (row[key] as string) : undefined;
}

function amountFromMinor(value: unknown, currency: CurrencyCode): Money {
  const minor = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid payment amount");
  return { amount: minor / 100, currency };
}

function mapPayment(row: DatabaseRow): Payment {
  const currency = requiredString(row, "currency") as CurrencyCode;
  const method = requiredString(row, "method") as PaymentMethod;
  const status = requiredString(row, "status") as PaymentStatus;
  if (!CURRENCIES.includes(currency) || !METHODS.includes(method) || !PAYMENT_STATUSES.includes(status)) {
    throw new Error("Invalid payment record");
  }
  return {
    id: requiredString(row, "id"),
    schoolId: requiredString(row, "school_id"),
    invoiceId: requiredString(row, "invoice_id"),
    amount: amountFromMinor(row.amount_minor, currency),
    method,
    status,
    idempotencyKey: requiredString(row, "idempotency_key"),
    ...(optionalString(row, "reference") ? { reference: optionalString(row, "reference") } : {}),
    createdBy: requiredString(row, "created_by"),
    createdAt: requiredString(row, "created_at"),
    updatedAt: requiredString(row, "updated_at"),
  };
}

function mapReceipt(row: DatabaseRow): PaymentReceipt {
  const createdAt = requiredString(row, "created_at");
  return {
    id: requiredString(row, "id"),
    schoolId: requiredString(row, "school_id"),
    paymentId: requiredString(row, "payment_id"),
    receiptNumber: requiredString(row, "receipt_number"),
    issuedAt: requiredString(row, "issued_at"),
    createdAt,
    // Receipt records are immutable and the schema intentionally has no updated_at.
    updatedAt: createdAt,
  };
}

function validation(message: string): ApiResult<never> {
  return {
    ok: false,
    error: { code: "VALIDATION", message, retryable: false },
  };
}

/**
 * Guardian-facing payment commands. The database RPC enforces invoice
 * ownership, outstanding balance, idempotency and payment-method rules.
 * The client only initiates a simulated payment; provider settlement is not
 * implied by a successful initiation response.
 */
export class SupabaseFinanceCommandAdapter {
  constructor(
    private readonly client: SupabaseFinanceClient,
    private readonly getActiveSchoolId: () => string | null,
  ) {}

  async initiatePayment(input: InitiatePaymentInput): Promise<ApiResult<Payment>> {
    const schoolId = this.getActiveSchoolId();
    if (!schoolId) return validation("Sign in and select a school before making a payment.");

    const { amount } = input.amount;
    const currency = input.amount.currency;
    const minorAmount = Math.round(amount * 100);
    if (
      !input.invoiceId.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isSafeInteger(minorAmount) ||
      Math.abs(amount * 100 - minorAmount) > 1e-7 ||
      !CURRENCIES.includes(currency) ||
      !METHODS.includes(input.method) ||
      input.idempotencyKey.trim().length < 8 ||
      input.idempotencyKey.trim().length > 160
    ) {
      return validation("Check the invoice, amount, currency, payment method and reference.");
    }

    try {
      const { data, error } = await this.client.rpc<DatabaseRow>("initiate_payment", {
        p_school_id: schoolId,
        p_invoice_id: input.invoiceId,
        p_amount_minor: minorAmount,
        p_currency: currency,
        p_method: input.method,
        p_idempotency_key: input.idempotencyKey.trim(),
      });
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (!data) {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "The payment request could not be confirmed. Please try again.",
            retryable: true,
          },
        };
      }
      try {
        return { ok: true, data: mapPayment(data) };
      } catch {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "The payment request could not be confirmed. Please contact the school before retrying.",
            retryable: false,
          },
        };
      }
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }

  async getReceipt(paymentId: string): Promise<ApiResult<PaymentReceipt>> {
    if (!paymentId.trim()) return validation("A valid payment is required.");
    try {
      const { data, error } = await this.client
        .from("receipts")
        .select("id,school_id,payment_id,receipt_number,issued_at,created_at")
        .eq("payment_id", paymentId)
        .maybeSingle<DatabaseRow>();
      if (error) return { ok: false, error: toSupabaseApiError(error) };
      if (!data) {
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "A receipt is not available for this payment yet.",
            retryable: false,
          },
        };
      }
      try {
        return { ok: true, data: mapReceipt(data) };
      } catch {
        return {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message: "The receipt could not be loaded. Please try again.",
            retryable: true,
          },
        };
      }
    } catch (error) {
      return { ok: false, error: toSupabaseApiError(error) };
    }
  }
}
