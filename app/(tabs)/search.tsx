import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BookCard } from "../../components/BookCard";
import { AppHeader, AppScreen, FeedbackPanel } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { filterBooks } from "../../lib/library-utils";
import { palette, radius } from "../../lib/theme";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { books, isLoading } = useApp();
  const local = useLocalLibrary();
  const matches = useMemo(() => filterBooks(books, query), [books, query]);
  return (
    <AppScreen>
      <AppHeader eyebrow="اكتشف" title="ابحث في المكتبة" subtitle="بالكتاب أو المؤلف أو الموضوع." />
      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color={palette.green} />
        <TextInput value={query} onChangeText={setQuery} placeholder="اكتب كلمة للبحث" placeholderTextColor="#879187" style={styles.input} textAlign="right" returnKeyType="search" accessibilityLabel="ابحث في الكتب" />
        {query.length > 0 ? <Text onPress={() => setQuery("")} style={styles.clear}>مسح</Text> : null}
      </View>
      <Text style={styles.resultCount}>{query.trim() ? `${matches.length.toLocaleString("ar-EG")} نتيجة` : "أحدث الكتب المتاحة"}</Text>
      {isLoading ? <FeedbackPanel title="جارٍ تحميل الكتب" loading /> : null}
      <FlatList
        data={matches}
        keyExtractor={(book) => book.id}
        renderItem={({ item }) => <BookCard book={item} favorite={local.favorites.includes(item.id)} onFavorite={() => local.toggleFavorite(item.id)} onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={!isLoading ? <FeedbackPanel title={query.trim() ? "لا توجد نتائج" : "المكتبة فارغة"} message={query.trim() ? "جرّب كلمة أخرى أو جزءًا من العنوان." : "ستظهر الكتب هنا عند توفرها."} /> : null}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchBox: { marginHorizontal: 18, marginBottom: 12, minHeight: 52, borderRadius: radius.control, borderColor: palette.border, borderWidth: 1, backgroundColor: palette.surface, paddingHorizontal: 14, flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  input: { flex: 1, paddingVertical: 11, color: palette.ink, fontSize: 15, writingDirection: "rtl" },
  clear: { color: palette.green, fontSize: 12, fontWeight: "800", padding: 5 },
  resultCount: { color: palette.muted, fontSize: 12, textAlign: "right", paddingHorizontal: 20, paddingBottom: 8 },
  list: { paddingBottom: 20 },
});
