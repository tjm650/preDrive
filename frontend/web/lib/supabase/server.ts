import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

function getPublicConfiguration(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase public configuration is missing for the web application.");
  }

  const parsed = new URL(url);
  const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    (parsed.protocol !== "https:" && !localDevelopment) ||
    (!parsed.hostname.endsWith(".supabase.co") && !localDevelopment) ||
    /service[_-]?role|secret/i.test(key)
  ) {
    throw new Error("The web application Supabase configuration is invalid.");
  }

  return { url, key };
}

/**
 * Pages Router server client. Cookie refreshes are written to the outgoing
 * response, while all database requests retain the user's JWT and RLS scope.
 */
export function createSupabaseServerClient(
  request: NextApiRequest,
  response: NextApiResponse,
): SupabaseClient {
  const { url, key } = getPublicConfiguration();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.cookie ?? "");
      },
      setAll(cookiesToSet) {
        const current = response.getHeader("Set-Cookie");
        const existing = Array.isArray(current)
          ? current.map(String)
          : current
            ? [String(current)]
            : [];
        const next = cookiesToSet.map(({ name, value, options }) =>
          serializeCookieHeader(name, value, options),
        );
        response.setHeader("Set-Cookie", [...existing, ...next]);
      },
    },
  });
}
