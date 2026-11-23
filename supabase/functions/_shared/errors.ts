export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: ApiFieldError[];
  retryable: boolean;
  correlationId: string;
}

export class HttpError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly fieldErrors?: ApiFieldError[];

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    options: {
      retryable?: boolean;
      fieldErrors?: ApiFieldError[];
    } = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status;
    this.retryable = options.retryable ??
      (code === "RATE_LIMITED" || code === "NETWORK" || code === "UNAVAILABLE");
    this.fieldErrors = options.fieldErrors;
  }
}

const SAFE_DATABASE_MESSAGES: Record<string, {
  code: ApiErrorCode;
  message: string;
  status: number;
}> = {
  UNAUTHENTICATED: {
    code: "UNAUTHENTICATED",
    message: "Sign in to continue.",
    status: 401,
  },
  FORBIDDEN: {
    code: "FORBIDDEN",
    message: "You do not have permission to perform this action.",
    status: 403,
  },
  VALIDATION: {
    code: "VALIDATION",
    message: "Check the supplied information and try again.",
    status: 400,
  },
  NOT_FOUND: {
    code: "NOT_FOUND",
    message: "The requested record could not be found.",
    status: 404,
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    message: "Too many attempts. Please wait before trying again.",
    status: 429,
  },
  CONFLICT: {
    code: "CONFLICT",
    message: "The requested operation conflicts with the current record state.",
    status: 409,
  },
};

const DATABASE_MESSAGE_CODES: Record<string, ApiErrorCode> = {
  PROFILE_REQUIRED: "NOT_FOUND",
  INVITATION_NOT_FOUND: "NOT_FOUND",
  TRIP_CHILD_NOT_FOUND: "NOT_FOUND",
  APPROVED_COLLECTOR_NOT_FOUND: "NOT_FOUND",
  CHILD_NOT_FOUND: "NOT_FOUND",
  FORBIDDEN_OR_NOT_FOUND: "NOT_FOUND",
  TEMPORARY_COLLECTOR_NOT_FOUND_OR_EXPIRED: "NOT_FOUND",
  PAYABLE_INVOICE_NOT_FOUND: "NOT_FOUND",
  PAYMENT_NOT_FOUND: "NOT_FOUND",
  SETTLED_PAYMENT_NOT_FOUND: "NOT_FOUND",
  REFUND_NOT_FOUND: "NOT_FOUND",
  FEE_ITEM_NOT_FOUND_OR_CURRENCY_MISMATCH: "NOT_FOUND",
  PENDING_BANK_PAYMENT_NOT_FOUND: "NOT_FOUND",
  SCHOOL_SUSPENDED: "FORBIDDEN",
  ACTIVE_ASSIGNED_TRIP_REQUIRED: "FORBIDDEN",
  ACTIVE_SUPERVISOR_TRIP_REQUIRED: "FORBIDDEN",
  PIN_INVALID: "FORBIDDEN",
  TRIP_NOT_STARTABLE: "CONFLICT",
  TRIP_NOT_CANCELLABLE: "CONFLICT",
  IDEMPOTENCY_KEY_REUSED: "CONFLICT",
  CHILD_STATUS_CONFLICT: "CONFLICT",
  CHILD_NOT_ON_BOARD: "CONFLICT",
  MEMBERSHIP_ROLE_CONFLICT: "CONFLICT",
  DELETION_REQUEST_NOT_COMPLETABLE: "CONFLICT",
  PAYMENT_ALREADY_SETTLED: "CONFLICT",
  INVOICE_BALANCE_CHANGED: "CONFLICT",
  INVOICE_NOT_ISSUABLE: "CONFLICT",
  INVOICE_NOT_VOIDABLE: "CONFLICT",
  BANK_TRANSFER_NOT_REVIEWABLE: "CONFLICT",
  PAYMENT_AMOUNT_INVALID_OR_RESERVED: "VALIDATION",
  REFUND_EXCEEDS_PAYMENT: "VALIDATION",
  INVOICE_LINE_VALIDATION: "VALIDATION",
  PIN_LOCKED: "RATE_LIMITED",
};

const PUBLIC_ERROR_DETAILS: Record<ApiErrorCode, {
  message: string;
  status: number;
}> = {
  UNAUTHENTICATED: {
    message: "Sign in to continue.",
    status: 401,
  },
  FORBIDDEN: {
    message: "You do not have permission to perform this action.",
    status: 403,
  },
  NOT_FOUND: {
    message: "The requested record could not be found.",
    status: 404,
  },
  VALIDATION: {
    message: "Check the supplied information and try again.",
    status: 400,
  },
  CONFLICT: {
    message: "The requested operation conflicts with the current record state.",
    status: 409,
  },
  RATE_LIMITED: {
    message: "Too many attempts. Please wait before trying again.",
    status: 429,
  },
  NETWORK: {
    message: "The network request could not be completed.",
    status: 503,
  },
  UNAVAILABLE: {
    message: "The service is temporarily unavailable. Please try again.",
    status: 503,
  },
  UNKNOWN: {
    message: "The request could not be completed.",
    status: 500,
  },
};

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  } | null;

  const message = typeof candidate?.message === "string"
    ? candidate.message
    : "";
  const databaseCode = typeof candidate?.code === "string"
    ? candidate.code
    : "";

  const safeMessage = SAFE_DATABASE_MESSAGES[message];
  if (safeMessage) {
    return new HttpError(
      safeMessage.code,
      safeMessage.message,
      safeMessage.status,
    );
  }

  const mappedCode = DATABASE_MESSAGE_CODES[message];
  if (mappedCode) {
    const publicDetails = PUBLIC_ERROR_DETAILS[mappedCode];
    return new HttpError(
      mappedCode,
      publicDetails.message,
      publicDetails.status,
      { retryable: mappedCode === "RATE_LIMITED" },
    );
  }

  switch (databaseCode) {
    case "28000":
      return new HttpError(
        "UNAUTHENTICATED",
        "Sign in to continue.",
        401,
      );
    case "42501":
      return new HttpError(
        "FORBIDDEN",
        "You do not have permission to perform this action.",
        403,
      );
    case "PGRST116":
    case "P0002":
      return new HttpError(
        "NOT_FOUND",
        "The requested record could not be found.",
        404,
      );
    case "22023":
      return new HttpError(
        "VALIDATION",
        "Check the supplied information and try again.",
        400,
      );
    case "23505":
    case "23503":
    case "40001":
      return new HttpError(
        "CONFLICT",
        "The requested operation conflicts with the current record state.",
        409,
      );
    case "429":
      return new HttpError(
        "RATE_LIMITED",
        "Too many attempts. Please wait before trying again.",
        429,
        { retryable: true },
      );
    case "57014":
    case "53300":
    case "08000":
    case "08003":
    case "08006":
      return new HttpError(
        "UNAVAILABLE",
        "The service is temporarily unavailable. Please try again.",
        503,
        { retryable: true },
      );
    default:
      return new HttpError(
        "UNKNOWN",
        "The request could not be completed.",
        500,
      );
  }
}

export function toApiError(error: unknown, correlationId: string): ApiError {
  const normalized = toHttpError(error);

  return {
    code: normalized.code,
    message: normalized.message,
    ...(normalized.fieldErrors
      ? { fieldErrors: normalized.fieldErrors }
      : {}),
    retryable: normalized.retryable,
    correlationId,
  };
}
