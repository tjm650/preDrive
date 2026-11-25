import { createBrowserClient, type SupabaseClient } from "@supabase/ssr";

let browserClient: SupabaseClient | undefined;

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

/** Browser client uses the SSR package's cookie-backed session storage. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("The Supabase browser client can only be created in a browser.");
  }
  if (!browserClient) {
    const { url, key } = getPublicConfiguration();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
