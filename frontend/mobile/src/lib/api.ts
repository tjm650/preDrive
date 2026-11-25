import {
  SupabaseAdapter,
  type SupabaseMutationClient,
  type SupabaseReadClient,
  type SupabaseRpcClient,
} from "@predrive/shared/supabase";
import { mobileSupabase } from "./supabase/client";
import { mobileSupabaseRuntime } from "./supabase/runtime";

/** Null until the public Supabase URL and publishable key are configured. */
export const mobileApi =
  mobileSupabase && mobileSupabaseRuntime
    ? new SupabaseAdapter({
        runtime: mobileSupabaseRuntime,
        readClient: mobileSupabase as unknown as SupabaseReadClient,
        rpcClient: mobileSupabase as unknown as SupabaseRpcClient & SupabaseReadClient,
        mutationClient: mobileSupabase as unknown as SupabaseMutationClient,
      })
    : null;
