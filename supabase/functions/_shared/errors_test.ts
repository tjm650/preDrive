import { toHttpError } from "./errors.ts";

Deno.test("PIN lock maps to RATE_LIMITED", () => {
  const error = toHttpError({
    code: "P0001",
    message: "PIN_LOCKED",
  });

  if (error.code !== "RATE_LIMITED" || error.status !== 429) {
    throw new Error("PIN lock must map to the stable RATE_LIMITED code.");
  }
});

Deno.test("missing invitation maps to NOT_FOUND", () => {
  const error = toHttpError({
    code: "P0001",
    message: "INVITATION_NOT_FOUND",
  });

  if (error.code !== "NOT_FOUND" || error.status !== 404) {
    throw new Error("Missing invitation must map to NOT_FOUND.");
  }
});

Deno.test("idempotency key reuse maps to CONFLICT", () => {
  const error = toHttpError({
    code: "P0001",
    message: "IDEMPOTENCY_KEY_REUSED",
  });

  if (error.code !== "CONFLICT" || error.status !== 409) {
    throw new Error("Idempotency key reuse must map to CONFLICT.");
  }
});

Deno.test("database details are not exposed to callers", () => {
  const error = toHttpError({
    code: "XX000",
    message: "private table name and customer data",
  });

  if (error.message.includes("private table") || error.message.includes("customer")) {
    throw new Error("Internal database details must not be exposed.");
  }
});
