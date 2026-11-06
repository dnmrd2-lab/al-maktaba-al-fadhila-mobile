import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { resolveSupabaseConfig } from "./supabase-config";

const { supabaseUrl, publishableKey } = resolveSupabaseConfig(
  {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
  Constants.expoConfig?.extra,
);

export const supabaseConfigured = Boolean(supabaseUrl && publishableKey);

const webStorage = {
  getItem: async (key: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

const authStorage = {
  getItem: (key: string) => Platform.OS === "web" ? webStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => Platform.OS === "web" ? webStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => Platform.OS === "web" ? webStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

// Client credentials are intentionally publishable. RLS remains the authorization boundary.
export const supabase = createClient(
  supabaseUrl || "https://not-configured.supabase.co",
  publishableKey || "not-configured",
  { auth: { storage: authStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
);
