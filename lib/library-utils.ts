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
  if (candidate?.code === "PGRST205" || candidate?.code === "42P01") {
    return "قاعدة Supabase المتصلة لا تحتوي جداول الكتب أو التصنيفات. تحقق من عنوان المشروع أو طبّق ترحيلات قاعدة المكتبة.";
  }
  if (typeof candidate?.message === "string" && candidate.message.trim()) return candidate.message;
  return "تعذر تحميل بيانات المكتبة. تحقق من الاتصال ثم أعد المحاولة.";
}
