import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resets a student's password by user ID.
 * Gated to admin callers only.
 */
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { targetUserId: string; newPassword: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is an administrator
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) throw new Error("Access denied: Admin role required");

    if (data.newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Import server admin client (bypasses RLS)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.targetUserId,
      { password: data.newPassword }
    );

    if (error) throw new Error(error.message);
    return { success: true };
  });
