import { z } from "npm:zod@4.6.7";
import { HttpError } from "./errors.ts";

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
): Promise<z.output<TSchema>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(
      "VALIDATION",
      "A JSON request body is required.",
      415,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > maxBodyBytes
  ) {
    throw new HttpError(
      "VALIDATION",
      "The request body is too large.",
      413,
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    throw new HttpError(
      "VALIDATION",
      "The request body could not be read.",
      400,
    );
  }

  if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
    throw new HttpError(
      "VALIDATION",
      "The request body is too large.",
      413,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new HttpError(
      "VALIDATION",
      "The request body must contain valid JSON.",
      400,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(
      "VALIDATION",
      "Check the supplied information and try again.",
      400,
      {
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.map(String).join(".") || "_root",
          message: issue.message,
        })),
      },
    );
  }

  return parsed.data;
}

export { z };
