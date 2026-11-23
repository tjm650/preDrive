import { applyCors, resolveCors } from "./cors.ts";
import {
  HttpError,
  toApiError,
  toHttpError,
} from "./errors.ts";
import { logger } from "./logger.ts";

export interface RequestContext {
  requestId: string;
  startedAt: number;
}

export type EdgeHandler = (
  request: Request,
  context: RequestContext,
) => Promise<Response>;

function getRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id") ?? "";
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(supplied)
  ) {
    return supplied;
  }
  return crypto.randomUUID();
}

export function jsonOk<T>(
  data: T,
  status = 200,
): Response {
  return Response.json(
    { ok: true, data },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function jsonError(
  error: unknown,
  requestId: string,
): Response {
  const normalized = toHttpError(error);
  return Response.json(
    {
      ok: false,
      error: toApiError(normalized, requestId),
    },
    {
      status: normalized.status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function createEdgeHandler(
  handler: EdgeHandler,
  functionName = "unnamed-function",
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = getRequestId(request);
    const startedAt = performance.now();

    let cors;
    try {
      cors = resolveCors(request);
    } catch {
      const response = jsonError(
        new HttpError(
          "UNAVAILABLE",
          "The service is not configured to accept this request.",
          503,
        ),
        requestId,
      );
      return response;
    }

    if (!cors.allowed) {
      logger.warn("request.cors_rejected", {
        requestId,
        outcome: "rejected",
        status: 403,
        functionName,
      });

      return applyCors(
        jsonError(
          new HttpError(
            "FORBIDDEN",
            "This origin is not allowed to access the service.",
            403,
          ),
          requestId,
        ),
        cors,
      );
    }

    if (request.method === "OPTIONS") {
      return applyCors(new Response(null, { status: 204 }), cors);
    }

    try {
      const response = await handler(request, {
        requestId,
        startedAt,
      });

      logger.info("request.completed", {
        requestId,
        status: response.status,
        durationMs: performance.now() - startedAt,
        outcome: response.ok ? "success" : "rejected",
        functionName,
      });

      return applyCors(response, cors);
    } catch (error) {
      const normalized = toHttpError(error);

      logger[normalized.status >= 500 ? "error" : "warn"](
        "request.failed",
        {
          requestId,
          status: normalized.status,
          durationMs: performance.now() - startedAt,
          errorCode: normalized.code,
          outcome: "failed",
          functionName,
        },
      );

      return applyCors(jsonError(normalized, requestId), cors);
    }
  };
}
