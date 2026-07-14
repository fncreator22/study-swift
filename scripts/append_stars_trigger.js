import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../supabase/migrations/20260715000000_intelligent_grading.sql");

let content = readFileSync(filePath, "utf-8");

const starsTriggerSql = `

-- ---------------------------------------------------------------------------
-- 8. Trigger function + trigger: update average course rating globally
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_course_average_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _course_id UUID;
  _avg_rating NUMERIC(3,2);
BEGIN
  -- Get course_id from enrollment
  SELECT course_id INTO _course_id
  FROM public.course_enrollments_v2
  WHERE id = NEW.enrollment_id;
  
  -- Calculate average satisfaction score for all feedback on this course
  SELECT round(avg(f.satisfaction_score)::NUMERIC, 2) INTO _avg_rating
  FROM public.course_feedback_v2 f
  JOIN public.course_enrollments_v2 e ON e.id = f.enrollment_id
  WHERE e.course_id = _course_id;
  
  -- Update average rating in courses_v2
  UPDATE public.courses_v2
  SET avg_rating = COALESCE(_avg_rating, 0.00)
  WHERE id = _course_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_course_average_rating ON public.course_feedback_v2;
CREATE TRIGGER trg_update_course_average_rating
  AFTER INSERT OR UPDATE ON public.course_feedback_v2
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_average_rating();
`;

// Append the trigger to the migration sql content
content = content + starsTriggerSql;

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully appended course stars average rating trigger to migration file!");
