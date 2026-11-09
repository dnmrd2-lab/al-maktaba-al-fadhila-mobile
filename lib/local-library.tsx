import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import {
  deleteLocalBookCache,
  ensureValidLocalPdf,
  getBookCacheDirectory,
} from "./book-cache";

export { getBookCacheDirectory, deleteLocalBookCache, ensureValidLocalPdf };

export type LocalLibraryState = {
  favorites: string[];
  progress: Record<string, number>;
  bookmarks: Record<string, number[]>;
  fontScale: number;
  seenWelcome: boolean;
};

type LocalLibraryContextValue = LocalLibraryState & {
  ready: boolean;
  toggleFavorite: (id: string) => void;
  saveProgress: (id: string, page: number) => void;
  toggleBookmark: (id: string, page: number) => void;
  setFontScale: (value: number) => void;
  clearLocalData: () => Promise<void>;
  deleteBookCache: (bookId: string) => Promise<void>;
  resolveBookPdfUri: (bookId: string, remotePdfUrl: string) => Promise<{ uri: string; isLocal: boolean }>;
};

const KEY = "al-maktaba-al-fadhila-mobile-v1";
const initial: LocalLibraryState = { favorites: [], progress: {}, bookmarks: {}, fontScale: 1, seenWelcome: false };
const Context = createContext<LocalLibraryContextValue | null>(null);

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") return typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(KEY, value);
}

export function LocalLibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalLibraryState>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await readRaw();
        if (raw && active) {
          const parsed = JSON.parse(raw);
          setState({
            favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
            progress: typeof parsed.progress === "object" && parsed.progress ? parsed.progress : {},
            bookmarks: typeof parsed.bookmarks === "object" && parsed.bookmarks ? parsed.bookmarks : {},
            fontScale: typeof parsed.fontScale === "number" ? parsed.fontScale : 1,
            seenWelcome: Boolean(parsed.seenWelcome),
          });
        }
      } catch {
        // fallback to defaults on corrupt storage
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => { active = false; };
  }, []);

  const persist = useCallback((next: LocalLibraryState) => {
    setState(next);
    void writeRaw(JSON.stringify(next));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    persist({
      ...state,
      favorites: state.favorites.includes(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id],
    });
  }, [persist, state]);

  const saveProgress = useCallback((id: string, page: number) => {
    persist({ ...state, progress: { ...state.progress, [id]: page } });
  }, [persist, state]);

  const toggleBookmark = useCallback((id: string, page: number) => {
    const list = state.bookmarks[id] ?? [];
    const nextList = list.includes(page) ? list.filter((p) => p !== page) : [...list, page].sort((a, b) => a - b);
    persist({ ...state, bookmarks: { ...state.bookmarks, [id]: nextList } });
  }, [persist, state]);

  const setFontScale = useCallback((value: number) => {
    persist({ ...state, fontScale: Math.max(0.85, Math.min(1.4, value)) });
  }, [persist, state]);

  const clearLocalData = useCallback(async () => {
    persist(initial);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(KEY);
    }
  }, [persist]);

  const deleteBookCacheHandler = useCallback(async (bookId: string) => {
    await deleteLocalBookCache(bookId);
  }, []);

  const resolveBookPdfUri = useCallback(async (bookId: string, remotePdfUrl: string) => {
    return ensureValidLocalPdf(bookId, remotePdfUrl);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      ready,
      toggleFavorite,
      saveProgress,
      toggleBookmark,
      setFontScale,
      clearLocalData,
      deleteBookCache: deleteBookCacheHandler,
      resolveBookPdfUri,
    }),
    [state, ready, toggleFavorite, saveProgress, toggleBookmark, setFontScale, clearLocalData, deleteBookCacheHandler, resolveBookPdfUri],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLocalLibrary() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useLocalLibrary must be used within LocalLibraryProvider");
  return ctx;
}
