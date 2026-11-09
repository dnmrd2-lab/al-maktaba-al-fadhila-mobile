import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { BookCard } from "../../components/BookCard";
import { AppHeader, AppScreen, FeedbackPanel } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { filterBooks } from "../../lib/library-utils";
import { startArabicVoiceRecognition, type VoiceRecognitionSession } from "../../lib/speech-service";
import { palette, radius } from "../../lib/theme";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const router = useRouter();
  const { books, isLoading } = useApp();
  const local = useLocalLibrary();
  const matches = useMemo(() => filterBooks(books, query), [books, query]);

  const toggleVoiceSearch = () => {
    if (isListening) {
      setIsListening(false);
      setVoiceNotice(null);
      return;
    }

    setVoiceNotice("جارٍ الاستماع... انطق اسم الكتاب الآن");
    setIsListening(true);

    const session: VoiceRecognitionSession | null = startArabicVoiceRecognition({
      onStart: () => {
        setIsListening(true);
      },
      onResult: (spokenText) => {
        setIsListening(false);
        const clean = spokenText.trim();
        setQuery(clean);

        // Check if there is an exact or top match to open and autoplay
        const found = filterBooks(books, clean);
        if (found.length > 0) {
          const topMatch = found[0];
          setVoiceNotice(`تم العثور على: «${topMatch.title}» — جارٍ الفتح والقراءة التلقائية...`);
          setTimeout(() => {
            router.push({
              pathname: "/reader/[id]",
              params: { id: topMatch.id, autoplay: "true" },
            });
          }, 850);
        } else {
          setVoiceNotice(`تم التقاط: «${clean}». استعرض النتائج المتقاربة أدناه.`);
        }
      },
      onError: (err) => {
        setIsListening(false);
        setVoiceNotice(`تعذر التقاط الصوت: ${err}`);
      },
      onEnd: () => {
        setIsListening(false);
      },
    });

    if (!session) {
      setIsListening(false);
      setVoiceNotice("للبحث الصوتي المباشر، يمكنك الضغط على أيقونة الميكروفون في لوحة المفاتيح لإملاء اسم الكتاب.");
    }
  };

  return (
    <AppScreen>
      <AppHeader eyebrow="اكتشف" title="ابحث في المكتبة" subtitle="بالكتاب أو المؤلف أو انطق اسم الكتاب صوتياً." />

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={22} color={palette.green} />

        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (voiceNotice) setVoiceNotice(null);
          }}
          placeholder="ابحث أو انطق اسم الكتاب..."
          placeholderTextColor="#879187"
          style={styles.input}
          textAlign="right"
          returnKeyType="search"
          accessibilityLabel="ابحث في الكتب"
        />

        {query.length > 0 ? (
          <Text
            onPress={() => {
              setQuery("");
              setVoiceNotice(null);
            }}
            style={styles.clear}
          >
            مسح
          </Text>
        ) : null}

        <Pressable
          onPress={toggleVoiceSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isListening ? "إيقاف البحث الصوتي" : "بدء البحث الصوتي"}
          style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
        >
          <MaterialCommunityIcons
            name={isListening ? "microphone" : "microphone-outline"}
            size={22}
            color={isListening ? palette.white : palette.greenDark}
          />
        </Pressable>
      </View>

      {/* Voice feedback banner */}
      {voiceNotice ? (
        <View style={[styles.voiceBanner, isListening && styles.voiceBannerListening]}>
          <MaterialCommunityIcons
            name={isListening ? "waveform" : "information-outline"}
            size={18}
            color={isListening ? palette.gold : palette.greenDark}
          />
          <Text style={[styles.voiceBannerText, isListening && styles.voiceBannerTextListening]}>
            {voiceNotice}
          </Text>
        </View>
      ) : null}

      <Text style={styles.resultCount}>
        {query.trim() ? `${matches.length.toLocaleString("ar-EG")} نتيجة` : "أحدث الكتب المتاحة"}
      </Text>

      {isLoading ? <FeedbackPanel title="جارٍ تحميل الكتب" loading /> : null}

      <FlatList
        data={matches}
        keyExtractor={(book) => book.id}
        renderItem={({ item }) => (
          <BookCard
            book={item}
            favorite={local.favorites.includes(item.id)}
            onFavorite={() => local.toggleFavorite(item.id)}
            onListen={() => router.push({ pathname: "/reader/[id]", params: { id: item.id, autoplay: "true" } })}
            onPress={() => router.push({ pathname: "/book/[id]", params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          !isLoading ? (
            <FeedbackPanel
              title={query.trim() ? "لا توجد نتائج" : "المكتبة فارغة"}
              message={query.trim() ? "جرّب كلمة أخرى أو انطق اسم الكتاب عبر زر الميكروفون." : "ستظهر الكتب هنا عند توفرها."}
            />
          ) : null
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    marginHorizontal: 18,
    marginBottom: 10,
    minHeight: 52,
    borderRadius: radius.control,
    borderColor: palette.border,
    borderWidth: 1,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 11, color: palette.ink, fontSize: 15, writingDirection: "rtl" },
  clear: { color: palette.green, fontSize: 12, fontWeight: "800", padding: 5 },
  voiceBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtnActive: {
    backgroundColor: palette.greenDark,
  },
  voiceBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.control,
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  voiceBannerListening: {
    backgroundColor: "#16281e",
    borderColor: palette.gold,
  },
  voiceBannerText: {
    flex: 1,
    color: palette.greenDark,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  voiceBannerTextListening: {
    color: palette.gold,
  },
  resultCount: { color: palette.muted, fontSize: 12, textAlign: "right", paddingHorizontal: 20, paddingBottom: 8 },
  list: { paddingBottom: 20 },
});
