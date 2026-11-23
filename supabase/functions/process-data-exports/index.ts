import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireCronSecret } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import {
  buildPersonalDataExport,
  storePersonalDataExport,
} from "../_shared/data-export.ts";
import { dataExportObjectPath } from "../_shared/privacy.ts";

const BATCH_SIZE = 10;

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }
  await requireCronSecret(request);

  const client = createServiceClient();
  const { data: requests, error } = await client
    .from("deletion_requests")
    .select("id,school_id,requested_by,subject_user_id,request_type,status,retention_hold")
    .eq("request_type", "data_export")
    .eq("status", "processing")
    .eq("retention_hold", false)
    .order("requested_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw error;

  let completed = 0;
  let failed = 0;

  for (const item of requests ?? []) {
    if (
      item.request_type !== "data_export" ||
      item.status !== "processing" ||
      item.retention_hold !== false ||
      !item.subject_user_id ||
      !item.requested_by ||
      item.subject_user_id !== item.requested_by
    ) {
      failed += 1;
      continue;
    }

    let objectPath: string | null = null;
    try {
      const payload = await buildPersonalDataExport(client, item.subject_user_id);
      objectPath = await storePersonalDataExport(
        client,
        item.school_id,
        item.id,
        payload,
      );

      const { error: completionError } = await client.rpc(
        "complete_deletion_request",
        {
          p_school_id: item.school_id,
          p_request_id: item.id,
          p_completion_note: "Personal data export prepared. Download is available for seven days.",
        },
      );
      if (completionError) throw completionError;
      completed += 1;
    } catch {
      if (objectPath) {
        await client.storage.from("exports").remove([objectPath]);
      }
      failed += 1;
    }
  }

  return jsonOk({ processed: (requests ?? []).length, completed, failed });
}, "process-data-exports");

Deno.serve(handler);
