import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireCronSecret } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const BATCH_SIZE = 25;

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }
  await requireCronSecret(request);

  const client = createServiceClient();
  const { data: requests, error } = await client
    .from("deletion_requests")
    .select("id,school_id,request_type,status,retention_hold")
    .in("request_type", ["account", "child_record"])
    .eq("status", "processing")
    .eq("retention_hold", false)
    .order("requested_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw error;

  let completed = 0;
  let held = 0;
  let failed = 0;

  for (const item of requests ?? []) {
    try {
      const { data, error: rpcError } = await client.rpc(
        "execute_approved_deletion_request",
        {
          p_school_id: item.school_id,
          p_request_id: item.id,
        },
      );
      if (rpcError) throw rpcError;
      if (data === "completed") completed += 1;
      else if (data === "held") held += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return jsonOk({ processed: (requests ?? []).length, completed, held, failed });
}, "process-approved-deletions");

Deno.serve(handler);
