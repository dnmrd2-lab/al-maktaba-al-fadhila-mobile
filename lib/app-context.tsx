import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { getLibraryErrorMessage } from "./library-utils";

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

async function signCoverPaths(paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
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
      .then(({ data, error: roleError }) => {
        if (!active) return;
        setRoles(roleError ? [] : (data ?? []).map((row) => mapRole(String(row.role))).filter((r): r is StaffRole => r !== null));
        setRolesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookRequest = isStaff
        ? supabase
            .from("books")
            .select("id, folder_id, title, author, description, category, cover_key, cover_url, pdf_url, pages, published, sort, download_policy")
            .order("sort")
        : supabase
            .from("books")
            .select("id, folder_id, title, author, description, category, cover_key, cover_url, pdf_url, pages, published, sort, download_policy")
            .eq("published", true)
            .order("sort");
      const [folderResult, bookResult] = await withTimeout(Promise.all([
        supabase.from("folders").select("id, slug, name, description, locked, sort").order("sort"),
        bookRequest,
      ]), 15_000);
      if (folderResult.error) throw folderResult.error;
      if (bookResult.error) throw bookResult.error;
      const rows = bookResult.data ?? [];
      const visibleRows = isStaff ? rows : rows.filter((row) => row.published);
      const signedCovers = await withTimeout(signCoverPaths(visibleRows.map((row) => row.cover_url ?? "")), 12_000);
      setFolders((folderResult.data ?? []) as Folder[]);
      setBooks(
        visibleRows.map((row) => ({
          id: row.id,
          folderId: row.folder_id,
          title: row.title,
          author: row.author ?? "",
          description: row.description ?? "",
          category: row.category ?? "",
          coverKey: row.cover_key === "cream" || row.cover_key === "teal" ? row.cover_key : "green",
          coverPath: row.cover_url,
          coverUri: row.cover_url ? signedCovers[row.cover_url] ?? null : null,
          pdfPath: row.pdf_url,
          downloadPolicy: row.download_policy === "DOWNLOAD_ALLOWED" ? "DOWNLOAD_ALLOWED" : "READ_ONLY",
          pages: Number(row.pages) || 0,
          published: Boolean(row.published),
          order: Number(row.sort) || 0,
        })),
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
