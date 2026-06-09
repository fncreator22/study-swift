import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = [
  "profiles", "user_roles",
  "subscriptions", "memberships",
  "courses", "videos",
  "tests", "test_questions",
  "test_attempts", "test_answers", "test_reviews",
  "purchases", "wallet_transactions", "token_requests",
  "support_tickets", "ticket_replies",
  "comments", "settings",
] as const;

const CONFLICT_KEYS: Record<string, string> = {
  user_roles: "user_id,role",
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin only");
}

export const exportPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Record<string, any[]> = {};
    for (const t of TABLES) {
      const { data, error } = await supabaseAdmin.from(t as any).select("*");
      if (error) throw new Error(`${t}: ${error.message}`);
      out[t] = (data ?? []) as any[];
    }
    return { exported_at: new Date().toISOString(), version: 1 as const, data: out };
  });

export const importPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payload: any }) => {
    if (!input?.payload?.data || typeof input.payload.data !== "object") {
      throw new Error("Invalid backup payload");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = data.payload.data;
    let imported = 0;
    const errors: { table: string; message: string }[] = [];
    for (const t of TABLES) {
      const rows = payload[t];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const onConflict = CONFLICT_KEYS[t] ?? "id";
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500);
        const { error } = await supabaseAdmin
          .from(t as any)
          .upsert(chunk as any, { onConflict, ignoreDuplicates: false });
        if (error) errors.push({ table: t, message: error.message });
        else imported += chunk.length;
      }
    }
    return { imported, errors };
  });
