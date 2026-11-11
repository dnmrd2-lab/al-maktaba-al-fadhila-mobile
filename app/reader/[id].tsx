import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { FeedbackPanel, PrimaryButton } from "../../components/ui";
import { useApp } from "../../lib/app-context";
import {
  deleteLocalBookCache,
  ensureValidLocalPdf,
  getLocalBookFilePath,
  isBookCachedLocally,
  readLocalBookBase64,
  useLocalLibrary,
} from "../../lib/local-library";
import { canOfferDownload } from "../../lib/library-utils";
import { extractStoragePath } from "../../lib/book-upload";
import {
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

function buildPdfHtml(
  pdfSource: { url: string; base64?: string },
  initialPage: number,
): string {
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
      height: 100%;
      min-height: 100%;
      margin: 0;
      padding: 0;
      background: #121814;
      color: #fbfbf9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif;
      overflow-x: hidden;
      overflow-y: auto;
      user-select: none;
      -webkit-user-select: none;
    }
    #wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 0;
      margin: 0;
    }
    #canvas-container {
      width: 100%;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      justify-content: center;
      align-items: center;
      touch-action: pan-x pan-y pinch-zoom;
      position: relative;
    }
    canvas {
      display: block;
      box-shadow: 0 6px 30px rgba(0,0,0,0.75);
      background: #ffffff;
      max-width: 100%;
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
    const pdfUrl = ${JSON.stringify(pdfSource.url || "")};
    const pdfBase64 = ${JSON.stringify(pdfSource.base64 || "")};
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
        const winW = window.innerWidth || document.documentElement.clientWidth || 360;
        const winH = window.innerHeight || document.documentElement.clientHeight || 640;
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        let baseScale = (winW - 4) / unscaledViewport.width;
        if (winW > winH) {
          // Landscape mode: adapt smoothly to fit height or width comfortably
          const heightFitScale = (winH - 8) / unscaledViewport.height;
          baseScale = Math.min(baseScale, heightFitScale);
        }

        const fitScale = Math.max(baseScale * userZoom, 0.35);
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
      notifyRN({ type: 'zoomChange', zoom: userZoom });
      if (pdfDoc) queueRenderPage(currentPage);
    };

    window.resetScale = function() {
      userZoom = 1.0;
      notifyRN({ type: 'zoomChange', zoom: 1.0 });
      if (pdfDoc) queueRenderPage(currentPage);
    };

    // Auto-rotation and resize listener - keeps currentPage without reloading PDF
    let resizeTimer = null;
    function handleScreenResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (pdfDoc && !pageRendering) {
          renderPage(currentPage);
        }
      }, 120);
    }
    window.addEventListener('resize', handleScreenResize);
    window.addEventListener('orientationchange', handleScreenResize);

    // Touch gesture handling: Single touch for swipe and single-tap for controls toggle
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchCount = 0;

    window.addEventListener('touchstart', function(e) {
      touchCount = e.touches.length;
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
      if (e.touches.length > 1) {
        touchCount = e.touches.length;
      }
    }, { passive: true });

    window.addEventListener('touchend', function(e) {
      if (touchCount !== 1 || !e.changedTouches || e.changedTouches.length === 0) {
        return;
      }

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const deltaX = endX - touchStartX;
      const deltaY = endY - touchStartY;
      const elapsed = Date.now() - touchStartTime;

      // 1. Single Tap in center/screen -> Toggle Immersive Controls
      if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12 && elapsed < 350) {
        notifyRN({ type: 'toggleControls' });
        return;
      }

      // 2. Swipe Gestures for Page Turns
      // ONLY active when userZoom is 1.0 (unscaled) and single touch to avoid interfering with zoom panning
      if (userZoom <= 1.05 && elapsed < 650) {
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        if (absX > 45 && absX > absY * 1.3) {
          // In RTL Arabic books:
          // Swipe right (finger moves right ->) flips to Next page
          // Swipe left (finger moves left <-) flips to Previous page
          if (deltaX > 45) {
            notifyRN({ type: 'nextPage' });
          } else if (deltaX < -45) {
            notifyRN({ type: 'prevPage' });
          }
        }
      }
    }, { passive: true });

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
        setTimeout(startLoad, 100);
        return;
      }

      var docConfig = {
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        disableFontFace: true,
        enableXfa: false
      };

      if (pdfBase64 && pdfBase64.length > 50) {
        try {
          var binary = atob(pdfBase64);
          var len = binary.length;
          var bytes = new Uint8Array(len);
          for (var i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          docConfig.data = bytes;
        } catch (e) {
          docConfig.url = pdfUrl;
        }
      } else {
        docConfig.url = pdfUrl;
      }

      const loadingTask = pdfjsLib.getDocument(docConfig);

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { books, isLoading, canManageBooks } = useApp();
  const local = useLocalLibrary();
  const book = books.find((item) => item.id === id);
  const bookTitle = book?.title ?? "";
  const bookId = book?.id;
  const webViewRef = useRef<WebView>(null);

  const [pdfSource, setPdfSource] = useState<{ url: string; base64?: string } | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isLocalCached, setIsLocalCached] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const pdfDisplayUrl = pdfSource?.url ?? null;
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

  // Immersive Mode (Full-screen overlay & toggle controls)
  const [showControls, setShowControls] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(1.0);

  // Resume Reading Toast
  const [resumeToast, setResumeToast] = useState<{ visible: boolean; page: number }>({
    visible: false,
    page: 1,
  });

  // In-book Text & Voice Search state (STT preserved)
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ page: number; snippet: string }[]>([]);
  const [isVoiceSearching, setIsVoiceSearching] = useState(false);
  const [voiceSearchStatus, setVoiceSearchStatus] = useState<string | null>(null);

  // Ensure speech is completely stopped on mount and unmount
  useEffect(() => {
    void stopArabicSpeech();
    return () => {
      void stopArabicSpeech();
    };
  }, []);

  // Show Resume Toast if book was resumed beyond page 1
  useEffect(() => {
    if (savedPage > 1) {
      setResumeToast({ visible: true, page: savedPage });
      const timer = setTimeout(() => {
        setResumeToast((prev) => ({ ...prev, visible: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [id, savedPage]);

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

    // 1. Fast path: check if book is already downloaded and stored locally
    try {
      const cached = await isBookCachedLocally(book.id);
      if (cached) {
        setIsLocalCached(true);
        setIsDownloading(false);
        setDownloadProgress(null);
        const base64 = await readLocalBookBase64(book.id);
        const localPath = await getLocalBookFilePath(book.id);
        setPdfSource({
          url: localPath || rawPath,
          base64: base64 || undefined,
        });
        setLoadingPdf(false);
        return;
      }
    } catch {
      // Continue to cloud download if local check fails
    }

    // 2. Resolve cloud URL from Supabase storage
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

    // 3. First time opening: Download and cache with progress indicator
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const result = await ensureValidLocalPdf(book.id, cloudUrl, (percent) => {
        setDownloadProgress(percent);
      });
      setIsLocalCached(Boolean(result.isLocal));
      setPdfSource({
        url: result.uri || cloudUrl,
        base64: result.base64,
      });
    } catch {
      setPdfSource({ url: cloudUrl });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
      setLoadingPdf(false);
    }
  }, [book?.id, book?.pdfPath]);

  useEffect(() => {
    void loadPdfSource();
  }, [loadPdfSource]);

  const setCurrentPage = useCallback((requestedPage: number, notifyWebView = true) => {
    if (!bookId || !Number.isFinite(requestedPage)) return;
    const nextPage = Math.min(maxPage, Math.max(1, Math.floor(requestedPage)));
    setReadingPosition({ bookId, page: nextPage });
    setPageInput(String(nextPage));
    local.saveProgress(bookId, nextPage);

    if (notifyWebView && book?.pdfPath && webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.goToPage && window.goToPage(${nextPage}); true;`);
    }
  }, [bookId, maxPage, local, book?.pdfPath]);

  const handleNextPage = useCallback(() => {
    if (!totalKnown || page < total) {
      setCurrentPage(page + 1);
    }
  }, [page, totalKnown, total, setCurrentPage]);

  const handlePrevPage = useCallback(() => {
    if (page > 1) {
      setCurrentPage(page - 1);
    }
  }, [page, setCurrentPage]);

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pageChange" && typeof data.page === "number") {
        setCurrentPage(data.page, false);
      } else if (data.type === "totalLoaded" && typeof data.total === "number") {
        setDetectedTotal(data.total);
      } else if (data.type === "toggleControls") {
        setShowControls((prev) => !prev);
      } else if (data.type === "nextPage") {
        handleNextPage();
      } else if (data.type === "prevPage") {
        handlePrevPage();
      } else if (data.type === "zoomChange" && typeof data.zoom === "number") {
        setCurrentZoom(data.zoom);
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

  // Execute in-book text search
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

  // In-book voice search (Microphone / STT preserved)
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
    setIsLocalCached(false);
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

  const resetZoom = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.resetScale && window.resetScale(); true;`);
    }
  };

  const pdfHtml = useMemo(() => {
    if (!pdfSource) return "";
    return buildPdfHtml(pdfSource, page);
  }, [pdfSource, page]);

  // Touch handlers for non-pdf sample text
  const sampleTouchRef = useRef<{ startX: number; startY: number; time: number } | null>(null);

  const handleSampleTouchStart = (e: any) => {
    const touch = e.nativeEvent.touches?.[0];
    if (touch) {
      sampleTouchRef.current = {
        startX: touch.pageX,
        startY: touch.pageY,
        time: Date.now(),
      };
    }
  };

  const handleSampleTouchEnd = (e: any) => {
    if (!sampleTouchRef.current) return;
    const touch = e.nativeEvent.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.pageX - sampleTouchRef.current.startX;
    const deltaY = touch.pageY - sampleTouchRef.current.startY;
    const elapsed = Date.now() - sampleTouchRef.current.time;

    if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12 && elapsed < 350) {
      setShowControls((prev) => !prev);
    } else if (elapsed < 600 && Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX > 40) {
        handleNextPage();
      } else if (deltaX < -40) {
        handlePrevPage();
      }
    }
    sampleTouchRef.current = null;
  };

  if (!book) {
    return (
      <View style={styles.fullScreenContainer}>
        {isLoading ? (
          <FeedbackPanel title="جارٍ تحميل الكتاب" loading />
        ) : (
          <FeedbackPanel title="لم يُعثر على الكتاب" action="العودة" onAction={() => router.back()} />
        )}
      </View>
    );
  }

  const isBookmarked = bookmarks.includes(page);

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar hidden={!showControls} style="light" />

      {/* Floating Exit Button in Immersive Mode (visible when controls are hidden) */}
      {!showControls ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.floatingExitBtn}
          accessibilityLabel="الخروج من القارئ"
        >
          <MaterialCommunityIcons name="arrow-right" size={22} color={palette.white} />
          <Text style={styles.floatingExitText}>خروج</Text>
        </Pressable>
      ) : null}

      {/* Resume Reading Toast Notification */}
      {resumeToast.visible ? (
        <View style={styles.toastContainer}>
          <MaterialCommunityIcons name="bookmark-check" size={20} color={palette.gold} />
          <Text style={styles.toastText}>
            تم استئناف القراءة من صفحة {resumeToast.page.toLocaleString("ar-EG")}
          </Text>
          <Pressable
            onPress={() => {
              setCurrentPage(1);
              setResumeToast((p) => ({ ...p, visible: false }));
            }}
            style={styles.toastResetBtn}
          >
            <Text style={styles.toastResetText}>العودة للبداية</Text>
          </Pressable>
          <Pressable
            onPress={() => setResumeToast((p) => ({ ...p, visible: false }))}
            hitSlop={8}
            style={styles.toastCloseBtn}
          >
            <MaterialCommunityIcons name="close" size={16} color={palette.white} />
          </Pressable>
        </View>
      ) : null}

      {/* Top Bar (Immersive Control) */}
      {showControls ? (
        <View style={styles.topbar}>
          {/* Back / Exit Button */}
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="العودة للمكتبة"
            style={styles.exitButton}
          >
            <MaterialCommunityIcons name="close" size={24} color={palette.white} />
            <Text style={styles.exitButtonText}>خروج</Text>
          </Pressable>

          <Text style={styles.topTitle} numberOfLines={1}>
            {book.title}
          </Text>

          <View style={styles.topActions}>
            {/* In-book Search & Voice Button (Microphone / STT preserved) */}
            <Pressable
              onPress={() => setSearchModalOpen((prev) => !prev)}
              hitSlop={6}
              accessibilityLabel="بحث صوتي داخل الكتاب"
              style={[styles.topIconBtn, searchModalOpen && styles.topIconBtnActive]}
            >
              <MaterialCommunityIcons name="magnify" size={21} color={searchModalOpen ? palette.gold : palette.white} />
            </Pressable>

            {book.pdfPath && pdfDisplayUrl ? (
              <>
                <Pressable onPress={() => adjustZoom(0.25)} hitSlop={6} accessibilityLabel="تكبير">
                  <MaterialCommunityIcons name="magnify-plus-outline" size={21} color={palette.white} />
                </Pressable>
                <Pressable onPress={() => adjustZoom(-0.25)} hitSlop={6} accessibilityLabel="تصغير">
                  <MaterialCommunityIcons name="magnify-minus-outline" size={21} color={palette.white} />
                </Pressable>
                {currentZoom !== 1.0 ? (
                  <Pressable onPress={resetZoom} hitSlop={6} accessibilityLabel="إعادة ضبط التكبير">
                    <MaterialCommunityIcons name="fit-to-page-outline" size={20} color={palette.gold} />
                  </Pressable>
                ) : null}
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

            {/* Immersive full-screen toggle button */}
            <Pressable
              onPress={() => setShowControls(false)}
              hitSlop={8}
              accessibilityLabel="ملء الشاشة"
            >
              <MaterialCommunityIcons name="fullscreen" size={22} color={palette.white} />
            </Pressable>
          </View>
        </View>
      ) : null}

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
              placeholder="اكتب كلمة أو انطقها بالميكروفون..."
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
              accessibilityLabel="البحث الصوتي عبر الميكروفون"
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
                      <Text style={styles.pageJumpBadgeText}>انتقال لصفحة {res.page.toLocaleString("ar-EG")}</Text>
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
      {showControls && totalKnown ? (
        <View style={styles.progressLine}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.round((page / total) * 100))}%` },
            ]}
          />
        </View>
      ) : null}

      {/* Bookmarks Bar */}
      {showControls && bookmarks.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookmarks}>
          {bookmarks.map((number) => (
            <Pressable key={number} style={styles.bookmarkChip} onPress={() => setCurrentPage(number)}>
              <Text style={styles.bookmarkText}>صفحة {number.toLocaleString("ar-EG")}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {/* Main Reader View (Takes 100% of space) */}
      {book.pdfPath ? (
        <View style={styles.readerContainer}>
          {loadingPdf ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={palette.gold} />
              <Text style={styles.centerText}>
                {downloadProgress !== null
                  ? `جارٍ تنزيل وحفظ الكتاب للقراءة الفورية (${downloadProgress}%)...`
                  : isLocalCached
                  ? "جارٍ استدعاء الكتاب فورياً من ذاكرة الهاتف..."
                  : "جارٍ فتح صفحات الكتاب..."}
              </Text>
              {downloadProgress !== null ? (
                <View style={styles.downloadProgressBar}>
                  <View style={[styles.downloadProgressBarFill, { width: `${downloadProgress}%` }]} />
                </View>
              ) : null}
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
                  <ActivityIndicator size="large" color={palette.gold} />
                  <Text style={styles.centerText}>
                    {downloadProgress !== null
                      ? `جارٍ حفظ صفحات الكتاب (${downloadProgress}%)...`
                      : isLocalCached
                      ? "جارٍ فتح الكتاب من ذاكرة الهاتف..."
                      : "جارٍ عرض صفحات الكتاب..."}
                  </Text>
                  {downloadProgress !== null ? (
                    <View style={styles.downloadProgressBar}>
                      <View style={[styles.downloadProgressBarFill, { width: `${downloadProgress}%` }]} />
                    </View>
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      ) : (
        <View
          style={styles.reader}
          onTouchStart={handleSampleTouchStart}
          onTouchEnd={handleSampleTouchEnd}
        >
          <ScrollView contentContainerStyle={styles.readerContent}>
            <View style={styles.sampleBanner}>
              <MaterialCommunityIcons name="information-outline" size={18} color={palette.gold} />
              <Text style={styles.sampleBannerText}>نص تجريبي للعرض فقط — ليس محتوى الكتاب الأصلي.</Text>
            </View>
            <Text style={[styles.sampleText, { fontSize: 16 * local.fontScale }]}>
              {pages[(page - 1) % pages.length]}
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Page Jump Bar (visible when controls are shown) */}
      {showControls ? (
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
      ) : null}

      {/* Bottom Navigation Controls Bar (visible when controls are shown) */}
      {showControls ? (
        <View style={styles.controls}>
          {/* Next Button (التالي) - in RTL placed forward */}
          <Pressable
            onPress={handleNextPage}
            disabled={totalKnown && page >= total}
            style={[styles.controlButton, totalKnown && page >= total && styles.disabled]}
            accessibilityLabel="الصفحة التالية"
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={palette.green} />
            <Text style={styles.controlText}>التالي</Text>
          </Pressable>

          {/* Current Page Counter */}
          <View style={styles.pageCount}>
            <Text style={styles.pageCountText}>
              صفحة {page.toLocaleString("ar-EG")}
              {totalKnown ? ` من ${total.toLocaleString("ar-EG")}` : ""}
            </Text>
            <Text style={styles.savedText}>موضع محفوظ تلقائياً على هذا الجهاز</Text>
          </View>

          {/* Previous Button (السابق) */}
          <Pressable
            onPress={handlePrevPage}
            disabled={page <= 1}
            style={[styles.controlButton, page <= 1 && styles.disabled]}
            accessibilityLabel="الصفحة السابقة"
          >
            <Text style={styles.controlText}>السابق</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={palette.green} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#121814",
  },
  floatingExitBtn: {
    position: "absolute",
    top: 28,
    right: 16,
    zIndex: 99,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 54, 41, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(197, 160, 89, 0.5)",
  },
  floatingExitText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "800",
  },
  toastContainer: {
    position: "absolute",
    top: 64,
    alignSelf: "center",
    zIndex: 150,
    backgroundColor: "#103629",
    borderWidth: 1,
    borderColor: palette.gold,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: "92%",
  },
  toastText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  toastResetBtn: {
    backgroundColor: "rgba(197, 160, 89, 0.25)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toastResetText: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: "800",
  },
  toastCloseBtn: {
    padding: 3,
  },
  topbar: {
    minHeight: 56,
    paddingTop: Platform.OS === "android" ? 18 : 12,
    paddingBottom: 10,
    paddingHorizontal: 14,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    backgroundColor: palette.greenDark,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(197, 160, 89, 0.2)",
    zIndex: 50,
  },
  exitButton: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  exitButtonText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: "800",
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
    gap: 11,
  },
  topIconBtn: {
    padding: 3,
    borderRadius: 6,
  },
  topIconBtnActive: {
    backgroundColor: "rgba(197, 160, 89, 0.25)",
  },
  searchDrawer: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    padding: 12,
    maxHeight: 320,
    zIndex: 60,
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
  progressLine: { height: 3, backgroundColor: "#2b3b30", alignItems: "flex-end" },
  progressFill: { height: 3, backgroundColor: palette.gold },
  bookmarks: { flexDirection: "row-reverse", gap: 7, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#18241d" },
  bookmarkChip: { backgroundColor: palette.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  bookmarkText: { color: palette.greenDark, fontWeight: "700", fontSize: 11 },
  readerContainer: { flex: 1, backgroundColor: "#121814" },
  webView: { flex: 1, backgroundColor: "#121814" },
  downloadProgressBar: {
    width: 220,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },
  downloadProgressBarFill: {
    height: "100%",
    backgroundColor: palette.gold,
    borderRadius: 999,
  },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: palette.white, fontSize: 13, fontWeight: "700", marginTop: 14, textAlign: "center" },
  errorTitle: { color: palette.danger, fontSize: 16, fontWeight: "800", marginTop: 12 },
  errorText: { color: palette.muted, fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 20 },
  errorActions: { flexDirection: "row-reverse", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" },
  reader: { flex: 1, backgroundColor: "#121814" },
  readerContent: { padding: 17, flexGrow: 1, justifyContent: "center" },
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
    zIndex: 50,
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
    minHeight: 60,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    backgroundColor: palette.surface,
    zIndex: 50,
  },
  controlButton: { flexDirection: "row-reverse", alignItems: "center", gap: 4, padding: 8 },
  disabled: { opacity: 0.35 },
  controlText: { color: palette.green, fontSize: 13, fontWeight: "800" },
  pageCount: { alignItems: "center" },
  pageCountText: { color: palette.ink, fontSize: 12, fontWeight: "800" },
  savedText: { color: palette.muted, fontSize: 9, marginTop: 2 },
});
