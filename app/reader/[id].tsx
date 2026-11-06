import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as WebBrowser from "expo-web-browser";
import { AppScreen, FeedbackPanel, PrimaryButton } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import { useLocalLibrary } from "../../lib/local-library";
import { canOfferDownload } from "../../lib/library-utils";
import { supabase } from "../../lib/supabase";
import { palette } from "../../lib/theme";

const samplePages = (title: string) => [
  `بسم الله الرحمن الرحيم\n\nالحمد لله رب العالمين، والصلاة والسلام على أشرف الأنبياء والمرسلين، نبينا محمد وعلى آله وصحبه أجمعين، أما بعد:\n\nهذه صفحات تجريبية للعرض فقط من «${title}»، وليست نص الكتاب الأصلي. تُستبدل عند رفع النسخة المعتمدة من الكتاب.`,
  "المقدمة\n\nاعلم — وفقك الله لطاعته — أن طلب العلم من أجلّ ما تُنفق فيه الأوقات، وأن العبد كلما ازداد علماً ازداد لله خشية، وأن أول ما يجب على المكلف معرفة ربه ومعرفة دينه ومعرفة نبيه صلى الله عليه وسلم.",
  "الباب الأول\n\nالأصل في العبادات التوقيف، فلا يُتعبد لله إلا بما شرع، والأصل في المعاملات الحل حتى يقوم الدليل على المنع. وعلى طالب العلم أن يعتني بالأصول قبل الفروع، وأن يتدرج في الطلب على أهل العلم الراسخين.",
  "الباب الثاني\n\nمن أعظم أسباب ثبات العبد على الحق: ملازمة القرآن تلاوةً وتدبراً، ومجالسة الصالحين، والدعاء بالثبات. وقد كان السلف يوصون بحفظ المتون والعناية بها؛ فإنها مفاتيح العلوم.",
  "الخاتمة\n\nهذا ما تيسر إيراده، والحمد لله الذي بنعمته تتم الصالحات، وصلى الله وسلم على نبينا محمد وعلى آله وصحبه أجمعين.",
];

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, isLoading } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);
  const bookTitle = book?.title ?? "";
  const bookId = book?.id;
  const saveReadingProgress = local.saveProgress;
  const [readingPosition, setReadingPosition] = useState<{ bookId: string; page: number } | null>(null);
  const [pageInput, setPageInput] = useState("");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pages = useMemo(() => samplePages(bookTitle), [bookTitle]);
  const total = book?.pdfPath ? Math.max(book.pages, 1) : Math.max(pages.length, 1);
  const totalKnown = !book?.pdfPath || book.pages > 0;
  const maxPage = book?.pdfPath && !totalKnown ? Number.MAX_SAFE_INTEGER : total;
  const savedPage = Math.min(maxPage, Math.max(1, local.progress[id] ?? 1));
  const page = readingPosition?.bookId === id ? readingPosition.page : savedPage;
  const bookmarks = local.bookmarks[id] ?? [];

  useEffect(() => {
    setPageInput(String(page));
  }, [id, page]);

  const setCurrentPage = (requestedPage: number) => {
    if (!bookId || !Number.isFinite(requestedPage)) return;
    const nextPage = Math.min(maxPage, Math.max(1, Math.floor(requestedPage)));
    setReadingPosition({ bookId, page: nextPage });
    setPageInput(String(nextPage));
    saveReadingProgress(bookId, nextPage);
  };

  const openPdf = async (asDownload = false) => {
    if (!book?.pdfPath) return;
    if (asDownload && !canOfferDownload(book)) {
      Alert.alert("التنزيل غير متاح", "يسمح إعداد هذا الكتاب بالقراءة فقط من الواجهة.");
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const { data, error: signedError } = await supabase.storage.from("library").createSignedUrl(
        book.pdfPath,
        asDownload ? 300 : 600,
        asDownload ? { download: `${book.title}.pdf` } : undefined,
      );
      if (signedError) throw signedError;
      if (!data?.signedUrl) throw new Error("لم يصدر رابط قراءة صالح.");
      const target = asDownload ? data.signedUrl : `${data.signedUrl}#page=${page}`;
      await WebBrowser.openBrowserAsync(target);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر فتح ملف الكتاب.");
    } finally {
      setOpening(false);
    }
  };

  if (!book) return <AppScreen>{isLoading ? <FeedbackPanel title="جارٍ تحميل الكتاب" loading /> : <FeedbackPanel title="لم يُعثر على الكتاب" action="العودة" onAction={() => router.back()} />}</AppScreen>;
  const isBookmarked = bookmarks.includes(page);

  return (
    <AppScreen edges={["top", "left", "right", "bottom"]}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="العودة"><MaterialCommunityIcons name="close" size={23} color={palette.white} /></Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{book.title}</Text>
        <Pressable onPress={() => local.toggleBookmark(book.id, page)} hitSlop={10} accessibilityLabel={isBookmarked ? "إزالة العلامة" : "إضافة علامة"}><MaterialCommunityIcons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={isBookmarked ? "#E6D4A9" : palette.white} /></Pressable>
      </View>
      <View style={styles.progressLine}>{totalKnown ? <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((page / total) * 100))}%` }]} /> : null}</View>
      {bookmarks.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookmarks}>
        {bookmarks.map((number) => <Pressable key={number} style={styles.bookmarkChip} onPress={() => setCurrentPage(number)}><Text style={styles.bookmarkText}>صفحة {number.toLocaleString("ar-EG")}</Text></Pressable>)}
      </ScrollView> : null}
      <ScrollView style={styles.reader} contentContainerStyle={styles.readerContent}>
        {book.pdfPath ? (
          <View style={styles.pdfPanel}>
            <MaterialCommunityIcons name="file-pdf-box" size={58} color={palette.green} />
            <Text style={styles.pdfTitle}>نسخة PDF متاحة</Text>
            <Text style={styles.pdfDescription}>يُفتح الملف في عارض النظام برابط موقّع قصير الأجل. أعد فتحه من هنا عند انتهاء صلاحية الرابط.</Text>
            <PrimaryButton title="فتح الكتاب للقراءة" onPress={() => void openPdf(false)} busy={opening} style={{ width: "100%", marginTop: 14 }} />
            {canOfferDownload(book) ? <PrimaryButton title="تنزيل النسخة" onPress={() => void openPdf(true)} variant="outline" style={{ width: "100%", marginTop: 8 }} /> : <Text style={styles.policyNote}>قراءة فقط من الواجهة؛ لا يظهر خيار التنزيل.</Text>}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {opening ? <ActivityIndicator color={palette.green} style={{ marginTop: 10 }} /> : null}
          </View>
        ) : (
          <View style={styles.sampleBanner}><MaterialCommunityIcons name="information-outline" size={18} color={palette.gold} /><Text style={styles.sampleBannerText}>نص تجريبي للعرض فقط — ليس محتوى الكتاب الأصلي.</Text></View>
        )}
        {!book.pdfPath ? <Text style={[styles.sampleText, { fontSize: 16 * local.fontScale }]}>{pages[(page - 1) % pages.length]}</Text> : null}
      </ScrollView>
      {book.pdfPath ? <View style={styles.jumpRow}>
        <Text style={styles.jumpHint}>بعد الرجوع من PDF، حدّث رقم الصفحة:</Text>
        <View style={styles.jumpControls}>
          <TextInput value={pageInput} onChangeText={setPageInput} keyboardType="number-pad" returnKeyType="done" onSubmitEditing={() => setCurrentPage(Number(pageInput))} placeholder="رقم الصفحة" placeholderTextColor={palette.muted} style={styles.pageInput} accessibilityLabel="رقم الصفحة الحالية" />
          <Pressable onPress={() => setCurrentPage(Number(pageInput))} style={styles.savePageButton}><Text style={styles.savePageText}>حفظ الموضع</Text></Pressable>
        </View>
      </View> : null}
      <View style={styles.controls}>
        <Pressable onPress={() => setCurrentPage(page + 1)} disabled={totalKnown && page >= total} style={[styles.controlButton, totalKnown && page >= total && styles.disabled]}><MaterialCommunityIcons name="chevron-left" size={20} color={palette.green} /><Text style={styles.controlText}>التالي</Text></Pressable>
        <View style={styles.pageCount}><Text style={styles.pageCountText}>صفحة {page.toLocaleString("ar-EG")}{totalKnown ? ` من ${total.toLocaleString("ar-EG")}` : ""}</Text><Text style={styles.savedText}>موضع مستقل لهذا الكتاب على الجهاز</Text></View>
        <Pressable onPress={() => setCurrentPage(page - 1)} disabled={page <= 1} style={[styles.controlButton, page <= 1 && styles.disabled]}><Text style={styles.controlText}>السابق</Text><MaterialCommunityIcons name="chevron-right" size={20} color={palette.green} /></Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 54, paddingHorizontal: 15, flexDirection: "row-reverse", alignItems: "center", gap: 12, backgroundColor: palette.greenDark },
  topTitle: { flex: 1, color: palette.white, textAlign: "right", fontSize: 14, fontWeight: "800" },
  progressLine: { height: 3, backgroundColor: "#D9DDCF", alignItems: "flex-end" },
  progressFill: { height: 3, backgroundColor: palette.gold },
  jumpRow: { paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
  jumpHint: { color: palette.muted, fontSize: 10, textAlign: "right", marginBottom: 6 },
  jumpControls: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  pageInput: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 10, color: palette.ink, textAlign: "center", backgroundColor: palette.white },
  savePageButton: { minHeight: 38, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: palette.green },
  savePageText: { color: palette.white, fontSize: 11, fontWeight: "800" },
  bookmarks: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 12, paddingVertical: 9 },
  bookmarkChip: { backgroundColor: palette.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  bookmarkText: { color: palette.greenDark, fontWeight: "700", fontSize: 11 },
  reader: { flex: 1 },
  readerContent: { padding: 17, flexGrow: 1 },
  pdfPanel: { flex: 1, minHeight: 330, alignItems: "center", justifyContent: "center", padding: 23, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  pdfTitle: { color: palette.ink, fontSize: 19, fontWeight: "900", marginTop: 10 },
  pdfDescription: { color: palette.muted, fontSize: 13, lineHeight: 22, textAlign: "center", marginTop: 8 },
  policyNote: { color: palette.muted, fontSize: 11, textAlign: "center", marginTop: 12 },
  error: { color: palette.danger, fontSize: 12, textAlign: "center", marginTop: 12 },
  sampleBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 7, padding: 12, backgroundColor: palette.goldSoft, borderRadius: 13, marginBottom: 13 },
  sampleBannerText: { flex: 1, color: palette.greenDark, fontSize: 12, fontWeight: "800", textAlign: "right" },
  sampleText: { color: palette.ink, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 18, padding: 23, textAlign: "right", lineHeight: 35, writingDirection: "rtl" },
  controls: { minHeight: 66, flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
  controlButton: { flexDirection: "row-reverse", alignItems: "center", gap: 4, padding: 8 },
  disabled: { opacity: 0.45 },
  controlText: { color: palette.green, fontSize: 12, fontWeight: "800" },
  pageCount: { alignItems: "center" },
  pageCountText: { color: palette.ink, fontSize: 11, fontWeight: "800" },
  savedText: { color: palette.muted, fontSize: 9, marginTop: 3 },
});
