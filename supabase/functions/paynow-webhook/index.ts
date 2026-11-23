import { createEdgeHandler, jsonOk } from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { createServiceClient, getRequiredEnv } from "../_shared/supabase.ts";
import {
  readPaynowBody,
  verifyPaynowCallback,
} from "../_shared/paynow.ts";

interface PaymentMatch {
  id: string;
  school_id: string;
  amount_minor: number | string;
  currency: "USD" | "ZiG";
  provider: string;
  status: string;
}

interface WebhookEventRow {
  id: string;
  processing_status: "received" | "processing" | "processed" | "ignored" | "failed";
  attempt_count: number;
}

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }

  let rawBody: string;
  try {
    rawBody = await readPaynowBody(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "PAYNOW_BODY_TOO_LARGE" ? 413 : 400;
    throw new HttpError(
      "VALIDATION",
      "The Paynow callback format is invalid.",
      status,
    );
  }

  let callback;
  try {
    callback = await verifyPaynowCallback(
      rawBody,
      getRequiredEnv("PAYNOW_INTEGRATION_KEY"),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PAYNOW_INTEGRATION_KEY_MISSING") {
      throw new HttpError(
        "UNAVAILABLE",
        "The payment notification service is not configured.",
        503,
      );
    }
    throw new HttpError(
      "FORBIDDEN",
      "The payment notification could not be authenticated.",
      401,
    );
  }

  const client = createServiceClient();
  const { data: paymentRows, error: paymentLookupError } = await client
    .from("payments")
    .select("id, school_id, amount_minor, currency, provider, status")
    .eq("reference", callback.reference)
    .eq("provider", "paynow")
    .limit(2);

  if (paymentLookupError) throw paymentLookupError;
  const matches = (paymentRows ?? []) as PaymentMatch[];
  const payment = matches.length === 1 ? matches[0] : null;

  const { data: insertedEvent, error: insertError } = await client
    .from("webhook_events")
    .insert({
      school_id: payment?.school_id ?? null,
      provider: "paynow",
      provider_event_id: callback.payloadSha256,
      event_type: callback.status,
      payload: callback.safePayload,
      payload_sha256: callback.payloadSha256,
      signature_verified: true,
      processing_status: "received",
    })
    .select("id, processing_status, attempt_count")
    .maybeSingle();

  let event = insertedEvent as WebhookEventRow | null;

  if (insertError) {
    if (insertError.code !== "23505") throw insertError;

    const { data: existingEvent, error: existingError } = await client
      .from("webhook_events")
      .select("id, processing_status, attempt_count")
      .eq("provider", "paynow")
      .eq("provider_event_id", callback.payloadSha256)
      .maybeSingle();

    if (existingError) throw existingError;
    event = existingEvent as WebhookEventRow | null;
  }

  if (!event) {
    throw new HttpError(
      "UNAVAILABLE",
      "The payment notification could not be recorded.",
      503,
      { retryable: true },
    );
  }

  if (
    event.processing_status === "processed" ||
    event.processing_status === "ignored"
  ) {
    return jsonOk({ accepted: true, duplicate: true });
  }

  const attemptCount = Math.min(event.attempt_count + 1, 20);
  const markEvent = async (
    status: "processed" | "ignored" | "failed",
    errorCode: string | null = null,
  ) => {
    const { error } = await client
      .from("webhook_events")
      .update({
        processing_status: status,
        processed_at: status === "failed" ? null : new Date().toISOString(),
        attempt_count: attemptCount,
        last_error_code: errorCode,
      })
      .eq("id", event!.id);

    if (error) throw error;
  };

  if (!payment || matches.length !== 1) {
    await markEvent("ignored", "PAYMENT_REFERENCE_NOT_FOUND");
    return jsonOk({ accepted: true, processed: false });
  }

  const amountMinor = Number(payment.amount_minor);
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor !== callback.amountMinor
  ) {
    await markEvent("failed", "PAYMENT_AMOUNT_MISMATCH");
    throw new HttpError(
      "CONFLICT",
      "The payment notification does not match the recorded payment amount.",
      409,
    );
  }

  if (callback.status !== "Paid") {
    await markEvent("ignored", "PAYMENT_STATUS_NOT_SETTLEABLE");
    return jsonOk({ accepted: true, processed: false });
  }

  const { error: settlementError } = await client.rpc("apply_payment_result", {
    p_payment_id: payment.id,
    p_succeeded: true,
    p_provider_reference: callback.paynowReference,
  });

  if (settlementError) {
    await markEvent("failed", "PAYMENT_SETTLEMENT_FAILED");
    throw settlementError;
  }

  await markEvent("processed");
  return jsonOk({ accepted: true, processed: true });
}, "paynow-webhook");

Deno.serve(handler);
