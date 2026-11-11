import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const { books, folders, isLoading, canManageBooks, session } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);

  if (!book) {
    return (
      <AppScreen>
        {isLoading ? (
          <FeedbackPanel title="جارٍ تحميل الكتاب" loading />
        ) : (
          <FeedbackPanel
            title="لم يُعثر على الكتاب"
            message="ربما أزيل من المكتبة أو لم يعد منشورًا."
            action="العودة للمكتبة"
            onAction={() => router.back()}
          />
        )}
      </AppScreen>
    );
  }

  const [imageError, setImageError] = React.useState(false);
  const cover = !imageError && book.coverUri ? { uri: book.coverUri } : covers[book.coverKey];
  const folder = folders.find((item) => item.id === book.folderId);
  const savedPage = local.progress[book.id];
  const isFavorite = local.favorites.includes(book.id);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppHeader eyebrow={folder?.name ?? "المكتبة"} title="تفاصيل الكتاب" />

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.category}>{book.category || "كتاب"}</Text>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author || "مؤلف غير محدد"}</Text>
            <View style={styles.statusRow}>
              <View style={styles.status}>
                <MaterialCommunityIcons name="check-decagram" size={15} color={palette.green} />
                <Text style={styles.statusText}>متاح للقراءة</Text>
              </View>
              <View style={styles.viewsBadge}>
                <MaterialCommunityIcons name="eye-outline" size={14} color={palette.greenDark} />
                <Text style={styles.viewsBadgeText}>
                  {(book.viewsCount ?? 0).toLocaleString("ar-EG")} قراءة
                </Text>
              </View>
            </View>
          </View>
          <Image source={cover} resizeMode="cover" style={styles.cover} onError={() => setImageError(true)} />
        </View>

        {/* Action Row: Reading and Bookmarking */}
        <View style={styles.actionRow}>
          <PrimaryButton
            title={savedPage ? `متابعة القراءة · ص ${savedPage.toLocaleString("ar-EG")}` : "ابدأ القراءة"}
            icon="book-open-page-variant"
            onPress={() => router.push({ pathname: "/reader/[id]", params: { id: book.id } })}
            style={styles.readButton}
          />
          <PrimaryButton
            title={isFavorite ? "محفوظ" : "حفظ"}
            icon={isFavorite ? "bookmark-check" : "bookmark-outline"}
            onPress={() => local.toggleFavorite(book.id)}
            variant="outline"
            style={styles.favButton}
          />
        </View>

        {/* Admin Management Section */}
        {canManageBooks ? (
          <View style={styles.adminBox}>
            <View style={styles.adminBadgeRow}>
              <MaterialCommunityIcons name="shield-check" size={18} color={palette.greenDark} />
              <Text style={styles.adminBadgeText}>صلاحيات الإشراف نشطة</Text>
            </View>
            <PrimaryButton
              title="تعديل بيانات ووصف هذا الكتاب"
              icon="file-document-edit-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: "/admin", params: { editBookId: book.id } })}
              style={styles.adminEditBtn}
            />
          </View>
        ) : !session ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: "/admin", params: { editBookId: book.id } })}
            style={styles.adminHintBox}
          >
            <MaterialCommunityIcons name="shield-account-outline" size={18} color={palette.muted} />
            <Text style={styles.adminHintText}>
              هل أنت المشرف على التطبيق؟ اضغط هنا لتسجيل الدخول وتعديل الكتاب
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>عن الكتاب</Text>
          <Text style={styles.description}>{book.description || "لا يوجد وصف لهذا الكتاب حتى الآن."}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>معلومات</Text>
          <MetaLine label="المؤلف" value={book.author || "غير محدد"} />
          <MetaLine label="التصنيف" value={book.category || "غير محدد"} />
          <MetaLine label="عدد الصفحات" value={formatPages(book.pages)} />
          <MetaLine
            label="مرات القراءة والمشاهدة"
            value={`${(book.viewsCount ?? 0).toLocaleString("ar-EG")} مرة`}
          />
          <MetaLine
            label="التنزيل"
            value={book.downloadPolicy === "DOWNLOAD_ALLOWED" ? "مسموح من الواجهة" : "قراءة فقط من الواجهة"}
          />
        </View>

        <Text style={styles.footerNote}>المفضلة وموضع القراءة محفوظان محليًا على هذا الجهاز.</Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  hero: {
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row-reverse",
    gap: 16,
    alignItems: "center",
    padding: 18,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  heroCopy: { flex: 1, alignItems: "flex-end" },
  cover: { width: 112, height: 158, borderRadius: 12, backgroundColor: palette.surfaceWarm },
  category: { color: palette.gold, fontSize: 12, fontWeight: "800", marginBottom: 7, textAlign: "right" },
  title: { color: palette.ink, fontSize: 19, fontWeight: "900", lineHeight: 28, textAlign: "right" },
  author: { color: palette.muted, fontSize: 13, marginTop: 8, textAlign: "right" },
  statusRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  status: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  statusText: { color: palette.green, fontSize: 12, fontWeight: "700" },
  viewsBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: palette.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 54, 41, 0.15)",
  },
  viewsBadgeText: { color: palette.greenDark, fontSize: 11, fontWeight: "800" },

  actionRow: {
    flexDirection: "row-reverse",
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 14,
    alignItems: "center",
  },
  readButton: {
    flex: 1,
    minHeight: 52,
  },
  favButton: {
    minWidth: 100,
    minHeight: 52,
  },

  adminBox: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: palette.greenSoft,
    borderWidth: 1,
    borderColor: palette.green,
  },
  adminBadgeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  adminBadgeText: { color: palette.greenDark, fontSize: 13, fontWeight: "800" },
  adminEditBtn: {
    width: "100%",
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.green,
  },

  adminHintBox: {
    marginHorizontal: 18,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.border,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  adminHintText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },

  panel: {
    marginHorizontal: 18,
    marginTop: 10,
    padding: 17,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  panelTitle: { color: palette.ink, fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 9 },
  description: { color: palette.muted, fontSize: 14, lineHeight: 25, textAlign: "right" },
  footerNote: { color: palette.muted, textAlign: "center", fontSize: 11, marginTop: 17, marginHorizontal: 24 },
});
