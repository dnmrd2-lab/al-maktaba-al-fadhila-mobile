// Pure cache helper - does not import react-native top-level to remain testable in Node/web environments

export async function getBookCacheDirectory(): Promise<string | null> {
  if (typeof window !== "undefined" && !("ReactNativeWebView" in window)) {
    // Web / browser environment
    return null;
  }
  try {
    const FileSystem: any = await import("expo-file-system/legacy");
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
 * Removes any cached or downloaded copy of a specific book from local device storage.
 */
export async function deleteLocalBookCache(bookId: string): Promise<void> {
  if (!bookId) return;
  try {
    const FileSystem: any = await import("expo-file-system/legacy");
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
 * Verifies local cache integrity for reading.
 * If a local file is 0 bytes or less than 1KB (corrupted), it is deleted immediately
 * and re-downloaded or streamed directly from the remote URL without interrupting the reader.
 */
export async function ensureValidLocalPdf(
  bookId: string,
  remotePdfUrl: string,
): Promise<{ uri: string; isLocal: boolean }> {
  const trimmedUrl = (remotePdfUrl || "").trim();
  if (!trimmedUrl) {
    return { uri: "", isLocal: false };
  }

  try {
    const FileSystem: any = await import("expo-file-system/legacy");
    const dir = await getBookCacheDirectory();
    if (!dir) return { uri: trimmedUrl, isLocal: false };

    const localPath = `${dir}${bookId}.pdf`;
    const info = await FileSystem.getInfoAsync(localPath);

    // If local file exists, validate size >= 1024 bytes
    if (info && info.exists) {
      if (typeof info.size === "number" && info.size >= 1024) {
        return { uri: localPath, isLocal: true };
      }
      // If 0 bytes or < 1024 bytes (damaged/corrupted), delete it immediately
      await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => undefined);
    }

    // Attempt downloading the book from remote URL
    const downloadRes = await FileSystem.downloadAsync(trimmedUrl, localPath);
    if (downloadRes && downloadRes.status === 200) {
      const newInfo = await FileSystem.getInfoAsync(localPath);
      if (newInfo && newInfo.exists && typeof newInfo.size === "number" && newInfo.size >= 1024) {
        return { uri: localPath, isLocal: true };
      }
      // Downloaded file was empty or corrupted - remove it immediately
      await FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => undefined);
    }

    // Fallback to streaming directly from remote URL without interrupting user
    return { uri: trimmedUrl, isLocal: false };
  } catch {
    return { uri: trimmedUrl, isLocal: false };
  }
}
