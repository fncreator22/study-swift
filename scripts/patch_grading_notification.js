import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../supabase/migrations/20260715000000_intelligent_grading.sql");

let content = readFileSync(filePath, "utf-8");

const oldNotificationInsert = `  -- Create course notification
  INSERT INTO public.course_notifications_v2
    (user_id, title, body, is_read, created_at)
  SELECT 
    e.user_id,
    CASE WHEN _passed THEN '🎉 Certificate Earned!' ELSE '❌ Assessment Feedback' END,
    CASE WHEN _passed THEN 'Congratulations! You passed the assessment for course completion.'
         ELSE 'You scored ' || _final_pct::text || '%. Please review the feedback and try again.'
    END,
    false,
    now()
  FROM public.course_enrollments_v2 e
  WHERE e.id = _enroll_id;`;

const newNotificationInsert = `  -- Create course notification
  INSERT INTO public.course_notifications_v2
    (user_id, title, body, is_read, notification_type, created_at)
  SELECT 
    e.user_id,
    CASE WHEN _passed THEN '🎉 Certificate Earned!' ELSE '❌ Assessment Feedback' END,
    CASE WHEN _passed THEN 'Congratulations! You passed the assessment for course completion.'
         ELSE 'You scored ' || _final_pct::text || '%. Please review the feedback and try again.'
    END,
    false,
    CASE WHEN _passed THEN 'certificate'::TEXT ELSE 'alert'::TEXT END,
    now()
  FROM public.course_enrollments_v2 e
  WHERE e.id = _enroll_id;`;

content = content.replace(oldNotificationInsert, newNotificationInsert);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched intelligent_grading.sql notification type!");
