import * as FileSystem from "expo-file-system/legacy";

/**
 * Resolves the directory used for local offline book caching.
 * Uses cacheDirectory (or documentDirectory fallback) with a dedicated "books/" subfolder.
 */
export async function getBookCacheDirectory(): Promise<string | null> {
  if (typeof window !== "undefined" && !("ReactNativeWebView" in window) && typeof navigator !== "undefined" && !navigator.product?.includes?.("ReactNative")) {
    // Pure web / browser environment
    return null;
  }
  try {
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) return null;
    const dir = `${baseDir}books/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
    }
    return dir;
  } catch {
    return null;
  }
}

/**
 * Checks if a book is already downloaded and cached locally with a valid file size (>= 1KB).
 */
export async function isBookCachedLocally(bookId: string): Promise<boolean> {
  if (!bookId) return false;
  try {
    const dir = await getBookCacheDirectory();
    if (!dir) return false;
    const targetFile = `${dir}${bookId}.pdf`;
    const info = await FileSystem.getInfoAsync(targetFile);
    if (info && info.exists && typeof info.size === "number" && info.size >= 1024) {
      return true;
    }
    // If exists but empty/corrupt, delete it immediately
    if (info && info.exists) {
      await FileSystem.deleteAsync(targetFile, { idempotent: true }).catch(() => undefined);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Gets the local file URI if cached and valid.
 */
export async function getLocalBookFilePath(bookId: string): Promise<string | null> {
  if (!bookId) return null;
  const isCached = await isBookCachedLocally(bookId);
  if (!isCached) return null;
  const dir = await getBookCacheDirectory();
  return dir ? `${dir}${bookId}.pdf` : null;
}

/**
 * Reads local cached book file as base64 for instant, CORS-free in-memory rendering.
 */
export async function readLocalBookBase64(bookId: string): Promise<string | null> {
  if (!bookId) return null;
  try {
    const localPath = await getLocalBookFilePath(bookId);
    if (!localPath) return null;
    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: (FileSystem as any).EncodingType?.Base64 ?? "base64",
    });
    return base64 && base64.length > 0 ? base64 : null;
  } catch {
    return null;
  }
}

/**
 * Removes any cached or downloaded copy of a specific book from local device storage.
 */
export async function deleteLocalBookCache(bookId: string): Promise<void> {
  if (!bookId) return;
  try {
    const dir = await getBookCacheDirectory();
    if (!dir) return;
    const targetFile = `${dir}${bookId}.pdf`;
    const info = await FileSystem.getInfoAsync(targetFile);
    if (info?.exists) {
      await FileSystem.deleteAsync(targetFile, { idempotent: true });
    }
  } catch {
    // Ignore filesystem deletion errors
  }
}

/**
 * Smart local caching manager:
 * 1. Checks if the file is already cached locally. If valid (>= 1KB), returns it immediately with zero network calls.
 * 2. If not cached (first time opening), downloads it directly to local cache and returns it.
 * 3. Falls back smoothly to remote URL if download fails or on web.
 */
export async function ensureValidLocalPdf(
  bookId: string,
  remotePdfUrl: string,
  onProgress?: (progressPercent: number) => void,
): Promise<{ uri: string; base64?: string; isLocal: boolean }> {
  const trimmedUrl = (remotePdfUrl || "").trim();
  if (!trimmedUrl) {
    return { uri: "", isLocal: false };
  }

  try {
    const dir = await getBookCacheDirectory();
    if (!dir) return { uri: trimmedUrl, isLocal: false };

    const localPath = `${dir}${bookId}.pdf`;

    // 1. Instant check: Already cached locally?
    const alreadyCached = await isBookCachedLocally(bookId);
    if (alreadyCached) {
      const base64 = await readLocalBookBase64(bookId);
      return {
        uri: localPath,
        base64: base64 ?? undefined,
        isLocal: true,
      };
    }

    // 2. First time: Download and save to local storage
    if (typeof FileSystem.createDownloadResumable === "function" && onProgress) {
      const downloadResumable = FileSystem.createDownloadResumable(
        trimmedUrl,
        localPath,
        {},
        (downloadProgress) => {
          const totalBytes = downloadProgress.totalBytesExpectedToWrite;
          if (totalBytes > 0) {
            const pct = Math.round((downloadProgress.totalBytesWritten / totalBytes) * 100);
            onProgress(Math.min(100, Math.max(0, pct)));
          }
        },
      );
      const downloadRes = await downloadResumable.downloadAsync();
      if (downloadRes && downloadRes.status === 200) {
        const isValid = await isBookCachedLocally(bookId);
        if (isValid) {
          const base64 = await readLocalBookBase64(bookId);
          return { uri: localPath, base64: base64 ?? undefined, isLocal: true };
        }
      }
    } else {
      const downloadRes = await FileSystem.downloadAsync(trimmedUrl, localPath);
      if (downloadRes && downloadRes.status === 200) {
        const isValid = await isBookCachedLocally(bookId);
        if (isValid) {
          const base64 = await readLocalBookBase64(bookId);
          return { uri: localPath, base64: base64 ?? undefined, isLocal: true };
        }
      }
    }

    // Fallback to streaming directly from remote URL without interrupting user
    return { uri: trimmedUrl, isLocal: false };
  } catch {
    return { uri: trimmedUrl, isLocal: false };
  }
}
