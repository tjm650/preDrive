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

const BATCH_SIZE = 10;
const LEASE_SECONDS = 900;

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }
  await requireCronSecret(request);

  const client = createServiceClient();
  const { data: requests, error } = await client.rpc(
    "claim_data_export_requests",
    {
      p_batch_size: BATCH_SIZE,
      p_lease_seconds: LEASE_SECONDS,
    },
  );

  if (error) throw error;

  let completed = 0;
  let failed = 0;

  for (const item of requests ?? []) {
    const leaseId = item.processing_lease_id as string;
    let objectPath: string | null = null;

    try {
      if (
        !item.subject_user_id ||
        !item.requested_by ||
        item.subject_user_id !== item.requested_by
      ) {
        throw new Error("EXPORT_SUBJECT_MISMATCH");
      }

      const payload = await buildPersonalDataExport(
        client,
        item.subject_user_id,
      );
      objectPath = await storePersonalDataExport(
        client,
        item.school_id,
        item.id,
        leaseId,
        payload,
      );

      const { error: completionError } = await client.rpc(
        "complete_data_export_request",
        {
          p_school_id: item.school_id,
          p_request_id: item.id,
          p_lease_id: leaseId,
          p_object_path: objectPath,
        },
      );
      if (completionError) throw completionError;
      completed += 1;
    } catch {
      const { data: released, error: releaseError } = await client.rpc(
        "release_data_export_request",
        {
          p_school_id: item.school_id,
          p_request_id: item.id,
          p_lease_id: leaseId,
        },
      );

      // Each lease has a unique object path, so cleanup cannot remove a
      // newer worker's artifact even after this worker loses its lease.
      if (objectPath) {
        await client.storage.from("exports").remove([objectPath]);
      }
      failed += 1;
    }
  }

  return jsonOk({ processed: (requests ?? []).length, completed, failed });
}, "process-data-exports");

Deno.serve(handler);
