import { createSupabaseRuntime } from "@predrive/shared/supabase";
import type { SupabaseAuthClient } from "@predrive/shared/supabase";
import { mobileSupabase, mobileSupabaseConfig } from "./client";

/**
 * Shared authentication/session services composed with the native Supabase
 * client. Uses the same resolved public configuration as the SDK client.
 */
export const mobileSupabaseRuntime =
  mobileSupabase && mobileSupabaseConfig.url && mobileSupabaseConfig.publishableKey
    ? createSupabaseRuntime({
        config: {
          url: mobileSupabaseConfig.url,
          publishableKey: mobileSupabaseConfig.publishableKey,
        },
        client: mobileSupabase as unknown as SupabaseAuthClient,
      })
    : null;
