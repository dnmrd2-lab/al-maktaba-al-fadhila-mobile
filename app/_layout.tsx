import "../global.css";
import React, { useEffect, useState } from "react";
import { Platform, I18nManager, View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BrandSplash } from "../components/BrandSplash";
import { AppProvider } from "../lib/app-context";
import { LocalLibraryProvider } from "../lib/local-library";
import { palette } from "../lib/theme";

if (Platform.OS !== "web" && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
}

if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "web") void SplashScreen.hideAsync().catch(() => undefined);
    const timer = setTimeout(() => setShowSplash(false), 1750);
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
