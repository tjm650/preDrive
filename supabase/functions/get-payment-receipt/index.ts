import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { parseJsonBody } from "../_shared/validation.ts";
import { receiptRequestSchema } from "../_shared/finance.ts";

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  const body = await parseJsonBody(request, receiptRequestSchema);
  const serviceClient = createServiceClient();
  const authenticated = await requireUser(request, serviceClient);

  const { data: payment, error: paymentError } = await serviceClient
    .from("payments")
    .select("id, school_id, invoice_id, status")
    .eq("id", body.paymentId)
    .maybeSingle();

  if (paymentError) throw paymentError;
  if (!payment || payment.status !== "succeeded") {
    throw new HttpError(
      "NOT_FOUND",
      "A settled payment receipt could not be found.",
      404,
    );
  }

  const { data: invoice, error: invoiceError } = await serviceClient
    .from("invoices")
    .select("id, school_id, guardian_user_id")
    .eq("id", payment.invoice_id)
    .eq("school_id", payment.school_id)
    .maybeSingle();

  if (invoiceError) throw invoiceError;
  if (!invoice || invoice.guardian_user_id !== authenticated.user.id) {
    throw new HttpError(
      "NOT_FOUND",
      "A settled payment receipt could not be found.",
      404,
    );
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from("school_memberships")
    .select("role, active")
    .eq("school_id", payment.school_id)
    .eq("user_id", authenticated.user.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership || membership.active !== true || membership.role !== "guardian") {
    throw new HttpError(
      "FORBIDDEN",
      "Your active guardian membership is required to view this receipt.",
      403,
    );
  }

  const { data: receipt, error: receiptError } = await serviceClient
    .from("receipts")
    .select("id, school_id, payment_id, receipt_number, issued_at")
    .eq("school_id", payment.school_id)
    .eq("payment_id", payment.id)
    .maybeSingle();

  if (receiptError) throw receiptError;
  if (!receipt) {
    throw new HttpError(
      "NOT_FOUND",
      "A settled payment receipt could not be found.",
      404,
    );
  }

  return jsonOk({
    id: receipt.id,
    schoolId: receipt.school_id,
    paymentId: receipt.payment_id,
    receiptNumber: receipt.receipt_number,
    issuedAt: receipt.issued_at,
  });
}, "get-payment-receipt");

Deno.serve(handler);
