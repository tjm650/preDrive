const MAX_PAYNOW_BODY_BYTES = 16 * 1024;
const MAX_PAYNOW_FIELDS = 40;
const PAYNOW_HASH_PATTERN = /^[A-Fa-f0-9]{128}$/;

export interface VerifiedPaynowCallback {
  reference: string;
  paynowReference: string;
  amountMinor: number;
  status: string;
  payloadSha256: string;
  safePayload: {
    reference: string;
    paynowreference: string;
    amount: string;
    status: string;
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function digest(
  algorithm: "SHA-256" | "SHA-512",
  value: string,
): Promise<string> {
  const result = await crypto.subtle.digest(
    algorithm,
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(result));
}

export async function computePaynowHash(
  signingValues: readonly string[],
  integrationKey: string,
): Promise<string> {
  if (!integrationKey.trim()) {
    throw new Error("PAYNOW_INTEGRATION_KEY_MISSING");
  }
  return (await digest("SHA-512", signingValues.join("") + integrationKey))
    .toUpperCase();
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (
    !PAYNOW_HASH_PATTERN.test(left) ||
    !PAYNOW_HASH_PATTERN.test(right) ||
    left.length !== right.length
  ) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function readPaynowBody(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(contentType)) {
    throw new TypeError("PAYNOW_CONTENT_TYPE_INVALID");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PAYNOW_BODY_BYTES) {
    throw new RangeError("PAYNOW_BODY_TOO_LARGE");
  }

  if (!request.body) {
    throw new TypeError("PAYNOW_BODY_MISSING");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_PAYNOW_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("PAYNOW_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function parseMinorUnits(value: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) {
    throw new TypeError("PAYNOW_AMOUNT_INVALID");
  }

  const [major, fractional = ""] = value.split(".");
  const minor = Number(major) * 100 + Number(fractional.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new TypeError("PAYNOW_AMOUNT_INVALID");
  }
  return minor;
}

export async function verifyPaynowCallback(
  rawBody: string,
  integrationKey: string,
): Promise<VerifiedPaynowCallback> {
  const params = new URLSearchParams(rawBody);
  const entries = Array.from(params.entries());

  if (entries.length < 5 || entries.length > MAX_PAYNOW_FIELDS) {
    throw new TypeError("PAYNOW_FIELD_COUNT_INVALID");
  }

  const values = new Map<string, string>();
  const hashValues: string[] = [];
  const signingValues: string[] = [];

  for (const [key, value] of entries) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey || values.has(normalizedKey)) {
      throw new TypeError("PAYNOW_DUPLICATE_OR_EMPTY_FIELD");
    }

    values.set(normalizedKey, value);
    if (normalizedKey === "hash") {
      hashValues.push(value);
    } else {
      signingValues.push(value);
    }
  }

  if (hashValues.length !== 1 || !PAYNOW_HASH_PATTERN.test(hashValues[0])) {
    throw new TypeError("PAYNOW_HASH_MISSING_OR_INVALID");
  }

  const expectedHash = await computePaynowHash(signingValues, integrationKey);

  if (!constantTimeHexEqual(expectedHash, hashValues[0].toUpperCase())) {
    throw new TypeError("PAYNOW_SIGNATURE_INVALID");
  }

  const reference = values.get("reference")?.trim() ?? "";
  const paynowReference = values.get("paynowreference")?.trim() ?? "";
  const amount = values.get("amount")?.trim() ?? "";
  const status = values.get("status")?.trim() ?? "";

  if (
    !reference ||
    reference.length > 160 ||
    !paynowReference ||
    paynowReference.length > 160 ||
    !status ||
    status.length > 80
  ) {
    throw new TypeError("PAYNOW_REQUIRED_FIELDS_INVALID");
  }

  const amountMinor = parseMinorUnits(amount);
  const payloadSha256 = await digest("SHA-256", rawBody);

  return {
    reference,
    paynowReference,
    amountMinor,
    status,
    payloadSha256,
    safePayload: {
      reference,
      paynowreference: paynowReference,
      amount,
      status,
    },
  };
}
