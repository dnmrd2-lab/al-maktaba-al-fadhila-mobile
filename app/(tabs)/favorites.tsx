import React, { useMemo } from "react";
import { FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { BookCard } from "../../components/BookCard";
import { AppHeader, AppScreen, FeedbackPanel } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";

export default function FavoritesScreen() {
  const router = useRouter();
  const { books } = useApp();
  const local = useLocalLibrary();
  const favorites = useMemo(() => books.filter((book) => local.favorites.includes(book.id)), [books, local.favorites]);
  return (
    <AppScreen>
      <AppHeader eyebrow="محفوظاتك" title="الكتب المفضلة" subtitle="تبقى هذه القائمة على جهازك فقط." />
      <FlatList
        data={favorites}
        keyExtractor={(book) => book.id}
        renderItem={({ item }) => <BookCard book={item} favorite onFavorite={() => local.toggleFavorite(item.id)} onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })} />}
        ListEmptyComponent={<FeedbackPanel title="لم تحفظ كتبًا بعد" message="اضغط رمز القلب على أي كتاب لتجده هنا." />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ list: { paddingBottom: 20, flexGrow: 1 } });
