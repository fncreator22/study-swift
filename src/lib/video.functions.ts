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

    const { data: lesson, error: lErr } = await supabase
      .from("course_lessons_v2")
      .select("id, module_id, video_url, video_provider, course_modules_v2(course_id)")
      .eq("id", data.videoId)
      .maybeSingle();

    if (lErr || !lesson) throw new Error("Lesson not found");

    const courseId = (lesson.course_modules_v2 as any)?.course_id;

    // Gate all videos by V2 course access
    if (courseId) {
      const { data: access } = await supabase.rpc("has_course_access_v2", {
        _user_id: userId, _course_id: courseId,
      });
      if (!access) throw new Error("Access denied. Please enroll in the course to access its modules.");
    }

    // External URL fallback
    if (lesson.video_provider !== "s3") {
      return { url: lesson.video_url ?? "", expiresIn: 0 };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage
      .from("course-videos")
      .createSignedUrl(lesson.video_url, 60 * 30); // 30 min

    if (sErr || !signed) throw new Error(sErr?.message || "Failed to sign URL");
    return { url: signed.signedUrl, expiresIn: 1800 };
  });
