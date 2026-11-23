import {
  parseAllowedOrigins,
  resolveCors,
} from "./cors.ts";
import { HttpError, toHttpError } from "./errors.ts";

Deno.test("CORS allows an exact configured origin", () => {
  const request = new Request("https://edge.example.test", {
    headers: { origin: "https://app.example.test" },
  });
  const decision = resolveCors(
    request,
    parseAllowedOrigins("https://app.example.test"),
  );

  if (!decision.allowed) throw new Error("Expected origin to be allowed.");
  if (
    decision.headers.get("Access-Control-Allow-Origin") !==
      "https://app.example.test"
  ) {
    throw new Error("CORS must echo only the exact allowed origin.");
  }
});

Deno.test("CORS rejects an unconfigured origin", () => {
  const request = new Request("https://edge.example.test", {
    headers: { origin: "https://attacker.example.test" },
  });
  const decision = resolveCors(
    request,
    parseAllowedOrigins("https://app.example.test"),
  );

  if (decision.allowed) throw new Error("Expected origin to be rejected.");
  if (decision.headers.has("Access-Control-Allow-Origin")) {
    throw new Error("Rejected origins must not receive allow-origin headers.");
  }
});

Deno.test("CORS allows non-browser service calls without an Origin header", () => {
  const request = new Request("https://edge.example.test", {
    method: "POST",
  });
  const decision = resolveCors(request, new Set());

  if (!decision.allowed) {
    throw new Error("Requests without an Origin header should be allowed.");
  }
});

Deno.test("invalid CORS configuration fails closed", () => {
  let failed = false;
  try {
    parseAllowedOrigins("https://app.example.test/dashboard");
  } catch {
    failed = true;
  }
  if (!failed) throw new Error("Expected invalid origin configuration to fail.");
});

Deno.test("non-local HTTP origins are rejected", () => {
  let failed = false;
  try {
    parseAllowedOrigins("http://app.example.test");
  } catch {
    failed = true;
  }
  if (!failed) {
    throw new Error("Non-local browser origins must use HTTPS.");
  }
});

Deno.test("database permission errors map to the public API code", () => {
  const error = toHttpError({
    code: "42501",
    message: "internal database detail",
  });

  if (error.code !== "FORBIDDEN" || error.status !== 403) {
    throw new Error("Expected database permission error to map to FORBIDDEN.");
  }
});

Deno.test("known API errors preserve their stable public code", () => {
  const error = toHttpError(
    new HttpError("CONFLICT", "The operation conflicts.", 409),
  );

  if (error.code !== "CONFLICT" || error.status !== 409) {
    throw new Error("Expected stable API error code to be preserved.");
  }
});
