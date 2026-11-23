import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { requireSchoolRole } from "../_shared/auth.ts";
import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { createServiceClient, getRequiredEnv } from "../_shared/supabase.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import {
  hashPaymentRateLimitSubject,
  paymentIntentSchema,
  paymentProviderFor,
  toMinorUnits,
} from "../_shared/payments.ts";

interface PaymentRow {
  id: string;
  school_id: string;
  invoice_id: string;
  amount_minor: number | string;
  currency: "USD" | "ZiG";
  method: "ecocash" | "cbz_transfer" | "cabs_transfer";
  status: "pending" | "processing" | "succeeded" | "failed" | "cancelled" | "refunded";
  idempotency_key: string;
  reference: string | null;
  created_by: string;
  provider: "simulated" | "manual_bank" | "paynow";
}

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  const body = await parseJsonBody(request, paymentIntentSchema);
  const serviceClient = createServiceClient();

  const actor = await requireSchoolRole(
    request,
    body.schoolId,
    ["guardian"],
    serviceClient,
  );

  const { data: school, error: schoolError } = await serviceClient
    .from("schools")
    .select("id, status")
    .eq("id", actor.schoolId)
    .maybeSingle();

  if (schoolError) throw schoolError;
  if (!school || school.status !== "active") {
    throw new HttpError(
      "CONFLICT",
      "Payments are unavailable while the school account is inactive.",
      409,
    );
  }

  const subjectHash = await hashPaymentRateLimitSubject(
    actor.schoolId,
    actor.userId,
  );
  const { data: rateLimitAllowed, error: rateLimitError } = await serviceClient
    .rpc("consume_rate_limit", {
      p_school_id: actor.schoolId,
      p_action: "finance.payment.initiate",
      p_subject_hash: subjectHash,
      p_limit: 5,
      p_window_seconds: 300,
    });

  if (rateLimitError) throw rateLimitError;
  if (rateLimitAllowed !== true) {
    throw new HttpError(
      "RATE_LIMITED",
      "Too many payment attempts. Wait five minutes before trying again.",
      429,
      { retryable: true },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    throw new HttpError(
      "UNAUTHENTICATED",
      "Sign in to continue.",
      401,
    );
  }

  // The service key identifies the project; the caller's verified JWT sets
  // the Postgres role to authenticated so auth.uid() remains the guardian.
  const userContextClient = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: authorization,
          "X-Client-Info": "predrive-payment-intent",
        },
      },
    },
  );

  const provider = paymentProviderFor(body.method).prepareIntent();
  const { data, error } = await userContextClient.rpc("initiate_payment", {
    p_school_id: actor.schoolId,
    p_invoice_id: body.invoiceId,
    p_amount_minor: toMinorUnits(body.amount),
    p_currency: body.currency,
    p_method: body.method,
    p_idempotency_key: body.idempotencyKey,
  });

  if (error) throw error;

  const payment = data as PaymentRow | null;
  if (
    !payment ||
    typeof payment.id !== "string" ||
    payment.school_id !== actor.schoolId ||
    payment.created_by !== actor.userId
  ) {
    throw new HttpError(
      "UNAVAILABLE",
      "The payment request could not be confirmed. Please check your invoices before retrying.",
      503,
      { retryable: true },
    );
  }

  if (payment.provider !== provider.provider || payment.status !== provider.status) {
    throw new HttpError(
      "UNAVAILABLE",
      "The payment provider returned an unexpected intent state.",
      503,
    );
  }

  const amountMinor = Number(payment.amount_minor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new HttpError(
      "UNAVAILABLE",
      "The payment amount could not be confirmed.",
      503,
    );
  }

  return jsonOk({
    id: payment.id,
    schoolId: payment.school_id,
    invoiceId: payment.invoice_id,
    amount: {
      amount: amountMinor / 100,
      currency: payment.currency,
    },
    method: payment.method,
    status: payment.status,
    idempotencyKey: payment.idempotency_key,
    ...(payment.reference ? { reference: payment.reference } : {}),
    createdBy: payment.created_by,
  });
}, "create-payment-intent");

Deno.serve(handler);
