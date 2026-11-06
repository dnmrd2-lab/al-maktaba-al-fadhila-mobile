import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

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
};

const KEY = "al-maktaba-al-fadhila-mobile-v1";
const initial: LocalLibraryState = { favorites: [], progress: {}, bookmarks: {}, fontScale: 1, seenWelcome: false };
const Context = createContext<LocalLibraryContextValue | null>(null);

async function readStoredState() {
  if (Platform.OS === "web") return typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
  const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
  return AsyncStorage.getItem(KEY);
}

async function writeStoredState(value: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
    return;
  }
  const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
  await AsyncStorage.setItem(KEY, value);
}

export function LocalLibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalLibraryState>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void readStoredState()
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<LocalLibraryState>;
            setState({ ...initial, ...parsed });
          } catch {
            setState(initial);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (ready) void writeStoredState(JSON.stringify(state)).catch(() => undefined);
  }, [state, ready]);

  const toggleFavorite = useCallback((id: string) => {
    setState((current) => ({ ...current, favorites: current.favorites.includes(id) ? current.favorites.filter((entry) => entry !== id) : [...current.favorites, id] }));
  }, []);
  const saveProgress = useCallback((id: string, page: number) => {
    setState((current) => ({ ...current, progress: { ...current.progress, [id]: Math.max(1, page) } }));
  }, []);
  const toggleBookmark = useCallback((id: string, page: number) => {
    setState((current) => {
      const currentPages = current.bookmarks[id] ?? [];
      const nextPages = currentPages.includes(page) ? currentPages.filter((entry) => entry !== page) : [...currentPages, page].sort((a, b) => a - b);
      return { ...current, bookmarks: { ...current.bookmarks, [id]: nextPages } };
    });
  }, []);
  const setFontScale = useCallback((value: number) => {
    setState((current) => ({ ...current, fontScale: Math.min(1.6, Math.max(0.85, value)) }));
  }, []);
  const clearLocalData = useCallback(async () => {
    const empty = { ...initial, seenWelcome: state.seenWelcome };
    setState(empty);
    await writeStoredState(JSON.stringify(empty));
  }, [state.seenWelcome]);

  const value = useMemo(() => ({ ...state, ready, toggleFavorite, saveProgress, toggleBookmark, setFontScale, clearLocalData }), [state, ready, toggleFavorite, saveProgress, toggleBookmark, setFontScale, clearLocalData]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLocalLibrary() {
  const value = useContext(Context);
  if (!value) throw new Error("useLocalLibrary must be used within LocalLibraryProvider");
  return value;
}
