import {
  classifyExpoReceipt,
  classifyProviderFailure,
  escapeHtml,
  isExpoPushToken,
  notificationContent,
  expoCollapseId,
  parseExpoPushTicket,
  retryDelayMs,
} from "./notifications.ts";

Deno.test("English notification content escapes untrusted alert text", () => {
  const content = notificationContent({
    locale: "en",
    title: "<School notice>",
    message: "Please review <this> & confirm.",
  });

  if (!content) throw new Error("English template was not selected.");
  if (content.html.includes("<School notice>")) {
    throw new Error("HTML title was not escaped.");
  }
  if (!content.html.includes("&lt;School notice&gt;")) {
    throw new Error("Escaped title is missing.");
  }
  if (!content.body.includes("<this>")) {
    throw new Error("Plain-text body should remain readable.");
  }
});

Deno.test("Shona and Ndebele are not silently sent using English copy", () => {
  if (notificationContent({ locale: "sn", title: "Alert", message: "Text" }) !== null) {
    throw new Error("Shona must wait for its reviewed template.");
  }
  if (notificationContent({ locale: "nd", title: "Alert", message: "Text" }) !== null) {
    throw new Error("Ndebele must wait for its reviewed template.");
  }
});

Deno.test("retry schedule is bounded and exhausts after twelve attempts", () => {
  if (retryDelayMs(1) !== 30_000) throw new Error("First retry delay is incorrect.");
  if (retryDelayMs(8) !== 7_200_000) throw new Error("Backoff cap is incorrect.");
  if (retryDelayMs(12) !== null) throw new Error("Exhausted deliveries must not retry.");
  if (retryDelayMs(0) !== null || retryDelayMs(-1) !== null) {
    throw new Error("Invalid attempt counts must not retry.");
  }
});

Deno.test("provider failures distinguish retryable and permanent responses", () => {
  if (!classifyProviderFailure("email", 429).retryable) {
    throw new Error("Rate limits must be retried.");
  }
  if (!classifyProviderFailure("expo", 503).retryable) {
    throw new Error("Provider outages must be retried.");
  }
  if (classifyProviderFailure("email", 401).retryable) {
    throw new Error("Authentication errors must not be retried indefinitely.");
  }
});

Deno.test("HTML escaping covers all special characters", () => {
  const escaped = escapeHtml(`&<>"'`);
  if (escaped !== "&amp;&lt;&gt;&quot;&#39;") {
    throw new Error("HTML escaping is incomplete.");
  }
});

Deno.test("Expo token validation rejects arbitrary strings", () => {
  if (!isExpoPushToken("ExponentPushToken[abcdefgh12345678]")) {
    throw new Error("A valid Expo token was rejected.");
  }
  if (isExpoPushToken("not-a-token")) {
    throw new Error("An arbitrary token was accepted.");
  }
});


Deno.test("Expo receipts distinguish handoff success and unregistered devices", () => {
  const success = classifyExpoReceipt("ok", undefined);
  if (!success || success.status !== "ok" || success.revokeDevice) {
    throw new Error("Successful receipt classification is incorrect.");
  }

  const unregistered = classifyExpoReceipt("error", "DeviceNotRegistered");
  if (
    !unregistered ||
    unregistered.status !== "error" ||
    unregistered.errorCode !== "DEVICE_NOT_REGISTERED" ||
    !unregistered.revokeDevice
  ) {
    throw new Error("DeviceNotRegistered receipt must revoke the device.");
  }

  const otherError = classifyExpoReceipt("error", "ProviderError");
  if (
    !otherError ||
    otherError.errorCode !== "EXPO_RECEIPT_ERROR" ||
    otherError.revokeDevice
  ) {
    throw new Error("Other receipt errors must not revoke the device.");
  }

  if (classifyExpoReceipt(undefined, undefined) !== null) {
    throw new Error("An incomplete receipt must remain unclassified.");
  }
});


Deno.test("English regional locales use English while unsupported locales stay suppressed", () => {
  const regional = notificationContent({
    locale: "en-ZW",
    title: "School notice",
    message: "Please check the trip update.",
  });
  if (!regional) throw new Error("en-ZW should use the reviewed English template.");
  if (notificationContent({ locale: "sn-ZW", title: "Alert", message: "Text" }) !== null) {
    throw new Error("Shona regional locales must remain suppressed.");
  }
  if (notificationContent({ locale: "nd-ZW", title: "Alert", message: "Text" }) !== null) {
    throw new Error("Ndebele regional locales must remain suppressed.");
  }
});

Deno.test("Expo delivery collapse identifiers are stable and bounded", () => {
  const id = "8f5c1a2b-3d4e-4f50-9a6b-7c8d9e0f1a2b";
  const first = expoCollapseId(id);
  const second = expoCollapseId(id);
  if (first !== second || first !== "pd-" + id || first.length > 64) {
    throw new Error("Expo collapse identifier is not stable or bounded.");
  }
  let rejected = false;
  try {
    expoCollapseId("not-a-uuid");
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Invalid delivery IDs must be rejected.");
});

Deno.test("Expo ticket parser accepts exactly one valid ticket and rejects malformed responses", () => {
  const objectTicket = parseExpoPushTicket({
    data: { status: "ok", id: "ticket-123" },
  });
  if (objectTicket?.status !== "ok" || objectTicket.id !== "ticket-123") {
    throw new Error("Single-object Expo ticket was not parsed.");
  }

  const arrayTicket = parseExpoPushTicket({
    data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
  });
  if (arrayTicket?.status !== "error" || arrayTicket.error !== "DeviceNotRegistered") {
    throw new Error("Single-item Expo ticket array was not parsed.");
  }

  if (parseExpoPushTicket({ data: [] }) !== null) {
    throw new Error("Empty ticket arrays must be rejected.");
  }
  if (parseExpoPushTicket({ data: [{ status: "ok", id: "one" }, { status: "ok", id: "two" }] }) !== null) {
    throw new Error("Unexpected multi-ticket response must be rejected.");
  }
  if (parseExpoPushTicket({ data: { status: "ok", id: "" } }) !== null) {
    throw new Error("Empty ticket IDs must be rejected.");
  }
});
