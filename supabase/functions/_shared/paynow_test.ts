import { verifyPaynowCallback } from "./paynow.ts";

const INTEGRATION_KEY = "3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977";

Deno.test("Paynow verifies the published SHA-512 example", async () => {
  const body = new URLSearchParams([
    ["id", "1201"],
    ["reference", "TEST REF"],
    ["amount", "99.99"],
    ["additionalinfo", "A test ticket transaction"],
    ["returnurl", "http://www.google.com/search?q=returnurl"],
    ["resulturl", "http://www.google.com/search?q=resulturl"],
    ["status", "Message"],
    ["hash", "2A033FC38798D913D42ECB786B9B19645ADEDBDE788862032F1BD82CF3B92DEF84F316385D5B40DBB35F1A4FD7D5BFE73835174136463CDD48C9366B0749C689"],
  ]).toString();

  const verified = await verifyPaynowCallback(body, INTEGRATION_KEY);
  if (verified.reference !== "TEST REF" || verified.amountMinor !== 9999) {
    throw new Error("Published Paynow example did not parse correctly.");
  }
});

Deno.test("Paynow callback accepts a correctly signed status update", async () => {
  const unsigned = [
    "reference=PRE-INV-001",
    "paynowreference=PN-123456",
    "amount=125.50",
    "status=Paid",
    "pollurl=https%3A%2F%2Fwww.paynow.co.zw%2FInterface%2FCheckPayment%2F",
  ].join("&");
  const values = [
    "PRE-INV-001",
    "PN-123456",
    "125.50",
    "Paid",
    "https://www.paynow.co.zw/Interface/CheckPayment/",
  ].join("");
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(values + INTEGRATION_KEY),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("").toUpperCase();

  const verified = await verifyPaynowCallback(
    `${unsigned}&hash=${hash}`,
    INTEGRATION_KEY,
  );

  if (
    verified.reference !== "PRE-INV-001" ||
    verified.paynowReference !== "PN-123456" ||
    verified.amountMinor !== 12550 ||
    verified.status !== "Paid"
  ) {
    throw new Error("Signed Paynow status update was not parsed correctly.");
  }
});

Deno.test("Paynow rejects a modified callback", async () => {
  const unsigned = [
    "reference=PRE-INV-002",
    "paynowreference=PN-2",
    "amount=10.00",
    "status=Paid",
  ].join("&");

  let rejected = false;
  try {
    await verifyPaynowCallback(
      `${unsigned}&hash=${"A".repeat(128)}`,
      INTEGRATION_KEY,
    );
  } catch {
    rejected = true;
  }

  if (!rejected) throw new Error("An invalid callback hash was accepted.");
});

Deno.test("Paynow rejects duplicate fields and invalid amount precision", async () => {
  for (const body of [
    "reference=A&reference=B&paynowreference=P&amount=1.00&status=Paid&hash=" + "A".repeat(128),
    "reference=A&paynowreference=P&amount=1.001&status=Paid&hash=" + "A".repeat(128),
  ]) {
    let rejected = false;
    try {
      await verifyPaynowCallback(body, INTEGRATION_KEY);
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("Malformed callback was accepted.");
  }
});

Deno.test("Paynow ignores the hash field wherever it appears in the form", async () => {
  const values = "A" + "P" + "1.00" + "Paid";
  const digest = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(values + INTEGRATION_KEY),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("").toUpperCase();
  const verified = await verifyPaynowCallback(
    `reference=A&hash=${hash}&paynowreference=P&amount=1.00&status=Paid`,
    INTEGRATION_KEY,
  );
  if (verified.status !== "Paid") {
    throw new Error("Valid callback with an interleaved hash was rejected.");
  }
});
