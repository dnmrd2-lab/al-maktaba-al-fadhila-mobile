import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette } from "../../lib/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Platform.OS === "web" ? 10 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.green,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { height: 58 + bottom, paddingTop: 7, paddingBottom: bottom, backgroundColor: palette.surface, borderTopColor: palette.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="library" options={{ title: "المكتبة", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bookshelf" color={color} size={size} /> }} />
      <Tabs.Screen name="search" options={{ title: "بحث", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="magnify" color={color} size={size} /> }} />
      <Tabs.Screen name="favorites" options={{ title: "المفضلة", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="heart-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
