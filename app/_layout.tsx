import "../global.css";
import React, { useEffect, useState } from "react";
import { Platform, I18nManager, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BrandSplash } from "../components/BrandSplash";
import { AppProvider } from "../lib/app-context";
import { LocalLibraryProvider } from "../lib/local-library";
import { palette } from "../lib/theme";
import { recordAppInstallation } from "../lib/analytics";
import { supabase, supabaseConfigured } from "../lib/supabase";

if (Platform.OS !== "web" && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
}

if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

const DEVICE_ID_KEY = "al_fadhila_device_id_v1";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "web") void SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setShowSplash(false), 1750);

    // Register unique device install via upsert
    void (async () => {
      try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId || !deviceId.trim()) {
          const randHex = Math.random().toString(36).substring(2, 10);
          deviceId = `dev_${Date.now()}_${randHex}`;
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        if (supabaseConfigured && deviceId) {
          const { error } = await supabase
            .from("app_installs")
            .upsert({ device_id: deviceId.trim(), platform: Platform.OS }, { onConflict: "device_id" });

          if (error && error.message?.includes("platform")) {
            await supabase
              .from("app_installs")
              .upsert({ device_id: deviceId.trim() }, { onConflict: "device_id" });
          }
        }
      } catch {
        void recordAppInstallation();
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <LocalLibraryProvider>
          <StatusBar style={showSplash ? "light" : "dark"} />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.background } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="book/[id]" options={{ animation: "slide_from_left" }} />
              <Stack.Screen name="reader/[id]" options={{ animation: "slide_from_left" }} />
              <Stack.Screen name="admin/index" options={{ animation: "slide_from_left" }} />
            </Stack>
            {showSplash ? <BrandSplash /> : null}
          </View>
        </LocalLibraryProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
