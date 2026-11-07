import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Linking from "expo-linking";
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

function buildPdfHtml(pdfUrl: string, initialPage: number): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, minimum-scale=1.0, user-scalable=yes" />
  <title>قارئ الكتاب</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body { width: 100%; min-height: 100%; background: #1a221d; color: #fbfbf9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-x: hidden; }
    #wrapper { display: flex; flex-direction: column; align-items: center; width: 100%; min-height: 100vh; padding-bottom: 24px; }
    #canvas-container { margin-top: 12px; width: 100%; display: flex; justify-content: center; align-items: center; padding: 0 6px; }
    canvas { max-width: 100%; height: auto !important; box-shadow: 0 6px 20px rgba(0,0,0,0.6); border-radius: 6px; background: #ffffff; }
    #loader { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 80px; color: #C5A059; font-size: 14px; font-weight: 700; gap: 14px; }
    .spinner { width: 38px; height: 38px; border: 3px solid rgba(197, 160, 89, 0.25); border-top-color: #C5A059; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-box { display: none; margin: 40px 16px; padding: 18px; background: rgba(192, 57, 43, 0.2); border: 1px solid #c0392b; border-radius: 12px; color: #ff8577; text-align: center; font-size: 13px; line-height: 22px; }
  </style>
</head>
<body>
  <div id="wrapper">
    <div id="loader">
      <div class="spinner"></div>
      <div>جارٍ تحميل صفحات الكتاب...</div>
    </div>
    <div id="error-box"></div>
    <div id="canvas-container">
      <canvas id="pdf-render-canvas"></canvas>
    </div>
  </div>

  <script>
    const pdfUrl = ${JSON.stringify(pdfUrl)};
    let currentPage = ${initialPage};
    let pdfDoc = null;
    let pageRendering = false;
    let pageNumPending = null;
    let scale = 1.6;
    const canvas = document.getElementById('pdf-render-canvas');
    const ctx = canvas.getContext('2d');

    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    function notifyRN(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    function renderPage(num) {
      if (!pdfDoc) return;
      pageRendering = true;

      pdfDoc.getPage(num).then(function(page) {
        const dpr = window.devicePixelRatio || 1.5;
        const viewport = page.getViewport({ scale: scale });
        
        canvas.height = viewport.height * dpr;
        canvas.width = viewport.width * dpr;
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        const renderTask = page.render(renderContext);

        renderTask.promise.then(function() {
          pageRendering = false;
          if (pageNumPending !== null) {
            renderPage(pageNumPending);
            pageNumPending = null;
          }
        });
      }).catch(function(err) {
        pageRendering = false;
        console.error('Page render error:', err);
      });

      notifyRN({ type: 'pageChange', page: num });
    }

    function queueRenderPage(num) {
      if (pageRendering) {
        pageNumPending = num;
      } else {
        renderPage(num);
      }
    }

    window.goToPage = function(target) {
      const p = parseInt(target, 10);
      if (!isNaN(p) && pdfDoc && p >= 1 && p <= pdfDoc.numPages) {
        currentPage = p;
        queueRenderPage(currentPage);
      }
    };

    window.changeScale = function(delta) {
      scale = Math.min(Math.max(scale + delta, 0.8), 3.5);
      if (pdfDoc) queueRenderPage(currentPage);
    };

    function startLoad() {
      if (!window.pdfjsLib) {
        setTimeout(startLoad, 200);
        return;
      }
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
        notifyRN({ type: 'totalLoaded', total: pdf.numPages });
        if (currentPage > pdf.numPages) currentPage = 1;
        renderPage(currentPage);
      }).catch(function(err) {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
        const box = document.getElementById('error-box');
        if (box) {
          box.style.display = 'block';
          box.innerHTML = '<div>تعذر عرض ملف الكتاب مباشرة.</div>' +
            '<div style="font-size:11px; margin-top:6px; opacity:0.8;">' + (err.message || '') + '</div>';
        }
        notifyRN({ type: 'error', message: err.message || 'load_error' });
      });
    }

    startLoad();
  </script>
</body>
</html>`;
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, isLoading } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);
  const bookTitle = book?.title ?? "";
  const bookId = book?.id;
  const webViewRef = useRef<WebView>(null);

  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [detectedTotal, setDetectedTotal] = useState<number | null>(null);

  const [readingPosition, setReadingPosition] = useState<{ bookId: string; page: number } | null>(null);
  const [pageInput, setPageInput] = useState("");
  const pages = useMemo(() => samplePages(bookTitle), [bookTitle]);

  const total = detectedTotal ?? (book?.pdfPath ? Math.max(book.pages, 1) : Math.max(pages.length, 1));
  const totalKnown = !book?.pdfPath || total > 0;
  const maxPage = totalKnown ? total : Number.MAX_SAFE_INTEGER;
  const savedPage = Math.min(maxPage, Math.max(1, local.progress[id] ?? 1));
  const page = readingPosition?.bookId === id ? readingPosition.page : savedPage;
  const bookmarks = local.bookmarks[id] ?? [];

  useEffect(() => {
    setPageInput(String(page));
  }, [id, page]);

  // Fetch signed URL automatically when screen loads
  useEffect(() => {
    if (!book?.pdfPath) {
      setLoadingPdf(false);
      return;
    }
    let active = true;
    setLoadingPdf(true);
    setPdfError(null);

    supabase.storage
      .from("library")
      .createSignedUrl(book.pdfPath, 7200)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setPdfError(error.message);
        } else if (data?.signedUrl) {
          setSignedPdfUrl(data.signedUrl);
        } else {
          setPdfError("لم يصدر رابط قراءة صالح.");
        }
        setLoadingPdf(false);
      })
      .catch((err) => {
        if (!active) return;
        setPdfError(err instanceof Error ? err.message : "تعذر الاتصال بملف الكتاب.");
        setLoadingPdf(false);
      });

    return () => {
      active = false;
    };
  }, [book?.pdfPath]);

  const setCurrentPage = (requestedPage: number, notifyWebView = true) => {
    if (!bookId || !Number.isFinite(requestedPage)) return;
    const nextPage = Math.min(maxPage, Math.max(1, Math.floor(requestedPage)));
    setReadingPosition({ bookId, page: nextPage });
    setPageInput(String(nextPage));
    local.saveProgress(bookId, nextPage);

    if (notifyWebView && book?.pdfPath && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.goToPage && window.goToPage(${nextPage}); true;`);
    }
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pageChange" && typeof data.page === "number") {
        setCurrentPage(data.page, false);
      } else if (data.type === "totalLoaded" && typeof data.total === "number") {
        setDetectedTotal(data.total);
      } else if (data.type === "error") {
        // Logged or handled gracefully
      }
    } catch {
      // Ignore non-json messages
    }
  };

  const openInExternalViewer = async () => {
    if (!signedPdfUrl) return;
    try {
      await Linking.openURL(signedPdfUrl);
    } catch {
      await WebBrowser.openBrowserAsync(signedPdfUrl);
    }
  };

  const downloadPdf = async () => {
    if (!book?.pdfPath) return;
    if (!canOfferDownload(book)) {
      Alert.alert("التنزيل غير متاح", "يسمح إعداد هذا الكتاب بالقراءة فقط من الواجهة.");
      return;
    }
    try {
      const { data, error } = await supabase.storage.from("library").createSignedUrl(
        book.pdfPath,
        600,
        { download: `${book.title}.pdf` }
      );
      if (error) throw error;
      if (data?.signedUrl) {
        await Linking.openURL(data.signedUrl);
      }
    } catch (cause) {
      Alert.alert("خطأ في التنزيل", cause instanceof Error ? cause.message : "تعذر بدء التنزيل.");
    }
  };

  const adjustZoom = (delta: number) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.changeScale && window.changeScale(${delta}); true;`);
    }
  };

  if (!book) {
    return (
      <AppScreen>
        {isLoading ? (
          <FeedbackPanel title="جارٍ تحميل الكتاب" loading />
        ) : (
          <FeedbackPanel title="لم يُعثر على الكتاب" action="العودة" onAction={() => router.back()} />
        )}
      </AppScreen>
    );
  }

  const isBookmarked = bookmarks.includes(page);
  const pdfHtml = useMemo(() => {
    if (!signedPdfUrl) return "";
    return buildPdfHtml(signedPdfUrl, page);
  }, [signedPdfUrl]);

  return (
    <AppScreen edges={["top", "left", "right", "bottom"]}>
      {/* Top Bar */}
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="العودة">
          <MaterialCommunityIcons name="close" size={24} color={palette.white} />
        </Pressable>

        <Text style={styles.topTitle} numberOfLines={1}>
          {book.title}
        </Text>

        <View style={styles.topActions}>
          {book.pdfPath && signedPdfUrl ? (
            <>
              <Pressable onPress={() => adjustZoom(0.25)} hitSlop={6} accessibilityLabel="تكبير">
                <MaterialCommunityIcons name="magnify-plus-outline" size={21} color={palette.white} />
              </Pressable>
              <Pressable onPress={() => adjustZoom(-0.25)} hitSlop={6} accessibilityLabel="تصغير">
                <MaterialCommunityIcons name="magnify-minus-outline" size={21} color={palette.white} />
              </Pressable>
              <Pressable onPress={() => void openInExternalViewer()} hitSlop={6} accessibilityLabel="فتح في عارض خارجي">
                <MaterialCommunityIcons name="open-in-new" size={20} color={palette.white} />
              </Pressable>
            </>
          ) : null}

          {canOfferDownload(book) ? (
            <Pressable onPress={() => void downloadPdf()} hitSlop={6} accessibilityLabel="تنزيل الكتاب">
              <MaterialCommunityIcons name="download" size={21} color={palette.white} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => local.toggleBookmark(book.id, page)}
            hitSlop={8}
            accessibilityLabel={isBookmarked ? "إزالة العلامة" : "إضافة علامة"}
          >
            <MaterialCommunityIcons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={23}
              color={isBookmarked ? "#E6D4A9" : palette.white}
            />
          </Pressable>
        </View>
      </View>

      {/* Progress Line */}
      <View style={styles.progressLine}>
        {totalKnown ? (
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.round((page / total) * 100))}%` },
            ]}
          />
        ) : null}
      </View>

      {/* Bookmarks Bar */}
      {bookmarks.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookmarks}>
          {bookmarks.map((number) => (
            <Pressable key={number} style={styles.bookmarkChip} onPress={() => setCurrentPage(number)}>
              <Text style={styles.bookmarkText}>صفحة {number.toLocaleString("ar-EG")}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Main Reader View */}
      {book.pdfPath ? (
        <View style={styles.readerContainer}>
          {loadingPdf ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={palette.green} />
              <Text style={styles.centerText}>جارٍ تجهيز ملف الكتاب للقراءة داخل التطبيق...</Text>
            </View>
          ) : pdfError ? (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={palette.danger} />
              <Text style={styles.errorTitle}>تعذر تحميل ملف الكتاب</Text>
              <Text style={styles.errorText}>{pdfError}</Text>
              <PrimaryButton
                title="فتح في عارض خارجي"
                onPress={() => void openInExternalViewer()}
                style={{ marginTop: 14 }}
              />
            </View>
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: pdfHtml }}
              onMessage={handleWebViewMessage}
              style={styles.webView}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              mixedContentMode="always"
              startInLoadingState
              renderLoading={() => (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color={palette.green} />
                  <Text style={styles.centerText}>جارٍ عرض صفحات الكتاب...</Text>
                </View>
              )}
            />
          )}
        </View>
      ) : (
        <ScrollView style={styles.reader} contentContainerStyle={styles.readerContent}>
          <View style={styles.sampleBanner}>
            <MaterialCommunityIcons name="information-outline" size={18} color={palette.gold} />
            <Text style={styles.sampleBannerText}>نص تجريبي للعرض فقط — ليس محتوى الكتاب الأصلي.</Text>
          </View>
          <Text style={[styles.sampleText, { fontSize: 16 * local.fontScale }]}>
            {pages[(page - 1) % pages.length]}
          </Text>
        </ScrollView>
      )}

      {/* Page Jump Row */}
      <View style={styles.jumpRow}>
        <Text style={styles.jumpHint}>الانتقال السريع لرقم صفحة:</Text>
        <View style={styles.jumpControls}>
          <TextInput
            value={pageInput}
            onChangeText={setPageInput}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={() => setCurrentPage(Number(pageInput))}
            placeholder="رقم الصفحة"
            placeholderTextColor={palette.muted}
            style={styles.pageInput}
            accessibilityLabel="رقم الصفحة الحالية"
          />
          <Pressable onPress={() => setCurrentPage(Number(pageInput))} style={styles.savePageButton}>
            <Text style={styles.savePageText}>انتقال وحفظ</Text>
          </Pressable>
        </View>
      </View>

      {/* Navigation Controls */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => setCurrentPage(page + 1)}
          disabled={totalKnown && page >= total}
          style={[styles.controlButton, totalKnown && page >= total && styles.disabled]}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={palette.green} />
          <Text style={styles.controlText}>التالي</Text>
        </Pressable>

        <View style={styles.pageCount}>
          <Text style={styles.pageCountText}>
            صفحة {page.toLocaleString("ar-EG")}
            {totalKnown ? ` من ${total.toLocaleString("ar-EG")}` : ""}
          </Text>
          <Text style={styles.savedText}>موضع محفوظ تلقائياً على هذا الجهاز</Text>
        </View>

        <Pressable
          onPress={() => setCurrentPage(page - 1)}
          disabled={page <= 1}
          style={[styles.controlButton, page <= 1 && styles.disabled]}
        >
          <Text style={styles.controlText}>السابق</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={palette.green} />
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topbar: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.greenDark,
  },
  topTitle: {
    flex: 1,
    color: palette.white,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
  },
  topActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  progressLine: { height: 3, backgroundColor: "#D9DDCF", alignItems: "flex-end" },
  progressFill: { height: 3, backgroundColor: palette.gold },
  bookmarks: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  bookmarkChip: { backgroundColor: palette.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  bookmarkText: { color: palette.greenDark, fontWeight: "700", fontSize: 11 },
  readerContainer: { flex: 1, backgroundColor: "#1a221d" },
  webView: { flex: 1, backgroundColor: "#1a221d" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: palette.white, fontSize: 13, fontWeight: "700", marginTop: 14, textAlign: "center" },
  errorTitle: { color: palette.danger, fontSize: 16, fontWeight: "800", marginTop: 12 },
  errorText: { color: palette.muted, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 20 },
  reader: { flex: 1 },
  readerContent: { padding: 17, flexGrow: 1 },
  sampleBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
    padding: 12,
    backgroundColor: palette.goldSoft,
    borderRadius: 13,
    marginBottom: 13,
  },
  sampleBannerText: { flex: 1, color: palette.greenDark, fontSize: 12, fontWeight: "800", textAlign: "right" },
  sampleText: {
    color: palette.ink,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 23,
    textAlign: "right",
    lineHeight: 35,
    writingDirection: "rtl",
  },
  jumpRow: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  jumpHint: { color: palette.muted, fontSize: 11, textAlign: "right", marginBottom: 5, fontWeight: "600" },
  jumpControls: { flexDirection: "row-reverse", gap: 8, alignItems: "center" },
  pageInput: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    color: palette.ink,
    textAlign: "center",
    backgroundColor: palette.white,
    fontWeight: "700",
  },
  savePageButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.green,
  },
  savePageText: { color: palette.white, fontSize: 11, fontWeight: "800" },
  controls: {
    minHeight: 62,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
  },
  controlButton: { flexDirection: "row-reverse", alignItems: "center", gap: 4, padding: 8 },
  disabled: { opacity: 0.4 },
  controlText: { color: palette.green, fontSize: 12, fontWeight: "800" },
  pageCount: { alignItems: "center" },
  pageCountText: { color: palette.ink, fontSize: 11, fontWeight: "800" },
  savedText: { color: palette.muted, fontSize: 9, marginTop: 2 },
});
