import { describe, expect, it } from "vitest";
import { canOfferDownload, filterBooks, formatPages, getBooksToContinue, getLibraryErrorMessage } from "../lib/library-utils";
import type { Book } from "../lib/app-context";

const book = (overrides: Partial<Book> = {}): Book => ({
  id: "one", folderId: "aqeedah", title: "شرح الأصول الثلاثة", author: "محمد بن عبد الوهاب",
  description: "شرح مبسط في العقيدة", category: "العقيدة", coverKey: "green", coverPath: null,
  coverUri: null, pdfPath: "files/book.pdf", downloadPolicy: "READ_ONLY", pages: 120,
  published: true, order: 1, isArchived: false, viewsCount: 0, ...overrides,
});

describe("library utilities", () => {
  it("searches Arabic title, author, category and description without case sensitivity", () => {
    expect(filterBooks([book()], "الأصول")).toHaveLength(1);
    expect(filterBooks([book()], "العقيدة")).toHaveLength(1);
    expect(filterBooks([book()], "غير موجود")).toHaveLength(0);
  });

  it("applies the folder filter", () => {
    expect(filterBooks([book(), book({ id: "two", folderId: "fiqh" })], "", "fiqh").map((item) => item.id)).toEqual(["two"]);
  });

  it("returns multiple books with separate saved pages and skips untouched books", () => {
    const first = book({ id: "first" });
    const second = book({ id: "second" });
    const untouched = book({ id: "untouched" });
    expect(getBooksToContinue([first, second, untouched], { first: 12, second: 4, untouched: 1 })).toEqual([first, second]);
  });

  it("only offers the download action when policy and PDF are both present", () => {
    expect(canOfferDownload(book({ downloadPolicy: "DOWNLOAD_ALLOWED" }))).toBe(true);
    expect(canOfferDownload(book({ pdfPath: null, downloadPolicy: "DOWNLOAD_ALLOWED" }))).toBe(false);
    expect(canOfferDownload(book())).toBe(false);
  });

  it("formats page counts and unknown values", () => {
    expect(formatPages(0)).toContain("غير محدد");
    expect(formatPages(12)).toContain("١٢");
  });

  it("gives an actionable Arabic message when the library tables are missing", () => {
    expect(getLibraryErrorMessage({ code: "PGRST205", message: "missing table" })).toContain("جداول المكتبة");
    expect(getLibraryErrorMessage({ code: "42P01", message: "missing table" })).toContain("جداول المكتبة");
  });

  it("shows a clear retry message for database connection failures", () => {
    expect(getLibraryErrorMessage({ message: "network unavailable" })).toBe(
      "تعذر الاتصال بقاعدة بيانات المكتبة. تحقق من اتصال الإنترنت ثم اضغط «إعادة المحاولة».",
    );
  });

  it("directs permission failures to the library administrator", () => {
    expect(getLibraryErrorMessage({ code: "42501", message: "permission denied" })).toContain("صلاحيات الوصول");
  });

  it("explains missing application configuration without exposing variable names", () => {
    const message = getLibraryErrorMessage({ message: "إعداد Supabase غير مكتمل. أضف EXPO_PUBLIC_SUPABASE_URL." });
    expect(message).toContain("إعداد اتصال المكتبة غير مكتمل");
    expect(message).not.toContain("EXPO_PUBLIC_SUPABASE_URL");
  });

  it("does not expose unknown backend errors and provides a safe fallback", () => {
    const rawMessage = "Database unavailable due to internal error";
    expect(getLibraryErrorMessage({ message: rawMessage })).not.toBe(rawMessage);
    expect(getLibraryErrorMessage({ message: rawMessage })).toContain("تحقق من اتصال الإنترنت");
    expect(getLibraryErrorMessage(null)).toContain("أعد المحاولة");
  });
});
