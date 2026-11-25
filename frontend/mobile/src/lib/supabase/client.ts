import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function isValidPublicConfiguration(url: string | undefined, key: string | undefined): boolean {
  if (!url || !key) return false;
  try {
    const parsed = new URL(url);
    const localDevelopment = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol !== "https:" && !localDevelopment) return false;
    if (!parsed.hostname.endsWith(".supabase.co") && !localDevelopment) return false;
    if (/service[_-]?role|secret/i.test(key)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Native sessions are stored using Expo SecureStore. Expo web uses the
 * browser storage implementation provided by supabase-js. Only public
 * project configuration is read from EXPO_PUBLIC_* variables.
 *
 * A null client is intentional when local/EAS configuration is incomplete:
 * screens can show the app's unavailable state rather than crashing during
 * module import.
 */
export const mobileSupabase: SupabaseClient | null =
  isValidPublicConfiguration(supabaseUrl, publishableKey)
    ? createClient(supabaseUrl!, publishableKey!, {
        auth: {
          ...(Platform.OS === "web" ? {} : { storage: secureStorage }),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
