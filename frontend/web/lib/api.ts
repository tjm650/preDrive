import {
  SupabaseAdapter,
  type SupabaseMutationClient,
  type SupabaseReadClient,
  type SupabaseRpcClient,
} from "@predrive/shared/supabase";
import { getSupabaseBrowserClient } from "./supabase/client";
import { getSupabaseWebRuntime } from "./supabase/runtime";

let api: SupabaseAdapter | undefined;

/** Browser API instance shared by the web dashboard and auth forms. */
export function getWebApi(): SupabaseAdapter {
  if (!api) {
    const client = getSupabaseBrowserClient();
    api = new SupabaseAdapter({
      runtime: getSupabaseWebRuntime(),
      readClient: client as unknown as SupabaseReadClient,
      rpcClient: client as unknown as SupabaseRpcClient & SupabaseReadClient,
      mutationClient: client as unknown as SupabaseMutationClient,
    });
  }
  return api;
}
