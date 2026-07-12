import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generates a short-lived signed URL for a private course video,
 * but only after verifying the caller has access to the parent course.
 */
export const getVideoSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { videoId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: video, error: vErr } = await supabase
      .from("videos")
      .select("id, course_id, storage_path, video_url")
      .eq("id", data.videoId)
      .maybeSingle();

    if (vErr || !video) throw new Error("Video not found");

    // Gate all videos (storage & external links) by course access
    if (video.course_id) {
      const { data: access } = await supabase.rpc("has_course_access", {
        _user_id: userId, _course_id: video.course_id,
      });
      if (!access) throw new Error("Access denied. Please enroll in the course to access its modules.");
    }

    // External URL fallback
    if (!video.storage_path) {
      return { url: video.video_url ?? "", expiresIn: 0 };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage
      .from("course-videos")
      .createSignedUrl(video.storage_path, 60 * 30); // 30 min

    if (sErr || !signed) throw new Error(sErr?.message || "Failed to sign URL");
    return { url: signed.signedUrl, expiresIn: 1800 };
  });
