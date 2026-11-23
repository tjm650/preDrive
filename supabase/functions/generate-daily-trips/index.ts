import { requireCronSecret } from "../_shared/auth.ts";
import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError(
      "VALIDATION",
      "Only POST requests are supported.",
      405,
    );
  }

  await requireCronSecret(request);

  const client = createServiceClient();
  const { data, error } = await client.rpc("generate_daily_trips");

  if (error) {
    throw error;
  }

  return jsonOk(data);
}, "generate-daily-trips");

Deno.serve(handler);
