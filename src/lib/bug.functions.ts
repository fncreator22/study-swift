import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Silently logs any runtime errors caught in the user-facing interface,
 * storing them in public.bug_reports for administrative diagnostics.
 */
export const reportBug = createServerFn({ method: "POST" })
  .inputValidator((d: { error_message: string; error_stack?: string; route: string; user_id?: string }) => d)
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from("bug_reports" as any)
      .insert({
        user_id: data.user_id || null,
        error_message: data.error_message,
        error_stack: data.error_stack || null,
        route: data.route,
        status: "open"
      });

    if (error) {
      console.error("[BugReporter] Error writing report to database:", error.message);
    }
    return { success: !error };
  });
