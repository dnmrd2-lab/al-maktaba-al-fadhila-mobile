import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import { AppHeader, AppScreen, FeedbackPanel, Pill, PrimaryButton } from "../../components/ui";
import { type Book, type StaffRole, useApp } from "../../lib/app-context";
import {
  createBookStoragePath,
  createCoverStoragePath,
  resolveBookUploadBody,
  type LibraryImageExtension,
} from "../../lib/book-upload";
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
  png: "image/png",
  webp: "image/webp",
};

function getCoverExtension(asset: DocumentPicker.DocumentPickerAsset): LibraryImageExtension {
  const mime = asset.mimeType?.toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  const extension = asset.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "jpg";
  if (extension === "png" || extension === "webp") return extension;
  throw new Error("اختر صورة غلاف بصيغة JPG أو PNG أو WebP.");
}

async function getFunctionError(error: unknown): Promise<string> {
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof payload?.error === "string") return payload.error;
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
) {
  const uploadBody = await resolveBookUploadBody(
    asset,
    Platform.OS,
    (uri) => new ExpoFile(uri) as unknown as Blob,
  );
  const { error } = await supabase.storage.from("library").upload(path, uploadBody, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
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
    rolesLoading,
    canManageBooks,
    canPublish,
    signIn,
    signOut,
    isConfigured,
  } = useApp();
  const isAdmin = roles.includes("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyBook, setBusyBook] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [pages, setPages] = useState("");
  const [folderId, setFolderId] = useState("");
  const [coverKey, setCoverKey] = useState<"green" | "cream" | "teal">("green");
  const [pdfAsset, setPdfAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [coverAsset, setCoverAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [downloadPolicy, setDownloadPolicy] = useState<"READ_ONLY" | "DOWNLOAD_ALLOWED">("READ_ONLY");
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [staffUsers, setStaffUsers] = useState<ManagedStaffUser[]>([]);
  const [staffUsersLoading, setStaffUsersLoading] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffFeedback, setStaffFeedback] = useState<SaveFeedback | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRole>("content_manager");
  const [passwordTargetId, setPasswordTargetId] = useState<string | null>(null);
  const [replacementPassword, setReplacementPassword] = useState("");
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);

  const editingBook = useMemo(
    () => books.find((book) => book.id === editingBookId) ?? null,
    [books, editingBookId],
  );

  useEffect(() => {
    if (!folderId && folders[0]) setFolderId(folders[0].id);
  }, [folders, folderId]);

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

  const resetBookForm = () => {
    setTitle("");
    setAuthor("");
    setDescription("");
    setCategory("");
    setPages("");
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

  const saveBook = async () => {
    setSaveFeedback(null);
    if (!title.trim() || !folderId) {
      setSaveFeedback({ tone: "error", message: "بيانات ناقصة: أدخل عنوان الكتاب واختر مجلدًا." });
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
        await uploadLibraryAsset(pdfAsset, path, "application/pdf");
        uploadedPaths.push(path);
        nextPdfPath = path;
      }
      if (coverAsset) {
        if (!session) throw new Error("سجّل الدخول قبل رفع الملفات.");
        const extension = getCoverExtension(coverAsset);
        const path = createCoverStoragePath(extension);
        await uploadLibraryAsset(coverAsset, path, imageMimeTypes[extension]);
        uploadedPaths.push(path);
        nextCoverPath = path;
      }

      const bookData = {
        folder_id: folderId,
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

      const replacedPaths = [
        pdfAsset && editingBook?.pdfPath ? editingBook.pdfPath : null,
        coverAsset && editingBook?.coverPath ? editingBook.coverPath : null,
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

  if (!authReady) return <AppScreen><FeedbackPanel title="جارٍ التحقق من الجلسة" loading /></AppScreen>;
  if (!isConfigured) return <AppScreen><FeedbackPanel title="إعداد Supabase مطلوب" message="أضف متغيري EXPO_PUBLIC_SUPABASE_URL وEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY." /></AppScreen>;
  if (!session) {
    return (
      <AppScreen>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader eyebrow="لأعضاء الفريق فقط" title="دخول الإدارة" subtitle="لا يوجد تسجيل عام؛ يستخدم الفريق حسابات Supabase المعتمدة." />
          <View style={styles.panel}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <TextInput {...inputProps} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" style={styles.input} returnKeyType="next" />
            <Text style={styles.label}>كلمة المرور</Text>
            <TextInput {...inputProps} value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry autoCapitalize="none" style={styles.input} onSubmitEditing={() => void submitLogin()} returnKeyType="go" />
            {authError ? <Text style={styles.error}>{authError}</Text> : null}
            <PrimaryButton title="تسجيل الدخول" onPress={() => void submitLogin()} busy={authBusy} style={{ marginTop: 12 }} />
          </View>
          <PrimaryButton title="العودة للمكتبة" variant="outline" onPress={() => router.back()} style={{ marginHorizontal: 18, marginTop: 10 }} />
        </ScrollView>
      </AppScreen>
    );
  }
  if (rolesLoading) return <AppScreen><FeedbackPanel title="جارٍ التحقق من الصلاحيات" loading /></AppScreen>;
  if (!roles.length) {
    return <AppScreen><FeedbackPanel title="ليس لهذا الحساب صلاحية إدارة" message="تواصل مع مدير المكتبة لإضافة دور مناسب إلى حسابك." action="تسجيل الخروج" onAction={() => void signOut()} /></AppScreen>;
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader eyebrow="منطقة محمية" title="إدارة المكتبة" subtitle={`الحساب: ${session.user.email ?? "عضو فريق"}`} />
        <View style={styles.roleRow}>{roles.map((role) => <View key={role} style={styles.rolePill}><Text style={styles.roleText}>{role === "admin" ? "المدير الرئيسي" : role === "content_manager" ? "مسؤول المحتوى" : "مسؤول النشر"}</Text></View>)}</View>
        {saveFeedback ? (
          <View accessibilityRole="alert" style={[styles.feedbackBanner, saveFeedback.tone === "success" ? styles.feedbackSuccess : styles.feedbackError]}>
            <Text style={[styles.feedbackText, saveFeedback.tone === "success" ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{saveFeedback.message}</Text>
          </View>
        ) : null}

        {canManageBooks ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{editingBook ? "تعديل بيانات الكتاب" : "إضافة كتاب"}</Text>
            <Text style={styles.label}>العنوان *</Text><TextInput {...inputProps} value={title} onChangeText={setTitle} placeholder="عنوان الكتاب" style={styles.input} />
            <Text style={styles.label}>المؤلف</Text><TextInput {...inputProps} value={author} onChangeText={setAuthor} placeholder="اسم المؤلف" style={styles.input} />
            <Text style={styles.label}>التصنيف</Text><TextInput {...inputProps} value={category} onChangeText={setCategory} placeholder="العقيدة، الفقه…" style={styles.input} />
            <Text style={styles.label}>الوصف أو جزء من المسودة</Text><TextInput {...inputProps} value={description} onChangeText={setDescription} placeholder="نبذة مختصرة أو ملاحظات المسودة" multiline style={[styles.input, styles.multiline]} />
            <Text style={styles.label}>عدد الصفحات</Text><TextInput {...inputProps} value={pages} onChangeText={setPages} placeholder="اختياري" keyboardType="number-pad" style={styles.input} />
            <Text style={styles.label}>المجلد</Text><View style={styles.pills}>{folders.map((folder) => <Pill key={folder.id} label={folder.name} selected={folderId === folder.id} onPress={() => setFolderId(folder.id)} />)}</View>
            
            <Text style={styles.label}>لون الغلاف البديل</Text><View style={styles.pills}>{(["green", "cream", "teal"] as const).map((key) => <Pill key={key} label={key === "green" ? "أخضر" : key === "cream" ? "عاجي" : "فيروزي"} selected={coverKey === key} onPress={() => setCoverKey(key)} />)}</View>
            <Text style={styles.label}>سياسة التنزيل</Text><View style={styles.pills}>
              <Pill label="قراءة فقط من الواجهة" selected={downloadPolicy === "READ_ONLY"} onPress={() => setDownloadPolicy("READ_ONLY")} />
              <Pill label="السماح بتنزيل النسخة" selected={downloadPolicy === "DOWNLOAD_ALLOWED"} onPress={() => setDownloadPolicy("DOWNLOAD_ALLOWED")} />
            </View>
            <PrimaryButton title={coverAsset ? `صورة: ${coverAsset.name}` : editingBook?.coverPath ? "استبدال صورة الغلاف (اختياري)" : "اختيار صورة غلاف (اختياري)"} variant="outline" onPress={() => void chooseCover()} style={{ marginTop: 12 }} />
            <PrimaryButton title={pdfAsset ? `PDF: ${pdfAsset.name}` : editingBook?.pdfPath ? "استبدال ملف PDF (اختياري)" : "اختيار ملف PDF (اختياري)"} variant="outline" onPress={() => void choosePdf()} style={{ marginTop: 8 }} />
            <Text style={styles.formNote}>صور الأغلفة بصيغ JPG أو PNG أو WebP وبحد أقصى 5 ميجابايت. استبدال ملف يحذف النسخة السابقة بعد نجاح حفظ التعديل.</Text>
            <PrimaryButton title={saving ? "جارٍ الحفظ…" : editingBook ? "حفظ التعديلات" : "حفظ كمسودة"} onPress={() => void saveBook()} busy={saving} style={{ marginTop: 10 }} />
            {editingBook ? <PrimaryButton title="إلغاء التعديل" variant="outline" onPress={resetBookForm} style={{ marginTop: 8 }} /> : null}
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.listHeading}><Text style={styles.panelTitle}>الكتب ({books.length.toLocaleString("ar-EG")})</Text><MaterialCommunityIcons name="book-multiple-outline" size={20} color={palette.green} /></View>
          {books.length === 0 ? <Text style={styles.formNote}>لا توجد كتب في القائمة حاليًا.</Text> : books.map((book) => {
            const canEditThisBook = roles.includes("admin") || (roles.includes("content_manager") && !book.published);
            return (
              <View key={book.id} style={styles.bookRow}>
                <View style={{ flex: 1, alignItems: "flex-end" }}><Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text><Text style={styles.bookAuthor}>{book.author || "مؤلف غير محدد"}</Text></View>
                <View style={[styles.badge, book.published ? styles.badgePublished : styles.badgeDraft]}><Text style={[styles.badgeText, book.published ? styles.badgePublishedText : styles.badgeDraftText]}>{book.published ? "منشور" : "مسودة"}</Text></View>
                {canEditThisBook ? <PrimaryButton title="تعديل" variant="outline" onPress={() => startEditing(book)} style={styles.publishButton} /> : null}
                {canPublish ? <PrimaryButton title={book.published ? "إلغاء النشر" : "نشر"} variant={book.published ? "outline" : "secondary"} onPress={() => void togglePublished(book.id, book.published)} busy={busyBook === book.id} style={styles.publishButton} /> : null}
              </View>
            );
          })}
        </View>

        {isAdmin ? (
          <View style={styles.panel}>
            <View style={styles.listHeading}>
              <Text style={styles.panelTitle}>إدارة أعضاء الفريق</Text>
              <MaterialCommunityIcons name="account-cog-outline" size={20} color={palette.green} />
            </View>
            <Text style={styles.formNote}>هذه الأدوات للمدير الرئيسي فقط. الحسابات المنشأة هنا تحصل على كلمة مرور مباشرة ودور محدد.</Text>
            {staffFeedback ? <View accessibilityRole="alert" style={[styles.feedbackBanner, styles.inlineFeedback, staffFeedback.tone === "success" ? styles.feedbackSuccess : styles.feedbackError]}><Text style={[styles.feedbackText, staffFeedback.tone === "success" ? styles.feedbackSuccessText : styles.feedbackErrorText]}>{staffFeedback.message}</Text></View> : null}
            <Text style={styles.label}>البريد الإلكتروني للعضو الجديد</Text>
            <TextInput {...inputProps} value={staffEmail} onChangeText={setStaffEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>كلمة المرور المؤقتة (12 حرفًا على الأقل)</Text>
            <TextInput {...inputProps} value={staffPassword} onChangeText={setStaffPassword} placeholder="أنشئ كلمة مرور قوية" secureTextEntry autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>الدور</Text>
            <View style={styles.pills}>{staffRoleOptions.map((option) => <Pill key={option.value} label={option.label} selected={staffRole === option.value} onPress={() => setStaffRole(option.value)} />)}</View>
            <PrimaryButton title="إنشاء حساب عضو الفريق" onPress={() => void createStaffUser()} busy={staffBusy} style={{ marginTop: 12 }} />
            <View style={styles.listHeading}><Text style={[styles.panelTitle, { marginTop: 20 }]}>الحسابات المخولة</Text></View>
            <PrimaryButton title={staffUsersLoading ? "جارٍ التحديث…" : "تحديث القائمة"} variant="outline" onPress={() => void loadStaffUsers()} busy={staffUsersLoading} style={styles.refreshButton} />
            {staffUsersLoading && staffUsers.length === 0 ? <Text style={styles.formNote}>جارٍ تحميل أعضاء الفريق…</Text> : null}
            {!staffUsersLoading && staffUsers.length === 0 && !staffFeedback ? <Text style={styles.formNote}>لا توجد حسابات فريق لعرضها.</Text> : null}
            {staffUsers.map((member) => (
              <View key={member.id} style={styles.staffUserCard}>
                <Text style={styles.staffEmail}>{member.email || "بريد غير متاح"}</Text>
                <Text style={styles.staffRoles}>{member.roles.map((role) => staffRoleOptions.find((item) => item.value === role)?.label ?? role).join("، ")}</Text>
                <View style={styles.staffActions}>
                  <PrimaryButton title="تغيير كلمة المرور" variant="outline" onPress={() => { setPasswordTargetId(passwordTargetId === member.id ? null : member.id); setReplacementPassword(""); setPendingDeleteUserId(null); }} style={styles.staffActionButton} />
                  {member.id !== session.user.id ? <PrimaryButton title="حذف الحساب" variant="outline" onPress={() => { setPendingDeleteUserId(pendingDeleteUserId === member.id ? null : member.id); setPasswordTargetId(null); }} style={[styles.staffActionButton, styles.deleteAction]} /> : <Text style={styles.formNote}>هذا حسابك الحالي؛ لا يمكن حذفه من هنا.</Text>}
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

        <View style={styles.notice}><MaterialCommunityIcons name="shield-check-outline" size={18} color={palette.green} /><Text style={styles.noticeText}>تُفرض صلاحيات الكتب في قاعدة البيانات عبر RLS. إدارة الحسابات تمر عبر دالة خادمية تتحقق من جلسة Supabase ودور المدير الرئيسي؛ لا يوجد مفتاح خدمة داخل التطبيق.</Text></View>
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
  pills: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  formNote: { color: palette.muted, fontSize: 11, lineHeight: 18, textAlign: "right", marginTop: 9 },
  listHeading: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 7 },
  bookRow: { flexDirection: "row-reverse", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 12, flexWrap: "wrap" },
  bookTitle: { color: palette.ink, fontSize: 12, fontWeight: "800", textAlign: "right" },
  bookAuthor: { color: palette.muted, fontSize: 10, textAlign: "right", marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  badgePublished: { backgroundColor: palette.greenSoft },
  badgeDraft: { backgroundColor: palette.goldSoft },
  badgeText: { fontSize: 9, fontWeight: "800" },
  badgePublishedText: { color: palette.green },
  badgeDraftText: { color: "#725716" },
  publishButton: { minHeight: 37, paddingHorizontal: 9, paddingVertical: 7 },
  refreshButton: { minHeight: 38, paddingVertical: 7, marginBottom: 4 },
  staffUserCard: { borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 13, marginTop: 10 },
  staffEmail: { color: palette.ink, fontSize: 13, fontWeight: "800", textAlign: "right" },
  staffRoles: { color: palette.muted, fontSize: 11, textAlign: "right", marginTop: 5 },
  staffActions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginTop: 9 },
  staffActionButton: { minHeight: 38, paddingHorizontal: 10, paddingVertical: 7 },
  deleteAction: { borderColor: palette.danger },
  inlineEditor: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: palette.white },
  confirmBox: { marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.danger, backgroundColor: "#fff8f6" },
  confirmText: { color: palette.danger, fontSize: 12, lineHeight: 19, textAlign: "right", marginBottom: 9 },
  notice: { marginHorizontal: 18, marginTop: 14, flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, padding: 13, borderRadius: 14, backgroundColor: palette.greenSoft },
  noticeText: { flex: 1, color: palette.greenDark, fontSize: 11, lineHeight: 19, textAlign: "right" },
});
