import {
  classifyExpoReceipt,
  classifyProviderFailure,
  escapeHtml,
  isExpoPushToken,
  notificationContent,
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
