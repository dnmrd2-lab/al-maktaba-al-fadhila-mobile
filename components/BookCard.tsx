import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Book } from "../lib/app-context";
import { formatPages } from "../lib/library-utils";
import { palette, radius } from "../lib/theme";

const fallbackCovers = {
  green: require("../assets/images/cover-green.jpg"),
  cream: require("../assets/images/cover-cream.jpg"),
  teal: require("../assets/images/cover-teal.jpg"),
};

export function BookCard({ book, favorite, onPress, onFavorite, readingPage }: { book: Book; favorite?: boolean; onPress: () => void; onFavorite?: () => void; readingPage?: number }) {
  const cover = book.coverUri ? { uri: book.coverUri } : fallbackCovers[book.coverKey];
  return (
    <View style={styles.card}>
      {onFavorite ? (
        <Pressable onPress={onFavorite} hitSlop={10} accessibilityRole="button" accessibilityLabel={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"} style={styles.favorite}>
          <MaterialCommunityIcons name={favorite ? "heart" : "heart-outline"} size={21} color={favorite ? palette.danger : palette.muted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onPress} style={({ pressed }) => [styles.body, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel={`تفاصيل الكتاب: ${book.title}`}>
        <View style={styles.copy}>
          <Text style={styles.category}>{book.category || "كتاب"}</Text>
          <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author || "مؤلف غير محدد"}</Text>
          {readingPage && readingPage > 1 ? <Text style={styles.progress}>آخر موضع: صفحة {readingPage.toLocaleString("ar-EG")} · تابع القراءة</Text> : null}
          <View style={styles.footer}>
            <Text style={styles.pages}>{formatPages(book.pages)}</Text>
            <MaterialCommunityIcons name="chevron-left" size={17} color={palette.green} />
          </View>
        </View>
        <Image source={cover} style={styles.cover} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: palette.surface, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, overflow: "hidden" },
  body: { minHeight: 142, padding: 14, paddingRight: 52, flexDirection: "row-reverse", alignItems: "center", gap: 14 },
  cover: { width: 82, height: 116, borderRadius: 11, backgroundColor: palette.surfaceWarm },
  copy: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  category: { color: palette.gold, fontSize: 11, fontWeight: "800", marginBottom: 5, textAlign: "right" },
  title: { color: palette.ink, fontSize: 15, fontWeight: "800", lineHeight: 23, textAlign: "right", width: "100%" },
  author: { color: palette.muted, fontSize: 12, marginTop: 6, textAlign: "right", width: "100%" },
  progress: { color: palette.green, fontSize: 10, fontWeight: "800", marginTop: 6, textAlign: "right", width: "100%" },
  footer: { width: "100%", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
  pages: { color: palette.muted, fontSize: 11 },
  favorite: { position: "absolute", zIndex: 2, left: 13, top: 13, width: 34, height: 34, borderRadius: 17, backgroundColor: palette.background, alignItems: "center", justifyContent: "center" },
});
