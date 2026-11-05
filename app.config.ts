export default {
  name: "الشيخ القرعاوي",
  slug: "al-qaraawi-library",
  owner: "dnmrd2s-team",
  version: "1.0.0",
  sdkVersion: "54.0.0",
  platforms: ["ios", "android", "web"],
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "almaktabaalfa",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#f5f0eb"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.elkelany.alqaraawi.library"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png"
    },
    package: "com.elkelany.alqaraawi.library"
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "913f1286-c020-408a-9008-24d765eac88a"
    }
  }
};
