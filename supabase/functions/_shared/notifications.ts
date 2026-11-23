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
  if (input.locale.toLowerCase() !== "en") return null;

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
