import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AppHeader, AppScreen, FeedbackPanel, MetaLine, PrimaryButton } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { formatPages } from "../../lib/library-utils";
import { palette, radius } from "../../lib/theme";

const covers = {
  green: require("../../assets/images/cover-green.jpg"),
  cream: require("../../assets/images/cover-cream.jpg"),
  teal: require("../../assets/images/cover-teal.jpg"),
};

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, folders, isLoading } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);
  if (!book) return <AppScreen>{isLoading ? <FeedbackPanel title="جارٍ تحميل الكتاب" loading /> : <FeedbackPanel title="لم يُعثر على الكتاب" message="ربما أزيل من المكتبة أو لم يعد منشورًا." />}</AppScreen>;
  const cover = book.coverUri ? { uri: book.coverUri } : covers[book.coverKey];
  const folder = folders.find((item) => item.id === book.folderId);
  const savedPage = local.progress[book.id];

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader eyebrow={folder?.name ?? "المكتبة"} title="تفاصيل الكتاب" />
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.category}>{book.category || "كتاب"}</Text>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author || "مؤلف غير محدد"}</Text>
            <View style={styles.status}><MaterialCommunityIcons name="check-decagram" size={15} color={palette.green} /><Text style={styles.statusText}>متاح للقراءة</Text></View>
          </View>
          <Image source={cover} resizeMode="cover" style={styles.cover} />
        </View>
        <View style={styles.actionRow}>
          <PrimaryButton title={savedPage ? `متابعة القراءة · صفحة ${savedPage.toLocaleString("ar-EG")}` : "ابدأ القراءة"} onPress={() => router.push({ pathname: "/reader/[id]", params: { id: book.id } })} style={{ flex: 1 }} />
          <PrimaryButton title={local.favorites.includes(book.id) ? "محفوظ" : "حفظ"} onPress={() => local.toggleFavorite(book.id)} variant="outline" style={{ minWidth: 90 }} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>عن الكتاب</Text>
          <Text style={styles.description}>{book.description || "لا يوجد وصف لهذا الكتاب حتى الآن."}</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>معلومات</Text>
          <MetaLine label="المؤلف" value={book.author || "غير محدد"} />
          <MetaLine label="التصنيف" value={book.category || "غير محدد"} />
          <MetaLine label="عدد الصفحات" value={formatPages(book.pages)} />
          <MetaLine label="التنزيل" value={book.downloadPolicy === "DOWNLOAD_ALLOWED" ? "مسموح من الواجهة" : "قراءة فقط من الواجهة"} />
        </View>
        <Text style={styles.footerNote}>المفضلة وموضع القراءة محفوظان محليًا على هذا الجهاز.</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  hero: { marginHorizontal: 18, marginBottom: 15, flexDirection: "row-reverse", gap: 16, alignItems: "center", padding: 18, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  heroCopy: { flex: 1, alignItems: "flex-end" },
  cover: { width: 112, height: 158, borderRadius: 12, backgroundColor: palette.surfaceWarm },
  category: { color: palette.gold, fontSize: 12, fontWeight: "800", marginBottom: 7, textAlign: "right" },
  title: { color: palette.ink, fontSize: 19, fontWeight: "900", lineHeight: 28, textAlign: "right" },
  author: { color: palette.muted, fontSize: 13, marginTop: 8, textAlign: "right" },
  status: { flexDirection: "row-reverse", alignItems: "center", gap: 5, marginTop: 14 },
  statusText: { color: palette.green, fontSize: 11, fontWeight: "700" },
  actionRow: { flexDirection: "row-reverse", gap: 9, marginHorizontal: 18, marginBottom: 14 },
  panel: { marginHorizontal: 18, marginTop: 10, padding: 17, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  panelTitle: { color: palette.ink, fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 9 },
  description: { color: palette.muted, fontSize: 14, lineHeight: 25, textAlign: "right" },
  footerNote: { color: palette.muted, textAlign: "center", fontSize: 11, marginTop: 17, marginHorizontal: 24 },
});
