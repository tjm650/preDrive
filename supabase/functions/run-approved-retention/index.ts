import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireCronSecret } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { runApprovedRetention } from "../_shared/retention.ts";

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }
  await requireCronSecret(request);

  const result = await runApprovedRetention(createServiceClient());
  return jsonOk(result);
}, "run-approved-retention");

Deno.serve(handler);
