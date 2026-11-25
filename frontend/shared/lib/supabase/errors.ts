import type { ApiError, ApiErrorCode } from "../api/types";

export interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
  statusCode?: string;
}

function isSupabaseError(value: unknown): value is SupabaseErrorLike {
  return typeof value === "object" && value !== null;
}

/**
 * Convert PostgREST/Postgres failures to safe UI errors.
 * Raw database messages, constraint names, SQL and provider details are never
 * returned to the application.
 */
export function toSupabaseApiError(value: unknown): ApiError {
  const error = isSupabaseError(value) ? value : {};
  const code = error.code ?? "";
  const status = error.status ?? Number(error.statusCode);
  let apiCode: ApiErrorCode = "UNKNOWN";
  let message = "We could not complete that request. Please try again.";
  let retryable = false;

  if (status === 401 || code === "PGRST301" || code === "28000") {
    apiCode = "UNAUTHENTICATED";
    message = "Your session has expired. Please sign in again.";
  } else if (status === 403 || code === "42501") {
    apiCode = "FORBIDDEN";
    message = "You do not have permission to complete that action.";
  } else if (status === 404 || code === "PGRST116") {
    apiCode = "NOT_FOUND";
    message = "The requested record could not be found.";
  } else if (status === 409 || code === "23505" || code === "23P01") {
    apiCode = "CONFLICT";
    message = "This record conflicts with an existing record.";
  } else if (status === 400 || code.startsWith("22") || code.startsWith("23")) {
    apiCode = "VALIDATION";
    message = "Some of the submitted information is invalid.";
  } else if (status === 429) {
    apiCode = "RATE_LIMITED";
    message = "Too many requests. Please try again shortly.";
    retryable = true;
  } else if (
    status >= 500 ||
    /network|fetch|timeout|connection/i.test(error.message ?? "")
  ) {
    apiCode = status >= 500 ? "UNAVAILABLE" : "NETWORK";
    message = "The service is temporarily unavailable. Check your connection and try again.";
    retryable = true;
  }

  return { code: apiCode, message, retryable };
}
