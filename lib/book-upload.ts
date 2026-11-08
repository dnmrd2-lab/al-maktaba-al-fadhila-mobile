export type PickedUploadAsset = {
  uri: string;
  file?: Blob | null;
};

export type LibraryUploadBody = Blob | ArrayBuffer;

export type LibraryImageExtension = "jpg" | "png" | "webp";

/**
 * Supabase Storage expects ArrayBuffer for React Native uploads. Web uploads
 * can use the File/Blob supplied by DocumentPicker.
 */
export async function resolveBookUploadBody(
  asset: PickedUploadAsset,
  platform: string,
  makeNativeFile: (uri: string) => Promise<ArrayBuffer> | ArrayBuffer,
): Promise<LibraryUploadBody> {
  let body: LibraryUploadBody;
  if (platform !== "web") {
    body = await makeNativeFile(asset.uri);
  } else if (asset.file) {
    body = asset.file;
  } else {
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error("تعذر قراءة الملف المختار في المتصفح.");
    }
    body = await response.blob();
  }

  const size = body instanceof ArrayBuffer ? body.byteLength : body.size;
  if (size <= 0) {
    throw new Error("الملف المختار فارغ أو تعذرت قراءته. اختر ملفًا صالحًا من الجهاز ثم حاول مجددًا.");
  }
  return body;
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
