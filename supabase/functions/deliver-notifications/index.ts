import { createEdgeHandler, jsonOk } from "../_shared/http.ts";
import { HttpError } from "../_shared/errors.ts";
import { requireCronSecret } from "../_shared/auth.ts";
import {
  createServiceClient,
  getRequiredEnv,
  type ServiceClient,
} from "../_shared/supabase.ts";
import {
  classifyExpoReceipt,
  classifyProviderFailure,
  isExpoPushToken,
  notificationContent,
  expoCollapseId,
  parseExpoPushTicket,
  retryDelayMs,
  type NotificationErrorCode,
} from "../_shared/notifications.ts";

const BATCH_SIZE = 25;
const LEASE_MINUTES = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 12;

interface DeliveryCandidate {
  id: string;
  school_id: string;
  alert_recipient_id: string;
  channel: "push" | "email";
  locale: string;
  attempt_count: number;
  device_token_id: string | null;
}

interface DeliveryRow extends DeliveryCandidate {
  status: string;
}

interface RecipientRow {
  id: string;
  school_id: string;
  alert_id: string;
  recipient_user_id: string;
  acknowledged_at: string | null;
}

interface AlertRow {
  id: string;
  school_id: string;
  title: string;
  message: string;
  status: string;
  source_type: string;
  source_id: string | null;
  severity: string;
}

interface ProfileRow {
  email: string | null;
}

interface TokenRow {
  id: string;
  push_token: string;
}

interface ProviderResult {
  messageId: string;
  deviceNotRegistered?: boolean;
}

function safeCode(value: string): NotificationErrorCode {
  const allowed: readonly string[] = [
    "DELIVERY_CONTEXT_UNAVAILABLE",
    "DELIVERY_ATTEMPTS_EXHAUSTED",
    "DEVICE_NOT_REGISTERED",
    "EMAIL_PROVIDER_REJECTED",
    "EMAIL_PROVIDER_RATE_LIMITED",
    "EMAIL_PROVIDER_UNAVAILABLE",
    "EMAIL_PROVIDER_RESPONSE_INVALID",
    "EXPO_PROVIDER_REJECTED",
    "EXPO_PROVIDER_RATE_LIMITED",
    "EXPO_PROVIDER_UNAVAILABLE",
    "EXPO_PROVIDER_RESPONSE_INVALID",
    "LOCALE_TEMPLATE_UNAVAILABLE",
    "RECIPIENT_NO_LONGER_ELIGIBLE",
  ];
  return allowed.includes(value)
    ? value as NotificationErrorCode
    : "DELIVERY_CONTEXT_UNAVAILABLE";
}

async function recoverExpiredLeases(client: ServiceClient): Promise<void> {
  const expiredBefore = new Date(
    Date.now() - LEASE_MINUTES * 60_000,
  ).toISOString();

  const exhausted = await client
    .from("notification_deliveries")
    .update({
      status: "failed",
      locked_at: null,
      locked_by: null,
      last_error_code: "DELIVERY_ATTEMPTS_EXHAUSTED",
    })
    .eq("status", "processing")
    .lte("attempt_count", MAX_ATTEMPTS)
    .lt("locked_at", expiredBefore)
    .gte("attempt_count", MAX_ATTEMPTS);

  if (exhausted.error) throw exhausted.error;

  const recovered = await client
    .from("notification_deliveries")
    .update({
      status: "pending",
      locked_at: null,
      locked_by: null,
      next_attempt_at: new Date().toISOString(),
      last_error_code: "DELIVERY_CONTEXT_UNAVAILABLE",
    })
    .eq("status", "processing")
    .lt("locked_at", expiredBefore)
    .lt("attempt_count", MAX_ATTEMPTS);

  if (recovered.error) throw recovered.error;
}

async function claimDelivery(
  client: ServiceClient,
  candidate: DeliveryCandidate,
  workerId: string,
): Promise<DeliveryRow | null> {
  const claimedAt = new Date().toISOString();
  const { data, error } = await client
    .from("notification_deliveries")
    .update({
      status: "processing",
      attempt_count: candidate.attempt_count + 1,
      locked_at: claimedAt,
      locked_by: workerId,
    })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .eq("attempt_count", candidate.attempt_count)
    .lte("next_attempt_at", claimedAt)
    .select("id, school_id, alert_recipient_id, channel, locale, attempt_count, device_token_id, status")
    .maybeSingle();

  if (error) throw error;
  return data as DeliveryRow | null;
}

async function loadEligibleContext(
  client: ServiceClient,
  delivery: DeliveryRow,
): Promise<{
  recipient: RecipientRow;
  alert: AlertRow;
  email: string | null;
  pushToken: TokenRow | null;
} | null> {
  const { data: recipientData, error: recipientError } = await client
    .from("alert_recipients")
    .select("id, school_id, alert_id, recipient_user_id, acknowledged_at")
    .eq("id", delivery.alert_recipient_id)
    .eq("school_id", delivery.school_id)
    .maybeSingle();
  if (recipientError) throw recipientError;
  if (!recipientData) return null;
  const recipient = recipientData as RecipientRow;

  const { data: alertData, error: alertError } = await client
    .from("alerts")
    .select("id, school_id, title, message, status, source_type, source_id, severity")
    .eq("id", recipient.alert_id)
    .eq("school_id", delivery.school_id)
    .maybeSingle();
  if (alertError) throw alertError;
  if (!alertData) return null;
  const alert = alertData as AlertRow;

  const [schoolResult, membershipResult, profileResult] = await Promise.all([
    client.from("schools").select("status").eq("id", delivery.school_id).maybeSingle(),
    client.from("school_memberships")
      .select("active")
      .eq("school_id", delivery.school_id)
      .eq("user_id", recipient.recipient_user_id)
      .eq("active", true)
      .maybeSingle(),
    client.from("profiles").select("email").eq("id", recipient.recipient_user_id).maybeSingle(),
  ]);

  if (schoolResult.error) throw schoolResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (profileResult.error) throw profileResult.error;

  if (
    recipient.acknowledged_at ||
    alert.status !== "open" ||
    schoolResult.data?.status !== "active" ||
    !membershipResult.data
  ) return null;

  // Broadcasts can expire or be cancelled after their alert has been materialised.
  if (alert.source_type === "manual" && alert.source_id) {
    const { data: broadcast, error: broadcastError } = await client
      .from("broadcasts")
      .select("status, expires_at")
      .eq("id", alert.source_id)
      .eq("school_id", delivery.school_id)
      .maybeSingle();
    if (broadcastError) throw broadcastError;
    if (
      broadcast &&
      (broadcast.status !== "published" ||
        (broadcast.expires_at && Date.parse(broadcast.expires_at) <= Date.now()))
    ) return null;
  }

  let email = (profileResult.data as ProfileRow | null)?.email ?? null;
  let pushToken: TokenRow | null = null;

  if (delivery.channel === "email") {
    const { data: consent, error: consentError } = await client
      .from("consent_records")
      .select("status")
      .eq("school_id", delivery.school_id)
      .eq("subject_user_id", recipient.recipient_user_id)
      .eq("purpose", "communications")
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false })
      .order("captured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (consentError) throw consentError;
    if (consent?.status !== "granted" || !email?.trim()) return null;
  }

  if (delivery.channel === "push") {
    // Each push outbox row is bound to one device. Never substitute another
    // device for a deleted/revoked token: doing so would break per-device
    // idempotency and could send a duplicate to an unrelated endpoint.
    if (!delivery.device_token_id) return null;
    const { data: token, error: tokenError } = await client
      .from("device_tokens")
      .select("id, push_token")
      .eq("id", delivery.device_token_id)
      .eq("school_id", delivery.school_id)
      .eq("user_id", recipient.recipient_user_id)
      .eq("provider", "expo")
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!token || !isExpoPushToken(token.push_token)) return null;
    pushToken = token as TokenRow;
  }

  return { recipient, alert, email, pushToken };
}

async function sendExpoPush(
  delivery: DeliveryRow,
  token: TokenRow,
  content: { title: string; body: string },
): Promise<ProviderResult> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN")?.trim();
  if (accessToken) headers.set("Authorization", "Bearer " + accessToken);

  let response: Response;
  try {
    response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: token.push_token,
        title: content.title,
        body: content.body,
        priority: "high",
        ttl: 3600,
        // Repeated attempts for this same outbox row replace/collapse where
        // supported; escalation sequences have distinct delivery UUIDs.
        collapseId: expoCollapseId(delivery.id),
        tag: expoCollapseId(delivery.id),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderFailure("EXPO_PROVIDER_UNAVAILABLE", true);
  }

  if (!response.ok) {
    const failure = classifyProviderFailure("expo", response.status);
    throw new ProviderFailure(failure.code, failure.retryable);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ProviderFailure("EXPO_PROVIDER_RESPONSE_INVALID", true);
  }

  const ticket = parseExpoPushTicket(payload);
  if (!ticket) {
    throw new ProviderFailure("EXPO_PROVIDER_RESPONSE_INVALID", true);
  }
  if (ticket.status === "error") {
    const providerError = ticket.error;
    if (providerError === "DeviceNotRegistered") {
      throw new ProviderFailure("DEVICE_NOT_REGISTERED", false, token.id);
    }
    if (providerError === "MessageRateExceeded") {
      throw new ProviderFailure("EXPO_PROVIDER_RATE_LIMITED", true);
    }
    if (providerError === "ExpoServerError") {
      throw new ProviderFailure("EXPO_PROVIDER_UNAVAILABLE", true);
    }
    throw new ProviderFailure("EXPO_PROVIDER_REJECTED", false);
  }
  if (ticket.status !== "ok" || !ticket.id) {
    throw new ProviderFailure("EXPO_PROVIDER_RESPONSE_INVALID", true);
  }

  return { messageId: ticket.id };
}

async function sendEmail(
  delivery: DeliveryRow,
  email: string,
  content: { title: string; body: string; html: string },
): Promise<ProviderResult> {
  const apiKey = getRequiredEnv("RESEND_API_KEY");
  const from = getRequiredEnv("RESEND_FROM_EMAIL");
  let response: Response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "predrive-notification/" + delivery.id,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: content.title,
        text: content.body,
        html: content.html,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderFailure("EMAIL_PROVIDER_UNAVAILABLE", true);
  }

  if (!response.ok) {
    const failure = classifyProviderFailure("email", response.status);
    throw new ProviderFailure(failure.code, failure.retryable);
  }

  let payload: { id?: string };
  try {
    payload = await response.json();
  } catch {
    throw new ProviderFailure("EMAIL_PROVIDER_RESPONSE_INVALID", true);
  }
  if (!payload.id || payload.id.length > 200) {
    throw new ProviderFailure("EMAIL_PROVIDER_RESPONSE_INVALID", true);
  }
  return { messageId: payload.id };
}

class ProviderFailure extends Error {
  readonly code: NotificationErrorCode;
  readonly retryable: boolean;
  readonly tokenId?: string;

  constructor(
    code: NotificationErrorCode,
    retryable: boolean,
    tokenId?: string,
  ) {
    super(code);
    this.name = "ProviderFailure";
    this.code = code;
    this.retryable = retryable;
    this.tokenId = tokenId;
  }
}

async function finishDelivery(
  client: ServiceClient,
  delivery: DeliveryRow,
  workerId: string,
  result: ProviderResult,
): Promise<void> {
  const { error } = await client
    .from("notification_deliveries")
    .update({
      status: "sent",
      provider_message_id: result.messageId,
      sent_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error_code: null,
      ...(delivery.channel === "push"
        ? { receipt_status: "pending", receipt_checked_at: null, receipt_error_code: null }
        : {}),
    })
    .eq("id", delivery.id)
    .eq("status", "processing")
    .eq("locked_by", workerId);
  if (error) throw error;
}

async function suppressDelivery(
  client: ServiceClient,
  delivery: DeliveryRow,
  workerId: string,
  code: NotificationErrorCode,
): Promise<void> {
  const { error } = await client
    .from("notification_deliveries")
    .update({
      status: "suppressed",
      locked_at: null,
      locked_by: null,
      last_error_code: safeCode(code),
    })
    .eq("id", delivery.id)
    .eq("status", "processing")
    .eq("locked_by", workerId);
  if (error) throw error;
}

async function retryOrFail(
  client: ServiceClient,
  delivery: DeliveryRow,
  workerId: string,
  code: NotificationErrorCode,
  retryable: boolean,
): Promise<void> {
  const delay = retryable ? retryDelayMs(delivery.attempt_count) : null;
  const exhausted = delay === null;
  const { error } = await client
    .from("notification_deliveries")
    .update({
      status: retryable && !exhausted ? "pending" : "failed",
      next_attempt_at: retryable && !exhausted
        ? new Date(Date.now() + delay).toISOString()
        : new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      last_error_code: exhausted
        ? "DELIVERY_ATTEMPTS_EXHAUSTED"
        : safeCode(code),
    })
    .eq("id", delivery.id)
    .eq("status", "processing")
    .eq("locked_by", workerId);
  if (error) throw error;
}


const RECEIPT_DELAY_MS = 15 * 60_000;
const RECEIPT_RECHECK_MS = 5 * 60_000;
const RECEIPT_RETENTION_MS = 24 * 60 * 60_000;

async function pollExpoReceipts(client: ServiceClient): Promise<number> {
  const now = Date.now();
  const dueBefore = new Date(now - RECEIPT_DELAY_MS).toISOString();
  const retryBefore = new Date(now - RECEIPT_RECHECK_MS).toISOString();
  const { data, error } = await client
    .from("notification_deliveries")
    .select("id, school_id, device_token_id, provider_message_id, sent_at")
    .eq("channel", "push")
    .eq("status", "sent")
    .eq("receipt_status", "pending")
    .not("provider_message_id", "is", null)
    .not("device_token_id", "is", null)
    .lte("sent_at", dueBefore)
    .or("receipt_checked_at.is.null,receipt_checked_at.lt." + retryBefore)
    .order("sent_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    school_id: string;
    device_token_id: string;
    provider_message_id: string;
    sent_at: string;
  }>;
  if (!rows.length) return 0;

  const expired = rows.filter((row) => now - Date.parse(row.sent_at) >= RECEIPT_RETENTION_MS);
  for (const row of expired) {
    const { error: updateError } = await client
      .from("notification_deliveries")
      .update({
        receipt_status: "error",
        receipt_checked_at: new Date(now).toISOString(),
        receipt_error_code: "EXPO_RECEIPT_EXPIRED",
      })
      .eq("id", row.id)
      .eq("receipt_status", "pending");
    if (updateError) throw updateError;
  }

  const eligible = rows.filter((row) => !expired.includes(row));
  let checked = expired.length;
  for (let offset = 0; offset < eligible.length; offset += 100) {
    const batch = eligible.slice(offset, offset + 100);
    const ids = batch.map((row) => row.provider_message_id);
    const headers = new Headers({ "Content-Type": "application/json" });
    const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN")?.trim();
    if (accessToken) headers.set("Authorization", "Bearer " + accessToken);

    let response: Response;
    try {
      response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;

    let payload: {
      data?: Record<string, {
        status?: string;
        details?: { error?: string };
      }>;
    };
    try {
      payload = await response.json();
    } catch {
      continue;
    }
    const receipts = payload.data ?? {};
    for (const row of batch) {
      const receipt = receipts[row.provider_message_id];
      if (!receipt) {
        const { error: updateError } = await client
          .from("notification_deliveries")
          .update({ receipt_checked_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("receipt_status", "pending");
        if (updateError) throw updateError;
        checked += 1;
        continue;
      }

      const classification = classifyExpoReceipt(
        receipt.status,
        receipt.details?.error,
      );
      if (!classification) {
        const { error: updateError } = await client
          .from("notification_deliveries")
          .update({ receipt_checked_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("receipt_status", "pending");
        if (updateError) throw updateError;
        checked += 1;
        continue;
      }
      const deviceNotRegistered = classification.revokeDevice;
      const receiptStatus = classification.status;
      const receiptErrorCode = classification.errorCode;

      const { error: updateError } = await client
        .from("notification_deliveries")
        .update({
          receipt_status: receiptStatus,
          receipt_checked_at: new Date().toISOString(),
          receipt_error_code: receiptErrorCode,
        })
        .eq("id", row.id)
        .eq("receipt_status", "pending");
      if (updateError) throw updateError;

      if (deviceNotRegistered) {
        const { error: revokeError } = await client
          .from("device_tokens")
          .update({ active: false, revoked_at: new Date().toISOString() })
          .eq("id", row.device_token_id)
          .eq("school_id", row.school_id)
          .eq("provider", "expo")
          .eq("active", true);
        if (revokeError) throw revokeError;
      }
      checked += 1;
    }
  }
  return checked;
}

const handler = createEdgeHandler(async (request) => {
  if (request.method !== "POST") {
    throw new HttpError("VALIDATION", "Only POST requests are supported.", 405);
  }

  await requireCronSecret(request);
  const client = createServiceClient();
  const workerId = crypto.randomUUID();

  await recoverExpiredLeases(client);
  const receiptsChecked = await pollExpoReceipts(client);

  const { data: candidates, error: candidatesError } = await client
    .from("notification_deliveries")
    .select("id, school_id, alert_recipient_id, channel, locale, attempt_count, device_token_id")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (candidatesError) throw candidatesError;

  let claimed = 0;
  let sent = 0;
  let suppressed = 0;
  let retried = 0;
  let failed = 0;
  let lostClaim = 0;

  for (const candidate of (candidates ?? []) as DeliveryCandidate[]) {
    const delivery = await claimDelivery(client, candidate, workerId);
    if (!delivery) {
      lostClaim += 1;
      continue;
    }
    claimed += 1;

    try {
      const context = await loadEligibleContext(client, delivery);
      if (!context) {
        await suppressDelivery(
          client,
          delivery,
          workerId,
          "RECIPIENT_NO_LONGER_ELIGIBLE",
        );
        suppressed += 1;
        continue;
      }

      const content = notificationContent({
        locale: delivery.locale,
        title: context.alert.title,
        message: context.alert.message,
      });
      if (!content) {
        await suppressDelivery(
          client,
          delivery,
          workerId,
          "LOCALE_TEMPLATE_UNAVAILABLE",
        );
        suppressed += 1;
        continue;
      }

      const result = delivery.channel === "push"
        ? await sendExpoPush(delivery, context.pushToken!, content)
        : await sendEmail(delivery, context.email!, content);

      await finishDelivery(client, delivery, workerId, result);
      sent += 1;
    } catch (error) {
      if (error instanceof ProviderFailure) {
        if (
          error.code === "DEVICE_NOT_REGISTERED" &&
          delivery.channel === "push" &&
          error.tokenId
        ) {
          const { error: revokeError } = await client
            .from("device_tokens")
            .update({ active: false, revoked_at: new Date().toISOString() })
            .eq("id", error.tokenId)
            .eq("school_id", delivery.school_id)
            .eq("provider", "expo")
            .eq("active", true);
          if (revokeError) throw revokeError;
          await suppressDelivery(client, delivery, workerId, error.code);
          suppressed += 1;
          continue;
        }

        await retryOrFail(
          client,
          delivery,
          workerId,
          error.code,
          error.retryable,
        );
        if (error.retryable && retryDelayMs(delivery.attempt_count) !== null) {
          retried += 1;
        } else {
          failed += 1;
        }
      } else {
        await retryOrFail(
          client,
          delivery,
          workerId,
          "DELIVERY_CONTEXT_UNAVAILABLE",
          true,
        );
        if (retryDelayMs(delivery.attempt_count) !== null) retried += 1;
        else failed += 1;
      }
    }
  }

  return jsonOk({
    workerId,
    candidates: (candidates ?? []).length,
    claimed,
    sent,
    suppressed,
    retried,
    failed,
    lostClaim,
    batchLimit: BATCH_SIZE,
    maxAttempts: MAX_ATTEMPTS,
    leaseMinutes: LEASE_MINUTES,
    receiptsChecked,
  });
}, "deliver-notifications");

Deno.serve(handler);
