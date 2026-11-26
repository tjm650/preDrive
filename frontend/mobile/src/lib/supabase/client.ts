import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

type PublicSupabaseExtra = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as PublicSupabaseExtra;

/**
 * Expo inlines EXPO_PUBLIC_* variables into native bundles. The app.json
 * values are a public-config fallback for local starts where no .env file
 * exists. Both values are publishable; no service-role key belongs here.
 */
export const mobileSupabaseConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || extra.supabaseUrl?.trim() || "",
  publishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    extra.supabasePublishableKey?.trim() ||
    "",
};

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function isValidPublicConfiguration(url: string, key: string): boolean {
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
 * browser storage implementation provided by supabase-js.
 */
export const mobileSupabase: SupabaseClient | null =
  isValidPublicConfiguration(mobileSupabaseConfig.url, mobileSupabaseConfig.publishableKey)
    ? createClient(mobileSupabaseConfig.url, mobileSupabaseConfig.publishableKey, {
        auth: {
          ...(Platform.OS === "web" ? {} : { storage: secureStorage }),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;
