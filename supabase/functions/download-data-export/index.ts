import {
  createEdgeHandler,
  jsonOk,
} from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { parseJsonBody, z } from "../_shared/validation.ts";
import {
  DATA_EXPORT_BUCKET,
  DATA_EXPORT_SIGNED_URL_SECONDS,
  isValidDataExportObjectPath,
  isValidDeletionRequestId,
} from "../_shared/privacy.ts";

const schema = z.object({
  requestId: z.string().refine(isValidDeletionRequestId),
}).strict();

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }

  const body = await parseJsonBody(request, schema);
  const client = createServiceClient();
  const authenticated = await requireUser(request, client);

  const { data: item, error } = await client
    .from("deletion_requests")
    .select("id,school_id,requested_by,subject_user_id,request_type,status,retention_hold,export_object_path")
    .eq("id", body.requestId)
    .eq("request_type", "data_export")
    .eq("status", "completed")
    .eq("retention_hold", false)
    .maybeSingle();

  if (error) throw error;
  if (
    !item ||
    item.requested_by !== authenticated.user.id ||
    item.subject_user_id !== authenticated.user.id ||
    !isValidDataExportObjectPath(item.school_id, item.id, item.export_object_path)
  ) {
    throw new HttpError("NOT_FOUND", "The requested export is unavailable.", 404);
  }

  const path = item.export_object_path;
  const { data, error: signedUrlError } = await client.storage
    .from(DATA_EXPORT_BUCKET)
    .createSignedUrl(path, DATA_EXPORT_SIGNED_URL_SECONDS, {
      download: "predrive-personal-data.json",
    });

  if (signedUrlError || !data?.signedUrl) {
    throw new HttpError(
      "NOT_FOUND",
      "The export has expired or is no longer available.",
      404,
    );
  }

  return jsonOk({
    url: data.signedUrl,
    expiresInSeconds: DATA_EXPORT_SIGNED_URL_SECONDS,
  });
}, "download-personal-data-export");

Deno.serve(handler);
