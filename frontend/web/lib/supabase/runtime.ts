import { createSupabaseRuntime } from "@predrive/shared/supabase";
import type { SupabaseAuthClient } from "@predrive/shared/lib/auth/supabase-auth-port";
import { getSupabaseBrowserClient } from "./client";

let runtime: ReturnType<typeof createSupabaseRuntime> | undefined;

/** Shared auth/session runtime for the browser-side web application. */
export function getSupabaseWebRuntime(): NonNullable<typeof runtime> {
  if (!runtime) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !publishableKey) {
      throw new Error("Supabase public configuration is missing for the web application.");
    }
    runtime = createSupabaseRuntime({
      config: { url, publishableKey },
      client: getSupabaseBrowserClient() as unknown as SupabaseAuthClient,
    });
  }
  return runtime;
}
