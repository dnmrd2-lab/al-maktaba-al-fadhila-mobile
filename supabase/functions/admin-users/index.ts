import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const allowedRoles = new Set(["admin", "content_manager", "publisher"]);
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
let serverApiKey = "";
try {
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  serverApiKey = secretKeys.default ?? "";
} catch {
  serverApiKey = "";
}
serverApiKey ||= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminClient = supabaseUrl && serverApiKey
  ? createClient(supabaseUrl, serverApiKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function respond(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}

function validRole(value: unknown): value is string {
  return typeof value === "string" && allowedRoles.has(value);
}

async function requireAdmin(request: Request) {
  if (!adminClient) throw new Error("ADMIN_FUNCTION_NOT_CONFIGURED");
  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("AUTH_REQUIRED");

  const { data: authData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !authData.user) throw new Error("AUTH_REQUIRED");

  const { data: roleRows, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id);
  if (roleError) throw new Error("ROLE_CHECK_FAILED");
  if (!(roleRows ?? []).some((row) => row.role === "admin")) throw new Error("ADMIN_REQUIRED");

  return { client: adminClient, actorId: authData.user.id };
}

async function countAdmins(client: NonNullable<typeof adminClient>) {
  const { count, error } = await client
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error("ROLE_CHECK_FAILED");
  return count ?? 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "الطريقة غير مدعومة." });
  if (!adminClient) return respond(500, { error: "لم تُضبط بيئة دالة إدارة المستخدمين في Supabase." });

  try {
    const { client, actorId } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") return respond(400, { error: "الطلب غير مكتمل." });

    if (body.action === "list") {
      const page = Number.isInteger(body.page) && Number(body.page) > 0 ? Number(body.page) : 1;
      const perPage = 100;
      const { data, error } = await client.auth.admin.listUsers({ page, perPage });
      if (error) return respond(400, { error: "تعذر تحميل حسابات الفريق." });

      const ids = (data.users ?? []).map((user) => user.id);
      if (!ids.length) return respond(200, { users: [], page, hasMore: false });
      const { data: roles, error: rolesError } = await client
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      if (rolesError) return respond(400, { error: "تعذر تحميل صلاحيات الفريق." });

      const rolesByUser = new Map<string, string[]>();
      for (const entry of roles ?? []) {
        if (!rolesByUser.has(entry.user_id)) rolesByUser.set(entry.user_id, []);
        rolesByUser.get(entry.user_id)?.push(entry.role);
      }
      const users = (data.users ?? [])
        .filter((user) => rolesByUser.has(user.id))
        .map((user) => ({
          id: user.id,
          email: user.email ?? "",
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
          roles: rolesByUser.get(user.id) ?? [],
        }));
      return respond(200, { users, page, hasMore: data.users.length === perPage });
    }

    if (body.action === "create") {
      const email = normalizedEmail(body.email);
      if (!email || !validPassword(body.password) || !validRole(body.role)) {
        return respond(400, { error: "أدخل بريداً صحيحاً وكلمة مرور من 12 حرفاً على الأقل ودوراً صالحاً." });
      }
      const { data, error } = await client.auth.admin.createUser({
        email,
        password: body.password,
        email_confirm: true,
      });
      if (error || !data.user) return respond(400, { error: "تعذر إنشاء الحساب. تحقق من البريد أو إعدادات Auth." });

      const { error: roleError } = await client.from("user_roles").insert({ user_id: data.user.id, role: body.role });
      if (roleError) {
        await client.auth.admin.deleteUser(data.user.id);
        return respond(400, { error: "تعذر تعيين دور الحساب؛ أُلغي إنشاء الحساب." });
      }
      console.info("library-admin:create-user", { actorId, targetId: data.user.id, role: body.role });
      return respond(200, { success: true, user: { id: data.user.id, email } });
    }

    if (body.action === "set_password") {
      const targetId = typeof body.userId === "string" ? body.userId : "";
      if (!targetId || !validPassword(body.password)) {
        return respond(400, { error: "أدخل معرف الحساب وكلمة مرور من 12 حرفاً على الأقل." });
      }
      const { data: targetRoles, error: targetError } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);
      if (targetError || !targetRoles?.length) return respond(404, { error: "حساب الفريق غير موجود." });
      const { error } = await client.auth.admin.updateUserById(targetId, { password: body.password });
      if (error) return respond(400, { error: "تعذر تحديث كلمة المرور." });
      console.info("library-admin:set-password", { actorId, targetId });
      return respond(200, { success: true });
    }

    if (body.action === "delete") {
      const targetId = typeof body.userId === "string" ? body.userId : "";
      if (!targetId) return respond(400, { error: "معرف الحساب مطلوب." });
      if (targetId === actorId) return respond(400, { error: "لا يمكن حذف الحساب الذي تستخدمه حالياً." });

      const { data: targetRoles, error: targetError } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);
      if (targetError || !targetRoles?.length) return respond(404, { error: "حساب الفريق غير موجود." });
      if (targetRoles.some((entry) => entry.role === "admin") && await countAdmins(client) <= 1) {
        return respond(400, { error: "لا يمكن حذف المدير الرئيسي الأخير." });
      }
      const { error } = await client.auth.admin.deleteUser(targetId);
      if (error) return respond(400, { error: "تعذر حذف الحساب." });
      console.info("library-admin:delete-user", { actorId, targetId });
      return respond(200, { success: true });
    }

    return respond(400, { error: "الإجراء المطلوب غير معروف." });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") return respond(401, { error: "انتهت الجلسة أو لم يتم تسجيل الدخول." });
    if (message === "ADMIN_REQUIRED") return respond(403, { error: "إدارة حسابات الفريق متاحة للمدير الرئيسي فقط." });
    if (message === "ROLE_CHECK_FAILED") return respond(500, { error: "تعذر التحقق من صلاحيات المدير." });
    console.error("library-admin function failed", { message });
    return respond(500, { error: "حدث خطأ في خدمة إدارة الحسابات." });
  }
});
