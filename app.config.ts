import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

if (process.env.EAS_BUILD === "true" && (!supabaseUrl || !supabasePublishableKey)) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or a public Supabase key (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY) for this EAS build.",
  );
}

const config: ExpoConfig = {
  name: "تطبيق فضيلة الشيخ عبدالله بن إبراهيم بن عثمان القرعاوي إمام الجامع الكبير (جامع خادم الحرمين الشريفين ببريدة)",
  owner: "dnmrd2s-team",
  slug: "al-qaraawi-library",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "fadhila-library",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.fadhila.library.mobile",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#103629",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
    },
    package: "com.fadhila.library.mobile",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  extra: {
    eas: { projectId: "913f1286-c020-408a-9008-24d765eac88a" },
    supabaseUrl,
    supabasePublishableKey,
  },
  web: { bundler: "metro", output: "static", favicon: "./assets/images/icon.png" },
  plugins: [
    "expo-router",
    ["expo-secure-store", { configureAndroidBackup: true }],
    ["expo-document-picker", {}],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/sheikh-portrait-logo.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#103629",
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
