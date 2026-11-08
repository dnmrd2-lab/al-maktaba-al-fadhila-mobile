import { afterEach, describe, expect, it, vi } from "vitest";
import { createBookStoragePath, createCoverStoragePath, resolveBookUploadBody } from "../lib/book-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveBookUploadBody", () => {
  it("uses the browser File supplied by DocumentPicker on web", async () => {
    const browserFile = new Blob(["pdf-bytes"], { type: "application/pdf" });
    const makeNativeFile = vi.fn(() => new ArrayBuffer(1));

    const result = await resolveBookUploadBody(
      { uri: "blob:https://preview.example/file-id", file: browserFile },
      "web",
      makeNativeFile,
    );

    expect(result).toBe(browserFile);
    expect(makeNativeFile).not.toHaveBeenCalled();
  });

  it("reads native files as ArrayBuffer for Supabase Storage", async () => {
    const nativeFile = new Uint8Array([1, 2, 3]).buffer;
    const makeNativeFile = vi.fn(() => nativeFile);

    const result = await resolveBookUploadBody(
      { uri: "file:///documents/book.pdf" },
      "android",
      makeNativeFile,
    );

    expect(result).toBe(nativeFile);
    expect(makeNativeFile).toHaveBeenCalledWith("file:///documents/book.pdf");
  });

  it("fetches the selected browser URI when DocumentPicker omits its File", async () => {
    const fetchedBlob = new Blob(["fallback-pdf"], { type: "application/pdf" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => fetchedBlob });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveBookUploadBody(
      { uri: "blob:https://preview.example/file-id" },
      "web",
      () => new ArrayBuffer(1),
    );

    expect(result).toBe(fetchedBlob);
    expect(fetchMock).toHaveBeenCalledWith("blob:https://preview.example/file-id");
  });

  it("rejects empty native and browser files before upload", async () => {
    await expect(
      resolveBookUploadBody({ uri: "file:///documents/empty.pdf" }, "android", () => new ArrayBuffer(0)),
    ).rejects.toThrow("الملف المختار فارغ");

    await expect(
      resolveBookUploadBody(
        { uri: "blob:https://preview.example/empty", file: new Blob() },
        "web",
        () => new ArrayBuffer(1),
      ),
    ).rejects.toThrow("الملف المختار فارغ");
  });
});

describe("createBookStoragePath", () => {
  it("creates a short ASCII-only key without using the Arabic filename", () => {
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
  it("creates ASCII-only image paths with the selected extension", () => {
    expect(createCoverStoragePath("webp", 456, "Cover_01")).toBe("files/456-Cover01.webp");
    expect(createCoverStoragePath("jpg", 789, "___")).toBe("files/789-upload.jpg");
  });
});
