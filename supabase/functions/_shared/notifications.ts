export interface NotificationContent {
  title: string;
  body: string;
  html: string;
}

export type NotificationErrorCode =
  | "DELIVERY_CONTEXT_UNAVAILABLE"
  | "DELIVERY_ATTEMPTS_EXHAUSTED"
  | "DEVICE_NOT_REGISTERED"
  | "EMAIL_PROVIDER_REJECTED"
  | "EMAIL_PROVIDER_RATE_LIMITED"
  | "EMAIL_PROVIDER_UNAVAILABLE"
  | "EMAIL_PROVIDER_RESPONSE_INVALID"
  | "EXPO_PROVIDER_REJECTED"
  | "EXPO_PROVIDER_RATE_LIMITED"
  | "EXPO_PROVIDER_UNAVAILABLE"
  | "EXPO_PROVIDER_RESPONSE_INVALID"
  | "LOCALE_TEMPLATE_UNAVAILABLE"
  | "RECIPIENT_NO_LONGER_ELIGIBLE";

const RETRY_DELAYS_MS = [
  30_000,
  120_000,
  600_000,
  1_800_000,
  3_600_000,
  7_200_000,
  7_200_000,
  7_200_000,
  7_200_000,
  7_200_000,
  7_200_000,
] as const;

export function notificationContent(input: {
  locale: string;
  title: string;
  message: string;
}): NotificationContent | null {
  const locale = input.locale.trim().replaceAll("_", "-").toLowerCase();
  // English regional variants use the same reviewed English copy. Shona and
  // Ndebele remain suppressed until their own native-reviewed templates exist.
  if (locale !== "en" && !locale.startsWith("en-")) return null;

  return {
    title: input.title,
    body: input.message,
    html: "<!doctype html><html><body style=\"font-family:Arial,sans-serif;color:#0F2A43;line-height:1.5\">" +
      "<h1 style=\"font-size:20px\">" + escapeHtml(input.title) + "</h1>" +
      "<p>" + escapeHtml(input.message).replace(/\n/g, "<br>") + "</p>" +
      "<p style=\"color:#526477;font-size:13px\">preDrive school notifications</p>" +
      "</body></html>",
  };
}

export function expoCollapseId(deliveryId: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(deliveryId)
  ) {
    throw new Error("Invalid notification delivery identifier.");
  }
  // 39 characters: safely below Expo/APNs collapse identifier limits.
  return "pd-" + deliveryId;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  error?: string;
}

export function parseExpoPushTicket(payload: unknown): ExpoPushTicket | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  const tickets = Array.isArray(data) ? data : [data];
  if (tickets.length !== 1 || !tickets[0] || typeof tickets[0] !== "object") {
    return null;
  }

  const ticket = tickets[0] as {
    status?: unknown;
    id?: unknown;
    details?: { error?: unknown };
  };
  if (ticket.status === "ok") {
    if (typeof ticket.id !== "string" || !ticket.id.trim() || ticket.id.length > 200) {
      return null;
    }
    return { status: "ok", id: ticket.id };
  }
  if (ticket.status === "error") {
    const error = ticket.details?.error;
    return {
      status: "error",
      error: typeof error === "string" && error.length <= 100 ? error : undefined,
    };
  }
  return null;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return character;
    }
  });
}

export function retryDelayMs(attemptCount: number): number | null {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) return null;
  return RETRY_DELAYS_MS[attemptCount - 1] ?? null;
}

export function classifyProviderFailure(
  provider: "expo" | "email",
  status: number,
): { retryable: boolean; code: NotificationErrorCode } {
  if (status === 429) {
    return {
      retryable: true,
      code: provider === "expo"
        ? "EXPO_PROVIDER_RATE_LIMITED"
        : "EMAIL_PROVIDER_RATE_LIMITED",
    };
  }

  if (status >= 500 || status === 0) {
    return {
      retryable: true,
      code: provider === "expo"
        ? "EXPO_PROVIDER_UNAVAILABLE"
        : "EMAIL_PROVIDER_UNAVAILABLE",
    };
  }

  return {
    retryable: false,
    code: provider === "expo"
      ? "EXPO_PROVIDER_REJECTED"
      : "EMAIL_PROVIDER_REJECTED",
  };
}

export function isExpoPushToken(value: string): boolean {
  return /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9+/_=-]{8,256}\]$/.test(
    value,
  );
}


export function classifyExpoReceipt(
  status: string | undefined,
  providerError: string | undefined,
): {
  status: "ok" | "error";
  errorCode: "DEVICE_NOT_REGISTERED" | "EXPO_RECEIPT_ERROR" | null;
  revokeDevice: boolean;
} | null {
  if (status === "ok") {
    return { status: "ok", errorCode: null, revokeDevice: false };
  }
  if (status !== "error") return null;
  if (providerError === "DeviceNotRegistered") {
    return {
      status: "error",
      errorCode: "DEVICE_NOT_REGISTERED",
      revokeDevice: true,
    };
  }
  return {
    status: "error",
    errorCode: "EXPO_RECEIPT_ERROR",
    revokeDevice: false,
  };
}
