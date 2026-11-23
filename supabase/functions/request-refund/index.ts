import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import { requireSchoolRole } from "../_shared/auth.ts";
import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import {
  createServiceClient,
  getRequiredEnv,
} from "../_shared/supabase.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { hashPaymentRateLimitSubject } from "../_shared/payments.ts";
import { refundRequestSchema } from "../_shared/finance.ts";

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  const body = await parseJsonBody(request, refundRequestSchema);
  const serviceClient = createServiceClient();
  const actor = await requireSchoolRole(
    request,
    body.schoolId,
    ["school_admin"],
    serviceClient,
  );

  const subjectHash = await hashPaymentRateLimitSubject(
    actor.schoolId,
    actor.userId,
  );
  const { data: rateLimitAllowed, error: rateLimitError } = await serviceClient
    .rpc("consume_rate_limit", {
      p_school_id: actor.schoolId,
      p_action: "finance.refund.request",
      p_subject_hash: subjectHash,
      p_limit: 5,
      p_window_seconds: 900,
    });

  if (rateLimitError) throw rateLimitError;
  if (rateLimitAllowed !== true) {
    throw new HttpError(
      "RATE_LIMITED",
      "Too many refund requests. Wait 15 minutes before trying again.",
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

  // Keep the verified administrator JWT in the RPC context. The database
  // derives auth.uid() and independently checks the school_admin role.
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
          "X-Client-Info": "predrive-refund-request",
        },
      },
    },
  );

  const { data: refundId, error } = await userContextClient.rpc(
    "request_refund",
    {
      p_school_id: actor.schoolId,
      p_payment_id: body.paymentId,
      p_amount_minor: body.amountMinor,
      p_reason: body.reason,
    },
  );

  if (error) throw error;
  if (typeof refundId !== "string") {
    throw new HttpError(
      "UNAVAILABLE",
      "The refund request could not be confirmed. Please refresh and check the payment.",
      503,
      { retryable: true },
    );
  }

  return jsonOk({
    refundId,
    status: "pending" as const,
  }, 201);
}, "request-refund");

Deno.serve(handler);
