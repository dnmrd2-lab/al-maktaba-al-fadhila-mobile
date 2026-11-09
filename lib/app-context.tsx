import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { getLibraryErrorMessage } from "./library-utils";
import { extractStoragePath } from "./book-upload";

export type StaffRole = "admin" | "content_manager" | "publisher";
export type DownloadPolicy = "READ_ONLY" | "DOWNLOAD_ALLOWED";

export type Folder = {
  id: string;
  slug: string;
  name: string;
  description: string;
  locked: boolean;
  sort: number;
};

export type Book = {
  id: string;
  folderId: string;
  title: string;
  author: string;
  description: string;
  category: string;
  coverKey: "green" | "cream" | "teal";
  coverPath: string | null;
  coverUri: string | null;
  pdfPath: string | null;
  downloadPolicy: DownloadPolicy;
  pages: number;
  published: boolean;
  order: number;
  isArchived: boolean;
};

type AppContextValue = {
  books: Book[];
  folders: Folder[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isConfigured: boolean;
  session: Session | null;
  authReady: boolean;
  roles: StaffRole[];
  rolesLoading: boolean;
  isStaff: boolean;
  canManageBooks: boolean;
  canPublish: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function mapRole(value: string): StaffRole | null {
  return value === "admin" || value === "content_manager" || value === "publisher" ? value : null;
}

const SUPER_ADMIN_EMAILS = ["dnmrd2@gmail.com"];

async function signCoverPaths(paths: string[]) {
  const unique = [...new Set(paths.map((p) => extractStoragePath(p) || p).filter(Boolean))];
  if (!unique.length) return {} as Record<string, string>;
  const { data, error } = await supabase.storage.from("library").createSignedUrls(unique, 3600);
  if (error) return {} as Record<string, string>;
  const output: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) output[item.path] = item.signedUrl;
  }
  return output;
}

function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("انتهت مهلة الاتصال بقاعدة البيانات. تحقق من الشبكة ثم أعد المحاولة.")), milliseconds);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (cause: unknown) => { clearTimeout(timer); reject(cause); },
    );
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isStaff = roles.length > 0;

  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthReady(true);
      setIsLoading(false);
      setError("إعداد Supabase غير مكتمل. أضف EXPO_PUBLIC_SUPABASE_URL ومفتاح النشر العام.");
      return;
    }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data: result }) => {
      if (active) {
        setSession(result.session);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = session?.user.id;
    const userEmail = session?.user.email?.toLowerCase().trim();
    const isSuperAdmin = Boolean(userEmail && SUPER_ADMIN_EMAILS.includes(userEmail));

    if (!userId || !supabaseConfigured) {
      setRoles([]);
      setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(
        ({ data, error: roleError }) => {
          if (!active) return;
          const fetched = roleError
            ? []
            : (data ?? []).map((row) => mapRole(String(row.role))).filter((r): r is StaffRole => r !== null);
          if (isSuperAdmin && !fetched.includes("admin")) {
            fetched.push("admin");
          }
          setRoles(fetched);
          setRolesLoading(false);
        },
        () => {
          if (!active) return;
          setRoles(isSuperAdmin ? ["admin"] : []);
          setRolesLoading(false);
        }
      );
    return () => {
      active = false;
    };
  }, [session?.user.id, session?.user.email]);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const selectColsWithArchive =
        "id, folder_id, title, author, description, category, cover_key, cover_url, pdf_url, pages, published, sort, download_policy, is_archived";
      const selectColsFallback =
        "id, folder_id, title, author, description, category, cover_key, cover_url, pdf_url, pages, published, sort, download_policy";

      let bookQuery = isStaff
        ? supabase.from("books").select(selectColsWithArchive).order("sort")
        : supabase.from("books").select(selectColsWithArchive).eq("published", true).order("sort");

      let [folderResult, bookResult]: [any, any] = await withTimeout(
        Promise.all([
          supabase.from("folders").select("id, slug, name, description, locked, sort").order("sort"),
          bookQuery,
        ]),
        15_000,
      );

      // Gracefully fallback if is_archived column does not exist in DB yet (PostgREST code 42703)
      if (bookResult.error && (bookResult.error.code === "42703" || bookResult.error.message?.includes("is_archived"))) {
        const fallbackBookQuery = isStaff
          ? supabase.from("books").select(selectColsFallback).order("sort")
          : supabase.from("books").select(selectColsFallback).eq("published", true).order("sort");
        bookResult = await fallbackBookQuery;
      }

      if (folderResult.error) throw folderResult.error;
      if (bookResult.error) throw bookResult.error;

      const rows = bookResult.data ?? [];
      const visibleRows = isStaff
        ? rows
        : rows.filter((row: any) => row.published && !row.is_archived);

      const coverCandidates = visibleRows.map((row: any) => (row.cover_url ?? "").trim()).filter(Boolean);
      const signedCovers = await withTimeout(signCoverPaths(coverCandidates), 12_000);

      setFolders((folderResult.data ?? []) as Folder[]);
      setBooks(
        visibleRows.map((row: any) => {
          const rawCover = (row.cover_url ?? "").trim() || null;
          const storageKey = extractStoragePath(rawCover);
          const isDirectUrl = Boolean(rawCover && /^https?:\/\//i.test(rawCover));
          const signedUri = storageKey ? signedCovers[storageKey] ?? null : null;

          return {
            id: row.id,
            folderId: row.folder_id,
            title: row.title,
            author: row.author ?? "",
            description: row.description ?? "",
            category: row.category ?? "",
            coverKey: row.cover_key === "cream" || row.cover_key === "teal" ? row.cover_key : "green",
            coverPath: rawCover,
            coverUri: isDirectUrl ? rawCover : signedUri,
            pdfPath: (row.pdf_url ?? "").trim() || null,
            downloadPolicy: row.download_policy === "DOWNLOAD_ALLOWED" ? "DOWNLOAD_ALLOWED" : "READ_ONLY",
            pages: Number(row.pages) || 0,
            published: Boolean(row.published),
            order: Number(row.sort) || 0,
            isArchived: Boolean(row.is_archived),
          };
        }),
      );
    } catch (cause) {
      setError(getLibraryErrorMessage(cause));
    } finally {
      setIsLoading(false);
    }
  }, [isStaff]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AppContextValue>(
    () => ({
      books,
      folders,
      isLoading,
      error,
      refresh,
      isConfigured: supabaseConfigured,
      session,
      authReady,
      roles,
      rolesLoading,
      isStaff,
      canManageBooks: roles.includes("admin") || roles.includes("content_manager"),
      canPublish: roles.includes("admin") || roles.includes("publisher"),
      signIn: async (email, password) => {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      },
      signOut: async () => {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      },
    }),
    [books, folders, isLoading, error, refresh, session, authReady, roles, rolesLoading, isStaff],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}
