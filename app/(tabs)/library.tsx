import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BookCard } from "../../components/BookCard";
import { AppHeader, AppScreen, FeedbackPanel, LibraryLoadAlert, Pill } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { filterBooks } from "../../lib/library-utils";
import { palette } from "../../lib/theme";

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ folder?: string }>();
  const router = useRouter();
  const { books, folders, isLoading, error, refresh } = useApp();
  const local = useLocalLibrary();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(params.folder ?? null);
  const visible = useMemo(() => filterBooks(books, "", selectedFolder), [books, selectedFolder]);

  return (
    <AppScreen>
      <AppHeader eyebrow="الفهرس" title="مكتبة الكتب" subtitle="اختر تصنيفًا، ثم افتح الكتاب الذي تريد." />
      <View style={styles.filters}>
        <Pill label="كل الكتب" selected={!selectedFolder} onPress={() => setSelectedFolder(null)} />
        {folders.map((folder) => <Pill key={folder.id} label={folder.name} selected={selectedFolder === folder.id} onPress={() => setSelectedFolder(folder.id)} />)}
      </View>
      <View style={styles.summary}><Text style={styles.summaryText}>{visible.length.toLocaleString("ar-EG")} كتاب</Text><Text style={styles.summaryTitle}>{selectedFolder ? folders.find((folder) => folder.id === selectedFolder)?.name : "جميع التصنيفات"}</Text></View>
      {error ? <LibraryLoadAlert message={error} onRetry={() => void refresh()} /> : null}
      {isLoading ? <FeedbackPanel title="جارٍ تحميل الكتب" loading /> : null}
      <FlatList
        data={visible}
        keyExtractor={(book) => book.id}
        renderItem={({ item }) => <BookCard book={item} favorite={local.favorites.includes(item.id)} onFavorite={() => local.toggleFavorite(item.id)} onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={!isLoading && !error ? <FeedbackPanel title="لا توجد كتب في هذا التصنيف" message="جرّب تصنيفًا آخر أو عد لاحقًا." /> : null}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: 16, gap: 8, paddingBottom: 13 },
  summary: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 10 },
  summaryTitle: { color: palette.ink, fontWeight: "800", fontSize: 14 },
  summaryText: { color: palette.muted, fontSize: 12 },
  list: { paddingTop: 2, paddingBottom: 20 },
});
