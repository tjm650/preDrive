import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.119.2";

export type ServiceClient = SupabaseClient;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Required Edge Function environment variable is missing: ${name}`);
  }
  return value;
}

export function createServiceClient(): ServiceClient {
  const url = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "predrive-edge-functions",
      },
    },
  });
}

export function getRequiredEnv(name: string): string {
  return requiredEnv(name);
}
