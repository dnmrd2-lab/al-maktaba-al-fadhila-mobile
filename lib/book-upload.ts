import * as FileSystem from "expo-file-system/legacy";

export type PickedUploadAsset = {
  uri: string;
  file?: Blob | null;
};

export type LibraryUploadBody = ArrayBuffer | Uint8Array;

export type LibraryImageExtension = "jpg" | "jpeg" | "png" | "webp";

/**
 * Converts a base64 string to a Uint8Array.
 * Works seamlessly in React Native (mobile) and Node/test environments.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1].trim() : base64.trim();
  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(clean, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  throw new Error("تعذر فك ترميز ملف Base64.");
}

/**
 * Supabase Storage expects ArrayBuffer or Uint8Array. Traditional Blob
 * on React Native mobile uploads 0-byte files, so we completely avoid Blob
 * on mobile and read native files as Uint8Array via FileSystem legacy or modern API.
 * On web, we read via ArrayBuffer.
 */
export async function resolveBookUploadBody(
  asset: PickedUploadAsset,
  platform: string,
  makeNativeFile?: (uri: string) => Promise<ArrayBuffer | Uint8Array> | ArrayBuffer | Uint8Array,
): Promise<LibraryUploadBody> {
  let body: LibraryUploadBody | undefined;

  if (platform !== "web") {
    if (makeNativeFile) {
      body = await makeNativeFile(asset.uri);
    } else {
      // 1. Try reading via modern File API if available
      try {
        const { File: ExpoFile } = await import("expo-file-system");
        if (typeof ExpoFile === "function") {
          const file = new ExpoFile(asset.uri);
          if (typeof file.bytes === "function") {
            const bytes = await file.bytes();
            if (bytes && bytes.byteLength > 0) {
              body = bytes;
            }
          }
        }
      } catch {
        // Fall back to legacy FileSystem API
      }

      // 2. If modern API didn't resolve, use expo-file-system/legacy
      if (!body) {
        const FileSystem = await import("expo-file-system/legacy");
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
        });
        body = base64ToUint8Array(base64);
      }
    }
  } else {
    // Web environment: read as ArrayBuffer via fetch or file.arrayBuffer()
    if (asset.file && typeof asset.file.arrayBuffer === "function") {
      body = await asset.file.arrayBuffer();
    } else {
      const response = await fetch(asset.uri);
      if (!response.ok) {
        throw new Error("تعذر قراءة الملف المختار في المتصفح.");
      }
      body = await response.arrayBuffer();
    }
  }

  const byteLength = body instanceof Uint8Array ? body.byteLength : (body as ArrayBuffer).byteLength;
  if (!byteLength || byteLength <= 0) {
    throw new Error("الملف المختار فارغ أو بحجم صفر بايت. يرجى اختيار ملف صالح من الجهاز ثم إعادة المحاولة.");
  }

  return body;
}

/**
 * Generates an ASCII-only storage path for books inside the 'files/' directory.
 * Completely decoupled from the book's Arabic or user-entered title.
 */
export function createBookStoragePath(
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, "") || "upload";
  return `files/${now}-${safeSuffix}.pdf`;
}

/**
 * Generates an ASCII-only storage path for book covers inside the 'covers/' directory.
 */
export function createCoverStoragePath(
  extension: LibraryImageExtension,
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, "") || "upload";
  return `covers/${now}-${safeSuffix}.${extension}`;
}

/** Keep backwards compatibility helper */
export function createLibraryStoragePath(
  extension: "pdf" | LibraryImageExtension,
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  if (extension === "pdf") {
    return createBookStoragePath(now, suffix);
  }
  return createCoverStoragePath(extension, now, suffix);
}

/**
 * Extracts the storage object path (e.g., 'files/123.pdf' or 'covers/456.jpg')
 * from either a full Supabase storage public/signed URL or a relative path.
 */
export function extractStoragePath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/library\/(.+)$/);
  if (match && match[1]) {
    return match[1].split("?")[0].trim();
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const libIndex = segments.indexOf("library");
      if (libIndex !== -1 && libIndex + 1 < segments.length) {
        return segments.slice(libIndex + 1).join("/");
      }
    } catch {
      // ignore parsing error
    }
  }

  return trimmed.replace(/^\/+/, "");
}

/**
 * Returns a clean, trimmed public URL for a given storage path or existing public URL.
 */
export function resolvePublicStorageUrl(
  supabaseInstance: { storage: { from: (bucket: string) => { getPublicUrl: (path: string) => { data: { publicUrl: string } } } } },
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const cleanPath = trimmed.replace(/^\/+/, "");
  const { data } = supabaseInstance.storage.from("library").getPublicUrl(cleanPath);
  return (data?.publicUrl ?? "").trim() || null;
}
