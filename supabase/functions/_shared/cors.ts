const ALLOWED_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "x-client-info",
  "x-request-id",
  "x-cron-secret",
  "x-provider-signature",
  "x-paynow-signature",
].join(", ");

export interface CorsDecision {
  allowed: boolean;
  headers: Headers;
}

export function parseAllowedOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();

  for (const entry of (value ?? "").split(",")) {
    const candidate = entry.trim();
    if (!candidate) continue;

    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error("APP_ALLOWED_ORIGINS contains an invalid URL.");
    }

    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.origin !== candidate.replace(/\/$/, "")
    ) {
      throw new Error(
        "APP_ALLOWED_ORIGINS entries must be exact HTTP(S) origins without paths.",
      );
    }

    origins.add(parsed.origin);
  }

  return origins;
}

export function resolveCors(
  request: Request,
  allowedOrigins = parseAllowedOrigins(
    Deno.env.get("APP_ALLOWED_ORIGINS"),
  ),
): CorsDecision {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });

  const origin = request.headers.get("origin");
  if (!origin) {
    return { allowed: true, headers };
  }

  if (!allowedOrigins.has(origin)) {
    return { allowed: false, headers };
  }

  headers.set("Access-Control-Allow-Origin", origin);
  return { allowed: true, headers };
}

export function applyCors(response: Response, cors: CorsDecision): Response {
  const headers = new Headers(response.headers);
  cors.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "vary") {
      headers.set(key, value);
    }
  });

  const existingVary = headers.get("Vary");
  const varyValues = new Set(
    (existingVary ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  );
  varyValues.add("Origin");
  headers.set("Vary", [...varyValues].join(", "));

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
