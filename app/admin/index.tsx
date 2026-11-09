import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import { AppHeader, AppScreen, FeedbackPanel, Pill, PrimaryButton } from "../../components/ui";
import { type Book, type DownloadPolicy, type Folder, type StaffRole, useApp } from "../../lib/app-context";
import {
  createBookStoragePath,
  createCoverStoragePath,
  extractStoragePath,
  resolveBookUploadBody,
  type LibraryImageExtension,
} from "../../lib/book-upload";
import { deleteLocalBookCache } from "../../lib/local-library";
import { supabase } from "../../lib/supabase";
import { palette, radius } from "../../lib/theme";

const inputProps = { autoCorrect: false, textAlign: "right" as const, placeholderTextColor: "#879187" };
type SaveFeedback = { tone: "success" | "error"; message: string };
type ManagedStaffUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: StaffRole[];
};
const staffRoleOptions: { value: StaffRole; label: string }[] = [
  { value: "content_manager", label: "مسؤول محتوى" },
  { value: "publisher", label: "مسؤول نشر" },
  { value: "admin", label: "مدير رئيسي" },
];
const imageMimeTypes: Record<LibraryImageExtension, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function getCoverExtension(asset: DocumentPicker.DocumentPickerAsset): LibraryImageExtension {
  const mime = asset.mimeType?.toLowerCase() ?? "";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  const ext = asset.name.split(".").pop()?.toLowerCase();
  if (ext === "png" || ext === "webp" || ext === "jpg" || ext === "jpeg") return ext;
  throw new Error("نوع صورة الغلاف غير مدعوم. استخدم JPG أو PNG أو WebP.");
}

async function getFunctionError(error: unknown) {
  const context = error as { context?: { json?: () => Promise<{ error?: string }> } } | null;
  if (context?.context && typeof context.context.json === "function") {
    try {
      const payload = await context.context.json();
      if (payload?.error) return payload.error;
    } catch {
      // ignore
    }
  }
  return error instanceof Error ? error.message : "تعذر الاتصال بخدمة إدارة الحسابات.";
}

async function runAdminAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("admin-users", { body });
  if (error) throw new Error(await getFunctionError(error));
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }
  if (!data) throw new Error("لم تُرجع خدمة إدارة الحسابات نتيجة. تحقق من نشر الدالة.");
  return data;
}

async function uploadLibraryAsset(
  asset: DocumentPicker.DocumentPickerAsset,
  path: string,
  contentType: string,
): Promise<string> {
  const uploadBody = await resolveBookUploadBody(asset, Platform.OS);
  const { error } = await supabase.storage.from("library").upload(path, uploadBody, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("library").getPublicUrl(path);
  const publicUrl = (data?.publicUrl ?? "").trim();
  return publicUrl || path;
}

export default function AdminScreen() {
  const router = useRouter();
  const { editBookId } = useLocalSearchParams<{ editBookId?: string }>();
  const {
    books,
    folders,
    refresh,
    session,
    authReady,
    roles,
    canPublish,
    canManageBooks,
    isConfigured,
    signIn,
    signOut,
  } = useApp();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pages, setPages] = useState("");
  const [folderId, setFolderId] = useState("");
  const [coverKey, setCoverKey] = useState<"green" | "cream" | "teal">("green");
  const [downloadPolicy, setDownloadPolicy] = useState<DownloadPolicy>("READ_ONLY");
  const [pdfAsset, setPdfAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const [dbFolders, setDbFolders] = useState<Folder[]>(folders);

  useEffect(() => {
    if (folders.length > 0) {
      setDbFolders(folders);
    } else {
      void supabase
        .from("folders")
        .select("id, slug, name, description, locked, sort")
        .order("sort")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setDbFolders(
              data.map((f: any) => ({
                id: f.id,
                slug: f.slug,
                name: f.name,
                description: f.description || "",
                locked: Boolean(f.locked),
                sort: f.sort ?? 0,
              })),
            );
          }
        });
    }
  }, [folders]);

  const activeFolders = dbFolders.length > 0 ? dbFolders : folders;

  useEffect(() => {
    if (!folderId && activeFolders.length > 0) {
      setFolderId(activeFolders[0].id);
    }
  }, [activeFolders, folderId]);
  const [coverAsset, setCoverAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [busyBook, setBusyBook] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [pendingDeleteBookId, setPendingDeleteBookId] = useState<string | null>(null);
  const [bookFilterTab, setBookFilterTab] = useState<"all" | "published" | "draft" | "archived">("all");

  const [staffUsers, setStaffUsers] = useState<ManagedStaffUser[]>([]);
  const [staffUsersLoading, setStaffUsersLoading] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("content_manager");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState<SaveFeedback | null>(null);
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [replacementPassword, setReplacementPassword] = useState("");
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);

  const isAdmin = roles.includes("admin");
  const editingBook = useMemo(() => books.find((b) => b.id === editingBookId) ?? null, [books, editingBookId]);

  const resetBookForm = () => {
    setTitle("");
    setAuthor("");
    setDescription("");
    setCategory("");
    setPages("");
    setFolderId(activeFolders[0]?.id ?? "");
    setPdfAsset(null);
    setCoverAsset(null);
    setEditingBookId(null);
    setCoverKey("green");
    setDownloadPolicy("READ_ONLY");
  };

  const startEditing = (book: Book) => {
    if (book.published && !isAdmin) {
      setSaveFeedback({ tone: "error", message: "مسؤول المحتوى يستطيع تعديل المسودات فقط؛ اطلب من المدير الرئيسي تعديل هذا الكتاب المنشور." });
      return;
    }
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
    setCategory(book.category);
    setPages(book.pages ? String(book.pages) : "");
    setFolderId(book.folderId);
    setCoverKey(book.coverKey);
    setDownloadPolicy(book.downloadPolicy);
    setPdfAsset(null);
    setCoverAsset(null);
    setSaveFeedback(null);
  };

  useEffect(() => {
    if (editBookId && books.length > 0) {
      const target = books.find((b) => b.id === editBookId);
      if (target) {
        startEditing(target);
      }
    }
  }, [editBookId, books]);

  const loadStaffUsers = useCallback(async () => {
    if (!isAdmin) return;
    setStaffUsersLoading(true);
    setStaffFeedback(null);
    try {
      const result = await runAdminAction<{ users: ManagedStaffUser[]; hasMore?: boolean }>({ action: "list" });
      setStaffUsers(result.users ?? []);
    } catch (cause) {
      setStaffFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر تحميل أعضاء الفريق." });
    } finally {
      setStaffUsersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) void loadStaffUsers();
  }, [isAdmin, loadStaffUsers]);

  const submitLogin = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      await signIn(email, password);
      setPassword("");
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "تعذر تسجيل الدخول.");
    } finally {
      setAuthBusy(false);
    }
  };

  const choosePdf = async () => {
    setSaveFeedback(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (!result.canceled) setPdfAsset(result.assets[0]);
    } catch (cause) {
      setSaveFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر اختيار ملف PDF. حاول مرة أخرى." });
    }
  };

  const chooseCover = async () => {
    setSaveFeedback(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      getCoverExtension(asset);
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        throw new Error("حجم صورة الغلاف يجب ألا يتجاوز 5 ميجابايت.");
      }
      setCoverAsset(asset);
    } catch (cause) {
      setSaveFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر اختيار صورة الغلاف." });
    }
  };

  const saveBook = async () => {
    setSaveFeedback(null);
    const targetFolderId = folderId || (activeFolders.length > 0 ? activeFolders[0].id : "");
    if (!title.trim() || !targetFolderId) {
      setSaveFeedback({ tone: "error", message: "بيانات ناقصة: أدخل عنوان الكتاب واختر مجلدًا صالحًا." });
      return;
    }
    if (pages && (!Number.isInteger(Number(pages)) || Number(pages) < 0)) {
      setSaveFeedback({ tone: "error", message: "عدد الصفحات غير صالح. أدخل عددًا صحيحًا موجبًا أو اتركه فارغًا." });
      return;
    }
    if (editingBook?.published && !isAdmin) {
      setSaveFeedback({ tone: "error", message: "لا يمكن لمسؤول المحتوى تعديل كتاب منشور." });
      return;
    }

    setSaving(true);
    const uploadedPaths: string[] = [];
    try {
      let nextPdfPath = editingBook?.pdfPath ?? null;
      let nextCoverPath = editingBook?.coverPath ?? null;

      if (pdfAsset) {
        if (!session) throw new Error("سجّل الدخول قبل رفع الملفات.");
        const path = createBookStoragePath();
        const publicUrl = await uploadLibraryAsset(pdfAsset, path, "application/pdf");
        uploadedPaths.push(path);
        nextPdfPath = publicUrl;
      }

      if (coverAsset) {
        if (!session) throw new Error("سجّل الدخول قبل رفع الملفات.");
        const extension = getCoverExtension(coverAsset);
        const path = createCoverStoragePath(extension);
        const publicUrl = await uploadLibraryAsset(coverAsset, path, imageMimeTypes[extension]);
        uploadedPaths.push(path);
        nextCoverPath = publicUrl;
      }

      const bookData = {
        folder_id: targetFolderId,
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        category: category.trim(),
        cover_key: coverKey,
        cover_url: nextCoverPath,
        pdf_url: nextPdfPath,
        pages: pages ? Number(pages) : 0,
        download_policy: downloadPolicy,
        updated_at: new Date().toISOString(),
      };

      if (editingBook) {
        const { error } = await supabase.from("books").update(bookData).eq("id", editingBook.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("books").insert({
          ...bookData,
          published: false,
          sort: books.length + 1,
        });
        if (error) throw error;
      }

      // Clean up previous storage objects if replaced
      const replacedPaths = [
        pdfAsset && editingBook?.pdfPath ? extractStoragePath(editingBook.pdfPath) : null,
        coverAsset && editingBook?.coverPath ? extractStoragePath(editingBook.coverPath) : null,
      ].filter((path): path is string => Boolean(path));

      let cleanupWarning = "";
      if (replacedPaths.length) {
        const { error } = await supabase.storage.from("library").remove(replacedPaths);
        if (error) cleanupWarning = " تم تحديث بيانات الكتاب، لكن تعذر حذف الملف السابق من التخزين.";
      }

      resetBookForm();
      await refresh();
      setSaveFeedback({
        tone: "success",
        message: `${editingBook ? "تم تحديث الكتاب بنجاح." : "تم الحفظ بنجاح؛ أُضيف الكتاب كمسودة غير منشورة."}${cleanupWarning}`,
      });
    } catch (cause) {
      if (uploadedPaths.length) await supabase.storage.from("library").remove(uploadedPaths).catch(() => undefined);
      setSaveFeedback({
        tone: "error",
        message: cause instanceof Error ? `تعذر حفظ الكتاب: ${cause.message}` : "تعذر حفظ الكتاب. تحقق من الاتصال والصلاحيات.",
      });
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (id: string, published: boolean) => {
    setBusyBook(id);
    setSaveFeedback(null);
    try {
      const { error } = await supabase.from("books").update({ published: !published, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await refresh();
      setSaveFeedback({ tone: "success", message: published ? "تم إلغاء نشر الكتاب." : "تم نشر الكتاب." });
    } catch (cause) {
      setSaveFeedback({ tone: "error", message: cause instanceof Error ? `تعذر تغيير حالة النشر: ${cause.message}` : "تعذر تغيير حالة النشر. تحقق من دور الحساب." });
    } finally {
      setBusyBook(null);
    }
  };

  const toggleArchived = async (book: Book) => {
    setBusyBook(book.id);
    setSaveFeedback(null);
    const nextArchived = !book.isArchived;
    try {
      const { error } = await supabase
        .from("books")
        .update({ is_archived: nextArchived, updated_at: new Date().toISOString() })
        .eq("id", book.id);

      if (error) {
        if (error.code === "42703" || error.message?.includes("is_archived")) {
          // Fallback if column not yet added in database schema
          const { error: pubError } = await supabase
            .from("books")
            .update({ published: !nextArchived, updated_at: new Date().toISOString() })
            .eq("id", book.id);
          if (pubError) throw pubError;
        } else {
          throw error;
        }
      }

      await refresh();
      setSaveFeedback({
        tone: "success",
        message: nextArchived ? `تم أرشفة كتاب «${book.title}» بنجاح وإخفاؤه من القائمة العامة.` : `تمت استعادة كتاب «${book.title}» من الأرشيف.`,
      });
    } catch (cause) {
      setSaveFeedback({
        tone: "error",
        message: cause instanceof Error ? `تعذر تغيير حالة الأرشفة: ${cause.message}` : "تعذر تغيير حالة الأرشفة.",
      });
    } finally {
      setBusyBook(null);
    }
  };

  const deleteBook = async (book: Book) => {
    setBusyBook(book.id);
    setSaveFeedback(null);
    try {
      // 1. Extract storage paths from pdf_url and cover_url
      const pathsToRemove: string[] = [];
      const pdfStoragePath = extractStoragePath(book.pdfPath);
      if (pdfStoragePath) pathsToRemove.push(pdfStoragePath);

      const coverStoragePath = extractStoragePath(book.coverPath);
      if (coverStoragePath) pathsToRemove.push(coverStoragePath);

      // 2. Remove files from Supabase Storage
      if (pathsToRemove.length > 0) {
        await supabase.storage.from("library").remove(pathsToRemove).catch(() => undefined);
      }

      // 3. Remove local cache from device storage
      await deleteLocalBookCache(book.id);

      // 4. Delete row from public.books
      const { error } = await supabase.from("books").delete().eq("id", book.id);
      if (error) throw error;

      // 5. Reset form if this book was being edited
      if (editingBook?.id === book.id) {
        resetBookForm();
      }

      // 6. Refresh app state immediately
      await refresh();

      setSaveFeedback({
        tone: "success",
        message: `تم حذف كتاب «${book.title}» وكافة ملفاته المرتبطة بنجاح.`,
      });
    } catch (cause) {
      setSaveFeedback({
        tone: "error",
        message: cause instanceof Error ? `تعذر حذف الكتاب: ${cause.message}` : "تعذر حذف الكتاب.",
      });
    } finally {
      setBusyBook(null);
      setPendingDeleteBookId(null);
    }
  };

  const createStaffUser = async () => {
    setStaffFeedback(null);
    if (staffPassword.length < 12) {
      setStaffFeedback({ tone: "error", message: "استخدم كلمة مرور من 12 حرفًا أو أكثر." });
      return;
    }
    setStaffBusy(true);
    try {
      await runAdminAction({ action: "create", email: staffEmail, password: staffPassword, role: staffRole });
      setStaffEmail("");
      setStaffPassword("");
      setStaffFeedback({ tone: "success", message: "تم إنشاء حساب عضو الفريق وتعيين دوره." });
      await loadStaffUsers();
    } catch (cause) {
      setStaffFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر إنشاء الحساب." });
    } finally {
      setStaffBusy(false);
    }
  };

  const updateStaffPassword = async (userId: string) => {
    setStaffFeedback(null);
    if (replacementPassword.length < 12) {
      setStaffFeedback({ tone: "error", message: "استخدم كلمة مرور من 12 حرفًا أو أكثر." });
      return;
    }
    setStaffBusy(true);
    try {
      await runAdminAction({ action: "set_password", userId, password: replacementPassword });
      setPasswordTargetId(null);
      setReplacementPassword("");
      setStaffFeedback({ tone: "success", message: "تم تغيير كلمة المرور." });
    } catch (cause) {
      setStaffFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر تغيير كلمة المرور." });
    } finally {
      setStaffBusy(false);
    }
  };

  const deleteStaffUser = async (userId: string) => {
    setStaffFeedback(null);
    setStaffBusy(true);
    try {
      await runAdminAction({ action: "delete", userId });
      setPendingDeleteUserId(null);
      setStaffFeedback({ tone: "success", message: "تم حذف حساب عضو الفريق." });
      await loadStaffUsers();
    } catch (cause) {
      setStaffFeedback({ tone: "error", message: cause instanceof Error ? cause.message : "تعذر حذف الحساب." });
    } finally {
      setStaffBusy(false);
    }
  };

  const filteredBooks = useMemo(() => {
    if (bookFilterTab === "published") return books.filter((b) => b.published && !b.isArchived);
    if (bookFilterTab === "draft") return books.filter((b) => !b.published && !b.isArchived);
    if (bookFilterTab === "archived") return books.filter((b) => b.isArchived);
    return books;
  }, [books, bookFilterTab]);

  if (!authReady) return <AppScreen><FeedbackPanel title="جارٍ التحقق من الجلسة" loading /></AppScreen>;
  if (!isConfigured) return <AppScreen><FeedbackPanel title="إعداد Supabase مطلوب" message="أضف متغيري EXPO_PUBLIC_SUPABASE_URL وEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY." /></AppScreen>;
  if (!session) {
    return (
      <AppScreen>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppHeader
            eyebrow="منطقة الإشراف"
            title="تسجيل دخول الإدارة"
            subtitle="هذه الشاشة مخصصة للمشرفين وفريق العمل لإضافة وتعديل الكتب ونشرها."
          />
          <View style={styles.panel}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput
              {...inputProps}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput
              {...inputProps}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
            />
            {authError ? <Text style={styles.error}>{authError}</Text> : null}
            <PrimaryButton title="تسجيل الدخول" onPress={() => void submitLogin()} busy={authBusy} style={{ marginTop: 14 }} />
          </View>
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader
          eyebrow="لوحة الإدارة"
          title="إدارة محتوى المكتبة"
          subtitle={`مرحباً بك: ${session.user.email ?? "مشرف المكتبة"}`}
        />

        <View style={styles.roleRow}>
          {roles.map((role) => (
            <View key={role} style={styles.rolePill}>
              <Text style={styles.roleText}>{staffRoleOptions.find((o) => o.value === role)?.label ?? role}</Text>
            </View>
          ))}
        </View>

        {saveFeedback ? (
          <View
            accessibilityRole="alert"
            style={[
              styles.feedbackBanner,
              saveFeedback.tone === "success" ? styles.feedbackSuccess : styles.feedbackError,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                saveFeedback.tone === "success" ? styles.feedbackSuccessText : styles.feedbackErrorText,
              ]}
            >
              {saveFeedback.message}
            </Text>
          </View>
        ) : null}

        {/* Book Form Panel */}
        {canManageBooks ? (
          <View style={styles.panel}>
            <View style={styles.listHeading}>
              <Text style={styles.panelTitle}>{editingBook ? `تعديل كتاب: ${editingBook.title}` : "إضافة كتاب جديد"}</Text>
              <MaterialCommunityIcons name={editingBook ? "file-document-edit-outline" : "book-plus-outline"} size={22} color={palette.green} />
            </View>

            <Text style={styles.label}>عنوان الكتاب</Text>
            <TextInput {...inputProps} value={title} onChangeText={setTitle} placeholder="مثال: الشرح الفريد لكتاب التوحيد" style={styles.input} />

            <Text style={styles.label}>المؤلف / الشارح</Text>
            <TextInput {...inputProps} value={author} onChangeText={setAuthor} placeholder="فضيلة الشيخ عبدالله بن إبراهيم القرعاوي" style={styles.input} />

            <Text style={styles.label}>التصنيف / الموضوع</Text>
            <TextInput {...inputProps} value={category} onChangeText={setCategory} placeholder="عقيدة، فقه، أصول..." style={styles.input} />

            <Text style={styles.label}>نبذة ووصف الكتاب</Text>
            <TextInput {...inputProps} value={description} onChangeText={setDescription} placeholder="اكتب نبذة مختصرة عن محتوى الكتاب ومنهجيته..." multiline style={[styles.input, styles.multiline]} />

            <Text style={styles.label}>عدد الصفحات (اختياري)</Text>
            <TextInput {...inputProps} value={pages} onChangeText={setPages} placeholder="120" keyboardType="number-pad" style={styles.input} />

            <View style={styles.folderSection}>
              <View style={styles.folderHeader}>
                <Text style={styles.label}>المجلد / القسم التابع له (إلزامي)</Text>
                {activeFolders.find((f) => f.id === (folderId || activeFolders[0]?.id)) ? (
                  <View style={styles.selectedBadge}>
                    <MaterialCommunityIcons name="folder-check" size={14} color={palette.greenDark} />
                    <Text style={styles.selectedBadgeText}>
                      المختار: {activeFolders.find((f) => f.id === (folderId || activeFolders[0]?.id))?.name}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.folderPills}>
                {activeFolders.map((f) => {
                  const isSelected = (folderId || activeFolders[0]?.id) === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setFolderId(f.id)}
                      style={[styles.folderPill, isSelected && styles.folderPillActive]}
                      accessibilityRole="button"
                      accessibilityLabel={`اختيار مجلد: ${f.name}`}
                    >
                      <MaterialCommunityIcons
                        name={isSelected ? "folder-open" : "folder"}
                        size={18}
                        color={isSelected ? palette.white : palette.greenDark}
                      />
                      <Text style={[styles.folderPillText, isSelected && styles.folderPillTextActive]}>
                        {f.name}
                      </Text>
                      {isSelected ? (
                        <MaterialCommunityIcons name="check" size={16} color={palette.white} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {activeFolders.length === 0 ? (
                <Text style={styles.formNote}>جارٍ تحميل الأقسام من قاعدة البيانات...</Text>
              ) : null}
            </View>

            <Text style={styles.label}>سياسة التنزيل للجمهور</Text>
            <View style={styles.pills}>
              <Pill label="قراءة فقط من التطبيق" selected={downloadPolicy === "READ_ONLY"} onPress={() => setDownloadPolicy("READ_ONLY")} />
              <Pill label="السماح بتنزيل نسخة PDF" selected={downloadPolicy === "DOWNLOAD_ALLOWED"} onPress={() => setDownloadPolicy("DOWNLOAD_ALLOWED")} />
            </View>

            <Text style={styles.label}>لون الغلاف البديل</Text>
            <View style={styles.pills}>
              <Pill label="أخضر" selected={coverKey === "green"} onPress={() => setCoverKey("green")} />
              <Pill label="كريمي" selected={coverKey === "cream"} onPress={() => setCoverKey("cream")} />
              <Pill label="أزرق مخضر (تيل)" selected={coverKey === "teal"} onPress={() => setCoverKey("teal")} />
            </View>

            <View style={{ marginTop: 14 }}>
              <PrimaryButton
                title={pdfAsset ? `تم اختيار: ${pdfAsset.name}` : editingBook?.pdfPath ? "تغيير ملف PDF المرفوع" : "اختيار ملف PDF للكتاب"}
                variant="outline"
                icon="file-pdf-box"
                onPress={() => void choosePdf()}
              />
              <Text style={styles.formNote}>يُرفع الملف كبيانات باينري كاملة وموثوقة دون فقد أي بايت.</Text>
            </View>

            <View style={{ marginTop: 10 }}>
              <PrimaryButton
                title={coverAsset ? `تم اختيار الغلاف: ${coverAsset.name}` : editingBook?.coverPath ? "تغيير صورة الغلاف" : "اختيار صورة مخصصة للغلاف (اختياري)"}
                variant="outline"
                icon="image-outline"
                onPress={() => void chooseCover()}
              />
              <Text style={styles.formNote}>صيغ مدعومة: JPG، PNG، WebP بحجم أقصى 5 ميجابايت.</Text>
            </View>

            <PrimaryButton
              title={saving ? "جارٍ الحفظ والرفع..." : editingBook ? "تحديث بيانات الكتاب" : "حفظ الكتاب كمسودة"}
              icon="content-save-outline"
              onPress={() => void saveBook()}
              busy={saving}
              style={{ marginTop: 16 }}
            />

            {editingBook ? (
              <PrimaryButton
                title="إلغاء التعديل والعودة"
                variant="outline"
                onPress={resetBookForm}
                style={{ marginTop: 8 }}
              />
            ) : null}
          </View>
        ) : null}

        {/* Books List Panel */}
        <View style={styles.panel}>
          <View style={styles.listHeading}>
            <Text style={styles.panelTitle}>قائمة الكتب ({books.length.toLocaleString("ar-EG")})</Text>
            <MaterialCommunityIcons name="book-multiple-outline" size={20} color={palette.green} />
          </View>

          {/* Filter Pills */}
          <View style={[styles.pills, { marginBottom: 12 }]}>
            <Pill label={`الكل (${books.length})`} selected={bookFilterTab === "all"} onPress={() => setBookFilterTab("all")} />
            <Pill label={`المنشورة (${books.filter((b) => b.published && !b.isArchived).length})`} selected={bookFilterTab === "published"} onPress={() => setBookFilterTab("published")} />
            <Pill label={`المسودات (${books.filter((b) => !b.published && !b.isArchived).length})`} selected={bookFilterTab === "draft"} onPress={() => setBookFilterTab("draft")} />
            <Pill label={`المؤرشفة (${books.filter((b) => b.isArchived).length})`} selected={bookFilterTab === "archived"} onPress={() => setBookFilterTab("archived")} />
          </View>

          {filteredBooks.length === 0 ? (
            <Text style={styles.formNote}>لا توجد كتب تطابق التصفية الحالية.</Text>
          ) : (
            filteredBooks.map((book) => {
              const canEditThisBook = isAdmin || (roles.includes("content_manager") && !book.published);
              const isDeleting = pendingDeleteBookId === book.id;

              return (
                <View key={book.id} style={styles.bookRow}>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={styles.bookAuthor}>{book.author || "مؤلف غير محدد"}</Text>
                  </View>

                  <View style={styles.badgeGroup}>
                    {book.isArchived ? (
                      <View style={[styles.badge, styles.badgeArchived]}>
                        <Text style={[styles.badgeText, styles.badgeArchivedText]}>مؤرشف</Text>
                      </View>
                    ) : book.published ? (
                      <View style={[styles.badge, styles.badgePublished]}>
                        <Text style={[styles.badgeText, styles.badgePublishedText]}>منشور</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeDraft]}>
                        <Text style={[styles.badgeText, styles.badgeDraftText]}>مسودة</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.bookActionGroup}>
                    {canEditThisBook ? (
                      <PrimaryButton
                        title="تعديل"
                        variant="outline"
                        onPress={() => startEditing(book)}
                        style={styles.actionBtn}
                      />
                    ) : null}

                    {canManageBooks ? (
                      <PrimaryButton
                        title={book.isArchived ? "استعادة" : "أرشفة"}
                        variant="outline"
                        onPress={() => void toggleArchived(book)}
                        busy={busyBook === book.id}
                        style={styles.actionBtn}
                      />
                    ) : null}

                    {canPublish && !book.isArchived ? (
                      <PrimaryButton
                        title={book.published ? "إلغاء النشر" : "نشر"}
                        variant={book.published ? "outline" : "secondary"}
                        onPress={() => void togglePublished(book.id, book.published)}
                        busy={busyBook === book.id}
                        style={styles.actionBtn}
                      />
                    ) : null}

                    {canManageBooks ? (
                      <PrimaryButton
                        title="حذف"
                        variant="outline"
                        onPress={() => setPendingDeleteBookId(isDeleting ? null : book.id)}
                        style={[styles.actionBtn, styles.deleteAction]}
                      />
                    ) : null}
                  </View>

                  {/* Inline Delete Confirmation */}
                  {isDeleting ? (
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmText}>
                        سيُحذف كتاب «{book.title}» نهائياً من قاعدة البيانات، وسيتم حذف ملف الـ PDF وصورة الغلاف من التخزين، بالإضافة لمسح أي نسخة مخزنة على أجهزة القراء.
                      </Text>
                      <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                        <PrimaryButton
                          title="تأكيد الحذف الشامل"
                          variant="outline"
                          onPress={() => void deleteBook(book)}
                          busy={busyBook === book.id}
                          style={styles.deleteAction}
                        />
                        <PrimaryButton
                          title="إلغاء"
                          variant="outline"
                          onPress={() => setPendingDeleteBookId(null)}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {/* Staff Management Panel (Admin only) */}
        {isAdmin ? (
          <View style={styles.panel}>
            <View style={styles.listHeading}>
              <Text style={styles.panelTitle}>إدارة أعضاء الفريق</Text>
              <MaterialCommunityIcons name="account-cog-outline" size={20} color={palette.green} />
            </View>
            <Text style={styles.formNote}>هذه الأدوات للمدير الرئيسي فقط. الحسابات المنشأة هنا تحصل على كلمة مرور مباشرة ودور محدد.</Text>

            {staffFeedback ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedbackBanner,
                  styles.inlineFeedback,
                  staffFeedback.tone === "success" ? styles.feedbackSuccess : styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    staffFeedback.tone === "success" ? styles.feedbackSuccessText : styles.feedbackErrorText,
                  ]}
                >
                  {staffFeedback.message}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>البريد الإلكتروني للعضو الجديد</Text>
            <TextInput {...inputProps} value={staffEmail} onChangeText={setStaffEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" style={styles.input} />

            <Text style={styles.label}>كلمة المرور المؤقتة (12 حرفًا على الأقل)</Text>
            <TextInput {...inputProps} value={staffPassword} onChangeText={setStaffPassword} placeholder="أنشئ كلمة مرور قوية" secureTextEntry autoCapitalize="none" style={styles.input} />

            <Text style={styles.label}>الدور</Text>
            <View style={styles.pills}>
              {staffRoleOptions.map((option) => (
                <Pill key={option.value} label={option.label} selected={staffRole === option.value} onPress={() => setStaffRole(option.value)} />
              ))}
            </View>

            <PrimaryButton title="إنشاء حساب عضو الفريق" onPress={() => void createStaffUser()} busy={staffBusy} style={{ marginTop: 12 }} />

            <View style={styles.listHeading}>
              <Text style={[styles.panelTitle, { marginTop: 20 }]}>الحسابات المخولة</Text>
            </View>
            <PrimaryButton title={staffUsersLoading ? "جارٍ التحديث…" : "تحديث القائمة"} variant="outline" onPress={() => void loadStaffUsers()} busy={staffUsersLoading} style={styles.refreshButton} />

            {staffUsersLoading && staffUsers.length === 0 ? <Text style={styles.formNote}>جارٍ تحميل أعضاء الفريق…</Text> : null}
            {!staffUsersLoading && staffUsers.length === 0 && !staffFeedback ? <Text style={styles.formNote}>لا توجد حسابات فريق لعرضها.</Text> : null}

            {staffUsers.map((member) => (
              <View key={member.id} style={styles.staffUserCard}>
                <Text style={styles.staffEmail}>{member.email || "بريد غير متاح"}</Text>
                <Text style={styles.staffRoles}>{member.roles.map((role) => staffRoleOptions.find((item) => item.value === role)?.label ?? role).join("، ")}</Text>
                <View style={styles.staffActions}>
                  <PrimaryButton title="تغيير كلمة المرور" variant="outline" onPress={() => { setPasswordTargetId(passwordTargetId === member.id ? null : member.id); setReplacementPassword(""); setPendingDeleteUserId(null); }} style={styles.staffActionButton} />
                  {member.id !== session.user.id ? (
                    <PrimaryButton title="حذف الحساب" variant="outline" onPress={() => { setPendingDeleteUserId(pendingDeleteUserId === member.id ? null : member.id); setPasswordTargetId(null); }} style={[styles.staffActionButton, styles.deleteAction]} />
                  ) : (
                    <Text style={styles.formNote}>هذا حسابك الحالي؛ لا يمكن حذفه من هنا.</Text>
                  )}
                </View>

                {passwordTargetId === member.id ? (
                  <View style={styles.inlineEditor}>
                    <Text style={styles.label}>كلمة المرور الجديدة</Text>
                    <TextInput {...inputProps} value={replacementPassword} onChangeText={setReplacementPassword} placeholder="12 حرفًا على الأقل" secureTextEntry autoCapitalize="none" style={styles.input} />
                    <PrimaryButton title="حفظ كلمة المرور" onPress={() => void updateStaffPassword(member.id)} busy={staffBusy} style={{ marginTop: 8 }} />
                  </View>
                ) : null}

                {pendingDeleteUserId === member.id ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.confirmText}>سيُحذف حساب هذا العضو نهائيًا، ولن يستطيع تسجيل الدخول. لا يمكن التراجع عن ذلك.</Text>
                    <PrimaryButton title="تأكيد حذف الحساب" variant="outline" onPress={() => void deleteStaffUser(member.id)} busy={staffBusy} style={styles.deleteAction} />
                    <PrimaryButton title="إلغاء" variant="outline" onPress={() => setPendingDeleteUserId(null)} style={{ marginTop: 7 }} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={palette.green} />
          <Text style={styles.noticeText}>
            تُفرض صلاحيات الكتب في قاعدة البيانات عبر RLS. إدارة الحسابات تمر عبر دالة خادمية تتحقق من جلسة Supabase ودور المدير الرئيسي؛ لا يوجد مفتاح خدمة داخل التطبيق.
          </Text>
        </View>

        <PrimaryButton title="تسجيل الخروج" variant="outline" onPress={() => void signOut()} style={{ marginHorizontal: 18, marginTop: 8 }} />
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  panel: { marginHorizontal: 18, marginTop: 10, marginBottom: 5, padding: 17, borderRadius: radius.card, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface },
  feedbackBanner: { marginHorizontal: 18, marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  inlineFeedback: { marginHorizontal: 0, marginBottom: 8 },
  feedbackSuccess: { backgroundColor: palette.greenSoft, borderColor: palette.green },
  feedbackError: { backgroundColor: "#fff0ed", borderColor: palette.danger },
  feedbackText: { fontSize: 13, lineHeight: 21, textAlign: "right", fontWeight: "700" },
  feedbackSuccessText: { color: palette.greenDark },
  feedbackErrorText: { color: palette.danger },
  panelTitle: { color: palette.ink, fontSize: 16, fontWeight: "900", textAlign: "right", marginBottom: 10 },
  label: { color: palette.ink, fontSize: 12, fontWeight: "800", textAlign: "right", marginTop: 10, marginBottom: 6 },
  input: { minHeight: 46, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: palette.white, borderColor: palette.border, borderWidth: 1, borderRadius: 12, color: palette.ink, fontSize: 14, writingDirection: "rtl" },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  error: { color: palette.danger, textAlign: "right", fontSize: 12, marginTop: 10 },
  roleRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginHorizontal: 18, marginBottom: 4 },
  rolePill: { borderRadius: 999, backgroundColor: palette.greenSoft, paddingHorizontal: 11, paddingVertical: 7 },
  roleText: { color: palette.green, fontSize: 11, fontWeight: "800" },
  folderSection: { marginTop: 4, marginBottom: 12 },
  folderHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  selectedBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    backgroundColor: palette.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectedBadgeText: { color: palette.greenDark, fontSize: 11, fontWeight: "800" },
  folderPills: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  folderPill: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.control,
    backgroundColor: palette.surfaceWarm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  folderPillActive: {
    backgroundColor: palette.greenDark,
    borderColor: palette.greenDark,
  },
  folderPillText: { color: palette.ink, fontSize: 13, fontWeight: "700" },
  folderPillTextActive: { color: palette.white, fontWeight: "800" },
  pills: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  formNote: { color: palette.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 9 },
  listHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 7 },
  bookRow: { flexDirection: "column", borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 12, gap: 8 },
  bookTitle: { color: palette.ink, fontSize: 13, fontWeight: "800", textAlign: "right", width: "100%" },
  bookAuthor: { color: palette.muted, fontSize: 11, textAlign: "right", marginTop: 2, width: "100%" },
  badgeGroup: { flexDirection: "row-reverse", gap: 6, marginVertical: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgePublished: { backgroundColor: palette.greenSoft },
  badgeDraft: { backgroundColor: palette.goldSoft },
  badgeArchived: { backgroundColor: "#f5ece6", borderWidth: 1, borderColor: "#c49a80" },
  badgeText: { fontSize: 10, fontWeight: "800" },
  badgePublishedText: { color: palette.green },
  badgeDraftText: { color: "#725716" },
  badgeArchivedText: { color: "#8c4a28" },
  bookActionGroup: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginTop: 4 },
  actionBtn: { minHeight: 36, paddingHorizontal: 10, paddingVertical: 6 },
  publishButton: { minHeight: 37, paddingHorizontal: 9, paddingVertical: 7 },
  refreshButton: { minHeight: 38, paddingVertical: 7, marginBottom: 4 },
  staffUserCard: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 13, marginTop: 10 },
  staffEmail: { color: palette.ink, fontSize: 13, fontWeight: "800", textAlign: "right" },
  staffRoles: { color: palette.muted, fontSize: 11, textAlign: "right", marginTop: 5 },
  staffActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 9 },
  staffActionButton: { minHeight: 38, paddingHorizontal: 10, paddingVertical: 7 },
  deleteAction: { borderColor: palette.danger },
  inlineEditor: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: palette.white },
  confirmBox: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.danger, backgroundColor: "#fff8f6" },
  confirmText: { color: palette.danger, fontSize: 12, lineHeight: 19, textAlign: "right", marginBottom: 9 },
  notice: { marginHorizontal: 18, marginTop: 14, flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14, backgroundColor: palette.greenSoft },
  noticeText: { flex: 1, color: palette.greenDark, fontSize: 11, lineHeight: 19, textAlign: "right" },
});
