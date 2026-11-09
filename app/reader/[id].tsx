import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { deleteLocalBookCache, ensureValidLocalPdf, useLocalLibrary } from "../../lib/local-library";
import { canOfferDownload } from "../../lib/library-utils";
import { extractStoragePath } from "../../lib/book-upload";
import {
  isSpeaking,
  speakArabicText,
  startArabicVoiceRecognition,
  stopArabicSpeech,
} from "../../lib/speech-service";
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
    html, body {
      width: 100%;
      min-height: 100%;
      background: #151c17;
      color: #fbfbf9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
      overflow-x: hidden;
    }
    #wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      min-height: 100vh;
      padding: 10px 4px 28px;
    }
    #canvas-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      touch-action: pan-y pinch-zoom;
    }
    canvas {
      display: block;
      box-shadow: 0 4px 22px rgba(0,0,0,0.65);
      border-radius: 4px;
      background: #ffffff;
    }
    #loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 80px;
      color: #C5A059;
      font-size: 14px;
      font-weight: 700;
      gap: 14px;
    }
    .spinner {
      width: 38px;
      height: 38px;
      border: 3px solid rgba(197, 160, 89, 0.25);
      border-top-color: #C5A059;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #error-box {
      display: none;
      margin: 40px 16px;
      padding: 20px;
      background: rgba(192, 57, 43, 0.22);
      border: 1px solid #c0392b;
      border-radius: 12px;
      color: #ff9d91;
      text-align: center;
      font-size: 13px;
      line-height: 22px;
    }
  </style>
</head>
<body>
  <div id="wrapper">
    <div id="loader">
      <div class="spinner"></div>
      <div>جارٍ تحميل صفحات الكتاب وتنسيق الخطوط...</div>
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
    let userZoom = 1.0;
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
        const dpr = Math.min(window.devicePixelRatio || 2, 3);
        const containerWidth = Math.max(window.innerWidth - 12, 320);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const fitScale = (containerWidth / unscaledViewport.width) * userZoom;
        const viewport = page.getViewport({ scale: fitScale });
        
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        // Extract text for TTS reading
        page.getTextContent().then(function(tc) {
          if (tc && tc.items) {
            const strings = tc.items.map(function(it) { return it.str; }).filter(Boolean);
            const text = strings.join(' ').replace(/\\s+/g, ' ').trim();
            notifyRN({ type: 'pageText', page: num, text: text });
          }
        }).catch(function(e) {
          // ignore text extraction errors
        });

        return page.render(renderContext).promise;
      }).then(function() {
        pageRendering = false;
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
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
      userZoom = Math.min(Math.max(userZoom + delta, 0.75), 3.0);
      if (pdfDoc) queueRenderPage(currentPage);
    };

    window.searchInPdf = function(query) {
      if (!pdfDoc || !query) {
        notifyRN({ type: 'searchResults', query: query || '', matches: [] });
        return;
      }
      const q = String(query).trim().toLowerCase();
      if (!q) {
        notifyRN({ type: 'searchResults', query: '', matches: [] });
        return;
      }
      const matches = [];
      let checked = 0;
      const total = pdfDoc.numPages;
      for (let i = 1; i <= total; i++) {
        (function(pageNum) {
          pdfDoc.getPage(pageNum).then(function(p) {
            return p.getTextContent();
          }).then(function(tc) {
            const fullText = tc.items.map(function(it) { return it.str; }).join(' ');
            const lower = fullText.toLowerCase();
            let pos = lower.indexOf(q);
            if (pos !== -1) {
              const start = Math.max(0, pos - 35);
              const end = Math.min(fullText.length, pos + q.length + 35);
              const snippet = (start > 0 ? '...' : '') + fullText.substring(start, end).trim() + (end < fullText.length ? '...' : '');
              matches.push({ page: pageNum, snippet: snippet });
            }
            checked++;
            if (checked === total) {
              matches.sort(function(a, b) { return a.page - b.page; });
              notifyRN({ type: 'searchResults', query: query, matches: matches.slice(0, 40) });
            }
          }).catch(function() {
            checked++;
            if (checked === total) {
              notifyRN({ type: 'searchResults', query: query, matches: matches });
            }
          });
        })(i);
      }
    };

    function startLoad() {
      if (!window.pdfjsLib) {
        setTimeout(startLoad, 200);
        return;
      }
      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        disableFontFace: true,
        enableXfa: false
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
          const isZeroByte = err && (String(err.message).includes('0') || String(err.message).includes('empty') || String(err.message).includes('signature') || String(err.message).includes('Missing PDF'));
          box.innerHTML = '<div style="font-weight:800; font-size:15px; margin-bottom:6px;">تعذر عرض صفحات الكتاب</div>' +
            '<div style="font-size:12px; line-height:20px; opacity:0.9;">' +
            (isZeroByte
              ? 'يبدو أن ملف الـ PDF المرفوع فارغ (0 بايت) أو غير مكتمل على السحابة. يرجى إعادة رفع ملف الكتاب الصالح من لوحة الإدارة.'
              : (err.message || 'تعذر تحميل ملف PDF.')) +
            '</div>';
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
  const { id, autoplay } = useLocalSearchParams<{ id: string; autoplay?: string }>();
  const router = useRouter();
  const { books, isLoading, canManageBooks } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);
  const bookTitle = book?.title ?? "";
  const bookId = book?.id;
  const webViewRef = useRef<WebView>(null);

  const [pdfDisplayUrl, setPdfDisplayUrl] = useState<string | null>(null);
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

  // Speech TTS state
  const [isSpeakingActive, setIsSpeakingActive] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(0.9);
  const [pageTextMap, setPageTextMap] = useState<Record<number, string>>({});

  // In-book Text & Voice Search state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ page: number; snippet: string }[]>([]);
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [voiceSearchStatus, setVoiceSearchStatus] = useState<string | null>(null);

  useEffect(() => {
    setPageInput(String(page));
  }, [id, page]);

  const loadPdfSource = useCallback(async () => {
    const rawPath = book?.pdfPath?.trim();
    if (!rawPath || !book?.id) {
      setLoadingPdf(false);
      return;
    }

    setLoadingPdf(true);
    setPdfError(null);

    let cloudUrl = rawPath;
    if (!/^https?:\/\//i.test(rawPath)) {
      const storageKey = extractStoragePath(rawPath) ?? rawPath;
      const { data } = supabase.storage.from("library").getPublicUrl(storageKey);
      cloudUrl = (data?.publicUrl ?? "").trim();
    }

    if (!cloudUrl) {
      setPdfError("رابط ملف الكتاب غير متاح.");
      setLoadingPdf(false);
      return;
    }

    try {
      const result = await ensureValidLocalPdf(book.id, cloudUrl);
      setPdfDisplayUrl(result.uri || cloudUrl);
    } catch {
      setPdfDisplayUrl(cloudUrl);
    } finally {
      setLoadingPdf(false);
    }
  }, [book?.id, book?.pdfPath]);

  useEffect(() => {
    void loadPdfSource();
  }, [loadPdfSource]);

  const setCurrentPage = (requestedPage: number, notifyWebView = true) => {
    if (!bookId || !Number.isFinite(requestedPage)) return;
    const nextPage = Math.min(maxPage, Math.max(1, Math.floor(requestedPage)));
    setReadingPosition({ bookId, page: nextPage });
    setPageInput(String(nextPage));
    local.saveProgress(bookId, nextPage);

    if (notifyWebView && book?.pdfPath && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.goToPage && window.goToPage(${nextPage}); true;`);
    }

    // If speech was active, continue reading new page
    if (isSpeakingActive) {
      void speakCurrentPage(nextPage);
    }
  };

  const speakCurrentPage = useCallback(
    async (targetPageNum?: number) => {
      const targetPage = targetPageNum ?? page;
      const extracted = pageTextMap[targetPage];
      let textToRead = "";

      if (extracted && extracted.trim().length > 10) {
        textToRead = extracted;
      } else if (!book?.pdfPath) {
        textToRead = pages[(targetPage - 1) % pages.length];
      } else {
        textToRead = `${bookTitle}. ${book?.author ? `لـ ${book.author}.` : ""} ${book?.description || ""}. صفحة رقم ${targetPage}.`;
      }

      setIsSpeakingActive(true);
      await speakArabicText(textToRead, {
        rate: speechRate,
        onStart: () => setIsSpeakingActive(true),
        onDone: () => setIsSpeakingActive(false),
        onError: () => setIsSpeakingActive(false),
      });
    },
    [page, pageTextMap, book?.pdfPath, book?.author, book?.description, bookTitle, pages, speechRate],
  );

  const stopReading = async () => {
    setIsSpeakingActive(false);
    await stopArabicSpeech();
  };

  const toggleSpeech = async () => {
    if (isSpeakingActive) {
      await stopReading();
    } else {
      await speakCurrentPage();
    }
  };

  // Autoplay on mount when ?autoplay=true is supplied
  useEffect(() => {
    if (autoplay === "true" && book) {
      const timer = setTimeout(() => {
        void speakCurrentPage();
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [autoplay, book, speakCurrentPage]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      void stopArabicSpeech();
    };
  }, []);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pageChange" && typeof data.page === "number") {
        setCurrentPage(data.page, false);
      } else if (data.type === "totalLoaded" && typeof data.total === "number") {
        setDetectedTotal(data.total);
      } else if (data.type === "pageText" && typeof data.page === "number" && typeof data.text === "string") {
        setPageTextMap((prev) => ({ ...prev, [data.page]: data.text }));
      } else if (data.type === "searchResults") {
        setSearchResults(Array.isArray(data.matches) ? data.matches : []);
        setSearchLoading(false);
      } else if (data.type === "error") {
        const msg = String(data.message || "");
        if (msg.includes("0") || msg.includes("empty") || msg.includes("signature")) {
          setPdfError("ملف الكتاب تالف أو فارغ (حجمه صفر بايت). يرجى إعادة رفع نسخة صالحة من لوحة الإدارة.");
        }
      }
    } catch {
      // Ignore non-json messages
    }
  };

  // Execute in-book search
  const executeInBookSearch = useCallback(
    (queryToSearch: string) => {
      const q = queryToSearch.trim();
      if (!q) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);

      if (book?.pdfPath && webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.searchInPdf && window.searchInPdf(${JSON.stringify(q)}); true;`);
      } else {
        const matches: { page: number; snippet: string }[] = [];
        pages.forEach((pText, idx) => {
          const pageNum = idx + 1;
          const lower = pText.toLowerCase();
          const pos = lower.indexOf(q.toLowerCase());
          if (pos !== -1) {
            const start = Math.max(0, pos - 35);
            const end = Math.min(pText.length, pos + q.length + 35);
            const snippet =
              (start > 0 ? "..." : "") +
              pText.substring(start, end).trim() +
              (end < pText.length ? "..." : "");
            matches.push({ page: pageNum, snippet });
          }
        });
        setSearchResults(matches);
        setSearchLoading(false);
      }
    },
    [book?.pdfPath, pages],
  );

  // In-book voice search recognition
  const toggleInBookVoiceSearch = () => {
    if (isVoiceSearching) {
      setIsVoiceSearching(false);
      setVoiceSearchStatus(null);
      return;
    }

    setVoiceSearchStatus("جارٍ الاستماع... انطق كلمة للبحث داخل الكتاب");
    setIsVoiceSearching(true);

    const session = startArabicVoiceRecognition({
      onStart: () => setIsVoiceSearching(true),
      onResult: (transcript) => {
        setIsVoiceSearching(false);
        const clean = transcript.trim();
        setSearchQuery(clean);
        setVoiceSearchStatus(`تم البحث عن: «${clean}»`);
        executeInBookSearch(clean);
      },
      onError: (err) => {
        setIsVoiceSearching(false);
        setVoiceSearchStatus(`تعذر الاستماع: ${err}`);
      },
      onEnd: () => setIsVoiceSearching(false),
    });

    if (!session) {
      setIsVoiceSearching(false);
      setVoiceSearchStatus("يمكنك استخدام الميكروفون في لوحة المفاتيح لإملاء كلمات البحث.");
    }
  };

  const retryAndClearCache = async () => {
    if (!book?.id) return;
    setLoadingPdf(true);
    setPdfError(null);
    await deleteLocalBookCache(book.id);
    await loadPdfSource();
  };

  const openInExternalViewer = async () => {
    if (!pdfDisplayUrl) return;
    try {
      await Linking.openURL(pdfDisplayUrl);
    } catch {
      await WebBrowser.openBrowserAsync(pdfDisplayUrl);
    }
  };

  const downloadPdf = async () => {
    if (!book?.pdfPath) return;
    if (!canOfferDownload(book)) {
      Alert.alert("التنزيل غير متاح", "يسمح إعداد هذا الكتاب بالقراءة فقط من الواجهة.");
      return;
    }
    try {
      const storageKey = extractStoragePath(book.pdfPath) ?? book.pdfPath;
      const { data, error } = await supabase.storage.from("library").createSignedUrl(
        storageKey,
        600,
        { download: `${book.title}.pdf` },
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

  const pdfHtml = useMemo(() => {
    if (!pdfDisplayUrl) return "";
    return buildPdfHtml(pdfDisplayUrl, page);
  }, [pdfDisplayUrl, page]);

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
          {/* In-book Search & Voice Button */}
          <Pressable
            onPress={() => setSearchModalOpen((prev) => !prev)}
            hitSlop={6}
            accessibilityLabel="بحث صوتي داخل الكتاب"
            style={[styles.topIconBtn, searchModalOpen && styles.topIconBtnActive]}
          >
            <MaterialCommunityIcons name="magnify" size={21} color={searchModalOpen ? palette.gold : palette.white} />
          </Pressable>

          {/* Audio TTS Button */}
          <Pressable
            onPress={() => void toggleSpeech()}
            hitSlop={6}
            accessibilityLabel={isSpeakingActive ? "إيقاف القراءة الصوتية" : "قراءة صوتية للصفحة"}
            style={[styles.topIconBtn, isSpeakingActive && styles.topIconBtnActive]}
          >
            <MaterialCommunityIcons
              name={isSpeakingActive ? "volume-high" : "headphones"}
              size={21}
              color={isSpeakingActive ? palette.gold : palette.white}
            />
          </Pressable>

          {book.pdfPath && pdfDisplayUrl ? (
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

      {/* TTS Audio Player Control Bar */}
      <View style={styles.audioBar}>
        <Pressable onPress={() => void toggleSpeech()} style={styles.audioPlayBtn}>
          <MaterialCommunityIcons
            name={isSpeakingActive ? "stop-circle" : "play-circle"}
            size={24}
            color={isSpeakingActive ? palette.gold : palette.greenDark}
          />
          <Text style={[styles.audioPlayText, isSpeakingActive && styles.audioPlayTextActive]}>
            {isSpeakingActive ? `جارٍ القراءة الصوتية (ص ${page.toLocaleString("ar-EG")})` : "استمع للصفحة الحالية"}
          </Text>
        </Pressable>

        <View style={styles.audioSpeedRow}>
          <Pressable
            onPress={() => setSpeechRate((r) => (r === 0.8 ? 1.0 : r === 1.0 ? 1.2 : 0.8))}
            style={styles.speedChip}
          >
            <Text style={styles.speedText}>{speechRate}x</Text>
          </Pressable>
        </View>
      </View>

      {/* In-Book Search & Voice Overlay Drawer */}
      {searchModalOpen ? (
        <View style={styles.searchDrawer}>
          <View style={styles.searchDrawerHeader}>
            <Text style={styles.searchDrawerTitle}>البحث النصي والصوتي داخل الكتاب</Text>
            <Pressable onPress={() => setSearchModalOpen(false)} hitSlop={6}>
              <MaterialCommunityIcons name="close" size={20} color={palette.ink} />
            </Pressable>
          </View>

          <View style={styles.searchDrawerInputBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={palette.green} />
            <TextInput
              value={searchQuery}
              onChangeText={(t) => {
                setSearchQuery(t);
                executeInBookSearch(t);
              }}
              onSubmitEditing={() => executeInBookSearch(searchQuery)}
              placeholder="اكتب كلمة أو انطقها للبحث..."
              placeholderTextColor="#879187"
              style={styles.searchDrawerInput}
              textAlign="right"
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => { setSearchQuery(""); setSearchResults([]); }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={palette.muted} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={toggleInBookVoiceSearch}
              style={[styles.drawerVoiceBtn, isVoiceSearching && styles.drawerVoiceBtnActive]}
            >
              <MaterialCommunityIcons
                name={isVoiceSearching ? "microphone" : "microphone-outline"}
                size={19}
                color={isVoiceSearching ? palette.white : palette.greenDark}
              />
            </Pressable>
          </View>

          {voiceSearchStatus ? (
            <Text style={styles.voiceSearchStatusText}>{voiceSearchStatus}</Text>
          ) : null}

          {searchLoading ? (
            <View style={styles.searchDrawerLoading}>
              <ActivityIndicator size="small" color={palette.green} />
              <Text style={styles.searchDrawerLoadingText}>جارٍ مسح صفحات الكتاب عن الكلمة...</Text>
            </View>
          ) : searchResults.length > 0 ? (
            <ScrollView style={styles.searchResultsList} contentContainerStyle={{ gap: 8 }}>
              <Text style={styles.searchResultsCount}>
                عثرنا على {searchResults.length.toLocaleString("ar-EG")} موضع:
              </Text>
              {searchResults.map((res, i) => (
                <View key={`${res.page}-${i}`} style={styles.searchResultItem}>
                  <View style={styles.searchResultHeader}>
                    <Pressable
                      onPress={() => {
                        setCurrentPage(res.page);
                        setSearchModalOpen(false);
                      }}
                      style={styles.pageJumpBadge}
                    >
                      <Text style={styles.pageJumpBadgeText}>انتقال لص {res.page.toLocaleString("ar-EG")}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void speakArabicText(`في صفحة ${res.page}. ${res.snippet}`)}
                      style={styles.speakSnippetBtn}
                    >
                      <MaterialCommunityIcons name="volume-high" size={16} color={palette.green} />
                      <Text style={styles.speakSnippetText}>استماع للنتيجة</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.searchResultSnippet}>{res.snippet}</Text>
                </View>
              ))}
            </ScrollView>
          ) : searchQuery.trim() && !searchLoading ? (
            <Text style={styles.searchDrawerEmpty}>لم يُعثر على تطابق لكلمة «{searchQuery}» في هذا الكتاب.</Text>
          ) : null}
        </View>
      ) : null}

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
              <View style={styles.errorActions}>
                <PrimaryButton
                  title="إعادة المحاولة ومسح الكاش"
                  icon="refresh"
                  onPress={() => void retryAndClearCache()}
                  style={{ minWidth: 160 }}
                />
                <PrimaryButton
                  title="فتح في عارض خارجي"
                  icon="open-in-new"
                  variant="outline"
                  onPress={() => void openInExternalViewer()}
                  style={{ minWidth: 140 }}
                />
              </View>
              {canManageBooks ? (
                <PrimaryButton
                  title="تعديل الكتاب ورفع ملف سليم"
                  icon="file-document-edit-outline"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/admin", params: { editBookId: book.id } })}
                  style={{ marginTop: 12, minWidth: 200 }}
                />
              ) : null}
            </View>
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={["*"]}
              source={{ html: pdfHtml, baseUrl: "https://localhost" }}
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
  topIconBtn: {
    padding: 3,
    borderRadius: 6,
  },
  topIconBtnActive: {
    backgroundColor: "rgba(197, 160, 89, 0.25)",
  },
  audioBar: {
    minHeight: 42,
    backgroundColor: "#112217",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(197, 160, 89, 0.3)",
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioPlayBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 7,
  },
  audioPlayText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "700",
  },
  audioPlayTextActive: {
    color: palette.gold,
  },
  audioSpeedRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
  },
  speedChip: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  speedText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: "800",
  },
  searchDrawer: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    padding: 12,
    maxHeight: 320,
  },
  searchDrawerHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  searchDrawerTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  searchDrawerInputBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.white,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  searchDrawerInput: {
    flex: 1,
    paddingVertical: 6,
    color: palette.ink,
    fontSize: 13,
    writingDirection: "rtl",
  },
  drawerVoiceBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerVoiceBtnActive: {
    backgroundColor: palette.greenDark,
  },
  voiceSearchStatusText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    marginTop: 5,
  },
  searchDrawerLoading: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    justifyContent: "center",
  },
  searchDrawerLoadingText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  searchResultsList: {
    marginTop: 8,
    maxHeight: 200,
  },
  searchResultsCount: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    marginBottom: 4,
  },
  searchResultItem: {
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    padding: 9,
    gap: 5,
  },
  searchResultHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageJumpBadge: {
    backgroundColor: palette.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pageJumpBadgeText: {
    color: palette.greenDark,
    fontSize: 11,
    fontWeight: "800",
  },
  speakSnippetBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  speakSnippetText: {
    color: palette.green,
    fontSize: 11,
    fontWeight: "700",
  },
  searchResultSnippet: {
    color: palette.ink,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "right",
  },
  searchDrawerEmpty: {
    color: palette.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
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
  errorActions: { flexDirection: "row-reverse", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" },
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
