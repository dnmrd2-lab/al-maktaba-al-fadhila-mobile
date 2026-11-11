vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/mock/cache/",
  documentDirectory: "/mock/docs/",
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  getInfoAsync: vi.fn().mockResolvedValue({ exists: false, size: 0 }),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
  downloadAsync: vi.fn().mockResolvedValue({ status: 200 }),
  readAsStringAsync: vi.fn().mockResolvedValue(Buffer.from("محتوى تجريبي").toString("base64")),
  EncodingType: { Base64: "base64" },
}));
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  base64ToUint8Array,
  createBookStoragePath,
  createCoverStoragePath,
  extractStoragePath,
  resolveBookUploadBody,
} from "../lib/book-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("base64ToUint8Array", () => {
  it("converts clean base64 string to Uint8Array", () => {
    const original = "بسم الله الرحمن الرحيم - كتاب الفضيلة";
    const base64 = Buffer.from(original).toString("base64");
    const bytes = base64ToUint8Array(base64);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(Buffer.from(bytes).toString("utf-8")).toBe(original);
  });

  it("handles base64 with data URI prefix", () => {
    const original = "data:application/pdf;base64," + Buffer.from("PDF_SAMPLE_DATA").toString("base64");
    const bytes = base64ToUint8Array(original);
    expect(Buffer.from(bytes).toString("utf-8")).toBe("PDF_SAMPLE_DATA");
  });
});

describe("resolveBookUploadBody", () => {
  it("reads native file via expo-file-system/legacy and converts to non-empty Uint8Array", async () => {
    const fakeContent = "محتوى كتاب تجريبي";
    const base64 = Buffer.from(fakeContent).toString("base64");
    vi.doMock("expo-file-system/legacy", () => ({
      readAsStringAsync: vi.fn().mockResolvedValue(base64),
      EncodingType: { Base64: "base64" },
    }));

    const result = await resolveBookUploadBody(
      { uri: "file:///data/user/0/app/cache/sample.pdf" },
      "android",
    );

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.byteLength).toBeGreaterThan(0);
    vi.doUnmock("expo-file-system/legacy");
  });

  it("uses ArrayBuffer on web instead of traditional Blob", async () => {
    const rawBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    const browserFile = {
      arrayBuffer: vi.fn().mockResolvedValue(rawBuffer),
    } as unknown as Blob;

    const result = await resolveBookUploadBody(
      { uri: "blob:https://preview.example/file-id", file: browserFile },
      "web",
    );

    expect(result).toBe(rawBuffer);
  });

  it("reads native files as Uint8Array/ArrayBuffer for Supabase Storage", async () => {
    const nativeFile = new Uint8Array([1, 2, 3]);
    const makeNativeFile = vi.fn(() => nativeFile);

    const result = await resolveBookUploadBody(
      { uri: "file:///documents/book.pdf" },
      "android",
      makeNativeFile,
    );

    expect(result).toBe(nativeFile);
    expect(makeNativeFile).toHaveBeenCalledWith("file:///documents/book.pdf");
  });

  it("fetches the selected browser URI as ArrayBuffer when DocumentPicker omits its File", async () => {
    const rawBuffer = new Uint8Array([10, 20, 30]).buffer;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => rawBuffer });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveBookUploadBody(
      { uri: "blob:https://preview.example/file-id" },
      "web",
    );

    expect(result).toBe(rawBuffer);
    expect(fetchMock).toHaveBeenCalledWith("blob:https://preview.example/file-id");
  });

  it("rejects empty native and browser files before upload", async () => {
    await expect(
      resolveBookUploadBody({ uri: "file:///documents/empty.pdf" }, "android", () => new ArrayBuffer(0)),
    ).rejects.toThrow("الملف المختار فارغ أو بحجم صفر بايت");

    await expect(
      resolveBookUploadBody(
        { uri: "blob:https://preview.example/empty", file: { arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Blob },
        "web",
      ),
    ).rejects.toThrow("الملف المختار فارغ أو بحجم صفر بايت");
  });
});

describe("createBookStoragePath", () => {
  it("creates a short ASCII-only key inside files/ without using the Arabic title", () => {
    const path = createBookStoragePath(1793468167589, "aB09Z");

    expect(path).toBe("files/1793468167589-aB09Z.pdf");
    expect(path).toMatch(/^files\/[0-9]+-[a-zA-Z0-9]+\.pdf$/);
    expect(path).not.toContain("الشرح");
  });

  it("falls back to a safe suffix if the random token is empty or unsafe", () => {
    expect(createBookStoragePath(123, "___")).toBe("files/123-upload.pdf");
  });
});

describe("createCoverStoragePath", () => {
  it("creates ASCII-only image paths in covers/ directory with the selected extension", () => {
    expect(createCoverStoragePath("webp", 456, "Cover_01")).toBe("covers/456-Cover01.webp");
    expect(createCoverStoragePath("jpg", 789, "___")).toBe("covers/789-upload.jpg");
  });
});

describe("extractStoragePath", () => {
  it("extracts path from full public URL", () => {
    const url = "https://shevwsbzkgdguucpbkcl.supabase.co/storage/v1/object/public/library/files/1794149266493-ackm250t.pdf";
    expect(extractStoragePath(url)).toBe("files/1794149266493-ackm250t.pdf");
  });

  it("extracts path from signed URL with query params", () => {
    const url = "https://shevwsbzkgdguucpbkcl.supabase.co/storage/v1/object/sign/library/covers/test.jpg?token=abc";
    expect(extractStoragePath(url)).toBe("covers/test.jpg");
  });

  it("preserves already relative storage paths", () => {
    expect(extractStoragePath("files/book.pdf")).toBe("files/book.pdf");
    expect(extractStoragePath("  /covers/image.png  ")).toBe("covers/image.png");
  });
});
