import { createSupabaseRuntime } from "@predrive/shared/supabase";
import type { SupabaseAuthClient } from "@predrive/shared/supabase";
import { mobileSupabase } from "./client";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

/**
 * Shared authentication/session services composed with the native Supabase
 * client. Data modules are attached to the same authenticated client by the
 * application API factory.
 */
export const mobileSupabaseRuntime =
  mobileSupabase && url && publishableKey
    ? createSupabaseRuntime({
        config: { url, publishableKey },
        client: mobileSupabase as unknown as SupabaseAuthClient,
      })
    : null;
