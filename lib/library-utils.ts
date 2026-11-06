import type { Book } from "./app-context";

export function filterBooks(books: Book[], query: string, folderId?: string | null): Book[] {
  const normalized = query.trim().toLocaleLowerCase("ar");
  return books.filter((book) => {
    const matchesFolder = !folderId || book.folderId === folderId;
    const haystack = `${book.title} ${book.author} ${book.category} ${book.description}`.toLocaleLowerCase("ar");
    return matchesFolder && (!normalized || haystack.includes(normalized));
  });
}

export function canOfferDownload(book: Pick<Book, "downloadPolicy" | "pdfPath">): boolean {
  return book.downloadPolicy === "DOWNLOAD_ALLOWED" && Boolean(book.pdfPath);
}

export function getBooksToContinue<T extends Pick<Book, "id">>(books: T[], progress: Record<string, number>): T[] {
  return books.filter((book) => Number.isFinite(progress[book.id]) && progress[book.id] > 1);
}

export function formatPages(pages: number): string {
  return pages > 0 ? `${pages.toLocaleString("ar-EG")} صفحة` : "عدد الصفحات غير محدد";
}

export function getLibraryErrorMessage(error: unknown): string {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === "string" ? candidate.code.toUpperCase() : "";
  const rawMessage = typeof candidate?.message === "string" ? candidate.message.trim() : "";
  const details = `${code} ${rawMessage}`.toLocaleLowerCase("en");

  if (code === "PGRST205" || code === "42P01") {
    return "تعذر تحميل الكتب لأن جداول المكتبة غير جاهزة. تواصل مع مسؤول المكتبة.";
  }
  if (
    code === "42501" ||
    code === "401" ||
    code === "403" ||
    /permission denied|row-level security|not authorized|unauthorized/.test(details)
  ) {
    return "تعذر تحميل الكتب بسبب صلاحيات الوصول. تواصل مع مسؤول المكتبة.";
  }
  if (/expo_public_supabase|إعداد supabase غير مكتمل|not-configured/.test(details)) {
    return "إعداد اتصال المكتبة غير مكتمل في هذه النسخة. حدّث التطبيق أو تواصل مع مسؤول المكتبة.";
  }
  if (/network|fetch|connection|connect|timeout|timed out|offline|internet|unreachable|dns|econn|enotfound/.test(details)) {
    return "تعذر الاتصال بقاعدة بيانات المكتبة. تحقق من اتصال الإنترنت ثم اضغط «إعادة المحاولة».";
  }
  return "حدث خطأ أثناء تحميل الكتب. تحقق من اتصال الإنترنت ثم أعد المحاولة. إذا استمرت المشكلة، تواصل مع مسؤول المكتبة.";
}
