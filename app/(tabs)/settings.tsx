import React from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AppHeader, AppScreen, PrimaryButton } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { palette, radius } from "../../lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { session, roles, signOut } = useApp();
  const local = useLocalLibrary();
  const confirmClear = () => Alert.alert("مسح بيانات هذا الجهاز؟", "سيتم حذف المفضلة ومواضع القراءة والعلامات المرجعية المحفوظة محليًا فقط.", [
    { text: "إلغاء", style: "cancel" },
    { text: "مسح البيانات", style: "destructive", onPress: () => void local.clearLocalData() },
  ]);
  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppHeader eyebrow="تخصيص" title="الإعدادات" subtitle="إدارة حسابك وبيانات القراءة." />
        <View style={styles.accountCard}>
          <View style={styles.accountIcon}><MaterialCommunityIcons name="account-outline" size={26} color={palette.green} /></View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.cardTitle}>{session?.user.email ?? "تصفح كزائر"}</Text>
            <Text style={styles.cardSubtitle}>{session ? (roles.length ? "حساب فريق المكتبة" : "حساب قارئ") : "لا تحتاج إلى حساب لتصفح الكتب المنشورة"}</Text>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>الحساب والإدارة</Text>
          <PrimaryButton title={session ? "فتح لوحة الإدارة" : "دخول أعضاء الفريق"} onPress={() => router.push("/admin")} />
          {session ? <Pressable onPress={() => void signOut()} style={styles.linkRow}><MaterialCommunityIcons name="logout" size={19} color={palette.muted} /><Text style={styles.linkText}>تسجيل الخروج</Text></Pressable> : null}
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>بيانات القراءة</Text>
          <View style={styles.noteRow}><MaterialCommunityIcons name="heart-outline" size={18} color={palette.gold} /><Text style={styles.noteText}>المفضلة، التقدم، والعلامات المرجعية محفوظة على هذا الجهاز فقط.</Text></View>
          <Pressable onPress={confirmClear} style={styles.clearButton}><Text style={styles.clearText}>مسح بيانات القراءة المحلية</Text><MaterialCommunityIcons name="delete-outline" size={19} color={palette.danger} /></Pressable>
        </View>
        <View style={styles.aboutCard}>
          <MaterialCommunityIcons name="book-open-page-variant" size={21} color={palette.gold} />
          <Text style={styles.aboutTitle}>عن التطبيق</Text>
          <Text style={styles.aboutText}>تطبيق عربي لقراءة الكتب والرسائل العلمية. بعض السجلات في قاعدة البيانات تجريبية، وأي صفحة نصية تجريبية موضحة بذلك داخل القارئ.</Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  accountCard: { marginHorizontal: 18, marginBottom: 12, padding: 16, flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radius.card },
  accountIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: palette.greenSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: palette.ink, fontSize: 14, fontWeight: "800", textAlign: "right" },
  cardSubtitle: { color: palette.muted, fontSize: 11, textAlign: "right", marginTop: 4 },
  panel: { marginHorizontal: 18, marginTop: 10, padding: 17, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radius.card },
  panelTitle: { color: palette.ink, fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 13 },
  linkRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 14 },
  linkText: { color: palette.muted, fontWeight: "700", fontSize: 13 },
  noteRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8 },
  noteText: { flex: 1, color: palette.muted, fontSize: 13, lineHeight: 22, textAlign: "right" },
  clearButton: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 15, padding: 10, borderTopWidth: 1, borderTopColor: palette.border },
  clearText: { color: palette.danger, fontSize: 12, fontWeight: "800" },
  aboutCard: { alignItems: "center", marginHorizontal: 18, marginTop: 16, padding: 18, backgroundColor: palette.greenDark, borderRadius: radius.card },
  aboutTitle: { color: palette.white, fontWeight: "900", fontSize: 15, marginTop: 7 },
  aboutText: { color: "#D8E3D9", fontSize: 12, textAlign: "center", lineHeight: 21, marginTop: 8 },
});
