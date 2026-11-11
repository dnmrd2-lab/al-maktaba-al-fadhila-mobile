import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase, supabaseConfigured } from "./supabase";

const DEVICE_ID_KEY = "al_fadhila_device_id_v1";
const INSTALL_RECORDED_KEY = "al_fadhila_install_recorded_v1";

/**
 * Retrieves an existing device identifier or generates and persists a new unique ID.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // 1. Check native SecureStore if on mobile
    if (Platform.OS !== "web") {
      try {
        const SecureStore = await import("expo-secure-store");
        const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (stored && stored.trim()) {
          return stored.trim();
        }
      } catch {
        // Fall back to AsyncStorage
      }
    }

    // 2. Check AsyncStorage
    const asyncStored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (asyncStored && asyncStored.trim()) {
      return asyncStored.trim();
    }

    // 3. Generate a new random device ID
    const randomHex = Math.random().toString(36).substring(2, 12);
    const timestamp = Date.now().toString(36);
    const newId = `dev_${timestamp}_${randomHex}`;

    // Persist to storage
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId).catch(() => undefined);
    if (Platform.OS !== "web") {
      try {
        const SecureStore = await import("expo-secure-store");
        await SecureStore.setItemAsync(DEVICE_ID_KEY, newId).catch(() => undefined);
      } catch {
        // Ignore native errors
      }
    }

    return newId;
  } catch {
    return `dev_${Date.now()}`;
  }
}

/**
 * Records app installation in Supabase table public.app_installs on first app open.
 */
export async function recordAppInstallation(): Promise<boolean> {
  if (!supabaseConfigured) return false;

  try {
    const alreadyRecorded = await AsyncStorage.getItem(INSTALL_RECORDED_KEY);
    if (alreadyRecorded === "true") {
      return true;
    }

    const deviceId = await getOrCreateDeviceId();

    // 1. Try atomic RPC if available
    try {
      const { data, error: rpcError } = await supabase.rpc("record_app_install", {
        p_device_id: deviceId,
      });
      if (!rpcError && data) {
        await AsyncStorage.setItem(INSTALL_RECORDED_KEY, "true").catch(() => undefined);
        return true;
      }
    } catch {
      // Fall through to direct table insert
    }

    // 2. Direct table insert
    const { error: insertError } = await supabase.from("app_installs").insert({
      device_id: deviceId,
    });

    if (!insertError || (insertError as any).code === "23505") {
      await AsyncStorage.setItem(INSTALL_RECORDED_KEY, "true").catch(() => undefined);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Increments reading/view count for a book in Supabase.
 */
export async function recordBookView(bookId: string): Promise<number | null> {
  if (!bookId || !supabaseConfigured) return null;

  try {
    // 1. Atomic RPC call
    try {
      const { data, error: rpcError } = await supabase.rpc("increment_book_views", {
        target_book_id: bookId,
      });
      if (!rpcError && typeof data === "number") {
        return data;
      }
    } catch {
      // Fall through to direct update fallback
    }

    // 2. Direct update fallback
    const { data: bookData } = await supabase
      .from("books")
      .select("views_count")
      .eq("id", bookId)
      .maybeSingle();

    const currentCount = Number(bookData?.views_count) || 0;
    const nextCount = currentCount + 1;

    const { error: updateError } = await supabase
      .from("books")
      .update({ views_count: nextCount })
      .eq("id", bookId);

    if (updateError) {
      return null;
    }

    return nextCount;
  } catch {
    return null;
  }
}

/**
 * Fetches the total number of unique app installations.
 */
export async function fetchTotalAppInstalls(): Promise<number> {
  if (!supabaseConfigured) return 0;
  try {
    const { count, error } = await supabase
      .from("app_installs")
      .select("id", { count: "exact", head: true });

    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
