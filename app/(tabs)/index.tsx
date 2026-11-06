import React, { useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BookCard } from "../../components/BookCard";
import { AppScreen, FeedbackPanel, SectionTitle } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { APP_ROLE, APP_TITLE } from "../../lib/branding";
import { getBooksToContinue } from "../../lib/library-utils";
import { useLocalLibrary } from "../../lib/local-library";
import { palette, radius } from "../../lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { books, folders, isLoading, error, refresh, session } = useApp();
  const local = useLocalLibrary();
  const featured = useMemo(() => books.filter((book) => book.published).slice(0, 5), [books]);
  const continueReading = useMemo(() => getBooksToContinue(books.filter((book) => book.published), local.progress), [books, local.progress]);

  return (
    <AppScreen>
      <FlatList
        data={featured}
        keyExtractor={(book) => book.id}
        renderItem={({ item }) => (
          <BookCard
            book={item}
            favorite={local.favorites.includes(item.id)}
            onFavorite={() => local.toggleFavorite(item.id)}
            onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })}
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.topbar}>
              <Pressable onPress={() => router.push(session ? "/admin" : "/settings")} style={styles.avatar} accessibilityLabel="الحساب والإدارة">
                <MaterialCommunityIcons name={session ? "account-check-outline" : "account-outline"} size={21} color={palette.green} />
              </Pressable>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>{APP_TITLE}</Text>
                <Text style={styles.brandSub}>{APP_ROLE}</Text>
              </View>
              <Image source={require("../../assets/images/sheikh-portrait-logo.png")} style={styles.brandMark} resizeMode="cover" accessible accessibilityLabel={APP_TITLE} />
            </View>
            <View style={styles.hero}>
              <View style={styles.heroOrnament}><MaterialCommunityIcons name="book-open-variant" size={48} color="#E6D4A9" /></View>
              <Text style={styles.heroEyebrow}>مكتبة رقمية عربية</Text>
              <Text style={styles.heroTitle}>اقرأ، تعلّم، واحتفظ بأثرك</Text>
              <Text style={styles.heroText}>كتب ورسائل علمية مرتبة لتصل إلى ما تبحث عنه بسهولة.</Text>
              <Pressable onPress={() => router.push("/library")} style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.8 }]}>
                <MaterialCommunityIcons name="arrow-left" size={17} color={palette.greenDark} />
                <Text style={styles.heroButtonText}>تصفح المكتبة</Text>
              </Pressable>
            </View>
            <View style={styles.statRow}>
              <View style={styles.statCard}><Text style={styles.statValue}>{books.filter((book) => book.published).length.toLocaleString("ar-EG")}</Text><Text style={styles.statLabel}>كتاب متاح</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{folders.length.toLocaleString("ar-EG")}</Text><Text style={styles.statLabel}>تصنيف</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>١٠٠٪</Text><Text style={styles.statLabel}>عربية</Text></View>
            </View>
            {continueReading.length > 0 ? (
              <>
                <View style={styles.sectionTop}><SectionTitle title="أكمل القراءة" action="تصفح المكتبة" onAction={() => router.push("/library")} /></View>
                {continueReading.slice(0, 5).map((book) => (
                  <BookCard
                    key={`continue-${book.id}`}
                    book={book}
                    favorite={local.favorites.includes(book.id)}
                    readingPage={local.progress[book.id]}
                    onFavorite={() => local.toggleFavorite(book.id)}
                    onPress={() => router.push({ pathname: "/reader/[id]", params: { id: book.id } })}
                  />
                ))}
              </>
            ) : null}
            <View style={styles.sectionTop}><SectionTitle title="تصفح حسب التصنيف" action="الكل" onAction={() => router.push("/library")} /></View>
            <View style={styles.folderList}>
              {folders.map((folder) => (
                <Pressable key={folder.id} onPress={() => router.push({ pathname: "/library", params: { folder: folder.id } })} style={({ pressed }) => [styles.folderChip, pressed && { opacity: 0.75 }]}>
                  <MaterialCommunityIcons name="bookshelf" size={18} color={palette.green} />
                  <Text style={styles.folderName}>{folder.name}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionTop}><SectionTitle title="مختارات المكتبة" action="عرض الكل" onAction={() => router.push("/library")} /></View>
            {error ? <FeedbackPanel title="تعذر تحميل المكتبة" message={error} action="إعادة المحاولة" onAction={() => void refresh()} /> : null}
            {isLoading ? <FeedbackPanel title="جارٍ تحميل الكتب" loading /> : null}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error ? <FeedbackPanel title="لا توجد كتب منشورة بعد" message="ستظهر الكتب هنا عندما تصبح متاحة في المكتبة." /> : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 22 },
  topbar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  brandCopy: { flex: 1, alignItems: "flex-end" },
  brandName: { color: palette.greenDark, fontSize: 13, lineHeight: 18, fontWeight: "900", textAlign: "right" },
  brandSub: { color: palette.muted, fontSize: 10, lineHeight: 15, marginTop: 2, textAlign: "right" },
  brandMark: { width: 46, height: 46, borderRadius: 15, backgroundColor: palette.greenDark, borderWidth: 1.5, borderColor: palette.gold, overflow: "hidden" },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: 16, marginTop: 3, minHeight: 225, backgroundColor: palette.greenDark, borderRadius: 24, padding: 22, alignItems: "flex-end", overflow: "hidden" },
  heroOrnament: { position: "absolute", left: 22, top: 32, opacity: 0.24 },
  heroEyebrow: { color: "#D9C18A", fontSize: 12, fontWeight: "800", marginBottom: 10 },
  heroTitle: { color: palette.white, fontSize: 23, fontWeight: "900", lineHeight: 34, textAlign: "right", maxWidth: "88%" },
  heroText: { color: "#D6E1D9", fontSize: 13, lineHeight: 22, textAlign: "right", marginTop: 8, maxWidth: "88%" },
  heroButton: { marginTop: 17, backgroundColor: "#E8D8AD", borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 10, flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  heroButtonText: { color: palette.greenDark, fontSize: 12, fontWeight: "900" },
  statRow: { flexDirection: "row-reverse", gap: 9, marginHorizontal: 16, marginTop: 12, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 15, paddingVertical: 11, alignItems: "center" },
  statValue: { color: palette.green, fontSize: 18, fontWeight: "900" },
  statLabel: { color: palette.muted, fontSize: 10, marginTop: 2 },
  sectionTop: { marginTop: 8 },
  folderList: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: 16, paddingBottom: 12, gap: 9 },
  folderChip: { flexDirection: "row-reverse", gap: 8, alignItems: "center", backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  folderName: { color: palette.ink, fontSize: 12, fontWeight: "700" },
});
