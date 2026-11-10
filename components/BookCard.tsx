import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Book } from "../lib/app-context";
import { formatPages } from "../lib/library-utils";
import { palette, radius } from "../lib/theme";

const fallbackCovers = {
  green: require("../assets/images/cover-green.jpg"),
  cream: require("../assets/images/cover-cream.jpg"),
  teal: require("../assets/images/cover-teal.jpg"),
};

export function BookCard({
  book,
  favorite,
  onPress,
  onFavorite,
  onListen,
  readingPage,
}: {
  book: Book;
  favorite?: boolean;
  onPress: () => void;
  onFavorite?: () => void;
  onListen?: () => void;
  readingPage?: number;
}) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const cover = !imageError && book.coverUri ? { uri: book.coverUri } : fallbackCovers[book.coverKey];

  const handleListen = () => {
    if (onListen) {
      onListen();
    } else {
      router.push({ pathname: "/reader/[id]", params: { id: book.id, autoplay: "true" } });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.topActions}>
        {onFavorite ? (
          <Pressable
            onPress={onFavorite}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
            style={styles.actionBtn}
          >
            <MaterialCommunityIcons
              name={favorite ? "heart" : "heart-outline"}
              size={18}
              color={favorite ? palette.danger : palette.muted}
            />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`تفاصيل الكتاب: ${book.title}`}
      >
        <View style={styles.copy}>
          <View style={styles.categoryRow}>
            <Text style={styles.category}>{book.category || "كتاب"}</Text>
            {book.isArchived ? (
              <View style={styles.archivedBadge}>
                <Text style={styles.archivedBadgeText}>مؤرشف</Text>
              </View>
            ) : !book.published ? (
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>مسودة</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author || "مؤلف غير محدد"}</Text>
          {readingPage && readingPage > 1 ? (
            <Text style={styles.progress}>آخر موضع: صفحة {readingPage.toLocaleString("ar-EG")} · تابع القراءة</Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.pages}>{formatPages(book.pages)}</Text>
            <MaterialCommunityIcons name="chevron-left" size={17} color={palette.green} />
          </View>
        </View>
        <Image source={cover} style={styles.cover} resizeMode="cover" onError={() => setImageError(true)} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
  },
  topActions: {
    position: "absolute",
    zIndex: 2,
    left: 11,
    top: 11,
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    minHeight: 142,
    padding: 14,
    paddingRight: 14,
    paddingLeft: 84,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  cover: { width: 82, height: 116, borderRadius: 11, backgroundColor: palette.surfaceWarm },
  copy: { flex: 1, alignItems: "flex-end", minWidth: 0 },
  categoryRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  category: { color: palette.gold, fontSize: 11, fontWeight: "800", textAlign: "right" },
  archivedBadge: {
    backgroundColor: "#f5ece6",
    borderColor: "#c49a80",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  archivedBadgeText: { color: "#8c4a28", fontSize: 9, fontWeight: "800" },
  draftBadge: {
    backgroundColor: palette.goldSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  draftBadgeText: { color: "#725716", fontSize: 9, fontWeight: "800" },
  title: { color: palette.ink, fontSize: 15, fontWeight: "800", lineHeight: 23, textAlign: "right", width: "100%" },
  author: { color: palette.muted, fontSize: 12, marginTop: 6, textAlign: "right", width: "100%" },
  progress: { color: palette.green, fontSize: 10, fontWeight: "800", marginTop: 6, textAlign: "right", width: "100%" },
  footer: {
    width: "100%",
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },
  pages: { color: palette.muted, fontSize: 11 },
});
