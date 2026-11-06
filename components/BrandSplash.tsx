import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_ROLE, APP_TAGLINE, APP_TITLE } from "../lib/branding";
import { palette } from "../lib/theme";

export function BrandSplash() {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [opacity, translateY]);

  return (
    <View style={styles.overlay} accessibilityLabel={`${APP_TITLE}، ${APP_ROLE}`}>
      <View pointerEvents="none" style={styles.ornaments}>
        <View style={styles.topRing} />
        <View style={styles.topRingInner} />
        <View style={styles.bottomRing} />
        <View style={styles.bottomRingInner} />
      </View>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.emblemFrame}>
            <Image source={require("../assets/images/sheikh-portrait-logo.png")} style={styles.emblemImage} resizeMode="cover" />
          </View>

          <Text style={styles.eyebrow}>مكتبة علمية عربية</Text>
          <Text style={styles.title}>{APP_TITLE}</Text>
          <View style={styles.divider} />
          <Text style={styles.role}>{APP_ROLE}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </Animated.View>
        <View pointerEvents="none" style={styles.footer}>
          <View style={styles.footerRule} />
          <Text style={styles.footerText}>المكتبة العلمية الرقمية</Text>
          <View style={styles.footerRule} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 50,
    overflow: "hidden",
    backgroundColor: palette.greenDark,
  },
  ornaments: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  topRing: { position: "absolute", width: 350, height: 350, borderRadius: 175, borderWidth: 1, borderColor: "rgba(217,193,138,0.13)", top: -190, right: -130 },
  topRingInner: { position: "absolute", width: 270, height: 270, borderRadius: 135, borderWidth: 1, borderColor: "rgba(217,193,138,0.08)", top: -148, right: -91 },
  bottomRing: { position: "absolute", width: 390, height: 390, borderRadius: 195, borderWidth: 1, borderColor: "rgba(217,193,138,0.11)", bottom: -260, left: -145 },
  bottomRingInner: { position: "absolute", width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: "rgba(217,193,138,0.07)", bottom: -214, left: -101 },
  safeArea: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 36 },
  emblemFrame: { width: 158, height: 158, alignItems: "center", justifyContent: "center", marginBottom: 17, borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: palette.gold },
  emblemImage: { width: 158, height: 158 },
  eyebrow: { color: palette.goldSoft, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 10 },
  title: { maxWidth: 360, color: palette.white, fontSize: 23, lineHeight: 38, fontWeight: "900", textAlign: "center" },
  divider: { width: 58, height: 2, borderRadius: 2, backgroundColor: palette.gold, marginTop: 19, marginBottom: 17 },
  role: { maxWidth: 340, color: "#E8E0CC", fontSize: 15, lineHeight: 25, fontWeight: "700", textAlign: "center" },
  tagline: { color: "#D8C99E", fontSize: 12, marginTop: 17, letterSpacing: 0.3 },
  footer: { position: "absolute", bottom: 14, left: 36, right: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  footerRule: { width: 28, height: 1, backgroundColor: "rgba(217,193,138,0.4)" },
  footerText: { color: "rgba(245,243,236,0.58)", fontSize: 10 },
});
