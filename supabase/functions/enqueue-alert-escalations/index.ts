import { createEdgeHandler, jsonOk } from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireCronSecret } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const BATCH_SIZE = 100;

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }

  await requireCronSecret(request);

  const client = createServiceClient();
  const { data, error } = await client.rpc(
    "enqueue_due_alert_escalations",
    { p_batch_size: BATCH_SIZE },
  );

  if (error) {
    throw new HttpError(
      "UNAVAILABLE",
      "Due alert escalations could not be processed. The scheduler will retry.",
      503,
      { retryable: true },
    );
  }

  if (
    typeof data !== "number" ||
    !Number.isInteger(data) ||
    data < 0 ||
    data > BATCH_SIZE
  ) {
    throw new HttpError(
      "UNAVAILABLE",
      "The escalation processor returned an invalid result.",
      503,
      { retryable: true },
    );
  }

  return jsonOk({
    processedAlerts: data,
    batchLimit: BATCH_SIZE,
  });
}, "enqueue-alert-escalations");

Deno.serve(handler);
