export type PickedUploadAsset = {
  uri: string;
  file?: Blob | null;
};

export type LibraryImageExtension = "jpg" | "png" | "webp";

/**
 * DocumentPicker exposes a real browser File on web. Native platforms instead
 * need a platform file wrapper supplied by the caller.
 */
export async function resolveBookUploadBody(
  asset: PickedUploadAsset,
  platform: string,
  makeNativeFile: (uri: string) => Blob,
): Promise<Blob> {
  if (platform !== "web") {
    return makeNativeFile(asset.uri);
  }

  if (asset.file) {
    return asset.file;
  }

  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error("تعذر قراءة الملف المختار في المتصفح.");
  }
  return response.blob();
}

/** Create an ASCII-only object key that never contains the user's filename. */
export function createLibraryStoragePath(
  extension: "pdf" | LibraryImageExtension,
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, "") || "upload";
  return `files/${now}-${safeSuffix}.${extension}`;
}

/** Keep the existing PDF helper stable for its callers and tests. */
export function createBookStoragePath(
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  return createLibraryStoragePath("pdf", now, suffix);
}

export function createCoverStoragePath(
  extension: LibraryImageExtension,
  now = Date.now(),
  suffix = Math.random().toString(36).slice(2, 10),
): string {
  return createLibraryStoragePath(extension, now, suffix);
}
